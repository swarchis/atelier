import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';
import { useProducts } from './ProductsContext.jsx';
import { useVendors } from './VendorsContext.jsx';
import { useProduction } from './ProductionContext.jsx';
import { useMaterials } from './MaterialsContext.jsx';
import { useTeam } from './TeamContext.jsx';
import { aiPost } from '../lib/aiApi.js';

const ChatContext = createContext(null);

// No realtime infrastructure exists elsewhere in this app (every context is
// fetch-on-mount + manual refresh) — this follows that same convention with
// a light poll while the chat panel is open, instead of introducing
// Supabase Realtime as a one-off for this single feature.
const POLL_MS = 8000;        // open thread, fallback behind Realtime
const LIST_POLL_MS = 20000;  // chat list/unread, fallback behind Realtime

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { activeBrand, products, collections } = useProducts();
  const { vendors, quotes } = useVendors();
  const { orders } = useProduction();
  const { materials } = useMaterials();
  const { members } = useTeam();

  const [aiChat, setAiChat] = useState(null);
  const [groupChats, setGroupChats] = useState([]);
  const [messagesByChat, setMessagesByChat] = useState({});
  const [loading, setLoading] = useState(true);
  const [sendingAI, setSendingAI] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const loadChats = async () => {
    if (!activeBrand || !user) { setAiChat(null); setGroupChats([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*, chat_participants(user_id, last_read_at)')
        .eq('brand_id', activeBrand.id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      let mine = (data || []).find(c => c.type === 'ai' && c.created_by === user.id);
      if (!mine) {
        const { data: created, error: createError } = await supabase
          .from('chats')
          .insert([{ brand_id: activeBrand.id, type: 'ai', name: 'AI Assistant', created_by: user.id }])
          .select()
          .single();
        const { data: rpcResult, error: rpcError } = createError
          ? await supabase.rpc('ensure_personal_ai_chat', { p_brand_id: activeBrand.id })
          : { data: null, error: null };
        const rpcCreated = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
        // Surfaced (not just console.error'd) since this was previously the
        // most common silent failure — migration 016 not run, or its RLS
        // policies not applied — and swallowing it just made the AI
        // Assistant entry mysteriously vanish with no way to tell why.
        // Kept non-fatal to the rest of loadChats so a broken AI-chat
        // insert never takes working group chats down with it.
        if (rpcError) {
          console.error('AI chat creation failed', { createError, rpcError, brandId: activeBrand.id, userId: user.id });
          setLoadError(rpcError.message || createError.message);
        }
        else mine = created || rpcCreated;
      }
      setAiChat(mine || null);

      const groups = (data || []).filter(c => c.type === 'group');
      const groupIds = groups.map(c => c.id);
      let lastMsgMap = {};
      if (groupIds.length) {
        const { data: latest } = await supabase
          .from('chat_messages')
          .select('chat_id, created_at')
          .in('chat_id', groupIds)
          .order('created_at', { ascending: false });
        (latest || []).forEach(m => { if (!lastMsgMap[m.chat_id]) lastMsgMap[m.chat_id] = m.created_at; });
      }
      setGroupChats(groups.map(c => {
        const mineParticipant = (c.chat_participants || []).find(p => p.user_id === user.id);
        const lastMessageAt = lastMsgMap[c.id] || null;
        const unread = !!(lastMessageAt && (!mineParticipant || new Date(lastMessageAt) > new Date(mineParticipant.last_read_at)));
        return { ...c, lastMessageAt, unread };
      }));
    } catch (err) {
      console.error('Error loading chats:', err);
      setLoadError(err.message || String(err));
      setAiChat(null);
      setGroupChats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChats(); }, [activeBrand?.id, user?.id]);

  // ── Live updates ───────────────────────────────────────────────────────────
  // Chat used to only change on page reload: the message poll ran solely while
  // a thread was open, and the chat LIST never refreshed at all, so new chats
  // and unread badges never appeared. Realtime pushes inserts over a websocket
  // (RLS still applies, so you only receive rows you could already read), and
  // a slow poll stays behind it as a safety net — without that, a silent
  // realtime failure would look exactly like the original bug.
  useEffect(() => {
    if (!activeBrand?.id || !user?.id) return undefined;

    // New messages arrive constantly during a conversation; refreshing the
    // whole chat list on each one would hammer the database, so coalesce.
    let listRefresh = null;
    const refreshListSoon = () => {
      if (listRefresh) return;
      listRefresh = setTimeout(() => { listRefresh = null; loadChats(); }, 1500);
    };

    const channel = supabase
      .channel(`chat-brand-${activeBrand.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new;
        if (!msg?.chat_id) return;
        setMessagesByChat(prev => {
          const thread = prev[msg.chat_id];
          if (!thread) return prev;                              // not loaded — the list refresh covers it
          if (thread.some(m => m.id === msg.id)) return prev;    // already have it (e.g. our own send)
          return { ...prev, [msg.chat_id]: [...thread, msg] };
        });
        refreshListSoon();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, refreshListSoon)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_participants' }, refreshListSoon)
      .subscribe();

    return () => {
      if (listRefresh) clearTimeout(listRefresh);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.id, user?.id]);

  // Fallback poll for the chat list (new chats, unread badges, ordering) in
  // case Realtime isn't available — the table isn't published, or a network
  // blocks websockets.
  useEffect(() => {
    if (!activeBrand?.id || !user?.id) return undefined;
    const timer = setInterval(() => { loadChats(); }, LIST_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.id, user?.id]);

  const loadMessages = async (chatId) => {
    if (!chatId) return [];
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) { console.error('Error loading messages:', error); return messagesByChat[chatId] || []; }
    setMessagesByChat(prev => ({ ...prev, [chatId]: data || [] }));
    return data || [];
  };

  // Every teammate who has a real user_id (i.e. actually claimed their
  // invite), plus the brand owner if the current user isn't the owner —
  // pending/unclaimed invites have no auth user yet and can't be added.
  const addableMembers = [
    ...(activeBrand && activeBrand.user_id && activeBrand.user_id !== user?.id
      ? [{ user_id: activeBrand.user_id, invited_email: 'Brand owner', role: 'owner' }]
      : []),
    ...members.filter(m => m.status === 'active' && m.user_id && m.user_id !== user?.id),
  ];

  const createGroupChat = async ({ name, participantUserIds }) => {
    if (!activeBrand || !user) throw new Error('No active brand');
    // Definer-rights RPC: creating the chat and its participant rows in one
    // transaction avoids the RLS insert failure ("new row violates row-level
    // security policy for table chats") that the direct insert path hits, and
    // guarantees a chat is never left with no members. The creator is always
    // added as a participant so their own last_read_at is tracked like
    // everyone else's — otherwise their own chat always looks unread.
    const { data: chat, error } = await supabase.rpc('create_group_chat', {
      p_brand_id: activeBrand.id,
      p_name: name?.trim() || 'New chat',
      p_participant_ids: [...new Set(participantUserIds || [])],
    });
    if (error) throw error;
    const created = Array.isArray(chat) ? chat[0] : chat;
    setGroupChats(prev => [...prev, created]);
    return created;
  };

  const addParticipant = async (chatId, userId) => {
    const { error } = await supabase.from('chat_participants').insert([{ chat_id: chatId, user_id: userId }]);
    if (error) throw error;
  };

  const markRead = async (chatId) => {
    if (!chatId) return;
    setGroupChats(prev => prev.map(c => (c.id === chatId ? { ...c, unread: false } : c)));
    const { data } = await supabase.from('chat_participants').select('id').eq('chat_id', chatId).eq('user_id', user.id).maybeSingle();
    if (data) {
      await supabase.from('chat_participants').update({ last_read_at: new Date().toISOString() }).eq('id', data.id);
    }
  };

  // Flattens whatever's already loaded in the other brand contexts into a
  // compact text block for the AI prompt — no extra queries, and capped so a
  // brand with a huge catalog doesn't blow out the prompt.
  const buildBrandContext = () => {
    if (!activeBrand) return '';
    const lines = [`Brand: ${activeBrand.name} (plan: ${activeBrand.plan_tier || 'free'})`];

    lines.push(`\nProducts (${products.length}):`);
    lines.push(products.slice(0, 40).map(p => `- ${p.name}: stage=${p.stage}, status=${p.status || 'active'}, readiness=${p.readiness}%, risk=${p.risk}, budget=$${p.budget || 0}, category=${p.category || 'uncategorized'}`).join('\n') || 'None yet.');

    lines.push(`\nCollections (${collections.length}): ${collections.map(c => c.name).join(', ') || 'None yet.'}`);

    lines.push(`\nVendors (${vendors.length}):`);
    lines.push(vendors.slice(0, 40).map(v => `- ${v.name}: category=${v.category || '—'}, location=${v.location || '—'}, MOQ=${v.moq ?? '—'}, lead time=${v.lead_time || '—'}, price=${v.price_range || '—'}, rating=${v.rating ?? '—'}, trust label=${v.label}`).join('\n') || 'None yet.');

    const openQuotes = quotes.filter(q => q.status === 'Requested' || q.status === 'Received');
    lines.push(`\nOpen quotes (${openQuotes.length}): ${openQuotes.slice(0, 20).map(q => `${q.products?.name || 'product'} <- ${q.vendors?.name || 'vendor'} (${q.status}${q.amount ? `, $${q.amount}` : ''})`).join('; ') || 'None.'}`);

    lines.push(`\nProduction orders (${orders.length}): ${orders.slice(0, 20).map(o => `${o.products?.name || 'product'} via ${o.vendors?.name || 'vendor'}: ${o.stage}, due ${o.due_date || 'unset'}, ${o.units || '—'} units`).join('; ') || 'None.'}`);

    lines.push(`\nMaterials library (${materials.length}): ${materials.slice(0, 20).map(m => m.name).join(', ') || 'None.'}`);

    return lines.join('\n');
  };

  const sendMessage = async (chat, body) => {
    if (!chat || !body.trim()) return;
    const { data: userMsg, error } = await supabase
      .from('chat_messages')
      .insert([{ chat_id: chat.id, sender_id: user.id, sender_type: 'user', body: body.trim() }])
      .select()
      .single();
    if (error) throw error;
    setMessagesByChat(prev => ({ ...prev, [chat.id]: [...(prev[chat.id] || []), userMsg] }));

    if (chat.type === 'ai') {
      setSendingAI(true);
      try {
        const history = (messagesByChat[chat.id] || []).map(m => ({ senderType: m.sender_type, body: m.body }));
        const res = await aiPost('/api/chat-reply', { message: body.trim(), history, brandContext: buildBrandContext() });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        const { data: aiMsg, error: aiError } = await supabase
          .from('chat_messages')
          .insert([{ chat_id: chat.id, sender_id: null, sender_type: 'ai', body: data.reply }])
          .select()
          .single();
        if (aiError) throw aiError;
        setMessagesByChat(prev => ({ ...prev, [chat.id]: [...(prev[chat.id] || []), aiMsg] }));
      } finally {
        setSendingAI(false);
      }
    }
    return userMsg;
  };

  const hasUnread = groupChats.some(c => c.unread);

  return (
    <ChatContext.Provider value={{
      aiChat, groupChats, messagesByChat, loading, sendingAI, hasUnread, loadError,
      addableMembers, loadMessages, sendMessage, createGroupChat, addParticipant, markRead,
      refresh: loadChats, pollMs: POLL_MS,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}

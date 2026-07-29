import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { apiPost } from '../lib/aiApi.js';
import { useProducts } from './ProductsContext.jsx';

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const { activeBrand } = useProducts();
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  // The brand's real posts pulled from the platforms, as opposed to `posts`,
  // which is what they planned in here. Two different things that used to get
  // conflated in Analytics.
  const [syncedPosts, setSyncedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!activeBrand) {
      setAccounts([]); setPosts([]); setSyncedPosts([]); setLoading(false); return;
    }
    setLoading(true);
    try {
      // Columns listed explicitly, NOT select('*'). 054 revoked table-level
      // SELECT and granted it back per column, and `select *` requires the
      // table-level privilege — per-column grants do not satisfy it. With '*'
      // this returns a permission error, which loadData swallows, so every
      // connected account silently renders as "Not connected".
      //
      // stats_synced_at arrives in 055 and is dropped on retry if it isn't there
      // yet — an out-of-date database should lose the "synced at" label, not the
      // whole accounts list. Same pattern as psd_url elsewhere.
      const ACCOUNT_COLUMNS = 'id, brand_id, platform, handle, followers, connected, created_at, token_expires_at';
      let { data: accData, error: accError } = await supabase
        .from('social_accounts')
        .select(`${ACCOUNT_COLUMNS}, stats_synced_at`)
        .eq('brand_id', activeBrand.id);
      if (accError && /stats_synced_at/.test(accError.message || '')) {
        ({ data: accData, error: accError } = await supabase
          .from('social_accounts')
          .select(ACCOUNT_COLUMNS)
          .eq('brand_id', activeBrand.id));
      }
      if (accError) throw accError;
      const { data: postData } = await supabase.from('content_posts').select('*, products(name)').eq('brand_id', activeBrand.id).order('scheduled_for', { ascending: false });
      const { data: syncedData } = await supabase
        .from('social_posts_synced')
        .select('*')
        .eq('brand_id', activeBrand.id)
        .order('posted_at', { ascending: false });

      setAccounts(accData || []);
      setPosts(postData || []);
      setSyncedPosts(syncedData || []);
    } catch (err) {
      console.error('Error loading content:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeBrand]);

  // connectAccount() used to live here and upsert the row with the tokens the
  // browser had just been handed. It is gone deliberately: migration 054 revokes
  // the client's INSERT/UPDATE on social_accounts and makes the token columns
  // unreadable, and the backend now writes the row in the OAuth callback with the
  // service-role key. Anything calling this from the client could only fail with
  // a permission error, so there is nothing to keep. The connect flow reloads via
  // refresh() instead.
  //
  // No follower count is fabricated. `followers` stays at its default until a
  // platform read actually populates it.
  const disconnectAccount = async (id) => {
    const account = accounts.find(a => a.id === id);
    await supabase.from('social_accounts').delete().eq('id', id);
    // Drop the cached metrics too. Leaving them means Analytics keeps reporting
    // on an account the user just disconnected, which reads as us still being
    // connected to it.
    if (account) {
      await supabase.from('social_posts_synced').delete()
        .eq('brand_id', account.brand_id).eq('platform', account.platform);
      setSyncedPosts(prev => prev.filter(p => p.platform !== account.platform));
    }
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  // Pulls the real numbers from the platform. The backend holds the token and
  // does the fetching; this only asks and then reloads.
  const syncAccount = async (platform) => {
    const res = await apiPost(`/api/social/sync/${platform}`, { brandId: activeBrand.id });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not sync that account.');
    await loadData();
    return data;
  };

  const schedulePost = async (postData) => {
    const { data, error } = await supabase.from('content_posts').insert([{
      brand_id: activeBrand.id, ...postData
    }]).select('*, products(name)').single();
    if (error) throw error;
    setPosts(prev => [data, ...prev].sort((a,b) => new Date(b.scheduled_for) - new Date(a.scheduled_for)));
  };

  const updatePostStatus = async (id, status) => {
    const { error } = await supabase.from('content_posts').update({ status }).eq('id', id);
    if (error) throw error;
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  return (
    <ContentContext.Provider value={{ accounts, posts, syncedPosts, loading, disconnectAccount, syncAccount, schedulePost, updatePostStatus, refresh: loadData }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used inside ContentProvider');
  return ctx;
}
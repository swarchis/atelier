import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useProducts } from './ProductsContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { useUserPreferences } from './UserPreferencesContext.jsx';
import { apiPost } from '../lib/aiApi.js';

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const { activeBrand } = useProducts();
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = async () => {
    if (!activeBrand) { setMembers([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brand_members')
        .select('*')
        .eq('brand_id', activeBrand.id)
        .order('invited_at', { ascending: true });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Error loading team members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMembers(); }, [activeBrand?.id]);

  useEffect(() => {
    if (!user?.email) return;
    async function claimInvites() {
      const { data: pending } = await supabase
        .from('brand_members')
        .select('id')
        .eq('invited_email', user.email)
        .is('user_id', null);
      if (!pending || pending.length === 0) return;
      // Seed a display name from the user's own profile so teammates see a
      // person, not an email address. They can change it any time (and are
      // prompted to if it's still blank).
      const { data: prefs } = await supabase
        .from('user_preferences').select('full_name').eq('user_id', user.id).maybeSingle();
      const seededName = prefs?.full_name?.trim() || null;
      await Promise.all(pending.map(row =>
        supabase.from('brand_members').update({
          user_id: user.id,
          status: 'active',
          joined_at: new Date().toISOString(),
          ...(seededName ? { display_name: seededName } : {}),
        }).eq('id', row.id)
      ));
      loadMembers();
    }
    claimInvites();
  }, [user?.id]);

  // The current user's membership row on this brand (owners have none).
  const myMembership = members.find(m => m.user_id === user?.id) || null;
  // Prompt-worthy: they've joined as a member but are still shown as an email.
  const needsDisplayName = !!myMembership && !myMembership.display_name;

  const setMyDisplayName = async (name) => {
    const clean = (name || '').trim();
    if (!clean || !user?.id) return;
    // Name themselves across every brand they belong to, so they aren't a
    // different anonymous email on each one.
    const { error } = await supabase
      .from('brand_members').update({ display_name: clean }).eq('user_id', user.id);
    if (error) throw error;
    setMembers(prev => prev.map(m => (m.user_id === user.id ? { ...m, display_name: clean } : m)));

    // Brands they OWN have no membership row to carry the name, so mirror it
    // onto the brand itself — that's the only copy teammates can read.
    await supabase.from('brands').update({ owner_display_name: clean }).eq('user_id', user.id);
  };

  const myRole = activeBrand?.memberRole || 'owner';
  const canManage = myRole === 'owner' || myRole === 'admin';

  const inviteMember = async (email, role) => {
    if (!activeBrand) throw new Error('No active brand');
    const targetEmail = email.trim().toLowerCase();

    // 1. Save Invite to Database
    const { data, error } = await supabase
      .from('brand_members')
      .insert([{ brand_id: activeBrand.id, invited_email: targetEmail, role }])
      .select()
      .single();
    if (error) throw error;
    
    setMembers(prev => [...prev, data]);

    // 2. Dispatch the Email via our Backend. Authenticated + brand-scoped now:
    // the endpoint sends from our own verified domain, so it checks the caller
    // actually belongs to the brand named in the invite.
    // The membership row above is already saved, so a failed email is not a
    // failed invite — it is an invite the person was never told about. Returning
    // the reason lets the caller say that, instead of the old behaviour: the
    // response was never inspected at all, so every invite looked sent even when
    // the backend had refused it outright.
    let emailError = null;
    try {
      const res = await apiPost('/api/send-invite', {
        email: targetEmail,
        brandId: activeBrand.id,
        brandName: activeBrand.name,
        inviterName: preferences?.full_name || user?.email,
        role: role,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) emailError = payload?.error || `Invite email failed (${res.status}).`;
    } catch (err) {
      emailError = err.message || 'Invite email failed to send.';
    }
    if (emailError) console.error('Failed to send invite email:', emailError);

    return { ...data, emailError };
  };

  const updateMemberRole = async (id, role) => {
    const { data, error } = await supabase.from('brand_members').update({ role }).eq('id', id).select().single();
    if (error) throw error;
    setMembers(prev => prev.map(m => (m.id === id ? data : m)));
    return data;
  };

  const removeMember = async (id) => {
    const { error } = await supabase.from('brand_members').delete().eq('id', id);
    if (error) throw error;
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  return (
    <TeamContext.Provider value={{ members, loading, myRole, canManage, inviteMember, updateMemberRole, removeMember, refresh: loadMembers, myMembership, needsDisplayName, setMyDisplayName }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used inside TeamProvider');
  return ctx;
}
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useProducts } from './ProductsContext.jsx';

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const { activeBrand } = useProducts();
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!activeBrand) {
      setAccounts([]); setPosts([]); setLoading(false); return;
    }
    setLoading(true);
    try {
      const { data: accData } = await supabase.from('social_accounts').select('*').eq('brand_id', activeBrand.id);
      const { data: postData } = await supabase.from('content_posts').select('*, products(name)').eq('brand_id', activeBrand.id).order('scheduled_for', { ascending: false });

      setAccounts(accData || []);
      setPosts(postData || []);
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
    await supabase.from('social_accounts').delete().eq('id', id);
    setAccounts(prev => prev.filter(a => a.id !== id));
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
    <ContentContext.Provider value={{ accounts, posts, loading, disconnectAccount, schedulePost, updatePostStatus, refresh: loadData }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used inside ContentProvider');
  return ctx;
}
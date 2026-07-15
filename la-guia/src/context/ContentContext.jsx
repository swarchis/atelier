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

  // Stores the real OAuth token now (it used to be discarded entirely —
  // see api/index.js's social OAuth rebuild). No follower count is
  // fabricated; each platform's real count would need its own extra API
  // call/scope this doesn't make yet, so it's left unset rather than
  // showing a made-up number.
  const connectAccount = async (platform, handle, accessToken, refreshToken) => {
    const { data, error } = await supabase.from('social_accounts').upsert({
      brand_id: activeBrand.id,
      platform: platform.toLowerCase(),
      handle,
      connected: true,
      access_token: accessToken || null,
      refresh_token: refreshToken || null,
    }, { onConflict: 'brand_id, platform' }).select().single();
    if (error) throw error;
    setAccounts(prev => [...prev.filter(a => a.platform !== platform.toLowerCase()), data]);
  };

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
    <ContentContext.Provider value={{ accounts, posts, loading, connectAccount, disconnectAccount, schedulePost, updatePostStatus, refresh: loadData }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used inside ContentProvider');
  return ctx;
}
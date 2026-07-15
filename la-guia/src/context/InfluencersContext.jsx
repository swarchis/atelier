import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useProducts } from './ProductsContext.jsx';

const InfluencersContext = createContext(null);

export function InfluencersProvider({ children }) {
  const { activeBrand } = useProducts();
  const [influencers, setInfluencers] = useState([]);
  const [dealsByInfluencer, setDealsByInfluencer] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!activeBrand) { setInfluencers([]); setDealsByInfluencer({}); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('influencers').select('*').eq('brand_id', activeBrand.id).order('created_at', { ascending: false });
      if (error) throw error;
      setInfluencers(data || []);
    } catch (err) {
      console.error('Error loading influencers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeBrand]);

  const createInfluencer = async (fields) => {
    const { data, error } = await supabase.from('influencers').insert([{ brand_id: activeBrand.id, ...fields }]).select().single();
    if (error) throw error;
    setInfluencers(prev => [data, ...prev]);
    return data;
  };

  const updateInfluencer = async (id, updates) => {
    const { data, error } = await supabase.from('influencers').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setInfluencers(prev => prev.map(i => i.id === id ? data : i));
    return data;
  };

  const deleteInfluencer = async (id) => {
    const { error } = await supabase.from('influencers').delete().eq('id', id);
    if (error) throw error;
    setInfluencers(prev => prev.filter(i => i.id !== id));
  };

  const loadDeals = async (influencerId) => {
    const { data, error } = await supabase.from('influencer_deals').select('*, products(name)').eq('influencer_id', influencerId).order('created_at', { ascending: false });
    if (error) { console.error('Error loading deals:', error); return dealsByInfluencer[influencerId] || []; }
    setDealsByInfluencer(prev => ({ ...prev, [influencerId]: data || [] }));
    return data || [];
  };

  const addDeal = async (influencerId, fields) => {
    const { data, error } = await supabase.from('influencer_deals').insert([{ brand_id: activeBrand.id, influencer_id: influencerId, ...fields }]).select('*, products(name)').single();
    if (error) throw error;
    setDealsByInfluencer(prev => ({ ...prev, [influencerId]: [data, ...(prev[influencerId] || [])] }));
    return data;
  };

  const updateDeal = async (id, influencerId, updates) => {
    const { data, error } = await supabase.from('influencer_deals').update(updates).eq('id', id).select('*, products(name)').single();
    if (error) throw error;
    setDealsByInfluencer(prev => ({ ...prev, [influencerId]: (prev[influencerId] || []).map(d => d.id === id ? data : d) }));
    return data;
  };

  return (
    <InfluencersContext.Provider value={{
      influencers, loading, createInfluencer, updateInfluencer, deleteInfluencer,
      dealsByInfluencer, loadDeals, addDeal, updateDeal, refresh: loadData,
    }}>
      {children}
    </InfluencersContext.Provider>
  );
}

export function useInfluencers() {
  const ctx = useContext(InfluencersContext);
  if (!ctx) throw new Error('useInfluencers must be used inside InfluencersProvider');
  return ctx;
}

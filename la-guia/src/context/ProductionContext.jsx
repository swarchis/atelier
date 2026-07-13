import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useProducts } from './ProductsContext.jsx';

const ProductionContext = createContext(null);

export function ProductionProvider({ children }) {
  const { activeBrand } = useProducts();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuesByOrder, setIssuesByOrder] = useState({});
  const [updatesByOrder, setUpdatesByOrder] = useState({});

  const loadOrders = async () => {
    if (!activeBrand) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*, products(name), vendors(name)')
        .eq('brand_id', activeBrand.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error loading orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [activeBrand]);

  const createOrder = async (orderData) => {
    const { data, error } = await supabase
      .from('production_orders')
      .insert([{
        brand_id: activeBrand.id,
        ...orderData,
        checkpoints: [
          { id: 'cp-cutting', label: 'Cutting', status: 'pending' },
          { id: 'cp-sewing', label: 'Sewing', status: 'pending' },
          { id: 'cp-qc', label: 'Quality Control', status: 'pending' },
          { id: 'cp-packing', label: 'Packing', status: 'pending' }
        ]
      }])
      .select('*, products(name), vendors(name)')
      .single();

    if (error) throw error;
    setOrders(prev => [data, ...prev]);
    return data;
  };

  const updateOrderStage = async (id, stage) => {
    // Stamps a real delivered_at the moment an order reaches "Delivered" so
    // on-time-rate/avg-days-in-production analytics have an honest date to
    // work from instead of guessing from the last-updated time. Falls back
    // to a plain stage update if migration 019 hasn't run yet (delivered_at
    // doesn't exist) — this is the core stage-change path, so it can't be
    // allowed to break over a column that's new and optional.
    const updates = { stage, delivered_at: stage === 'Delivered' ? new Date().toISOString() : null };
    let { error } = await supabase.from('production_orders').update(updates).eq('id', id);
    if (error) {
      ({ error } = await supabase.from('production_orders').update({ stage }).eq('id', id));
      if (error) throw error;
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, stage } : o)));
      return;
    }
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...updates } : o)));
  };

  // Generic update function to handle things like checking off checklist items
  const updateOrder = async (id, updates) => {
    const { data, error } = await supabase
      .from('production_orders')
      .update(updates)
      .eq('id', id)
      .select('*, products(name), vendors(name)')
      .single();

    if (error) throw error;
    setOrders(prev => prev.map(o => o.id === id ? data : o));
    return data;
  };

  const loadIssues = async (orderId) => {
    const { data, error } = await supabase.from('production_issues').select('*').eq('production_order_id', orderId).order('created_at', { ascending: false });
    if (error) { console.error('Error loading issues:', error); return issuesByOrder[orderId] || []; }
    setIssuesByOrder(prev => ({ ...prev, [orderId]: data || [] }));
    return data || [];
  };

  const addIssue = async (orderId, { severity, description }) => {
    const { data, error } = await supabase.from('production_issues').insert([{ production_order_id: orderId, severity: severity || 'Medium', description }]).select().single();
    if (error) throw error;
    setIssuesByOrder(prev => ({ ...prev, [orderId]: [data, ...(prev[orderId] || [])] }));
    return data;
  };

  const toggleIssueResolved = async (issue) => {
    const { data, error } = await supabase.from('production_issues').update({ resolved: !issue.resolved }).eq('id', issue.id).select().single();
    if (error) throw error;
    setIssuesByOrder(prev => ({ ...prev, [issue.production_order_id]: (prev[issue.production_order_id] || []).map(i => (i.id === issue.id ? data : i)) }));
    return data;
  };

  const loadUpdates = async (orderId) => {
    const { data, error } = await supabase.from('production_updates').select('*').eq('production_order_id', orderId).order('created_at', { ascending: false });
    if (error) { console.error('Error loading updates:', error); return updatesByOrder[orderId] || []; }
    setUpdatesByOrder(prev => ({ ...prev, [orderId]: data || [] }));
    return data || [];
  };

  const addUpdate = async (orderId, note) => {
    const { data, error } = await supabase.from('production_updates').insert([{ production_order_id: orderId, note }]).select().single();
    if (error) throw error;
    setUpdatesByOrder(prev => ({ ...prev, [orderId]: [data, ...(prev[orderId] || [])] }));
    return data;
  };

  return (
    <ProductionContext.Provider value={{
      orders, loading, createOrder, updateOrderStage, updateOrder, refresh: loadOrders,
      issuesByOrder, loadIssues, addIssue, toggleIssueResolved,
      updatesByOrder, loadUpdates, addUpdate,
    }}>
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used inside ProductionProvider');
  return ctx;
}
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useProducts } from './ProductsContext.jsx';

const ProductionContext = createContext(null);

export function ProductionProvider({ children }) {
  const { activeBrand } = useProducts();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
          { label: 'Cutting', status: 'pending' },
          { label: 'Sewing', status: 'pending' },
          { label: 'Quality Control', status: 'pending' },
          { label: 'Packing', status: 'pending' }
        ]
      }])
      .select('*, products(name), vendors(name)')
      .single();

    if (error) throw error;
    setOrders(prev => [data, ...prev]);
    return data;
  };

  const updateOrderStage = async (id, stage) => {
    const { error } = await supabase
      .from('production_orders')
      .update({ stage })
      .eq('id', id);
    if (error) throw error;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, stage } : o));
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

  return (
    <ProductionContext.Provider value={{ orders, loading, createOrder, updateOrderStage, updateOrder, refresh: loadOrders }}>
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used inside ProductionProvider');
  return ctx;
}
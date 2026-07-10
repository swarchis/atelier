import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useProducts } from './ProductsContext.jsx';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { activeBrand } = useProducts();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    if (!activeBrand) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('brand_id', activeBrand.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [activeBrand]);

  const markAsRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) throw error;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!activeBrand) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('brand_id', activeBrand.id)
      .eq('read', false);
    if (error) throw error;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Utility to create a notification from anywhere in the app
  const addNotification = async ({ title, body, type = 'info', link = null }) => {
    if (!activeBrand) return;
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        brand_id: activeBrand.id,
        title,
        body,
        type,
        link,
        read: false
      }])
      .select()
      .single();

    if (error) throw error;
    setNotifications(prev => [data, ...prev]);
    return data;
  };

  return (
    <NotificationsContext.Provider value={{ notifications, loading, markAsRead, markAllAsRead, addNotification, refresh: loadNotifications }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
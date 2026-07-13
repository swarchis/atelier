import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useProducts } from './ProductsContext.jsx';

const MaterialsContext = createContext(null);

// The base material row is a shared reference library, not brand-scoped —
// loaded once per session. Cost history and supplier links are real,
// brand-specific facts (what YOU paid, WHO you buy from), so they live in
// separate brand-scoped child tables and are only loaded once a material's
// detail page actually needs them.
export function MaterialsProvider({ children }) {
  const { activeBrand } = useProducts();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [costLogByMaterial, setCostLogByMaterial] = useState({});
  const [vendorLinksByMaterial, setVendorLinksByMaterial] = useState({});

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('materials').select('*').order('name', { ascending: true });
      if (!error) setMaterials(data || []);
      else console.error('Error loading materials:', error);
      setLoading(false);
    }
    load();
  }, []);

  const createMaterial = async ({ name, category, type, riskLevel, warning, handlingNotes }) => {
    const { data, error } = await supabase
      .from('materials')
      .insert([{ name, category: category || null, type: type || 'fabric', risk_level: riskLevel || null, warning: warning || null, handling_notes: handlingNotes || null }])
      .select()
      .single();
    if (error) throw error;
    setMaterials(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const updateMaterial = async (id, updates) => {
    const { data, error } = await supabase.from('materials').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setMaterials(prev => prev.map(m => (m.id === id ? data : m)));
    return data;
  };

  const deleteMaterial = async (id) => {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const loadCostLog = async (materialId) => {
    if (!activeBrand) return [];
    const { data, error } = await supabase
      .from('material_cost_log')
      .select('*')
      .eq('brand_id', activeBrand.id)
      .eq('material_id', materialId)
      .order('logged_at', { ascending: true });
    if (error) { console.error('Error loading cost log:', error); return costLogByMaterial[materialId] || []; }
    setCostLogByMaterial(prev => ({ ...prev, [materialId]: data || [] }));
    return data || [];
  };

  const addCostLogEntry = async (materialId, { unitCost, note }) => {
    if (!activeBrand) throw new Error('No active brand');
    const { data, error } = await supabase
      .from('material_cost_log')
      .insert([{ brand_id: activeBrand.id, material_id: materialId, unit_cost: Number(unitCost), note: note || null }])
      .select()
      .single();
    if (error) throw error;
    setCostLogByMaterial(prev => ({ ...prev, [materialId]: [...(prev[materialId] || []), data] }));
    return data;
  };

  const loadVendorLinks = async (materialId) => {
    if (!activeBrand) return [];
    const { data, error } = await supabase
      .from('material_vendors')
      .select('*, vendors(name, category, location, price_range)')
      .eq('brand_id', activeBrand.id)
      .eq('material_id', materialId);
    if (error) { console.error('Error loading material vendors:', error); return vendorLinksByMaterial[materialId] || []; }
    setVendorLinksByMaterial(prev => ({ ...prev, [materialId]: data || [] }));
    return data || [];
  };

  const linkVendor = async (materialId, vendorId) => {
    if (!activeBrand) throw new Error('No active brand');
    const { data, error } = await supabase
      .from('material_vendors')
      .insert([{ brand_id: activeBrand.id, material_id: materialId, vendor_id: vendorId }])
      .select('*, vendors(name, category, location, price_range)')
      .single();
    if (error) throw error;
    setVendorLinksByMaterial(prev => ({ ...prev, [materialId]: [...(prev[materialId] || []), data] }));
    return data;
  };

  const unlinkVendor = async (linkId, materialId) => {
    const { error } = await supabase.from('material_vendors').delete().eq('id', linkId);
    if (error) throw error;
    setVendorLinksByMaterial(prev => ({ ...prev, [materialId]: (prev[materialId] || []).filter(l => l.id !== linkId) }));
  };

  return (
    <MaterialsContext.Provider value={{
      materials, loading, createMaterial, updateMaterial, deleteMaterial,
      costLogByMaterial, loadCostLog, addCostLogEntry,
      vendorLinksByMaterial, loadVendorLinks, linkVendor, unlinkVendor,
    }}>
      {children}
    </MaterialsContext.Provider>
  );
}

export function useMaterials() {
  const ctx = useContext(MaterialsContext);
  if (!ctx) throw new Error('useMaterials must be used inside MaterialsProvider');
  return ctx;
}

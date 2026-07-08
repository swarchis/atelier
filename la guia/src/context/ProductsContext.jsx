import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { products as seedProducts, designs as seedDesigns } from '../data/mockData.js';

const PRODUCTS_KEY = 'grainline_products_v1';
const DESIGNS_KEY = 'grainline_designs_v1';
const ProductsContext = createContext(null);

function loadProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) return seedProducts;
    const saved = JSON.parse(raw);
    const savedById = Object.fromEntries(saved.map(p => [p.id, p]));
    // Merge stage overrides onto the current seed set, and keep any brand-new
    // products (created via the design studio) that aren't in the seed at all.
    const merged = seedProducts.map(p => (savedById[p.id] ? { ...p, stage: savedById[p.id].stage } : p));
    const extra = saved.filter(p => !seedProducts.some(sp => sp.id === p.id));
    return [...merged, ...extra];
  } catch {
    return seedProducts;
  }
}

function loadDesigns() {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY);
    if (!raw) return seedDesigns;
    return { ...seedDesigns, ...JSON.parse(raw) };
  } catch {
    return seedDesigns;
  }
}

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(loadProducts);
  const [designs, setDesigns] = useState(loadDesigns);
  // Raw File objects can't be serialized to localStorage — kept in memory only,
  // so an uploaded mockup survives navigation this session but not a hard reload.
  const uploadedFiles = useRef(new Map());

  useEffect(() => {
    try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); } catch {}
  }, [products]);

  useEffect(() => {
    try { localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs)); } catch {}
  }, [designs]);

  const moveProduct = (id, stage) => {
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, stage } : p)));
  };

  // Starting a new design creates both a product workspace (so it shows up in
  // the pipeline immediately, at Concept) and its design record together.
  const createDesign = ({ garmentType, baseType, silhouette, colorway, file }) => {
    const id = `design-${Date.now()}`;
    if (file) uploadedFiles.current.set(id, file);
    setProducts(prev => [
      { id, name: `New ${garmentType}`, category: garmentType, collectionId: null, stage: 'concept', risk: 'Balanced', budget: 0, readiness: 4 },
      ...prev,
    ]);
    setDesigns(prev => ({
      ...prev,
      [id]: {
        garmentType, silhouette: silhouette || null, baseType, colorway: colorway || '—',
        status: 'Sketching',
        layers: [{ name: baseType === 'upload' ? 'Uploaded mockup' : baseType === 'ai-silhouette' ? 'AI-generated base silhouette' : 'Silhouette base', visible: true }],
        analysis: null,
      },
    }));
    return id;
  };

  const getUploadedFile = id => uploadedFiles.current.get(id) || null;

  return (
    <ProductsContext.Provider value={{ products, moveProduct, designs, createDesign, getUploadedFile }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used inside ProductsProvider');
  return ctx;
}

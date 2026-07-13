import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';
import { useProducts } from './ProductsContext.jsx';
import { uploadDesignImage } from '../lib/designImages.js';

const SamplingContext = createContext(null);

export function SamplingProvider({ children }) {
  const { user } = useAuth();
  const { activeBrand } = useProducts();
  const [samples, setSamples] = useState([]);
  const [images, setImages] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [fitFeedback, setFitFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!activeBrand) { setSamples([]); setImages([]); setAnnotations([]); setFitFeedback([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: sampleData, error } = await supabase
        .from('samples')
        .select('*, products(name, category), vendors(name)')
        .eq('brand_id', activeBrand.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSamples(sampleData || []);

      const sampleIds = (sampleData || []).map(s => s.id);
      if (sampleIds.length) {
        const [imgRes, annRes, fitRes] = await Promise.all([
          supabase.from('sample_images').select('*').in('sample_id', sampleIds).order('created_at', { ascending: true }),
          supabase.from('sample_annotations').select('*').in('sample_id', sampleIds).order('created_at', { ascending: true }),
          supabase.from('sample_fit_feedback').select('*').in('sample_id', sampleIds).order('created_at', { ascending: true }),
        ]);
        setImages(imgRes.data || []);
        setAnnotations(annRes.data || []);
        setFitFeedback(fitRes.data || []);
      } else {
        setImages([]); setAnnotations([]); setFitFeedback([]);
      }
    } catch (err) {
      console.error('Error loading samples:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeBrand?.id]);

  // Round numbering is derived from existing rounds for the product, not
  // tracked separately — so it can never drift out of sync with what's
  // actually in the samples table.
  const createSampleRequest = async ({ productId, vendorId, requestNotes, expectedDate }) => {
    if (!activeBrand) throw new Error('No active brand');
    const existingRounds = samples.filter(s => s.product_id === productId).map(s => s.round_number);
    const roundNumber = existingRounds.length ? Math.max(...existingRounds) + 1 : 1;
    const { data, error } = await supabase
      .from('samples')
      .insert([{
        brand_id: activeBrand.id,
        product_id: productId,
        vendor_id: vendorId || null,
        round_number: roundNumber,
        request_notes: requestNotes || null,
        expected_date: expectedDate || null,
        created_by: user?.id || null,
      }])
      .select('*, products(name, category), vendors(name)')
      .single();
    if (error) throw error;
    setSamples(prev => [data, ...prev]);
    return data;
  };

  const updateSample = async (id, updates) => {
    const { data, error } = await supabase
      .from('samples')
      .update(updates)
      .eq('id', id)
      .select('*, products(name, category), vendors(name)')
      .single();
    if (error) throw error;
    setSamples(prev => prev.map(s => (s.id === id ? data : s)));
    return data;
  };

  const deleteSample = async (id) => {
    const { error } = await supabase.from('samples').delete().eq('id', id);
    if (error) throw error;
    setSamples(prev => prev.filter(s => s.id !== id));
    setImages(prev => prev.filter(i => i.sample_id !== id));
    setAnnotations(prev => prev.filter(a => a.sample_id !== id));
    setFitFeedback(prev => prev.filter(f => f.sample_id !== id));
  };

  // Marks the current round and immediately opens the next one — revision
  // history lives as a chain of rounds on the same product, not an edit to
  // the round that got sent back.
  const requestRevision = async (sample, notes) => {
    await updateSample(sample.id, { status: 'Revision Requested' });
    return createSampleRequest({
      productId: sample.product_id,
      vendorId: sample.vendor_id,
      requestNotes: notes || `Revision after round ${sample.round_number}`,
    });
  };

  const addImage = async (sampleId, file, caption) => {
    const url = await uploadDesignImage(file, sampleId, 'sample');
    const { data, error } = await supabase.from('sample_images').insert([{ sample_id: sampleId, image_url: url, caption: caption || null }]).select().single();
    if (error) throw error;
    setImages(prev => [...prev, data]);
    return data;
  };

  const deleteImage = async (imageId) => {
    const { error } = await supabase.from('sample_images').delete().eq('id', imageId);
    if (error) throw error;
    setImages(prev => prev.filter(i => i.id !== imageId));
    setAnnotations(prev => prev.filter(a => a.image_id !== imageId));
  };

  const addAnnotation = async (sampleId, { imageId, xPercent, yPercent, note }) => {
    const { data, error } = await supabase
      .from('sample_annotations')
      .insert([{ sample_id: sampleId, image_id: imageId || null, x_percent: xPercent ?? null, y_percent: yPercent ?? null, note }])
      .select()
      .single();
    if (error) throw error;
    setAnnotations(prev => [...prev, data]);
    return data;
  };

  const toggleAnnotationResolved = async (annotation) => {
    const { data, error } = await supabase.from('sample_annotations').update({ resolved: !annotation.resolved }).eq('id', annotation.id).select().single();
    if (error) throw error;
    setAnnotations(prev => prev.map(a => (a.id === annotation.id ? data : a)));
    return data;
  };

  const addFitFeedback = async (sampleId, { area, rating, note }) => {
    const { data, error } = await supabase
      .from('sample_fit_feedback')
      .insert([{ sample_id: sampleId, area, rating, note: note || null }])
      .select()
      .single();
    if (error) throw error;
    setFitFeedback(prev => [...prev, data]);
    return data;
  };

  return (
    <SamplingContext.Provider value={{
      samples, images, annotations, fitFeedback, loading,
      createSampleRequest, updateSample, deleteSample, requestRevision,
      addImage, deleteImage, addAnnotation, toggleAnnotationResolved, addFitFeedback,
      refresh: loadData,
    }}>
      {children}
    </SamplingContext.Provider>
  );
}

export function useSampling() {
  const ctx = useContext(SamplingContext);
  if (!ctx) throw new Error('useSampling must be used inside SamplingProvider');
  return ctx;
}

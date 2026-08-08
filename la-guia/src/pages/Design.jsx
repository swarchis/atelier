import React, { useEffect, useRef, useState } from 'react';
import { validateUpload, acceptAttr } from '../lib/uploadGuard.js';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext.jsx';
import { useAIUsage } from '../context/AIUsageContext.jsx';
import CreditCost from '../components/CreditCost.jsx';
import { SILHOUETTE_QUALITY_OPTIONS, silhouetteFeature } from '../data/aiCredits.js';
import { getPlan } from '../data/plans.js';
import GarmentSilhouette, { CustomSilhouette, GARMENT_TYPES } from '../components/GarmentSilhouette.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import { useMultiSelect } from '../lib/useMultiSelect.js';
import { useDragAndDrop } from '../lib/useDragAndDrop.js';
import BulkActionBar from '../components/BulkActionBar.jsx';
import { ContextMenuTarget } from '../components/ContextMenu.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';
import { base64ToBlob, isRenderableImageUrl } from '../lib/designImages.js';
import { aiPost } from '../lib/aiApi.js';
import { toast } from '../lib/toast.js';

// AFTER:
const STATUS_COLOR = { Sketching: 'var(--ink-3)', Refining: 'var(--c-design)', Ready: 'var(--green)' };

const STAGE_LABELS = {
  concept: 'Design',
  design: 'Design',
  techpack: 'Tech Pack',
  sourcing: 'Sourcing',
  sampling: 'Sampling',
  production: 'Production',
  launched: 'Launched'
};

const STAGE_COLORS = {
  concept: 'var(--c-design)',
  design: 'var(--c-design)',
  techpack: 'var(--c-techpack)',
  sourcing: 'var(--c-vendors)',
  sampling: 'var(--c-finalcheck)',
  production: 'var(--c-materials)',
  launched: 'var(--green)'
};
const DESIGN_STATUSES = ['Sketching', 'Refining', 'Ready'];
const VIEWS = [
  { key: 'cards', label: 'Cards', icon: 'ph-squares-four' },
  { key: 'kanban', label: 'Kanban', icon: 'ph-kanban' },
  { key: 'table', label: 'Table', icon: 'ph-table' },
];

// A design thumbnail that falls back to the garment icon when the stored
// image can't actually be painted. Extension checks can't catch everything:
// designs created before uploads used real content types have PSD bytes
// sitting behind a .png URL, and only a load error reveals that.
function DesignThumb({ url, name, fallback }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed || !isRenderableImageUrl(url)) return fallback;
  return (
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

export default function Design() {
  const navigate = useNavigate();
  const {
    products, designs, createDesign, deleteProduct, activeBrand, duplicateProduct, setProductStatus,
    archivedProducts, loadArchivedProducts, updateDesignStatus, loading: dataLoading,
    collections, updateProduct, brandMockups, saveBrandMockup, deleteBrandMockup,
  } = useProducts();
  const { canAfford, openTopup, remaining: aiRemaining, logUsage } = useAIUsage();
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [customType, setCustomType] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [view, setView] = useState('cards');
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [collectionPicker, setCollectionPicker] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState(null); // collection id mid-assign
  const [newName, setNewName] = useState(''); // optional name for the next created design
  const [silQuality, setSilQuality] = useState('medium'); // AI silhouette render quality
  const fileRef = useRef(null);
  const mockupFileRef = useRef(null);
  const [savingMockup, setSavingMockup] = useState(false);
  const designProducts = products.filter(p => p.status !== 'archived');
  const multiSelect = useMultiSelect(designProducts);
  const dnd = useDragAndDrop();

  useEffect(() => {
    if (showArchived) loadArchivedProducts();
  }, [showArchived, activeBrand?.id]);

  const handleDuplicate = async (e, product) => {
    e.stopPropagation();
    setActionError(null);
    setDuplicatingId(product.id);
    try {
      const newId = await duplicateProduct(product.id);
      navigate(`/design/${newId}`);
    } catch (err) {
      setActionError(`Couldn't duplicate "${product.name}": ${err.message}`);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleArchiveToggle = async (e, product, archive) => {
    e.stopPropagation();
    setActionError(null);
    try {
      await setProductStatus(product.id, archive ? 'archived' : 'active');
      if (showArchived) loadArchivedProducts();
    } catch (err) {
      setActionError(`Couldn't update "${product.name}": ${err.message}`);
    }
  };

  // Assign every selected design to a collection (moves them if they were
  // already in a different one), then clear the selection.
  const handleBulkAddToCollection = async (collectionId) => {
    setActionError(null);
    setAddingToCollection(collectionId);
    try {
      await Promise.all(multiSelect.selectedItems.map(p => updateProduct(p.id, { collection_id: collectionId })));
      multiSelect.clear();
      setCollectionPicker(false);
    } catch (err) {
      setActionError(`Couldn't add the selection to the collection: ${err.message}`);
    } finally {
      setAddingToCollection(null);
    }
  };

  const handleBulkArchive = async () => {
    setActionError(null);
    setBulkArchiving(true);
    try {
      await Promise.all(multiSelect.selectedItems.map(p => setProductStatus(p.id, 'archived')));
      multiSelect.clear();
    } catch (err) {
      setActionError(`Couldn't archive the selection: ${err.message}`);
    } finally {
      setBulkArchiving(false);
    }
  };

  const handleKanbanDrop = async (productId, status) => {
    try {
      await updateDesignStatus(productId, status);
    } catch (err) {
      setActionError(`Couldn't move that design: ${err.message}`);
    }
  };

  const plan = getPlan(activeBrand?.plan_tier || 'free');
  const atProductLimit = products.length >= plan.limits.products;

  // Start a design from one of the brand's saved mockups. Prefers the layered
  // original when there is one, so a mockup saved off a canvas reopens with
  // its layers instead of a flattened copy.
  const startFromMockup = async (mockup) => {
    if (atProductLimit) { navigate('/settings'); return; }
    setLoading(true);
    try {
      const source = mockup.psd_url || mockup.image_url;
      const res = await fetch(source);
      if (!res.ok) throw new Error(`Could not load that mockup (${res.status})`);
      const blob = await res.blob();
      const isPsd = !!mockup.psd_url;
      const file = new File([blob], isPsd ? `${mockup.name}.psd` : `${mockup.name}.png`, {
        type: isPsd ? 'image/vnd.adobe.photoshop' : (blob.type || 'image/png'),
      });
      const id = await createDesign({
        garmentType: mockup.name,
        baseType: 'upload',
        colorway: mockup.name,
        file,
        name: newName.trim() || mockup.name,
      });
      setNewName('');
      navigate(`/design/${id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMockup = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    const name = window.prompt('Name this mockup', file.name.replace(/\.[^/.]+$/, ''));
    if (name === null) return; // cancelled
    setSavingMockup(true);
    try {
      await saveBrandMockup({ name, blob: file });
      toast.success('Mockup saved — it will show up here for every new design.');
    } catch (err) {
      toast.error('Could not save that mockup: ' + err.message);
    } finally {
      setSavingMockup(false);
    }
  };

  const handleDeleteMockup = async (mockup) => {
    if (!window.confirm(`Remove "${mockup.name}" from your saved mockups?`)) return;
    try {
      await deleteBrandMockup(mockup.id);
    } catch (err) {
      toast.error('Could not remove that mockup: ' + err.message);
    }
  };

  const startFromSilhouette = async (type) => {
    if (atProductLimit) { navigate('/settings'); return; }
    setLoading(true);
    try {
      // Fetch the template photo so creation persists an initial snapshot to
      // design_versions — this path used to pass no file, so template designs
      // had no image anywhere and the dashboard hero card stayed a placeholder
      // until a tech pack existed.
      let file = null;
      try {
        const res = await fetch(`/silhouettes/${type.key}.jpeg`);
        if (res.ok) file = new File([await res.blob()], `${type.key}.jpeg`, { type: 'image/jpeg' });
      } catch { /* vector-only template — create without a snapshot */ }
      const id = await createDesign({ garmentType: type.label, baseType: 'silhouette', silhouette: type.key, file, name: newName });
      setNewName('');
      navigate(`/design/${id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

const startFromUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (atProductLimit) { navigate('/settings'); return; }
  // Checked before anything is created, so a rejected file leaves no half-made
  // product behind.
  try {
    validateUpload(file, 'design');
  } catch (err) {
    toast.error(err.message);
    e.target.value = '';
    return;
  }
  setLoading(true);
  try {
    // Strips file extensions like ".png" or ".jpg" so "Jacket.png" becomes "Jacket"
    const cleanedFileName = file.name.replace(/\.[^/.]+$/, "");
    const designName = newName.trim() || cleanedFileName;

    const id = await createDesign({
      garmentType: designName,
      baseType: 'upload',
      colorway: file.name,
      file,
      name: designName
    });
    setNewName('');
    navigate(`/design/${id}`);
  } catch (err) {
    toast.error(err.message);
  } finally {
    setLoading(false);
  }
};

  const startFromAI = async () => {
    const garmentType = customType.trim();
    if (!garmentType) return;
    if (atProductLimit) { setGenerateError(`You're at your plan's limit of ${plan.limits.products} active products — upgrade to add more.`); return; }
    if (!canAfford(silhouetteFeature(silQuality))) { openTopup(); return; }
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await aiPost('/api/design/generate-element', { mode: 'silhouette', prompt: garmentType, quality: silQuality });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await logUsage('silhouette');

      const blob = await base64ToBlob(data.imageBase64, data.mimeType);
      const file = new File([blob], `${garmentType}-silhouette.png`, { type: data.mimeType || 'image/png' });
      const id = await createDesign({ garmentType, baseType: 'ai-silhouette', file, name: newName });
      setNewName('');
      navigate(`/design/${id}`);
    } catch (err) {
      setGenerateError(err.message || 'Could not generate a silhouette for that garment type.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-design)' }}>Design</div>
            <h1 className="page-title">Design Studio</h1>
          </div>
          <div className="page-sub">{designProducts.length} in concept or design</div>
        </div>
        <div className="topbar-right">
          <div className="pill-group">
            {VIEWS.map(v => (
              <button key={v.key} className={`pill ${view === v.key ? 'active' : ''}`} onClick={() => setView(v.key)} title={v.label}>
                <i className={`ph ${v.icon}`} style={{ marginRight: 6 }} /> {v.label}
              </button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => setShowArchived(s => !s)}>
            <i className={`ph ${showArchived ? 'ph-eye-slash' : 'ph-archive'}`} /> {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button data-tour="design-new" className="btn btn-primary" onClick={() => setShowNew(s => !s)} disabled={loading}>
            <i className="ph ph-plus" /> {loading ? 'Creating...' : 'New design'}
          </button>
        </div>
      </div>

      <div className="content">
        {actionError && (
          <div className="alert" style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
            <i className="ph ph-warning" style={{ marginTop: 1 }} />
            <div>{actionError}</div>
          </div>
        )}
        {showNew && (
          <div className="card-raised enter" style={{ marginBottom: 28 }}>
            <div className="corner-fold" style={{ '--fold-color': 'var(--c-design)' }} />
            <div className="card-header"><span className="card-title">Start a new design</span></div>
            <div className="card-body">
              {atProductLimit && (
                <div className="form-hint" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', color: 'var(--amber)' }}>
                  <i className="ph ph-warning" style={{ marginRight: 4 }} /> You're at your {plan.name} plan's limit of {plan.limits.products} active product{plan.limits.products === 1 ? '' : 's'}.{' '}
                  <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/settings')}>Upgrade to add more</span>.
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 18, maxWidth: 360 }}>
                <label className="form-label">Design name <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional — you can rename it any time)</span></label>
                <input
                  className="form-input"
                  placeholder={'e.g. "Boxy heavyweight hoodie"'}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="section-label" style={{ marginBottom: 12 }}>Start from a preset silhouette</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 22 }}>
                {GARMENT_TYPES.map(t => (
                  <div
                    key={t.key}
                    onClick={() => !loading && startFromSilhouette(t)}
                    style={{
                      border: '1.5px solid var(--border-2)', borderRadius: 'var(--r-sm)', padding: '14px 8px 10px',
                      textAlign: 'center', cursor: loading ? 'wait' : 'pointer', background: 'var(--bg-1)', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if(!loading) { e.currentTarget.style.borderColor = 'var(--c-design)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                    onMouseLeave={e => { if(!loading) { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.transform = ''; } }}
                  >
                    <div style={{ color: 'var(--ink-2)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                      <GarmentSilhouette type={t.key} size={44} />
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>{t.label}</div>
                  </div>
                ))}
              </div>

              <div className="section-label" style={{ marginBottom: 4 }}>Your saved mockups</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
                Your own base mockups, ready to start from. Save one here, or from any design's canvas.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 22 }}>
                {brandMockups.map(mk => (
                  <div
                    key={mk.id}
                    onClick={() => !loading && startFromMockup(mk)}
                    title={`Start a design from "${mk.name}"`}
                    style={{
                      position: 'relative',
                      border: '1.5px solid var(--border-2)', borderRadius: 'var(--r-sm)', padding: '10px 8px',
                      textAlign: 'center', cursor: loading ? 'wait' : 'pointer', background: 'var(--bg-1)', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = 'var(--c-design)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                    onMouseLeave={e => { if (!loading) { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.transform = ''; } }}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteMockup(mk); }}
                      title="Remove this mockup"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 12, padding: 2, lineHeight: 1 }}
                    >
                      <i className="ph ph-x" />
                    </button>
                    <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' }}>
                      <img src={mk.image_url} alt={mk.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mk.name}</div>
                    {mk.psd_url && <div style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>layered</div>}
                  </div>
                ))}

                <div
                  onClick={() => !savingMockup && mockupFileRef.current?.click()}
                  title="Save a mockup you can reuse on future designs"
                  style={{
                    border: '1.5px dashed var(--border-2)', borderRadius: 'var(--r-sm)', padding: '14px 8px 10px',
                    textAlign: 'center', cursor: savingMockup ? 'wait' : 'pointer', color: 'var(--ink-3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 92,
                  }}
                >
                  <i className={`ph ${savingMockup ? 'ph-circle-notch ph-spin' : 'ph-plus'}`} style={{ fontSize: 18, marginBottom: 6 }} />
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{savingMockup ? 'Saving…' : 'Save a mockup'}</div>
                </div>
                <input
                  ref={mockupFileRef}
                  type="file"
                  accept={acceptAttr('design')}
                  style={{ display: 'none' }}
                  onChange={handleSaveMockup}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0', color: 'var(--ink-4)' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span className="section-label" style={{ marginBottom: 0 }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <div
                onClick={() => !loading && fileRef.current?.click()}
                style={{
                  border: '1.5px dashed var(--border-2)', borderRadius: 'var(--r)', padding: '26px 16px',
                  textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, cursor: loading ? 'wait' : 'pointer',
                }}
              >
                <i className="ph ph-upload-simple" style={{ fontSize: 22, marginBottom: 8, display: 'block', color: 'var(--c-design)' }} />
                Upload your own mockup, sketch, or reference photo
                <input ref={fileRef} type="file" accept={acceptAttr('design')} style={{ display: 'none' }} onChange={startFromUpload} />
              </div>

              <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 'var(--r-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)', flex: 1, minWidth: 200 }}>
                    Don't see your garment type above? AI will generate a blank garment mockup for you to build on.
                  </span>
                  <input
                    className="form-input" style={{ width: 160 }} placeholder="e.g. Balaclava"
                    value={customType} onChange={e => { setCustomType(e.target.value); setGenerateError(null); }}
                    onKeyDown={e => e.key === 'Enter' && !generating && customType.trim() && startFromAI()}
                    disabled={generating}
                  />
                  <button className="btn btn-sm" onClick={startFromAI} disabled={generating || loading || !customType.trim()}>
                    {generating ? <><i className="ph ph-spinner ph-spin" /> Sketching…</> : 'Generate silhouette'}
                    {!generating && <CreditCost feature={silhouetteFeature(silQuality)} style={{ marginLeft: 6 }} />}
                  </button>
                </div>

                {/* Render quality — higher quality costs proportionally more
                    credits because it costs proportionally more to generate. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quality</span>
                  {SILHOUETTE_QUALITY_OPTIONS.map(q => {
                    const active = silQuality === q.key;
                    return (
                      <button
                        key={q.key}
                        type="button"
                        title={q.hint}
                        onClick={() => setSilQuality(q.key)}
                        disabled={generating}
                        className="btn btn-sm"
                        style={{
                          padding: '4px 10px', fontSize: 12,
                          background: active ? 'var(--accent-bg)' : 'transparent',
                          borderColor: active ? 'var(--accent)' : undefined,
                          color: active ? 'var(--accent)' : 'var(--ink-3)',
                        }}
                      >
                        {q.label}
                        <CreditCost feature={silhouetteFeature(q.key)} style={{ marginLeft: 5, color: 'inherit', opacity: 0.75 }} />
                      </button>
                    );
                  })}
                </div>
                {generateError && (
                  <div className="form-hint" style={{ color: 'var(--red)', marginTop: 10 }}>
                    <i className="ph ph-warning" style={{ marginRight: 4 }} /> {generateError}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="section-label">In progress</div>

        {dataLoading ? (
          <div className="grid-cards">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : view === 'cards' ? (
          <div className="grid-cards">
            {designProducts.map(p => {
              const d = designs[p.id];
              const menuItems = [
                { label: 'Duplicate', icon: 'ph-copy', onClick: () => handleDuplicate({ stopPropagation() {} }, p) },
                { label: 'Archive', icon: 'ph-archive', onClick: () => handleArchiveToggle({ stopPropagation() {} }, p, true) },
                { label: 'Delete', icon: 'ph-trash', danger: true, onClick: () => setDeleteTarget(p) },
              ];
              return (
                <ContextMenuTarget key={p.id} items={menuItems}>
                  <div className="card-raised card-hover" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => navigate(`/design/${p.id}`)}>
                    <div className="corner-fold" style={{ '--fold-color': 'var(--c-design)' }} />
                    <input
                      type="checkbox"
                      checked={multiSelect.isSelected(p.id)}
                      onClick={e => e.stopPropagation()}
                      onChange={() => multiSelect.toggle(p.id)}
                      style={{ position: 'absolute', top: 14, left: 14, width: 16, height: 16, cursor: 'pointer', zIndex: 1 }}
                      title="Select"
                    />
                    <button
                      className="piece-move-btn"
                      title="Delete design"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                      style={{ color: 'var(--red)' }}
                    >
                      <i className="ph ph-trash" />
                    </button>
                    <button
                      className="piece-move-btn"
                      title="Duplicate design"
                      onClick={e => handleDuplicate(e, p)}
                      disabled={duplicatingId === p.id}
                      style={{ right: 40 }}
                    >
                      <i className={`ph ${duplicatingId === p.id ? 'ph-spinner ph-spin' : 'ph-copy'}`} />
                    </button>
                    <button
                      className="piece-move-btn"
                      title="Archive design"
                      onClick={e => handleArchiveToggle(e, p, true)}
                      style={{ right: 70 }}
                    >
                      <i className="ph ph-archive" />
                    </button>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', marginTop: 6 }}>
                      <div style={{ width: 44, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-3)', borderRadius: 8, color: 'var(--ink-3)', flexShrink: 0, overflow: 'hidden' }}>
                        <DesignThumb
                          url={d?.previewUrl || d?.imageUrl || p?.image_url}
                          name={p.name}
                          fallback={d?.baseType === 'ai-silhouette' && d?.aiPaths?.paths?.length
                            ? <CustomSilhouette paths={d.aiPaths.paths} accents={d.aiPaths.accents} size={30} />
                            : <GarmentSilhouette type={d?.silhouette || 'tee'} size={30} />}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{p.category}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="tag" style={{ background: 'transparent', borderColor: STATUS_COLOR[d?.status] || 'var(--border-2)', color: STATUS_COLOR[d?.status] || 'var(--ink-3)' }}>
                        {d ? d.status : 'Not started'}
                      </span>
                      <span className="tag" style={{ background: 'var(--bg-3)', borderColor: STAGE_COLORS[p.stage] || 'var(--border)', color: STAGE_COLORS[p.stage] || 'var(--ink-2)', fontWeight: 600 }}>
                        <i className="ph ph-compass" style={{ marginRight: 4 }} />
                        {STAGE_LABELS[p.stage] || 'Design'}
                      </span>
                    </div>
                  </div>
                </ContextMenuTarget>
              );
            })}
          </div>
        ) : view === 'kanban' ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DESIGN_STATUSES.length}, 1fr)`, gap: 16 }}>
            {DESIGN_STATUSES.map(status => {
              const inColumn = designProducts.filter(p => (designs[p.id]?.status || 'Sketching') === status);
              const isOver = dnd.overZone === status;
              return (
                <div
                  key={status}
                  {...dnd.dropZoneProps(status, id => handleKanbanDrop(id, status))}
                  style={{
                    background: isOver ? 'color-mix(in srgb, var(--c-design) 8%, transparent)' : 'var(--bg-2)',
                    border: `1.5px dashed ${isOver ? 'var(--c-design)' : 'var(--border)'}`, borderRadius: 'var(--r)',
                    padding: 12, minHeight: 200,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[status] }}>{status}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{inColumn.length}</span>
                  </div>
                  {inColumn.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontStyle: 'italic', padding: '10px 0' }}>Drop a design here</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {inColumn.map(p => (
                      <div
                        key={p.id}
                        {...dnd.draggableProps(p.id)}
                        onClick={() => navigate(`/design/${p.id}`)}
                        className="card-raised card-hover"
                        style={{ padding: '10px 12px', cursor: dnd.draggingId === p.id ? 'grabbing' : 'grab', opacity: dnd.draggingId === p.id ? 0.5 : 1 }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{p.category}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>Design status</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>Risk</th>
                  <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {designProducts.map((p, i) => {
                  const d = designs[p.id];
                  return (
                    <tr
                      key={p.id}
                      className="card-hover"
                      style={{ borderBottom: i < designProducts.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                      onClick={() => navigate(`/design/${p.id}`)}
                    >
                      <td style={{ padding: '10px 20px', fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: '10px 20px', color: 'var(--ink-3)' }}>{p.category || '—'}</td>
                      <td style={{ padding: '10px 20px' }}>
                        <span className="tag" style={{ background: 'transparent', borderColor: STATUS_COLOR[d?.status] || 'var(--border-2)', color: STATUS_COLOR[d?.status] || 'var(--ink-3)' }}>
                          {d ? d.status : 'Not started'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 20px', color: 'var(--ink-3)' }}>{p.risk}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.readiness}%</td>
                    </tr>
                  );
                })}
                {designProducts.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontStyle: 'italic', fontSize: 12.5 }}>No designs in progress yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {showArchived && (
          <>
            <div className="section-label" style={{ marginTop: 28 }}>Archived</div>
            {archivedProducts.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', fontStyle: 'italic' }}>No archived products.</div>
            ) : (
              <div className="grid-cards">
                {archivedProducts.map(p => (
                  <div key={p.id} className="card-raised card-hover" style={{ padding: '16px 18px', cursor: 'pointer', opacity: 0.7 }} onClick={() => navigate(`/design/${p.id}`)}>
                    <button
                      className="piece-move-btn"
                      title="Restore from archive"
                      onClick={e => handleArchiveToggle(e, p, false)}
                    >
                      <i className="ph ph-tray-arrow-up" />
                    </button>
                    <div style={{ minWidth: 0, marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{p.category}</div>
                    </div>
                    <span className="tag" style={{ background: 'transparent', borderColor: 'var(--border-2)', color: 'var(--ink-3)' }}>Archived</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        itemLabel="design"
        itemName={deleteTarget?.name || ''}
        warning="Its tech pack, measurements, and BOM will be deleted with it."
        onConfirm={async () => { await deleteProduct(deleteTarget.id); }}
      />

      {collectionPicker && multiSelect.count > 0 && (
        <div
          onClick={() => setCollectionPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} className="card-raised" style={{ width: '100%', maxWidth: 420, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="card-title">Add {multiSelect.count} design{multiSelect.count === 1 ? '' : 's'} to collection</span>
              <button className="canvas-icon-btn" onClick={() => setCollectionPicker(false)} title="Close"><i className="ph ph-x" /></button>
            </div>
            {collections.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                No collections yet — create one on the{' '}
                <span style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/collections')}>Collections page</span> first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {collections.map(c => (
                  <button
                    key={c.id}
                    className="btn btn-sm"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                    disabled={!!addingToCollection}
                    onClick={() => handleBulkAddToCollection(c.id)}
                  >
                    <span><i className="ph ph-stack" style={{ marginRight: 6 }} />{c.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {addingToCollection === c.id ? 'Adding…' : (c.launch_window || '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'cards' && (
        <BulkActionBar
          count={multiSelect.count}
          onClear={multiSelect.clear}
          actions={[
            { label: 'Add to collection', icon: 'ph-stack', onClick: () => setCollectionPicker(true) },
            { label: bulkArchiving ? 'Archiving…' : 'Archive', icon: 'ph-archive', onClick: handleBulkArchive },
          ]}
        />
      )}
    </>
  );
}
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { useProducts } from '../context/ProductsContext.jsx';
import { useAIUsage } from '../context/AIUsageContext.jsx';
import CreditCost from '../components/CreditCost.jsx';
import { supabase } from '../lib/supabase.js';
import GarmentSilhouette, { CustomSilhouette, VectorSilhouette } from '../components/GarmentSilhouette.jsx';
import PhotopeaEditor from '../components/PhotopeaEditor.jsx';
import FlowStepper from '../components/FlowStepper.jsx';
import TabBar from '../components/TabBar.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import AIStudioTab from '../components/design-studio/AIStudioTab.jsx';
import InspirationTab from '../components/design-studio/InspirationTab.jsx';
import VariantsTab from '../components/design-studio/VariantsTab.jsx';
import HistoryTab from '../components/design-studio/HistoryTab.jsx';
import SkuVariantsTab from '../components/design-studio/SkuVariantsTab.jsx';
import { blobToBase64, uploadDesignImage, uploadDesignPsd, deleteMockupFiles, PSD_VERSION_LABEL, appendViewToPsd } from '../lib/designImages.js';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import Splitter from '../components/Splitter.jsx';
import AssetsTab from '../components/design-studio/AssetsTab.jsx';
import { aiPost } from '../lib/aiApi.js';
import { toast } from '../lib/toast.js';

const SEVERITY_ICON = { amber: 'ph-warning', blue: 'ph-info', green: 'ph-check-circle', red: 'ph-x-circle' };
const DESIGN_STATUSES = ['Sketching', 'Refining', 'Ready'];
const FABRIC_TAG_TYPES = [
  { key: 'composition', label: 'Composition', color: 'var(--c-materials)' },
  { key: 'care', label: 'Care', color: 'var(--c-vendors)' },
  { key: 'origin', label: 'Origin', color: 'var(--c-organization)' },
  { key: 'certification', label: 'Certification', color: 'var(--green)' },
];
const CANVAS_STATUS = {
  loading: { label: 'Canvas ready', color: 'var(--green)' },
  ready: { label: 'Canvas ready', color: 'var(--green)' },
  error: { label: 'Could not load canvas', color: 'var(--red)' },
};
const TABS = [
  { key: 'canvas', label: 'Canvas', icon: 'ph-pencil-simple' },
  { key: 'ai-studio', label: 'AI Studio', icon: 'ph-sparkle' },
  { key: 'inspiration', label: 'Inspiration', icon: 'ph-images' },
  { key: 'image-variants', label: 'Image Variants', icon: 'ph-shuffle' },
  { key: 'skus', label: 'SKUs & Variants', icon: 'ph-barcode' },
  { key: 'history', label: 'History & Comments', icon: 'ph-clock-counter-clockwise' },
  { key: 'assets', label: 'Assets & Media', icon: 'ph-folder-open' },
];

export default function DesignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, designs, getUploadedFile, deleteProduct, updateProduct, touchProduct, activeBrand, categories, duplicateProduct, setProductStatus, updateDesignStatus, updateDesignFabricTags, saveBrandMockup } = useProducts();
  const { canAfford, openTopup, logUsage } = useAIUsage();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingTP, setGeneratingTP] = useState(false);
  const [localAnalysis, setLocalAnalysis] = useState(null);
  const [canvasStatus, setCanvasStatus] = useState('ready');
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [captureError, setCaptureError] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingCanvas, setSavingCanvas] = useState(false);
  const [savingMockup, setSavingMockup] = useState(false);
  const autosaveBusy = useRef(false);
  const autosaveFailures = useRef(0);
  const [toggling, setToggling] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagType, setTagType] = useState('composition');
  const [savingStatus, setSavingStatus] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [splitWidth, setSplitWidth] = useState(560);
  const [duplicating, setDuplicating] = useState(false);
  const [findingVendors, setFindingVendors] = useState(false);
  const [tab, setTab] = useState('canvas');
  const [moodboard, setMoodboard] = useState([]);
  const [palette, setPalette] = useState([]);
  const [variants, setVariants] = useState([]);
  // Alternate garment views (back/side/detail). The main canvas is always the
  // FRONT view; these are switchable tabs beside it so generating a new angle
  // never destroys the front.
  const [views, setViews] = useState([]);
  const [activeView, setActiveView] = useState('front');
  const [switchingView, setSwitchingView] = useState(null);
  const [frontImageUrl, setFrontImageUrl] = useState(null);
  const [frontPsdUrl, setFrontPsdUrl] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const photopeaRef = useRef(null);
  const canvasPanelRef = useRef(null);

  const product = products.find(p => p.id === id);
  const design = designs[id];
  const uploadedFile = getUploadedFile(id);

  // The working canvas file lives only in ProductsContext's in-memory map for
  // the session — after a reload it's gone, and Photopea used to come up on
  // its blank start screen (or a blank template, losing saved work). Fall back
  // to the newest saved snapshot in design_versions: creation writes an
  // 'Initial design' row, manual saves write 'Saved canvas' rows, and the
  // rolling 'Autosave' row keeps this within two minutes of live work.
  const [persistedFile, setPersistedFile] = useState(null);
  // Tracks whether the saved-snapshot lookup has finished. The canvas must not
  // load the blank template/vector fallback until then: the template is a
  // local asset that always wins the race against this async fetch, and the
  // editor's once-per-document guard would then ignore the real saved work
  // when it arrived — reverting the canvas to a blank template.
  const [persistedChecked, setPersistedChecked] = useState(false);
  useEffect(() => {
    setPersistedFile(null);
    setPersistedChecked(false);
    if (!design || uploadedFile) { setPersistedChecked(true); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('design_versions')
          .select('image_url, psd_url, label, created_at')
          .eq('product_id', id)
          .order('created_at', { ascending: false })
          .limit(10);
        // RECENCY WINS. Rows arrive newest-first, so the newest real save is the
        // one to restore — full stop. Preferring "whichever row has a layered
        // file" instead (as this used to) reopened the stale legacy working-file
        // row, which the current save path no longer updates — that's why
        // designs came back as their first generated version. Layers are
        // preferred only WITHIN the newest save.
        const rows = data || [];
        const newest = rows.find(v => v.label !== PSD_VERSION_LABEL);
        const legacyPsd = rows.find(v => v.label === PSD_VERSION_LABEL);

        let psdUrl = newest?.psd_url || null;
        // Pre-030 designs kept the layered file in its own rolling row tracking
        // the same canvas. Use it ONLY when it is at least as recent as the
        // newest save, so a stale one can never resurrect old work.
        if (!psdUrl && legacyPsd?.image_url) {
          const legacyAt = new Date(legacyPsd.created_at || 0).getTime();
          const newestAt = new Date(newest?.created_at || 0).getTime();
          if (!newest || legacyAt >= newestAt) psdUrl = legacyPsd.image_url;
        }

        // Remembered so switching back to Front can reopen it in place.
        if (!cancelled) {
          if (newest?.image_url) setFrontImageUrl(newest.image_url);
          if (psdUrl) setFrontPsdUrl(psdUrl);
        }
        const pickUrl = psdUrl || newest?.image_url;
        if (!pickUrl || cancelled) return;
        const res = await fetch(pickUrl);
        if (!res.ok) throw new Error(`image fetch failed (${res.status})`);
        const blob = await res.blob();
        if (!cancelled) {
          setPersistedFile(psdUrl
            ? new File([blob], 'design.psd', { type: 'image/vnd.adobe.photoshop' })
            : new File([blob], 'design.png', { type: blob.type || 'image/png' }));
        }
      } catch (err) {
        console.error('Could not restore saved design image:', err);
      } finally {
        if (!cancelled) setPersistedChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [id, design?.baseType, uploadedFile]);

  const saveRename = async () => {
    const name = nameDraft.trim();
    if (!name || name === product?.name) { setRenaming(false); return; }
    setSavingName(true);
    try {
      await updateProduct(id, { name });
      setRenaming(false);
    } catch (err) {
      setCaptureError(`Couldn't rename: ${err.message}`);
    } finally {
      setSavingName(false);
    }
  };

  // Capture the current Photopea canvas and persist it as a design_versions
  // snapshot. Manual saves append a restorable 'Saved canvas' row; autosaves
  // keep updating one rolling 'Autosave' row (bumping created_at so it sorts
  // newest) rather than flooding history. Whatever is newest here is exactly
  // what the canvas-restore fallback and every preview load, so saved work
  // survives navigating away, reloads, and new sessions.
  // Capture the canvas ONCE as both a flattened preview and a layered PSD, and
  // store them on the SAME version row. Every save therefore carries its own
  // layer stack, so restoring an old version brings its layers back instead of
  // a flattened image. image_url stays the thumbnail history/previews use;
  // psd_url is what actually gets reopened.
  // Write a version row, retrying without psd_url if that column doesn't exist
  // yet (migration 030 not applied). A save must never fail outright just
  // because layers can't be stored — it simply saves flattened instead.
  // .select('id') on every write is what makes a blocked one detectable. An
  // UPDATE that RLS refuses is NOT an error — it matches zero rows and returns
  // `{data: null, error: null}`, which is indistinguishable from success unless
  // you look at what came back. design_versions had no permissive UPDATE policy
  // at all until 060, so every autosave for months reported success while saving
  // nothing, and the "fall back to an insert" guard below could never fire
  // because it was testing for an error that RLS does not produce.
  const writeVersionRow = async (payload, existingId) => {
    const attempt = (body) => (existingId
      ? supabase.from('design_versions').update(body).eq('id', existingId).select('id')
      : supabase.from('design_versions').insert([{ product_id: id, ...body }]).select('id'));

    let { data, error } = await attempt(payload);
    if (error && /psd_url/i.test(error.message || '')) {
      console.warn('design_versions.psd_url is missing — apply migration 030 to preserve layers. Saving flattened for now.');
      const { psd_url, ...withoutPsd } = payload;
      ({ data, error } = await attempt(withoutPsd));
    }
    if (error) return error;
    if (!data || data.length === 0) {
      // Wrote nothing, silently. Surfaced as a real error so the caller's
      // fallback runs and the autosave failure counter actually counts.
      return new Error('That save was blocked before it reached the database — no row was written.');
    }
    return null;
  };

  // Capture the canvas ONCE as both a flattened preview and a layered PSD, and
  // store them on the SAME version row. Every save therefore carries its own
  // layer stack, so restoring an old version brings its layers back instead of
  // a flattened image. image_url stays the thumbnail history/previews use;
  // psd_url is what actually gets reopened.
  const persistCanvas = async (label) => {
    const capturedUrl = await photopeaRef.current.capture();
    const blob = await fetch(capturedUrl).then(r => r.blob());
    const publicUrl = await uploadDesignImage(blob, id, label === 'Autosave' ? 'autosave' : 'save');
    setFrontImageUrl(publicUrl);

    // Best-effort: an oversized document or a bucket MIME restriction must not
    // lose the save entirely — the raster preview above has already landed.
    let psdUrl = null;
    try {
      const psdBlob = await photopeaRef.current.capturePsd();
      if (psdBlob && psdBlob.size <= 40 * 1024 * 1024) psdUrl = await uploadDesignPsd(psdBlob, id);
      else if (psdBlob) console.warn('PSD too large to store (>40MB) — saved flattened preview only.');
    } catch (err) {
      console.error('PSD capture failed (raster preview still saved):', err);
    }
    if (psdUrl) setFrontPsdUrl(psdUrl);

    // psd_url is written ONLY when a capture actually produced one.
    //
    // This used to be `psd_url: psdUrl` unconditionally, so a failed or
    // oversized capture wrote null over the rolling Autosave row's reference to
    // the last good layered file. The design silently lost its layer stack and
    // reopened flattened — trading the user's layers for nothing at all.
    //
    // Omitting the column leaves the previous value in place on an UPDATE, and
    // leaves it null on an INSERT, which is correct in both cases: a version that
    // never had a layered file genuinely has none, and one that did keeps it.
    //
    // The kept PSD can be a capture or two behind the flat preview beside it.
    // That is the intended trade: slightly stale layers beat no layers, and the
    // restore path prefers the PSD precisely because layers are the valuable part.
    const row = { image_url: publicUrl };
    if (psdUrl) {
      row.psd_url = psdUrl;
    } else {
      console.warn('No PSD captured for this save — keeping the previous layered file rather than clearing it.');
    }
    if (label === 'Autosave') {
      // The files this autosave is about to replace. Read BEFORE the write, used
      // only after it succeeds — this rolling row is the single biggest source of
      // orphaned storage in the app, because each autosave repointed it and left
      // the previous PNG and PSD behind forever.
      const { data: existing } = await supabase
        .from('design_versions').select('id, image_url, psd_url')
        .eq('product_id', id).eq('label', 'Autosave').maybeSingle();
      const superseded = existing ? [existing.image_url, existing.psd_url] : [];

      let error = existing
        ? await writeVersionRow({ ...row, created_at: new Date().toISOString() }, existing.id)
        : await writeVersionRow({ ...row, label: 'Autosave', source: 'autosave' });
      // An update blocked by RLS leaves nothing saved — fall back to an insert.
      if (error && existing) error = await writeVersionRow({ ...row, label: 'Autosave', source: 'autosave' });
      if (error) throw error;

      // Only once the replacement is safely stored, and only files genuinely
      // replaced by this save.
      const toDelete = [];
      if (superseded[0] && superseded[0] !== publicUrl) toDelete.push(superseded[0]);
      // The PSD goes ONLY if a new one actually took its place. A failed capture
      // leaves psdUrl null, and deleting then would destroy the user's only
      // layered file to reclaim a few megabytes — an orphan is the cheaper
      // mistake by a wide margin.
      if (psdUrl && superseded[1] && superseded[1] !== psdUrl) toDelete.push(superseded[1]);
      await deleteMockupFiles(toDelete);
    } else {
      const error = await writeVersionRow({ ...row, label, source: 'manual-save' });
      if (error) throw error;
    }

    setHistoryRefreshKey(k => k + 1);
    // Marks the product as worked on. A canvas save writes to designs and
    // design_versions, so the products trigger never sees it, and without this
    // the piece you just edited would not surface on Home as what you were
    // last doing. Fire-and-forget: it must never fail a save.
    touchProduct(id).catch(() => {});
    return { imageUrl: publicUrl, psdUrl };
  };

  // Save the current canvas as a reusable mockup for the whole brand, so a
  // base block you've perfected here can start future designs. Captures the
  // layered document alongside the flat preview, so starting from it later
  // reopens the layers.
  const handleSaveAsMockup = async () => {
    const name = window.prompt('Name this mockup', product?.name || 'Base mockup');
    if (name === null) return;
    setSavingMockup(true);
    setCaptureError(null);
    try {
      const capturedUrl = await photopeaRef.current.capture();
      const blob = await fetch(capturedUrl).then(r => r.blob());
      let psdBlob = null;
      try {
        const psd = await photopeaRef.current.capturePsd();
        if (psd && psd.size <= 40 * 1024 * 1024) psdBlob = psd;
      } catch (err) {
        console.error('PSD capture failed; saving the mockup flattened:', err);
      }
      await saveBrandMockup({ name, blob, psdBlob });
      toast.success('Saved to your mockups — start a new design from it any time.');
    } catch (err) {
      setCaptureError('Could not save that mockup: ' + err.message);
    } finally {
      setSavingMockup(false);
    }
  };

  const handleSaveCanvas = async () => {
    setSavingCanvas(true);
    setCaptureError(null);
    try {
      await persistCanvas('Saved canvas');
      toast.success('Canvas saved.');
    } catch (err) {
      setCaptureError('Save failed: ' + err.message);
    } finally {
      setSavingCanvas(false);
    }
  };

  // Autosave every 2 minutes while the canvas is live. Best-effort and quiet:
  // an empty canvas (capture times out) or a transient failure just skips the
  // cycle. Guarded so it never overlaps a manual save or another capture-based
  // action (they share Photopea's single capture channel).
  useEffect(() => {
    const timer = setInterval(async () => {
      if (canvasStatus !== 'ready' || autosaveBusy.current || savingCanvas || analyzing || generatingTP || toggling) return;
      autosaveBusy.current = true;
      try {
        await persistCanvas('Autosave');
        autosaveFailures.current = 0;
      } catch (err) {
        // A single miss is normal (empty canvas, transient capture timeout),
        // but silent forever is how a broken autosave hides until work is
        // already lost — so say something once it's clearly not transient.
        autosaveFailures.current += 1;
        console.error('Autosave failed:', err);
        if (autosaveFailures.current === 3) {
          toast.error("Autosave isn't working — use Save to store your work.");
        }
      }
      autosaveBusy.current = false;
    }, 120000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canvasStatus, savingCanvas, analyzing, generatingTP, toggling]);
  // Canvas + AI Studio used to be mutually-exclusive tabs — this is the one
  // place a real side-by-side split exists between them.
  const showSplitStudio = splitView && (tab === 'canvas' || tab === 'ai-studio');

  // Moodboard/palette/variants live on the `designs` row but aren't part of
  // ProductsContext's designs map (kept lean for what every page needs) —
  // loaded directly here, same pattern TechPackDetail uses for tech_packs.
  useEffect(() => {
    async function loadStudioData() {
      // `views` arrives with migration 029. If that hasn't been applied yet the
      // whole select would error and silently take moodboard/palette/variants
      // down with it, so fall back to the pre-029 column set.
      let { data } = await supabase.from('designs').select('moodboard, palette, variants, views').eq('product_id', id).single();
      if (!data) {
        const fallback = await supabase.from('designs').select('moodboard, palette, variants').eq('product_id', id).single();
        data = fallback.data;
      }
      if (data) {
        setMoodboard(data.moodboard || []);
        setPalette(data.palette || []);
        setVariants(data.variants || []);
        setViews(data.views || []);
      }
    }
    loadStudioData();
  }, [id]);

  const persistStudioField = async (field, value) => {
    await supabase.from('designs').update({ [field]: value }).eq('product_id', id);
  };

  const captureCanvasBase64 = async () => {
    const url = await photopeaRef.current.capture();
    const blob = await fetch(url).then(r => r.blob());
    return blobToBase64(blob);
  };

  // ── Garment views ─────────────────────────────────────────────────────────
  // The live canvas always shows exactly one view. Before switching away we
  // capture it back into whichever view is currently active, so moving between
  // Front and Back never loses edits.
  const viewTabs = [{ key: 'front', label: 'Front' }, ...views];

  const saveActiveView = async () => {
    if (activeView === 'front') {
      await persistCanvas('Autosave');
      return;
    }
    const capturedUrl = await photopeaRef.current.capture();
    const blob = await fetch(capturedUrl).then(r => r.blob());
    const publicUrl = await uploadDesignImage(blob, id, 'view');
    // Views keep their own layered file too — switching tabs must not be a
    // slow way of flattening a design.
    let psdUrl = null;
    try {
      const psdBlob = await photopeaRef.current.capturePsd();
      if (psdBlob && psdBlob.size <= 40 * 1024 * 1024) psdUrl = await uploadDesignPsd(psdBlob, id);
    } catch (err) {
      console.error('PSD capture failed for this view (flattened preview still saved):', err);
    }
    const previous = views.find(v => v.key === activeView);
    const next = views.map(v => (
      v.key === activeView ? { ...v, imageUrl: publicUrl, psdUrl: psdUrl || v.psdUrl || null } : v
    ));
    setViews(next);
    await persistStudioField('views', next);

    // Same leak as the autosave row: re-saving a view repointed it and left the
    // previous files behind. Only after the persist succeeds, and note psdUrl is
    // kept when the new capture failed (`psdUrl || v.psdUrl`), so the old PSD is
    // still referenced in that case and must not be removed.
    const supersededViewFiles = [];
    if (previous?.imageUrl && previous.imageUrl !== publicUrl) supersededViewFiles.push(previous.imageUrl);
    if (psdUrl && previous?.psdUrl && previous.psdUrl !== psdUrl) supersededViewFiles.push(previous.psdUrl);
    await deleteMockupFiles(supersededViewFiles);
  };

  // Load a stored view into the canvas, preferring its layered file so the
  // layer stack survives the switch. Posts raw bytes (openFile) rather than a
  // URL, which is the only path that reliably reopens a PSD with its layers.
  const openIntoCanvas = async ({ psdUrl, imageUrl }) => {
    const url = psdUrl || imageUrl;
    if (!url) return;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load that view (${res.status})`);
    await photopeaRef.current?.openFile(await res.blob());
  };

  const switchView = async (key) => {
    if (key === activeView || switchingView) return;
    setSwitchingView(key);
    setCaptureError(null);
    try {
      // Best-effort: an empty canvas can't be captured, which shouldn't block
      // the switch itself.
      try { await saveActiveView(); } catch (err) { console.error('Could not save the current view:', err); }
      const target = key === 'front'
        ? { psdUrl: frontPsdUrl, imageUrl: frontImageUrl }
        : (views.find(v => v.key === key) || {});
      await openIntoCanvas(target);
      setActiveView(key);
    } finally {
      setSwitchingView(null);
    }
  };

  // Called by the AI Studio "Generate a View" tool instead of overwriting the
  // canvas: the new angle becomes its own tab and the front view survives.
  // A generated back or side view goes ON the current canvas, to the right of
  // what is already there, rather than replacing it or opening in its own tab.
  // A designer judging proportion needs both at once, and the design review
  // captures the canvas — so views in separate tabs meant it could only ever
  // see one, and "the back view is entirely missing" was its most common
  // finding on designs that had a back.
  //
  // Done by rebuilding the PSD rather than scripting Photopea, because
  // Photopea cannot do this: checked against a live instance, resizeCanvas and
  // Layer.translate are both undefined, so there is no scripted way to widen
  // the canvas or move a layer into the new space.
  const addViewFromResult = async (dataUrl, label) => {
    const key = `view-${Date.now()}`;
    const name = (label || '').trim() ? label.trim().slice(0, 24) : 'New view';
    setSwitchingView(key);
    setCaptureError(null);
    try {
      setTab('canvas');
      const psdBlob = await photopeaRef.current.capturePsd();
      const combined = await appendViewToPsd(psdBlob, dataUrl, name);
      await photopeaRef.current.openFile(combined);
      // Give Photopea a moment to finish opening before capturing it back.
      await new Promise(r => setTimeout(r, 1500));
      await persistCanvas(`Added ${name}`);
      toast.success(`"${name}" placed beside your existing view.`);
    } catch (err) {
      setCaptureError(`Could not place that view on the canvas: ${err.message}`);
    } finally {
      setSwitchingView(null);
    }
  };

  const deleteView = async (key) => {
    const next = views.filter(v => v.key !== key);
    setViews(next);
    await persistStudioField('views', next);
    if (activeView === key) {
      setActiveView('front');
      await openIntoCanvas({ psdUrl: frontPsdUrl, imageUrl: frontImageUrl }).catch(() => {});
    }
  };

  // Restoring a saved version reopens its OWN layered file, so history is a
  // real undo trail rather than a gallery of flattened screenshots. Versions
  // saved before migration 030 have no psd_url and restore flattened — the
  // History row says so rather than pretending otherwise.
  const restoreVersion = async (v) => {
    setCaptureError(null);
    try {
      await openIntoCanvas({ psdUrl: v.psd_url, imageUrl: v.image_url });
      setTab('canvas');
      toast.success(v.psd_url ? 'Version restored with its layers.' : 'Version restored (this one was saved flattened).');
    } catch (err) {
      setCaptureError('Could not restore that version: ' + err.message);
    }
  };

  const applyResultToCanvas = (url) => {
    photopeaRef.current?.openImage(url);
    setTab('canvas');
  };

  // Non-destructive counterpart — adds an AI Studio "addition" result as its
  // own new layer instead of replacing everything already on the canvas.
  const addLayerToCanvas = (url) => {
    photopeaRef.current?.addLayer(url);
    setTab('canvas');
  };

  const [templateFile, setTemplateFile] = useState(null);
  const [svgFallback, setSvgFallback] = useState(null);

  useEffect(() => {
    if (!design || design.baseType === 'upload') {
      setTemplateFile(null);
      setSvgFallback(null);
      return;
    }

    if (design.baseType === 'ai-silhouette') {
      // Legacy designs generated before "Generate silhouette" switched to real
      // AI image generation still carry vector path data — render those from
      // the stored paths. Newer ones are a raster image (an actual generated
      // sketch, not guessed SVG coordinates) that arrives via `uploadedFile`,
      // same as an uploaded mockup — nothing to fetch or fall back to here.
      if (design.aiPaths?.paths?.length) {
        setSvgFallback(renderToStaticMarkup(
          <CustomSilhouette paths={design.aiPaths.paths} accents={design.aiPaths.accents} size={900} strokeWidth={0.3} color="#1a1a1a" />
        ));
      } else {
        setSvgFallback(null);
      }
      setTemplateFile(null);
      return;
    }

    const type = design.silhouette || 'tee';
    let cancelled = false;

    // Attempt to load the real template photo. If it 404s, fall back to the vector shapes.
    fetch(`/silhouettes/${type}.jpeg`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.blob();
      })
      .then(blob => {
        if (cancelled) return;
        setTemplateFile(new File([blob], `${type}.jpeg`, { type: 'image/jpeg' }));
        setSvgFallback(null);
      })
      .catch(() => {
        if (cancelled) return;
        setSvgFallback(renderToStaticMarkup(
          <VectorSilhouette type={type} size={900} strokeWidth={0.3} color="#1a1a1a" />
        ));
        setTemplateFile(null);
      });

    return () => { cancelled = true; };
  }, [design?.silhouette, design?.baseType, design?.aiPaths]);

  // Native Fullscreen Listener: Synchronizes the UI state instantly
  // even if the user exits fullscreen using the physical Escape key.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setExpanded(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!product || !design) {
    return (
      <div className="content">
        <EmptyState icon="ph-magnifying-glass" title="Design not found" sub="This workspace doesn't exist yet." />
      </div>
    );
  }

  const analysis = localAnalysis || design.analysis;
  const statusMeta = CANVAS_STATUS[canvasStatus] || CANVAS_STATUS.ready;

  const captureAndAnalyze = async () => {
    if (!canAfford('analyze-design')) { openTopup(); return; }
    setCaptureError(null);
    setAnalyzing(true);

    try {
      const url = await photopeaRef.current.capture();
      setSnapshot(url);

      const response = await fetch(url);
      const blob = await response.blob();
      
      const base64data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
          
      const apiRes = await aiPost('/api/analyze-design', {
        imageBase64: base64data,
        product: product ? { name: product.name, category: product.category, stage: product.stage, risk: product.risk, budget: product.budget } : null,
        design: design ? {
          garment_type: design.garment_type, silhouette: design.silhouette, base_type: design.base_type,
          colorway: design.colorway, fabric_tags: design.fabric_tags, palette: design.palette, moodboard: design.moodboard,
        } : null,
      });
      
      const data = await apiRes.json();
      if (data.ok) {
        await logUsage('analyze-design');
        setLocalAnalysis(data.analysis);
        await supabase.from('designs').update({ analysis: data.analysis }).eq('product_id', id);

        setTimeout(() => {
          document.getElementById('analysis-result-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setCaptureError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConvertToTechPack = async () => {
    if (!canAfford('generate-tech-pack')) { openTopup(); return; }
    setGeneratingTP(true);
    setCaptureError(null);
    try {
      let base64data;
      let blobToUpload;
      
      if (!snapshot) {
        const url = await photopeaRef.current.capture();
        setSnapshot(url);
        const response = await fetch(url);
        blobToUpload = await response.blob();
        base64data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blobToUpload);
        });
      } else {
        const response = await fetch(snapshot);
        blobToUpload = await response.blob();
        base64data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blobToUpload);
        });
      }

      // 1. UPLOAD IMAGE TO SUPABASE STORAGE
      const fileName = `${id}-${Date.now()}.jpeg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('mockups')
        .upload(fileName, blobToUpload, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw new Error("Image Upload Failed: " + uploadError.message);

      // Get the permanent public URL
      const { data: { publicUrl } } = supabase.storage
        .from('mockups')
        .getPublicUrl(fileName);
      
      // 2. ASK AI TO GENERATE TECH PACK
      const apiRes = await aiPost('/api/generate-tech-pack', { imageBase64: base64data });
      
      const data = await apiRes.json();
      if (!data.ok) throw new Error(data.error);
      await logUsage('generate-tech-pack');

      // 3. SAVE EVERYTHING TO DB
      await supabase.from('tech_packs').upsert({
        product_id: id,
        image_url: publicUrl, // Save the permanent image link!
        bom: data.techPackData.bom,
        measurements: data.techPackData.measurements,
        updated_at: new Date().toISOString()
      }, { onConflict: 'product_id' });

      await supabase.from('products').update({ stage: 'techpack' }).eq('id', id);
      navigate(`/tech-packs/${id}`);

    } catch (err) {
      setCaptureError("Tech Pack Error: " + err.message);
      setGeneratingTP(false);
    }
  };

  const toggleExpand = async () => {
    setToggling(true);
    try {
      const url = await photopeaRef.current.capture();
      const blob = await fetch(url).then(r => r.blob());
      setRestoreFile(new File([blob], 'canvas.jpeg', { type: 'image/jpeg' }));
    } catch {}
    setToggling(false);

    // Call the browser's native OS-level Fullscreen API
    if (!document.fullscreenElement) {
      canvasPanelRef.current?.requestFullscreen().catch(err => {
        console.error("Error enabling fullscreen:", err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error("Error exiting fullscreen:", err);
      });
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const newId = await duplicateProduct(id);
      navigate(`/design/${newId}`);
    } catch (err) {
      setCaptureError('Duplicate failed: ' + err.message);
      setDuplicating(false);
    }
  };

  const handleFindVendors = async () => {
    setFindingVendors(true);
    try {
      let imageBase64 = null;
      try { imageBase64 = await captureCanvasBase64(); } catch { /* search still works without the image */ }
      navigate('/vendors', {
        state: {
          fromDesign: true,
          keywords: design.garmentType,
          category: product.category,
          productName: product.name,
          imageBase64,
        },
      });
    } finally {
      setFindingVendors(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await setProductStatus(id, status);
      // Archived products drop out of the main `products` list, so staying
      // on this page would immediately hit the "not found" empty state —
      // head back to the list instead, same as after a delete.
      if (status === 'archived') navigate('/design');
    } catch (err) {
      setCaptureError('Failed to update status: ' + err.message);
    }
  };

  const handleDesignStatusChange = async (status) => {
    setSavingStatus(true);
    try {
      await updateDesignStatus(id, status);
    } catch (err) {
      setCaptureError('Failed to update design status: ' + err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  const addFabricTag = async () => {
    const label = tagDraft.trim();
    if (!label) return;
    const next = [...(design.fabricTags || []), { type: tagType, label }];
    setTagDraft('');
    try {
      await updateDesignFabricTags(id, next);
    } catch (err) {
      setCaptureError('Failed to save tag: ' + err.message);
    }
  };

  const removeFabricTag = async (index) => {
    const next = (design.fabricTags || []).filter((_, i) => i !== index);
    try {
      await updateDesignFabricTags(id, next);
    } catch (err) {
      setCaptureError('Failed to remove tag: ' + err.message);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Design Studio', path: '/design' }, { label: product.name }]} />
            <div className="page-eyebrow" style={{ color: 'var(--c-design)' }}>Design Studio</div>
            {renaming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="form-input"
                  autoFocus
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(false); }}
                  style={{ fontSize: 18, fontWeight: 600, maxWidth: 340 }}
                />
                <button className="btn btn-sm btn-primary" onClick={saveRename} disabled={savingName || !nameDraft.trim()}>
                  {savingName ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-sm" onClick={() => setRenaming(false)} disabled={savingName}>Cancel</button>
              </div>
            ) : (
              <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {product.name}
                <button
                  className="canvas-icon-btn"
                  title="Rename design"
                  onClick={() => { setNameDraft(product.name); setRenaming(true); }}
                  style={{ color: 'var(--ink-3)' }}
                >
                  <i className="ph ph-pencil-simple" />
                </button>
              </h1>
            )}
          </div>
          <div className="page-sub">{product.category}</div>
        </div>
        <div className="topbar-right">
          {(tab === 'canvas' || tab === 'ai-studio') && (
            <button className="btn btn-sm" onClick={() => setSplitView(s => !s)} title={splitView ? 'Show one panel at a time' : 'Show canvas and AI Studio side by side'}>
              <i className={`ph ${splitView ? 'ph-columns' : 'ph-square-split-horizontal'}`} /> {splitView ? 'Split view on' : 'Split view'}
            </button>
          )}
          <button className="canvas-icon-btn" onClick={() => setConfirmingDelete(true)} title="Delete design" style={{ color: 'var(--red)' }}>
            <i className="ph ph-trash" />
          </button>
          <button className="canvas-icon-btn" onClick={handleDuplicate} disabled={duplicating} title="Duplicate design">
            <i className={`ph ${duplicating ? 'ph-spinner ph-spin' : 'ph-copy'}`} />
          </button>
          <button className="btn btn-primary" onClick={handleConvertToTechPack} disabled={generatingTP || analyzing}>
            {generatingTP ? <><i className="ph ph-spinner ph-spin" /> Saving & Generating...</> : <><i className="ph ph-magic-wand" /> Auto-Generate Tech Pack</>}
            {!generatingTP && <CreditCost feature="generate-tech-pack" style={{ marginLeft: 6, color: 'inherit', opacity: 0.8 }} />}
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        itemLabel="design"
        itemName={product.name}
        warning="Its tech pack, measurements, and BOM will be deleted with it."
        onConfirm={async () => { await deleteProduct(id); navigate('/design'); }}
      />

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={id} current="design" />
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} accent="var(--c-design)" />

      <div className="content">
        {captureError && (
          <div className="alert" style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
            <i className="ph ph-warning" style={{ marginTop: 1 }} />
            <div><strong>Error:</strong> {captureError}</div>
          </div>
        )}

        {/* Kept mounted (display:none, not unmounted) when other tabs are active so
            the Photopea iframe never reloads and in-progress canvas work survives
            switching to AI Studio/Inspiration/etc. and back. Also shown while on the
            AI Studio tab in split view, since the canvas needs to render beside it. */}
        <div style={{ display: (tab === 'canvas' || showSplitStudio) ? 'block' : 'none' }}>
        {analysis && (
          <div style={{ maxWidth: 1080, marginBottom: 16 }} id="analysis-result-card">
            <div className="card-raised">
              <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <span className="card-title">AI Design Critique</span>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>A critique of this exact canvas snapshot, judged against your brand profile, this product's budget and live trend data. Scored on six weighted dimensions and deliberately harsh: a good-looking sketch with nothing specified belongs in the 30s, not the 80s.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  {snapshot && <img src={snapshot} alt="Captured canvas snapshot" style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', borderRadius: 8, border: '1.5px solid var(--border-2)', flexShrink: 0 }} />}
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 700, color: analysis.score >= 80 ? 'var(--green)' : 'var(--amber)' }}>
                    {analysis.score}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Factory Readiness Score</div>
                    {analysis.cappedBy && (
                      <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 2 }}>Capped by {analysis.cappedBy}</div>
                    )}
                  </div>
                </div>

                {analysis.verdict && (
                  <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 16, paddingLeft: 12, borderLeft: '2px solid var(--border-2)' }}>
                    {analysis.verdict}
                  </div>
                )}

                {Array.isArray(analysis.dimensions) && analysis.dimensions.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 8 }}>What makes up the score</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {analysis.dimensions.map(d => (
                        <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 132, fontSize: 12.5, color: 'var(--ink-2)', flexShrink: 0 }}>{d.label}</div>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden', minWidth: 60 }}>
                            <div style={{ width: `${d.score ?? 0}%`, height: '100%', background: (d.score ?? 0) >= 76 ? 'var(--green)' : (d.score ?? 0) >= 56 ? 'var(--amber)' : 'var(--red)' }} />
                          </div>
                          <div style={{ width: 34, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12.5, flexShrink: 0 }}>{d.score ?? '—'}</div>
                          <div style={{ width: 34, textAlign: 'right', fontSize: 11, color: 'var(--ink-4)', flexShrink: 0 }}>×{d.weight}%</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
                      {analysis.dimensions.filter(d => d.reason).map(d => (
                        <div key={d.key} style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                          <strong style={{ color: 'var(--ink-2)' }}>{d.label}:</strong> {d.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(analysis.notes || []).map((note, i) => (
                    <div key={i} className={`alert alert-${note.severity}`} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, fontSize: 13 }}>
                      <i className={SEVERITY_ICON[note.severity] || "ph ph-info"} style={{ marginTop: 2 }} />
                      <div>{note.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Split view pins both panes to the same height and lets each scroll on
            its own. Previously the row was align-items:flex-start with only the
            canvas given a height, so the AI Studio column (nine tool cards) ran
            roughly twice as tall, and scrolling down to reach a tool scrolled
            the canvas off screen — which defeats the one thing split view is
            for: comparing an AI result against the live canvas. */}
        <div className="canvas-row" style={{ maxWidth: showSplitStudio ? 'none' : 1080, display: 'flex', gap: showSplitStudio ? 0 : 16, alignItems: showSplitStudio ? 'stretch' : 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: showSplitStudio ? '0 0 auto' : 1, width: showSplitStudio ? splitWidth : undefined, minWidth: 0, height: expanded ? 0 : 600 }}>
            <div ref={canvasPanelRef} className={`canvas-panel ${expanded ? 'expanded' : ''}`} style={{ '--cp-accent': 'var(--c-design)' }}>
              <div className="canvas-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                  {/* One tab per garment view. Front is the main canvas; extra
                      views are added by the AI "Generate a View" tool. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {viewTabs.map(v => {
                      const isActive = activeView === v.key;
                      const isBusy = switchingView === v.key;
                      return (
                        <div key={v.key} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <button
                            onClick={() => switchView(v.key)}
                            disabled={!!switchingView}
                            title={isActive ? `${v.label} view (showing)` : `Switch to the ${v.label} view`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: v.key === 'front' ? '4px 10px' : '4px 20px 4px 10px',
                              fontSize: 12, fontWeight: isActive ? 700 : 500,
                              background: isActive ? 'var(--bg-1)' : 'transparent',
                              color: isActive ? 'var(--ink)' : 'var(--ink-3)',
                              border: '1px solid', borderColor: isActive ? 'var(--border-2)' : 'transparent',
                              borderRadius: 'var(--r-sm)', cursor: switchingView ? 'default' : 'pointer',
                              maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            {isBusy && <i className="ph ph-circle-notch ph-spin" style={{ fontSize: 11 }} />}
                            {v.label}
                          </button>
                          {v.key !== 'front' && (
                            <button
                              onClick={() => deleteView(v.key)}
                              disabled={!!switchingView}
                              title={`Remove the ${v.label} view`}
                              style={{
                                position: 'absolute', right: 5, background: 'none', border: 'none',
                                color: 'var(--ink-4)', cursor: 'pointer', fontSize: 11, padding: 2, lineHeight: 1,
                              }}
                            >
                              <i className="ph ph-x" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="canvas-panel-badge">
                    <span className="canvas-panel-dot" style={{ background: statusMeta.color }} />
                    {switchingView ? 'Switching view…' : statusMeta.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    onClick={handleSaveCanvas}
                    disabled={savingCanvas || analyzing || generatingTP || toggling || canvasStatus !== 'ready'}
                    title="Save the current canvas as a snapshot (it also autosaves every 2 minutes)"
                  >
                    {savingCanvas ? <><i className="ph ph-spinner ph-spin" /> Saving…</> : <><i className="ph ph-floppy-disk" /> Save</>}
                  </button>
                  <button
                    className="canvas-icon-btn"
                    onClick={handleSaveAsMockup}
                    disabled={savingMockup || savingCanvas || analyzing || generatingTP || toggling || canvasStatus !== 'ready'}
                    title="Save this canvas as a reusable mockup for future designs"
                  >
                    <i className={`ph ${savingMockup ? 'ph-circle-notch ph-spin' : 'ph-bookmark-simple'}`} />
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={captureAndAnalyze} disabled={analyzing || generatingTP}>
                    {analyzing ? 'Analyzing...' : 'Analyze Design'}
                    {!analyzing && <CreditCost feature="analyze-design" style={{ marginLeft: 6, color: 'inherit', opacity: 0.8 }} />}
                  </button>
                  <button className="canvas-icon-btn" onClick={toggleExpand} disabled={toggling}>
                    <i className={`ph ${expanded ? 'ph-corners-in' : 'ph-corners-out'}`} />
                  </button>
                </div>
              </div>
              
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ display: toggling ? 'flex' : 'none', position: 'absolute', inset: 0, background: 'var(--bg-2)', zIndex: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ph ph-spinner ph-spin" style={{ fontSize: 24, color: 'var(--ink-3)' }} />
                </div>
                <PhotopeaEditor 
                  ref={photopeaRef} 
                  svgMarkup={(restoreFile || !persistedChecked) ? null : svgFallback}
                  file={restoreFile || uploadedFile || persistedFile || (persistedChecked ? templateFile : null)}
                  onStatusChange={setCanvasStatus} 
                />
              </div>
            </div>
          </div>

          {showSplitStudio ? (
            <>
              <Splitter width={splitWidth} onWidthChange={setSplitWidth} min={360} max={900} />
              {/* Same explicit height as the canvas pane (not 100%, so it stays
                  correct when the mobile breakpoint stacks the row), with its
                  own scrollbar so the tool list moves independently. */}
              <div className="split-studio-pane" style={{ flex: 1, minWidth: 0, height: expanded ? undefined : 600, overflowY: 'auto', paddingLeft: 16 }}>
                <AIStudioTab
                  productId={id}
                  onCapture={captureCanvasBase64}
                  onApplyToCanvas={applyResultToCanvas}
                  onAddView={addViewFromResult}
                  onAddLayer={addLayerToCanvas}
                  logUsage={logUsage}
                  onVersionSaved={() => setHistoryRefreshKey(k => k + 1)}
                />
              </div>
            </>
          ) : (
          <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-raised">
              <div className="card-header"><span className="card-title">Details</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Garment type</label>
                  <div style={{ fontSize: 13.5 }}>{design.garmentType}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={product.category || ''} onChange={e => updateProduct(id, { category: e.target.value })}>
                    {product.category && !categories.some(c => c.name === product.category) && (
                      <option value={product.category}>{product.category}</option>
                    )}
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Colorway (sketch)</label>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>{design.colorway || '—'}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Product status</label>
                  <select className="form-input" value={product.status || 'active'} onChange={e => handleStatusChange(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="discontinued">Discontinued</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Design status</label>
                  <select className="form-input" value={design.status || 'Sketching'} onChange={e => handleDesignStatusChange(e.target.value)} disabled={savingStatus}>
                    {DESIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Fabric tags</label>
                  {(design.fabricTags || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {design.fabricTags.map((t, i) => {
                        const meta = FABRIC_TAG_TYPES.find(ft => ft.key === t.type) || FABRIC_TAG_TYPES[0];
                        return (
                          <span key={i} className="tag" style={{ background: 'transparent', borderColor: meta.color, color: meta.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {t.label}
                            <button onClick={() => removeFabricTag(i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-input" style={{ width: 108, fontSize: 12 }} value={tagType} onChange={e => setTagType(e.target.value)}>
                      {FABRIC_TAG_TYPES.map(ft => <option key={ft.key} value={ft.key}>{ft.label}</option>)}
                    </select>
                    <input
                      className="form-input" style={{ flex: 1, fontSize: 12 }} placeholder="e.g. 100% GOTS cotton"
                      value={tagDraft} onChange={e => setTagDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFabricTag(); } }}
                    />
                    <button className="btn btn-sm" onClick={addFabricTag} disabled={!tagDraft.trim()}><i className="ph ph-plus" /></button>
                  </div>
                </div>
                <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={() => setTab('skus')}>
                  <i className="ph ph-barcode" /> Manage SKUs & Variants
                </button>
                <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleFindVendors} disabled={findingVendors}>
                  <i className={`ph ${findingVendors ? 'ph-spinner ph-spin' : 'ph-handshake'}`} /> {findingVendors ? 'Capturing design…' : 'Find Vendors for this Design'}
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
        </div>

        {tab === 'ai-studio' && !showSplitStudio && (
          <AIStudioTab
            productId={id}
            onCapture={captureCanvasBase64}
            onApplyToCanvas={applyResultToCanvas}
            onAddView={addViewFromResult}
            onAddLayer={addLayerToCanvas}
            logUsage={logUsage}
            onVersionSaved={() => setHistoryRefreshKey(k => k + 1)}
          />
        )}

        {tab === 'inspiration' && (
          <InspirationTab
            productId={id}
            category={design.garmentType}
            moodboard={moodboard}
            onMoodboardChange={v => { setMoodboard(v); persistStudioField('moodboard', v); }}
            palette={palette}
            onPaletteChange={v => { setPalette(v); persistStudioField('palette', v); }}
            onCapture={captureCanvasBase64}
            logUsage={logUsage}
          />
        )}

        {tab === 'image-variants' && (
          <VariantsTab
            productId={id}
            variants={variants}
            onChange={v => { setVariants(v); persistStudioField('variants', v); }}
            onCapture={captureCanvasBase64}
            onApplyToCanvas={applyResultToCanvas}
            logUsage={logUsage}
          />
        )}

        {tab === 'skus' && (
          <SkuVariantsTab
            productId={id}
            product={product}
            brandName={activeBrand?.name}
            onUpdateProduct={updates => updateProduct(id, updates)}
          />
        )}

        {tab === 'assets' && (
          <AssetsTab productId={id} />
        )}
        
        {tab === 'history' && (
          <HistoryTab key={historyRefreshKey} productId={id} onApplyToCanvas={applyResultToCanvas} onRestoreVersion={restoreVersion} />
        )}
      </div>
    </>
  );
}
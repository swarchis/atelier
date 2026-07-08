import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { useProducts } from '../context/ProductsContext.jsx';
import GarmentSilhouette from '../components/GarmentSilhouette.jsx';
import PhotopeaEditor from '../components/PhotopeaEditor.jsx';
import FlowStepper from '../components/FlowStepper.jsx';
import EmptyState from '../components/EmptyState.jsx';

const GENERIC_ANALYSIS = {
  score: 68,
  notes: [
    { severity: 'amber', text: 'Proportions look consistent, but the shoulder line may need a flatter angle for this fabric weight.' },
    { severity: 'blue', text: 'No strong silhouette overlap with your existing catalog — this reads as distinct.' },
    { severity: 'amber', text: 'Consider adding a reference note on intended fabric drape before converting to a tech pack.' },
  ],
};

const SEVERITY_ICON = { amber: 'ph-warning', blue: 'ph-info', green: 'ph-check-circle', red: 'ph-x-circle' };
const CANVAS_STATUS = {
  loading: { label: 'Loading Photopea…', color: 'var(--ink-4)' },
  ready: { label: 'Canvas ready', color: 'var(--green)' },
  error: { label: 'Could not load canvas', color: 'var(--red)' },
};

export default function DesignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, designs, getUploadedFile } = useProducts();
  const [analyzing, setAnalyzing] = useState(false);
  const [localAnalysis, setLocalAnalysis] = useState(null);
  const [canvasStatus, setCanvasStatus] = useState('loading');
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [captureError, setCaptureError] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [toggling, setToggling] = useState(false);
  const photopeaRef = useRef(null);

  const product = products.find(p => p.id === id);
  const design = designs[id];
  const uploadedFile = design?.baseType === 'upload' ? getUploadedFile(id) : null;

  const svgMarkup = useMemo(() => {
    if (!design || design.baseType === 'upload') return null;
    return renderToStaticMarkup(<GarmentSilhouette type={design.silhouette || 'tee'} size={900} strokeWidth={4} color="#1a1a1a" />);
  }, [design]);

  // Escape exits fullscreen; lock page scroll while expanded so the overlay behaves like a real focus mode.
  useEffect(() => {
    if (!expanded) return;
    const onKey = e => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [expanded]);

  if (!product || !design) {
    return (
      <div className="content">
        <EmptyState icon="ph-magnifying-glass" title="Design not found" sub="This workspace doesn't exist yet." />
      </div>
    );
  }

  const analysis = design.analysis || localAnalysis;
  const statusMeta = CANVAS_STATUS[canvasStatus];

  const captureAndAnalyze = async () => {
    setCaptureError(null);
    try {
      const url = await photopeaRef.current.capture();
      setSnapshot(url);
      setAnalyzing(true);
      setTimeout(() => { setLocalAnalysis(GENERIC_ANALYSIS); setAnalyzing(false); }, 900);
    } catch (err) {
      setCaptureError(err.message || 'Could not capture the canvas');
    }
  };

  // Photopea doesn't reliably re-layout its own internal UI when the iframe
  // that holds it gets resized (confirmed live — jumping to a much wider
  // container leaves its canvas stuck at the old size). Rather than fight
  // that, we grab a flattened snapshot of whatever's on the canvas right
  // before toggling, then remount Photopea fresh at the new size and reopen
  // that snapshot — visually seamless, though it does flatten layers.
  const toggleExpand = async () => {
    if (canvasStatus === 'ready') {
      setToggling(true);
      try {
        const url = await photopeaRef.current.capture();
        const blob = await fetch(url).then(r => r.blob());
        setRestoreFile(new File([blob], 'canvas.png', { type: 'image/png' }));
      } catch {
        // If capture fails, we just remount with whatever the original source was.
      }
      setToggling(false);
    }
    setCanvasStatus('loading');
    setExpanded(e => !e);
  };

  const canvasPanel = (
    <div className={`canvas-panel ${expanded ? 'expanded' : ''}`} style={{ '--cp-accent': 'var(--c-design)' }}>
      <div className="canvas-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Canvas</span>
          <span className="canvas-panel-badge">
            <span className="canvas-panel-dot" style={{ background: statusMeta.color }} />
            {statusMeta.label}
          </span>
          <span className="canvas-panel-badge">powered by <a href="https://www.photopea.com" target="_blank" rel="noreferrer" style={{ marginLeft: 3 }}>Photopea</a> — opens .psd &amp; .ai natively</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={captureAndAnalyze} disabled={canvasStatus !== 'ready' || analyzing}>
            {analyzing ? <><i className="ph ph-circle-notch" /> Analyzing…</> : <><i className="ph ph-magic-wand" /> Capture &amp; analyze</>}
          </button>
          <button className="canvas-icon-btn" title={expanded ? 'Exit fullscreen (Esc)' : 'Expand to fullscreen'} onClick={toggleExpand} disabled={toggling}>
            <i className={`ph ${toggling ? 'ph-circle-notch' : expanded ? 'ph-corners-in' : 'ph-corners-out'}`} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PhotopeaEditor
          key={expanded ? 'expanded' : 'inline'}
          ref={photopeaRef}
          svgMarkup={restoreFile ? null : svgMarkup}
          file={restoreFile || uploadedFile}
          onStatusChange={setCanvasStatus}
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-design)' }}>Design</div>
            <h1 className="page-title">{product.name}</h1>
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={() => navigate(`/tech-packs/${product.id}`)}>
            <i className="ph ph-ruler" /> Convert to tech pack
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={product.id} current="design" />
      </div>

      <div className="content">
        {/* Capped width on purpose — a single fixed-height panel stretched edge-to-edge
            on a wide monitor turns into an unusable letterbox strip. Canvas sits beside
            the sidebar here instead of stacking above it, so the space is actually used. */}
        <div style={{ maxWidth: 1080, display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          {/* .canvas-panel.expanded is position:fixed and escapes this wrapper entirely —
              this stays a single mounted instance either way, so the live canvas is never lost. */}
          <div style={{ flex: 1, minWidth: 0, height: expanded ? 0 : 600 }}>
            {canvasPanel}
          </div>

          {/* Side panel */}
          <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-raised">
              <div className="card-header"><span className="card-title">Details</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Garment type</label>
                  <div style={{ fontSize: 13.5 }}>{design.garmentType}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Colorway</label>
                  <input className="form-input" defaultValue={design.baseType === 'upload' ? '' : design.colorway} placeholder="e.g. Ash / Ecru trim" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Status</label>
                  <span className="tag tag-accent">{design.status}</span>
                </div>
              </div>
            </div>

            <div className="card-raised">
              <div className="card-header"><span className="card-title">Creative Cloud sync</span></div>
              <div className="card-body">
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 14 }}>
                  Link Adobe Creative Cloud to pass this mockup back and forth with Photoshop or Illustrator on your desktop.
                </p>
                <button className="btn" disabled style={{ opacity: 0.55, cursor: 'not-allowed', width: '100%', justifyContent: 'center' }}>
                  <i className="ph ph-cloud-arrow-up" /> Connect Creative Cloud
                </button>
                <div className="form-hint" style={{ marginTop: 8 }}>Needs a backend OAuth connection to Adobe — not wired up yet in this frontend-only build.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1080 }}>
          {/* Analysis */}
          <div className="card-raised">
            <div className="card-header">
              <span className="card-title">Design analysis</span>
            </div>
            <div className="card-body">
              {captureError && (
                <div className="alert" style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
                  <i className="ph ph-warning" style={{ marginTop: 1 }} />
                  {captureError} — give the canvas a second to finish loading and try again.
                </div>
              )}
              {analysis ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    {snapshot && <img src={snapshot} alt="Captured canvas snapshot" style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', borderRadius: 8, border: '1.5px solid var(--border-2)', flexShrink: 0 }} />}
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 700, color: analysis.score >= 80 ? 'var(--green)' : analysis.score >= 55 ? 'var(--amber)' : 'var(--red)' }}>
                      {analysis.score}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Design clarity score<br />based on proportion, construction feasibility, and catalog overlap</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analysis.notes.map((n, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 8, background: `var(--${n.severity}-bg)`, border: `1px solid var(--${n.severity}-border)`, color: `var(--${n.severity})`, fontSize: 13.5 }}>
                        <i className={`ph ${SEVERITY_ICON[n.severity]}`} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{n.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState icon="ph-magic-wand" color="var(--c-design)" title="Not analyzed yet" sub="Draw or place something on the canvas above, then hit “Capture & analyze” to pull it in here." />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { useProducts } from '../context/ProductsContext.jsx';
import { supabase } from '../lib/supabase.js';
import GarmentSilhouette from '../components/GarmentSilhouette.jsx';
import PhotopeaEditor from '../components/PhotopeaEditor.jsx';
import FlowStepper from '../components/FlowStepper.jsx';
import EmptyState from '../components/EmptyState.jsx';

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
  const [generatingTP, setGeneratingTP] = useState(false); // New state for Tech Pack Gen
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

  const analysis = localAnalysis || design.analysis;
  const statusMeta = CANVAS_STATUS[canvasStatus];

  // 1. Capture Canvas and get Analysis
  const captureAndAnalyze = async () => {
    setCaptureError(null);
    setAnalyzing(true);
    
    try {
      const url = await photopeaRef.current.capture();
      setSnapshot(url);

      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onloadend = async () => {
        try {
          const base64data = reader.result.split(',')[1];
          
          const apiRes = await fetch('http://localhost:3001/api/analyze-design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64data })
          });
          
          const data = await apiRes.json();
          if (data.ok) {
            setLocalAnalysis(data.analysis);
            await supabase.from('designs').update({ analysis: data.analysis }).eq('product_id', product.id);
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          setCaptureError(err.message);
        } finally {
          setAnalyzing(false);
        }
      };
    } catch (err) {
      setCaptureError(err.message || 'Could not capture the canvas');
      setAnalyzing(false);
    }
  };

  // 2. Generate Tech Pack using the captured snapshot
  const handleConvertToTechPack = async () => {
    if (!snapshot) {
      alert("Please click 'Capture & Analyze' to freeze your design before converting to a Tech Pack.");
      return;
    }

    setGeneratingTP(true);
    try {
      // Get base64 string from the snapshot URL we already have
      const response = await fetch(snapshot);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onloadend = async () => {
        try {
          const base64data = reader.result.split(',')[1];
          
          // Ask Node backend to generate BOM and Measurements
          const apiRes = await fetch('http://localhost:3001/api/generate-tech-pack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64data })
          });
          
          const data = await apiRes.json();
          if (!data.ok) throw new Error(data.error);

          // Save the AI generated data to Supabase
          const { error } = await supabase
            .from('tech_packs')
            .upsert({
              product_id: product.id,
              bom: data.techPackData.bom,
              measurements: data.techPackData.measurements,
              updated_at: new Date().toISOString()
            }, { onConflict: 'product_id' });

          if (error) throw error;
          
          // Update product stage to techpack
          await supabase.from('products').update({ stage: 'techpack' }).eq('id', product.id);
          
          // Navigate to the newly filled tech pack!
          navigate(`/tech-packs/${product.id}`);

        } catch (err) {
          alert("Failed to generate Tech Pack: " + err.message);
          setGeneratingTP(false);
        }
      };
    } catch (err) {
      alert("Error processing image: " + err.message);
      setGeneratingTP(false);
    }
  };

  const toggleExpand = async () => {
    if (canvasStatus === 'ready') {
      setToggling(true);
      try {
        const url = await photopeaRef.current.capture();
        const blob = await fetch(url).then(r => r.blob());
        setRestoreFile(new File([blob], 'canvas.png', { type: 'image/png' }));
      } catch {}
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
          <span className="canvas-panel-badge">powered by <a href="https://www.photopea.com" target="_blank" rel="noreferrer" style={{ marginLeft: 3 }}>Photopea</a></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={captureAndAnalyze} disabled={canvasStatus !== 'ready' || analyzing || generatingTP}>
            {analyzing ? '🤖 Analyzing...' : '🤖 Capture & Analyze'}
          </button>
          <button className="btn btn-sm" onClick={toggleExpand} disabled={toggling}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {toggling && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-2)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ph ph-spinner ph-spin" style={{ fontSize: 24, color: 'var(--ink-3)' }} />
          </div>
        )}
        <PhotopeaEditor ref={photopeaRef} svgMarkup={svgMarkup} file={uploadedFiles.current.get(id)} onStatusChange={setCanvasStatus} />
      </div>
    </div>
  );

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-design)' }}>Design Studio</div>
            <h1 className="page-title">{product.name}</h1>
          </div>
          <div className="page-sub">{product.category}</div>
        </div>
        <div className="topbar-right">
          {/* AI Generator Button */}
          <button className="btn btn-primary" onClick={handleConvertToTechPack} disabled={generatingTP || analyzing}>
            {generatingTP ? (
              <><i className="ph ph-spinner ph-spin" /> Generating Tech Pack...</>
            ) : (
              <><i className="ph ph-magic-wand" /> Auto-Generate Tech Pack</>
            )}
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={product.id} current="design" />
      </div>

      <div className="content">
        <div style={{ maxWidth: 1080, display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0, height: expanded ? 0 : 600 }}>
            {canvasPanel}
          </div>

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
              <div className="card-header"><span className="card-title">Creative Cloud</span></div>
              <div className="card-body">
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 14 }}>
                  Link Adobe Creative Cloud to pass this mockup back and forth with Photoshop or Illustrator.
                </p>
                <button className="btn" disabled style={{ opacity: 0.55, cursor: 'not-allowed', width: '100%', justifyContent: 'center' }}>
                  <i className="ph ph-cloud-arrow-up" /> Connect CC
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1080 }}>
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
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Factory Readiness Score<br/>Assessed by Claude 3.5 Sonnet</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analysis.notes.map((note, i) => (
                      <div key={i} className={`alert alert-${note.severity}`} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, fontSize: 13 }}>
                        <i className={SEVERITY_ICON[note.severity] || "ph ph-info"} style={{ marginTop: 2 }} />
                        <div>{note.text}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState icon="ph-magic-wand" title="No analysis yet" sub="Draw or upload your design in the canvas above, then click 'Capture & Analyze' to get instant factory feedback." />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
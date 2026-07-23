import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSampling } from '../context/SamplingContext.jsx';
import { useProducts } from '../context/ProductsContext.jsx';
import { useVendors } from '../context/VendorsContext.jsx';
import { useTeam } from '../context/TeamContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import FlowStepper from '../components/FlowStepper.jsx';
import { toast } from '../lib/toast.js';

const STATUSES = ['Requested', 'In Production', 'Shipped', 'Received', 'Under Review', 'Revision Requested', 'Approved', 'Rejected'];
const STATUS_TAG = {
  Requested: 'tag-neutral', 'In Production': 'tag-amber', Shipped: 'tag-blue', Received: 'tag-blue',
  'Under Review': 'tag-amber', 'Revision Requested': 'tag-red', Approved: 'tag-green', Rejected: 'tag-red',
};
const FIT_AREAS = ['Chest', 'Shoulders', 'Waist', 'Hips', 'Length', 'Sleeve', 'Neckline', 'Overall'];
const FIT_RATINGS = ['Too tight', 'Slightly tight', 'Good fit', 'Slightly loose', 'Too loose', 'Too short', 'Too long'];

function AnnotatableImage({ image, annotations, onAddAnnotation, onToggleResolved, onDeleteImage }) {
  const [pending, setPending] = useState(null); // { x, y }
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const imgAnnotations = annotations.filter(a => a.image_id === image.id);

  const handleClick = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPending({ x, y });
    setNote('');
  };

  const confirmPending = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onAddAnnotation({ imageId: image.id, xPercent: pending.x, yPercent: pending.y, note: note.trim() });
      setPending(null);
      setNote('');
    } catch (err) {
      toast.error('Could not pin that note: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#fff' }}>
      <button
        onClick={() => onDeleteImage(image.id)}
        title="Remove photo"
        style={{ position: 'absolute', top: 6, right: 6, zIndex: 6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: 11 }}
      >
        <i className="ph ph-x" />
      </button>
      <img src={image.image_url} alt={image.caption || 'Sample photo'} style={{ width: '100%', display: 'block', cursor: 'crosshair' }} onClick={handleClick} />
      {imgAnnotations.map((a, i) => (
        <div
          key={a.id}
          title={a.note}
          onClick={e => { e.stopPropagation(); onToggleResolved(a); }}
          style={{
            position: 'absolute', left: `${a.x_percent}%`, top: `${a.y_percent}%`, transform: 'translate(-50%, -50%)',
            width: 20, height: 20, borderRadius: '50%', background: a.resolved ? 'var(--green)' : 'var(--red)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          {i + 1}
        </div>
      ))}
      {pending && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', left: `${Math.min(pending.x, 65)}%`, top: `${Math.min(pending.y, 75)}%`,
            background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 8, padding: 10, width: 200,
            boxShadow: 'var(--shadow-lg)', zIndex: 7,
          }}
        >
          <textarea className="form-textarea" style={{ minHeight: 50, fontSize: 12, marginBottom: 6 }} placeholder="What's off here?" value={note} onChange={e => setNote(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={confirmPending} disabled={saving || !note.trim()}>Pin note</button>
            <button type="button" className="btn btn-sm" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SampleDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { samples, images, annotations, fitFeedback, createSampleRequest, updateSample, requestRevision, addImage, deleteImage, addAnnotation, toggleAnnotationResolved, addFitFeedback } = useSampling();
  const { products } = useProducts();
  const { vendors } = useVendors();
  const { canManage } = useTeam();

  const product = products.find(p => p.id === productId);
  const productSamples = samples.filter(s => s.product_id === productId).sort((a, b) => a.round_number - b.round_number);

  const [activeId, setActiveId] = useState(null);
  const active = productSamples.find(s => s.id === activeId) || productSamples[productSamples.length - 1];

  const [showNewRound, setShowNewRound] = useState(false);
  const [roundForm, setRoundForm] = useState({ vendorId: '', requestNotes: '', expectedDate: '' });
  const [roundSaving, setRoundSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [fitForm, setFitForm] = useState({ area: FIT_AREAS[0], rating: FIT_RATINGS[2], note: '' });
  const [fitSaving, setFitSaving] = useState(false);

  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!product) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Product not found" sub="This product doesn't exist yet." /></div>;
  }
  if (productSamples.length === 0) {
    return (
      <div className="content">
        <EmptyState icon="ph-t-shirt" color="var(--c-finalcheck)" title="No samples requested yet" sub={`Request a sample for ${product.name} from the Sampling page.`} cta="Go to Sampling" onCta={() => navigate('/sampling')} />
      </div>
    );
  }

  const activeImages = images.filter(i => i.sample_id === active.id);
  const activeAnnotations = annotations.filter(a => a.sample_id === active.id);
  const generalAnnotations = activeAnnotations.filter(a => !a.image_id);
  const activeFeedback = fitFeedback.filter(f => f.sample_id === active.id);

  const handleNewRound = async e => {
    e.preventDefault();
    setRoundSaving(true);
    try {
      const created = await createSampleRequest({ productId, ...roundForm });
      setShowNewRound(false);
      setRoundForm({ vendorId: '', requestNotes: '', expectedDate: '' });
      setActiveId(created.id);
    } catch (err) {
      toast.error('Could not start a new round: ' + err.message);
    } finally {
      setRoundSaving(false);
    }
  };

  const handleUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await addImage(active.id, file);
    } catch (err) {
      setUploadError(err.message || 'Could not upload that photo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddFitFeedback = async e => {
    e.preventDefault();
    setFitSaving(true);
    try {
      await addFitFeedback(active.id, fitForm);
      setFitForm({ area: FIT_AREAS[0], rating: FIT_RATINGS[2], note: '' });
    } catch (err) {
      toast.error('Could not log that feedback: ' + err.message);
    } finally {
      setFitSaving(false);
    }
  };

  const setStatus = async status => {
    setActionBusy(true);
    setActionError(null);
    try {
      await updateSample(active.id, { status, ...(status === 'Received' ? { received_at: new Date().toISOString() } : {}) });
    } catch (err) {
      setActionError(err.message || 'Could not update this round.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestRevision = async e => {
    e.preventDefault();
    setActionBusy(true);
    setActionError(null);
    try {
      const created = await requestRevision(active, revisionNotes);
      setShowRevisionForm(false);
      setRevisionNotes('');
      setActiveId(created.id);
    } catch (err) {
      setActionError(err.message || 'Could not request a revision.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-finalcheck)' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/sampling')}><i className="ph ph-arrow-left" /> Sampling</span>
            </div>
            <h1 className="page-title">{product.name}</h1>
          </div>
          <div className="page-sub">{product.category} · {productSamples.length} round{productSamples.length === 1 ? '' : 's'}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={() => setShowNewRound(s => !s)}>
            <i className="ph ph-plus" /> New round
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={productId} current="sampling" />
      </div>

      <div className="content">
        {showNewRound && (
          <form className="card-raised enter" style={{ marginBottom: 24 }} onSubmit={handleNewRound}>
            <div className="card-header"><span className="card-title">Start round {productSamples.length + 1}</span></div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Vendor (optional)</label>
                  <select className="form-select" value={roundForm.vendorId} onChange={e => setRoundForm(f => ({ ...f, vendorId: e.target.value }))}>
                    <option value="">Not chosen yet</option>
                    {vendors.filter(v => !v.blocked).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Expected date</label>
                  <input className="form-input" type="date" value={roundForm.expectedDate} onChange={e => setRoundForm(f => ({ ...f, expectedDate: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">What are you asking for</label>
                <textarea className="form-textarea" placeholder="e.g. Second fit sample, adjusted sleeve length" value={roundForm.requestNotes} onChange={e => setRoundForm(f => ({ ...f, requestNotes: e.target.value }))} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={roundSaving}>{roundSaving ? 'Requesting…' : 'Request this round'}</button>
            </div>
          </form>
        )}

        {/* ── Round timeline ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {productSamples.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className="pill"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '8px 14px',
                background: (active.id === s.id) ? 'var(--accent-bg)' : undefined,
                borderColor: (active.id === s.id) ? 'var(--accent)' : undefined,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700 }}>Round {s.round_number}</span>
              <span className={`tag ${STATUS_TAG[s.status] || 'tag-neutral'}`} style={{ fontSize: 10 }}>{s.status}</span>
            </button>
          ))}
        </div>

        {/* ── Active round header ─────────────────────────────────────── */}
        <div className="card-raised" style={{ marginBottom: 24, padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Round {active.round_number} · {active.vendors?.name || 'No vendor chosen'}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Requested {new Date(active.created_at).toLocaleDateString()}
                {active.expected_date && ` · expected ${new Date(active.expected_date).toLocaleDateString()}`}
                {active.received_at && ` · received ${new Date(active.received_at).toLocaleDateString()}`}
              </div>
              {active.request_notes && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, maxWidth: 480 }}>{active.request_notes}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select className="form-select" value={active.status} onChange={e => setStatus(e.target.value)} disabled={actionBusy}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {actionError && <div className="form-hint" style={{ color: 'var(--red)', marginTop: 12 }}>{actionError}</div>}

          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

          {canManage ? (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-primary" disabled={actionBusy} onClick={() => setStatus('Approved')}><i className="ph ph-check-circle" /> Approve</button>
                <button className="btn btn-sm" style={{ color: 'var(--red)' }} disabled={actionBusy} onClick={() => setStatus('Rejected')}>Reject</button>
                <button className="btn btn-sm" disabled={actionBusy} onClick={() => setShowRevisionForm(s => !s)}><i className="ph ph-arrow-clockwise" /> Request revision</button>
              </div>
              {showRevisionForm && (
                <form onSubmit={handleRequestRevision} style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
                    <label className="form-label">What needs to change</label>
                    <input className="form-input" placeholder="e.g. Take the sleeve in 1cm, retest colorway" value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} />
                  </div>
                  <button className="btn btn-sm btn-primary" type="submit" disabled={actionBusy}>Open round {active.round_number + 1}</button>
                </form>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' }}>Only brand admins/owners can approve, reject, or request a revision.</div>
          )}
        </div>

        {/* ── Images & annotations ────────────────────────────────────── */}
        <div className="section-label">Photos &amp; annotations</div>
        <div className="form-hint" style={{ marginBottom: 14 }}>Click anywhere on a photo to pin a note at that spot. Click a pin to mark it resolved.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
          {activeImages.map(img => (
            <AnnotatableImage
              key={img.id} image={img} annotations={activeAnnotations}
              onAddAnnotation={a => addAnnotation(active.id, a)}
              onToggleResolved={toggleAnnotationResolved}
              onDeleteImage={id => deleteImage(id).catch(err => toast.error('Could not remove photo: ' + err.message))}
            />
          ))}
          <label style={{ border: '1.5px dashed var(--border-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, cursor: 'pointer', color: 'var(--ink-3)', fontSize: 12.5 }}>
            {uploading ? <i className="ph ph-spinner ph-spin" style={{ fontSize: 20 }} /> : <i className="ph ph-upload-simple" style={{ fontSize: 20, marginBottom: 6 }} />}
            {uploading ? 'Uploading…' : 'Add a photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        {uploadError && <div className="form-hint" style={{ color: 'var(--red)', marginBottom: 14 }}>{uploadError}</div>}

        {generalAnnotations.length > 0 && (
          <div className="card" style={{ marginBottom: 28 }}>
            {generalAnnotations.map(a => (
              <div className="list-row" key={a.id}>
                <span style={{ fontSize: 13, textDecoration: a.resolved ? 'line-through' : 'none', color: a.resolved ? 'var(--ink-4)' : 'var(--ink-2)' }}>{a.note}</span>
                <button className="btn btn-sm" onClick={() => toggleAnnotationResolved(a)}>{a.resolved ? 'Reopen' : 'Resolve'}</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Fit feedback ─────────────────────────────────────────────── */}
        <div className="section-label">Fit feedback</div>
        {activeFeedback.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            {activeFeedback.map(f => (
              <div className="list-row" key={f.id}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.area}</div>
                  {f.note && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{f.note}</div>}
                </div>
                <span className="tag tag-neutral">{f.rating}</span>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleAddFitFeedback} className="card-raised" style={{ marginBottom: 28 }}>
          <div className="card-body" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
              <label className="form-label">Area</label>
              <select className="form-select" value={fitForm.area} onChange={e => setFitForm(f => ({ ...f, area: e.target.value }))}>
                {FIT_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
              <label className="form-label">Rating</label>
              <select className="form-select" value={fitForm.rating} onChange={e => setFitForm(f => ({ ...f, rating: e.target.value }))}>
                {FIT_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label className="form-label">Note</label>
              <input className="form-input" placeholder="Optional detail" value={fitForm.note} onChange={e => setFitForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <button className="btn btn-sm btn-primary" type="submit" disabled={fitSaving}>Log feedback</button>
          </div>
        </form>
      </div>
    </>
  );
}

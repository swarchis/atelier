import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVendors } from '../context/VendorsContext.jsx';
import { useProducts } from '../context/ProductsContext.jsx';
import { trustTagClass } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { apiPost, aiPost } from '../lib/aiApi.js';
import { useAIUsage } from '../context/AIUsageContext.jsx';
import CreditCost from '../components/CreditCost.jsx';
import FlowStepper from '../components/FlowStepper.jsx';

const STATUSES = ['All', 'Requested', 'Received', 'Accepted', 'Declined'];
const TECHPACK_STAGES = ['techpack', 'sourcing', 'sampling', 'production', 'launched'];

function QuoteRow({ q, onUpdate, onOpen }) {
  const [amount, setAmount] = useState(q.amount || '');
  const [busy, setBusy] = useState(false);

  const run = async (updates) => {
    setBusy(true);
    try { await onUpdate(q.id, updates); } catch (err) { toast.error('Could not update quote: ' + err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="list-row" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{q.products?.name || 'Unknown product'}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{q.vendors?.name || 'Unknown vendor'} · requested {new Date(q.requested_at).toLocaleDateString()}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
        {q.status === 'Requested' && (
          <>
            <input
              className="form-input"
              style={{ width: 100, padding: '6px 10px', fontSize: 12.5 }}
              type="number" step="0.01" placeholder="$/unit"
              value={amount} onChange={e => setAmount(e.target.value)}
            />
            <button className="btn btn-sm" disabled={busy || !amount} onClick={() => run({ status: 'Received', amount: parseFloat(amount) })}>
              Mark received
            </button>
          </>
        )}
        {q.status === 'Received' && (
          <>
            {q.amount && <span style={{ fontFamily: 'var(--mono)', fontSize: 13.5 }}>${Number(q.amount).toFixed(2)}/unit</span>}
            <button className="btn btn-sm" disabled={busy} onClick={() => run({ status: 'Accepted' })}>Accept</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => run({ status: 'Declined' })}>Decline</button>
          </>
        )}
        {(q.status === 'Accepted' || q.status === 'Declined') && q.amount && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13.5 }}>${Number(q.amount).toFixed(2)}/unit</span>
        )}
        <span className={q.status === 'Accepted' ? 'tag tag-green' : q.status === 'Declined' ? 'tag tag-red' : q.status === 'Received' ? 'tag tag-blue' : 'tag tag-neutral'}>{q.status}</span>
        <i className="ph ph-caret-right" style={{ color: 'var(--ink-4)' }} />
      </div>
    </div>
  );
}

const EMPTY_RFQ = { productId: '', vendorIds: [], quantity: '', targetUnitCost: '', deadline: '', message: '' };

// The shared RFQ body. {{vendor}} is substituted per recipient at send time, so
// one edited draft covers every vendor on the request — which is the point of an
// RFQ: the same ask to everyone, so the quotes that come back are comparable.
const VENDOR_TOKEN = '{{vendor}}';

function defaultRfqSubject(productName) {
  return `Request for Quote: ${productName || 'New Design'}`;
}

function defaultRfqBody({ productName, brandName, quantity, targetUnitCost, deadline, message }) {
  return `Hello ${VENDOR_TOKEN},

We would like to request a formal quote for our product: ${productName || 'Garment Design'}.

Details:
- Target Quantity: ${quantity || 'Standard MOQ'}
- Target Unit Cost: ${targetUnitCost ? '$' + targetUnitCost : 'Open for negotiation'}
- Target Deadline: ${deadline || 'Standard lead time'}

Additional Notes:
${message || 'None'}

Please reply with your pricing and availability.

Best regards,
${brandName || 'Atelier Studio'}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function QuoteTracker() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlProductId = searchParams.get('productId');

  const { vendors, quotes, loading, updateQuote, createRFQ, updateVendor } = useVendors();
  // activeBrand: /api/send-vendor-email is brand-scoped, so the RFQ dispatch
  // below has to say which brand it's sending on behalf of.
  const { products, activeBrand } = useProducts();
  const { canAfford, openTopup } = useAIUsage();
  const [filter, setFilter] = useState('All');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'compare'
  const [compareProductId, setCompareProductId] = useState('');

  const [showNewRFQ, setShowNewRFQ] = useState(false);
  const [rfqForm, setRfqForm] = useState(EMPTY_RFQ);
  const [rfqOverrideGate, setRfqOverrideGate] = useState(false);
  const [rfqSending, setRfqSending] = useState(false);
  const [rfqError, setRfqError] = useState(null);
  // The shared draft. `draftTouched` stops the live prefill below from
  // overwriting an edit the moment the user changes quantity or a deadline.
  const [rfqSubject, setRfqSubject] = useState('');
  const [rfqBody, setRfqBody] = useState('');
  const [draftTouched, setDraftTouched] = useState(false);
  const [drafting, setDrafting] = useState(false);
  // Addresses typed in for vendors that have none on file, keyed by vendor id.
  // Saved back onto the vendor row on a successful send so it is asked once.
  const [vendorEmails, setVendorEmails] = useState({});

  const techPackProducts = products.filter(p => TECHPACK_STAGES.includes(p.stage));
  const rfqProduct = products.find(p => p.id === rfqForm.productId);
  const rfqBelowThreshold = rfqProduct && rfqProduct.readiness < 80;
  const rfqBlocked = rfqBelowThreshold && !rfqOverrideGate;
  const availableVendors = vendors.filter(v => !v.blocked);

  // If a productId was passed in the URL (e.g. from TechPackDetail stepper), focus on it
  useEffect(() => {
    if (urlProductId) {
      setCompareProductId(urlProductId);
      setViewMode('compare');
      setRfqForm(f => ({ ...f, productId: urlProductId }));
    }
  }, [urlProductId]);

  const toggleRfqVendor = vendorId => setRfqForm(f => ({ ...f, vendorIds: f.vendorIds.includes(vendorId) ? f.vendorIds.filter(x => x !== vendorId) : [...f.vendorIds, vendorId] }));

  const selectedVendors = vendors.filter(v => rfqForm.vendorIds.includes(v.id));
  // What each selected vendor will actually be mailed at: the stored address,
  // or whatever was typed for it in this form.
  const emailFor = v => (v.email || vendorEmails[v.id] || '').trim();
  const missingEmail = selectedVendors.filter(v => !emailFor(v));
  const invalidEmail = selectedVendors.filter(v => emailFor(v) && !EMAIL_RE.test(emailFor(v)));
  const sendableCount = selectedVendors.length - missingEmail.length - invalidEmail.length;

  // Keep the draft in step with the form until the user edits it, so opening the
  // compose box never shows a stale quantity or the wrong product name.
  useEffect(() => {
    if (draftTouched) return;
    setRfqSubject(defaultRfqSubject(rfqProduct?.name));
    setRfqBody(defaultRfqBody({
      productName: rfqProduct?.name,
      brandName: activeBrand?.name,
      quantity: rfqForm.quantity,
      targetUnitCost: rfqForm.targetUnitCost,
      deadline: rfqForm.deadline,
      message: rfqForm.message,
    }));
  }, [draftTouched, rfqProduct?.name, activeBrand?.name, rfqForm.quantity, rfqForm.targetUnitCost, rfqForm.deadline, rfqForm.message]);

  const resetRfq = () => {
    setRfqForm(EMPTY_RFQ);
    setRfqOverrideGate(false);
    setVendorEmails({});
    setDraftTouched(false);
  };

  // Optional AI pass over the draft. Charged once for the whole RFQ, not per
  // vendor — it is one shared message.
  const draftWithAI = async () => {
    if (!rfqProduct) { setRfqError('Choose a tech pack first.'); return; }
    if (!canAfford('draft-vendor-email')) { openTopup(); return; }
    setDrafting(true);
    setRfqError(null);
    try {
      const res = await aiPost('/api/draft-vendor-email', {
        vendorName: VENDOR_TOKEN,
        productName: rfqProduct.name,
        garmentType: rfqProduct.category,
        preferences: { quantity: rfqForm.quantity, targetUnitCost: rfqForm.targetUnitCost, deadline: rfqForm.deadline },
        ask: rfqForm.message || 'Request a formal production quote with pricing, MOQ and lead time.',
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setDraftTouched(true);
      if (data.draft?.subject) setRfqSubject(data.draft.subject);
      if (data.draft?.body) setRfqBody(data.draft.body);
    } catch (err) {
      setRfqError(err.message || 'Could not draft that email.');
    } finally {
      setDrafting(false);
    }
  };

  const submitRFQ = async e => {
    e.preventDefault();
    if (!rfqForm.productId || rfqForm.vendorIds.length === 0 || rfqBlocked) return;
    setRfqSending(true);
    setRfqError(null);
    try {
      await createRFQ(rfqForm);

      // The RFQ row is saved either way — a vendor with no address still gets
      // tracked, you just have to reach them yourself. Only the mail is skipped.
      const sent = [];
      const failed = [];
      const skipped = [];

      for (const vendor of selectedVendors) {
        const to = emailFor(vendor);
        if (!to || !EMAIL_RE.test(to)) { skipped.push(vendor.name); continue; }
        try {
          const res = await apiPost('/api/send-vendor-email', {
            to,
            brandId: activeBrand?.id,
            subject: rfqSubject,
            body: rfqBody.split(VENDOR_TOKEN).join(vendor.name),
            vendorName: vendor.name,
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.ok) throw new Error(data?.error || `Send failed (${res.status})`);
          sent.push(vendor.name);
          // Remember an address that just worked, so the next RFQ doesn't ask.
          if (!vendor.email) updateVendor(vendor.id, { email: to }).catch(() => {});
        } catch (emailErr) {
          failed.push(`${vendor.name} (${emailErr.message})`);
        }
      }

      // Report what actually happened. This used to be an unconditional
      // "emails dispatched!" fired outside the loop, which was wrong every
      // single time: vendors.email did not exist, so nothing was ever sent.
      const parts = [`RFQ saved for ${selectedVendors.length} vendor${selectedVendors.length === 1 ? '' : 's'}`];
      if (sent.length) parts.push(`emailed ${sent.length}`);
      if (skipped.length) parts.push(`no address for ${skipped.join(', ')}`);
      if (failed.length) parts.push(`failed: ${failed.join('; ')}`);
      const summary = parts.join(' · ');
      if (failed.length) toast.error(summary);
      else toast.success(summary);

      setShowNewRFQ(false);
      resetRfq();
    } catch (err) {
      setRfqError(err.message || 'Could not send that RFQ.');
    } finally {
      setRfqSending(false);
    }
  };

  // Extract unique products that actually have quotes
  const quotedProducts = useMemo(() => {
    const map = new Map();
    quotes.forEach(q => {
      if (q.products && q.product_id && !map.has(q.product_id)) {
        map.set(q.product_id, { id: q.product_id, name: q.products.name });
      }
    });
    return Array.from(map.values());
  }, [quotes]);

  // Auto-select the first available product when switching to compare view if none selected
  useEffect(() => {
    if (viewMode === 'compare' && !compareProductId && quotedProducts.length > 0) {
      setCompareProductId(quotedProducts[0].id);
    }
  }, [viewMode, quotedProducts, compareProductId]);

  const filtered = filter === 'All' ? quotes : quotes.filter(q => q.status === filter);
  const compareQuotes = quotes.filter(q => q.product_id === compareProductId);

  const handleMatrixAction = async (id, updates) => {
    try { await updateQuote(id, updates); } catch (err) { toast.error('Could not update quote: ' + err.message); }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-vendors)' }}>Vendors</div>
            <h1 className="page-title">Quote Tracker</h1>
          </div>
          <div className="page-sub">Status of every outstanding and received quote, across vendors</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={() => setShowNewRFQ(s => !s)}>
            <i className="ph ph-plus" /> New RFQ
          </button>
        </div>
      </div>

      <div className="content">
        {urlProductId && (
          <div style={{ marginBottom: 20 }}>
            <FlowStepper productId={urlProductId} current="vendors" />
          </div>
        )}

        {showNewRFQ && (
          <form className="card-raised enter" style={{ marginBottom: 24 }} onSubmit={submitRFQ}>
            <div className="corner-fold" style={{ '--fold-color': 'var(--c-vendors)' }} />
            <div className="card-header"><span className="card-title">New RFQ — send to multiple vendors at once</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Tech pack</label>
                <select className="form-select" value={rfqForm.productId} onChange={e => { setRfqForm(f => ({ ...f, productId: e.target.value })); setRfqOverrideGate(false); }} required>
                  <option value="" disabled>Choose a tech pack</option>
                  {techPackProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.readiness}%)</option>)}
                </select>
                {techPackProducts.length === 0 && <div className="form-hint">No products have a tech pack yet — convert a design first.</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Send to which vendors?</label>
                {availableVendors.length === 0 ? (
                  <div className="form-hint">No vendors yet — add some from the Vendor Hub first.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    {availableVendors.map(v => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: rfqForm.vendorIds.includes(v.id) ? 'var(--accent-bg)' : 'transparent' }}>
                        <input type="checkbox" checked={rfqForm.vendorIds.includes(v.id)} onChange={() => toggleRfqVendor(v.id)} />
                        {v.name}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>{v.category || 'Uncategorized'}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="form-input" placeholder="e.g. 300 units" value={rfqForm.quantity} onChange={e => setRfqForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Target unit cost</label>
                  <input className="form-input" placeholder="e.g. $18.00" value={rfqForm.targetUnitCost} onChange={e => setRfqForm(f => ({ ...f, targetUnitCost: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <input className="form-input" placeholder="e.g. Sept 15" value={rfqForm.deadline} onChange={e => setRfqForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Anything else every vendor should know</label>
                <textarea className="form-textarea" placeholder="Optional notes" value={rfqForm.message} onChange={e => setRfqForm(f => ({ ...f, message: e.target.value }))} />
              </div>

              {selectedVendors.length > 0 && (
                <>
                  {missingEmail.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Where should this go?</label>
                      <div className="form-hint" style={{ marginBottom: 8 }}>
                        {missingEmail.length === 1 ? 'This vendor has' : `These ${missingEmail.length} vendors have`} no email on file. Add one and we'll save it to the vendor. Leave it blank and the RFQ is still tracked, just not emailed.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {missingEmail.map(v => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', minWidth: 130 }}>{v.name}</span>
                            <input
                              className="form-input"
                              type="email"
                              placeholder="sales@factory.com"
                              value={vendorEmails[v.id] || ''}
                              onChange={e => setVendorEmails(m => ({ ...m, [v.id]: e.target.value }))}
                              style={{ flex: 1 }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>The email they'll receive</label>
                      <button type="button" className="btn btn-sm" onClick={draftWithAI} disabled={drafting || !rfqProduct}>
                        <i className={drafting ? 'ph ph-circle-notch ph-spin' : 'ph ph-sparkle'} />
                        {drafting ? 'Drafting…' : 'Draft with AI'}
                        {!drafting && <CreditCost feature="draft-vendor-email" style={{ marginLeft: 6, color: 'inherit', opacity: 0.8 }} />}
                      </button>
                    </div>
                    <input
                      className="form-input"
                      value={rfqSubject}
                      onChange={e => { setDraftTouched(true); setRfqSubject(e.target.value); }}
                      placeholder="Subject"
                      style={{ marginBottom: 8 }}
                    />
                    <textarea
                      className="form-textarea"
                      value={rfqBody}
                      onChange={e => { setDraftTouched(true); setRfqBody(e.target.value); }}
                      rows={12}
                      style={{ fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.6 }}
                    />
                    <div className="form-hint" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <span><code>{VENDOR_TOKEN}</code> becomes each vendor's name. Everyone gets the same message, so the quotes come back comparable.</span>
                      {draftTouched && (
                        <button type="button" className="btn btn-sm" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', textDecoration: 'underline', boxShadow: 'none', padding: 0 }} onClick={() => setDraftTouched(false)}>
                          Reset to template
                        </button>
                      )}
                    </div>
                  </div>

                  {invalidEmail.length > 0 && (
                    <div className="form-hint" style={{ color: 'var(--red)', marginBottom: 12 }}>
                      Not a valid email address for {invalidEmail.map(v => v.name).join(', ')}. Fix it, or clear it to skip that vendor.
                    </div>
                  )}
                </>
              )}

              {rfqBelowThreshold && (
                <div className="form-hint" style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', marginBottom: 14 }}>
                  <i className="ph ph-lock-key" style={{ marginRight: 4 }} />
                  <strong>Hard Gate:</strong> {rfqProduct.name} is only at {rfqProduct.readiness}% factory readiness. A score of 80%+ is required to send an RFQ.
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" checked={rfqOverrideGate} onChange={e => setRfqOverrideGate(e.target.checked)} />
                    I understand the risks and want to send it anyway
                  </label>
                </div>
              )}
              {rfqError && <div className="form-hint" style={{ color: 'var(--red)', marginBottom: 12 }}>{rfqError}</div>}
              {/* The label says what will actually happen — how many get an
                  email, not just how many vendors are ticked. */}
              <button className="btn btn-primary" type="submit" disabled={rfqSending || !rfqForm.productId || rfqForm.vendorIds.length === 0 || rfqBlocked || invalidEmail.length > 0}>
                <i className="ph ph-paper-plane-tilt" />
                {rfqSending
                  ? 'Sending…'
                  : sendableCount > 0
                    ? `Send to ${sendableCount} vendor${sendableCount === 1 ? '' : 's'}${missingEmail.length ? ` (${missingEmail.length} without an address)` : ''}`
                    : `Save RFQ for ${rfqForm.vendorIds.length} vendor${rfqForm.vendorIds.length === 1 ? '' : 's'} — no emails to send`}
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
          {viewMode === 'list' ? (
            <div className="pill-group" data-tour="quote-tracker">
              {STATUSES.map(s => (
                <button key={s} className={`pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
              ))}
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 260 }}>
              <select className="form-select" style={{ padding: '8px 28px 8px 12px', fontSize: 13.5, fontWeight: 600 }} value={compareProductId} onChange={e => setCompareProductId(e.target.value)}>
                {quotedProducts.length === 0 && <option value="">No quotes available yet</option>}
                {quotedProducts.map(p => <option key={p.id} value={p.id}>Compare quotes for: {p.name}</option>)}
              </select>
            </div>
          )}

          <div className="pill-group">
            <button className={`pill ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <i className="ph ph-list-dashes" style={{ marginRight: 6 }} /> List
            </button>
            <button className={`pill ${viewMode === 'compare' ? 'active' : ''}`} onClick={() => setViewMode('compare')}>
              <i className="ph ph-columns" style={{ marginRight: 6 }} /> Compare Matrix
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)' }}><i className="ph ph-circle-notch ph-spin" /> Loading…</div>
        ) : viewMode === 'list' ? (
          /* --- LIST VIEW --- */
          filtered.length ? (
            <div className="card">
              {filtered.map(q => <QuoteRow key={q.id} q={q} onUpdate={updateQuote} onOpen={() => navigate(`/quotes/${q.id}`)} />)}
            </div>
          ) : (
            <div className="card-raised" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div>No quotes match this status.</div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/vendors')}>
                <i className="ph ph-magnifying-glass" /> Search & Find Vendors
              </button>
            </div>
          )
        ) : (
          /* --- COMPARE MATRIX VIEW --- */
          compareQuotes.length === 0 ? (
            <div className="card-raised" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div>No quotes available to compare for this product yet.</div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/vendors')}>
                <i className="ph ph-magnifying-glass" /> Search & Find Vendors
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
              {compareQuotes.map(q => {
                const vendorObj = vendors.find(v => v.id === q.vendor_id) || {};
                const targetCost = q.preferences?.targetUnitCost;
                const diff = (q.amount && targetCost) ? Number(q.amount) - Number(targetCost) : null;
                
                return (
                  <div key={q.id} className="card-raised" style={{ minWidth: 280, flex: '0 0 280px', display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }} onClick={() => navigate(`/quotes/${q.id}`)}>
                      <span className="card-title">{q.vendors?.name || 'Unknown Vendor'}</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className={q.status === 'Accepted' ? 'tag tag-green' : q.status === 'Declined' ? 'tag tag-red' : q.status === 'Received' ? 'tag tag-blue' : 'tag tag-neutral'}>{q.status}</span>
                        {vendorObj.label && <span className={trustTagClass(vendorObj.label === 'Verified partner' ? 'green' : vendorObj.label === 'Unverified' ? 'amber' : 'neutral')}>{vendorObj.label}</span>}
                      </div>
                    </div>
                    
                    <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Quoted Price</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700, color: q.amount ? 'var(--ink)' : 'var(--ink-4)' }}>
                          {q.amount ? `$${Number(q.amount).toFixed(2)}` : 'Pending'}
                        </div>
                        {diff !== null && (
                          <div style={{ fontSize: 12, color: diff <= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
                            {diff <= 0 ? `-$${Math.abs(diff).toFixed(2)} under target` : `+$${diff.toFixed(2)} over target`}
                          </div>
                        )}
                        {targetCost && diff === null && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Target: ${Number(targetCost).toFixed(2)}</div>}
                      </div>
                      
                      <div style={{ height: 1, background: 'var(--border)' }} />
                      
                      <div className="grid-2" style={{ gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>MOQ</div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{vendorObj.moq ?? 'Unknown'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Lead Time</div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{vendorObj.lead_time || 'Unknown'}</div>
                        </div>
                      </div>
                      
                      <div style={{ height: 1, background: 'var(--border)' }} />
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>Location</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{vendorObj.location || '—'}</div>
                      </div>
                      
                      {q.status === 'Received' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 10 }}>
                          <button className="btn btn-sm btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleMatrixAction(q.id, { status: 'Accepted' })}>Accept</button>
                          <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', color: 'var(--red)' }} onClick={() => handleMatrixAction(q.id, { status: 'Declined' })}>Decline</button>
                        </div>
                      )}
                      {q.status === 'Requested' && (
                        <div style={{ marginTop: 'auto', paddingTop: 10, fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', textAlign: 'center' }}>
                          Waiting for vendor response...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
}
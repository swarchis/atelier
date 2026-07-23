import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendors } from '../context/VendorsContext.jsx';
import { useProducts } from '../context/ProductsContext.jsx';
import { trustTagClass } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { supabase } from '../lib/supabase.js';

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

export default function QuoteTracker() {
  const navigate = useNavigate();
  const { vendors, quotes, loading, updateQuote, createRFQ } = useVendors();
  const { products } = useProducts();
  const [filter, setFilter] = useState('All');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'compare'
  const [compareProductId, setCompareProductId] = useState('');

  const [showNewRFQ, setShowNewRFQ] = useState(false);
  const [rfqForm, setRfqForm] = useState(EMPTY_RFQ);
  const [rfqOverrideGate, setRfqOverrideGate] = useState(false);
  const [rfqSending, setRfqSending] = useState(false);
  const [rfqError, setRfqError] = useState(null);

  const techPackProducts = products.filter(p => TECHPACK_STAGES.includes(p.stage));
  const rfqProduct = products.find(p => p.id === rfqForm.productId);
  const rfqBelowThreshold = rfqProduct && rfqProduct.readiness < 80;
  const rfqBlocked = rfqBelowThreshold && !rfqOverrideGate;
  const availableVendors = vendors.filter(v => !v.blocked);

  const toggleRfqVendor = vendorId => setRfqForm(f => ({ ...f, vendorIds: f.vendorIds.includes(vendorId) ? f.vendorIds.filter(x => x !== vendorId) : [...f.vendorIds, vendorId] }));

  const submitRFQ = async e => {
    e.preventDefault();
    if (!rfqForm.productId || rfqForm.vendorIds.length === 0 || rfqBlocked) return;
    setRfqSending(true);
    setRfqError(null);
    try {
      await createRFQ(rfqForm);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const selectedVendors = vendors.filter(v => rfqForm.vendorIds.includes(v.id));

      for (const vendor of selectedVendors) {
        if (vendor.email) {
          try {
            await fetch(`${API_URL}/api/send-vendor-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                to: vendor.email,
                subject: `Request for Quote: ${rfqProduct?.name || 'New Design'}`,
                body: `Hello ${vendor.name},\n\nWe would like to request a formal quote for our product: ${rfqProduct?.name || 'Garment Design'}.\n\nDetails:\n- Target Quantity: ${rfqForm.quantity || 'Standard MOQ'}\n- Target Unit Cost: ${rfqForm.targetUnitCost ? '$' + rfqForm.targetUnitCost : 'Open for negotiation'}\n- Target Deadline: ${rfqForm.deadline || 'Standard lead time'}\n\nAdditional Notes:\n${rfqForm.message || 'None'}\n\nPlease reply with your pricing and availability.\n\nBest regards,\nAtelier Studio`,
                vendorName: vendor.name
              })
            });
          } catch (emailErr) {
            console.error(`Failed to dispatch email to ${vendor.name}:`, emailErr);
          }
        }
      }
      toast.success('RFQ created and emails dispatched!');
      setShowNewRFQ(false);
      setRfqForm(EMPTY_RFQ);
      setRfqOverrideGate(false);
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

  // Auto-select the first available product when switching to compare view
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
              <button className="btn btn-primary" type="submit" disabled={rfqSending || !rfqForm.productId || rfqForm.vendorIds.length === 0 || rfqBlocked}>
                <i className="ph ph-paper-plane-tilt" /> {rfqSending ? 'Sending…' : `Send to ${rfqForm.vendorIds.length || 0} vendor${rfqForm.vendorIds.length === 1 ? '' : 's'}`}
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
            <div className="card-raised" style={{ padding: '30px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
              No quotes match this status.
            </div>
          )
        ) : (
          /* --- COMPARE MATRIX VIEW --- */
          compareQuotes.length === 0 ? (
            <div className="card-raised" style={{ padding: '30px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
              Select a product from the dropdown above to compare its vendor quotes.
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
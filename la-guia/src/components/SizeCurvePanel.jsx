import React, { useEffect, useState } from 'react';
import { useProduction } from '../context/ProductionContext.jsx';
import { toast } from '../lib/toast.js';

// Benchmark shape for a unisex top, as a STARTING POINT only. It is deliberately
// labelled as a benchmark in the UI rather than a recommendation: it is not
// this brand's data, and presenting a guess as an answer is the kind of
// invented number this app doesn't do. Once a style has sold, the founder's own
// sell-through beats any published curve.
const BENCHMARK = [
  { size: 'XS', pct: 5 },
  { size: 'S', pct: 15 },
  { size: 'M', pct: 27 },
  { size: 'L', pct: 28 },
  { size: 'XL', pct: 17 },
  { size: 'XXL', pct: 8 },
];

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function blankRow(size = '') {
  return { size, colorway: '', units: '', received_units: '' };
}

export default function SizeCurvePanel({ orderId, orderUnits }) {
  const { sizesByOrder, loadOrderSizes, saveOrderSizes } = useProduction();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadOrderSizes(orderId).then(data => {
      if (!alive) return;
      setRows((data || []).map(d => ({
        size: d.size,
        colorway: d.colorway || '',
        units: d.units ?? '',
        received_units: d.received_units ?? '',
      })));
      setLoaded(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const total = rows.reduce((sum, r) => sum + (Number(r.units) || 0), 0);
  const totalReceived = rows.reduce((sum, r) => sum + (Number(r.received_units) || 0), 0);
  const anyReceived = rows.some(r => r.received_units !== '' && r.received_units != null);

  const setRow = (i, field, value) => setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRow = () => setRows(prev => [...prev, blankRow()]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  // Spreads a total across the benchmark shape. Remainder lands on the largest
  // size so the rows always sum to exactly the number asked for.
  const applyBenchmark = () => {
    const target = Number(orderUnits) || total || 0;
    if (!target) { toast.error('Set the order total first, then apply a curve.'); return; }
    const next = BENCHMARK.map(b => ({ ...blankRow(b.size), units: Math.floor((target * b.pct) / 100) }));
    const placed = next.reduce((s, r) => s + r.units, 0);
    const biggest = next.reduce((best, r, i) => (r.units > next[best].units ? i : best), 0);
    next[biggest].units += target - placed;
    setRows(next);
  };

  const applyFlat = () => {
    const target = Number(orderUnits) || total || 0;
    if (!target) { toast.error('Set the order total first, then apply a curve.'); return; }
    const each = Math.floor(target / DEFAULT_SIZES.length);
    const next = DEFAULT_SIZES.map(s => ({ ...blankRow(s), units: each }));
    next[0].units += target - each * DEFAULT_SIZES.length;
    setRows(next);
  };

  const save = async () => {
    const named = rows.filter(r => String(r.size).trim());
    if (named.length !== rows.length) { toast.error('Every row needs a size.'); return; }
    setSaving(true);
    try {
      await saveOrderSizes(orderId, rows);
      toast.success(rows.length ? `Size curve saved — ${total} units across ${rows.length} sizes.` : 'Size curve cleared.');
    } catch (err) {
      toast.error('Could not save the size curve: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // A flat buy is the specific mistake worth naming, because it looks like the
  // safe neutral choice and is the one that reliably loses money.
  const isFlat = rows.length > 2 && new Set(rows.map(r => Number(r.units) || 0)).size === 1 && total > 0;

  if (!loaded) return <div className="form-hint">Loading size curve…</div>;

  return (
    <div>
      <div className="form-hint" style={{ marginBottom: 14 }}>
        How the order splits across sizes. The factory needs this to cut, and it decides how much of
        the run sells at full price: core sizes clear first, and whatever you over-bought on the edges
        is what gets marked down.
      </div>

      {rows.length === 0 ? (
        <div className="card-raised" style={{ padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 6 }}>No size breakdown on this order yet.</div>
          <div className="form-hint" style={{ marginBottom: 16 }}>
            Without one the order is just a unit count, and the split gets decided by whoever cuts it.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-primary" onClick={applyBenchmark}>Start from a benchmark curve</button>
            <button className="btn btn-sm" onClick={addRow}>Add sizes manually</button>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Size</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Colorway</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ordered</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Received</th>
                  <th style={{ padding: '10px 16px', width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const short = r.received_units !== '' && r.received_units != null && Number(r.received_units) < Number(r.units);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 16px' }}>
                        <input className="form-input" style={{ width: 90, padding: '6px 10px', fontSize: 12.5 }} placeholder="M" value={r.size} onChange={e => setRow(i, 'size', e.target.value)} />
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        <input className="form-input" style={{ width: 140, padding: '6px 10px', fontSize: 12.5 }} placeholder="(all)" value={r.colorway} onChange={e => setRow(i, 'colorway', e.target.value)} />
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        <input className="form-input" type="number" min="0" style={{ width: 100, padding: '6px 10px', fontSize: 12.5, fontFamily: 'var(--mono)' }} value={r.units} onChange={e => setRow(i, 'units', e.target.value)} />
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        <input className="form-input" type="number" min="0" style={{ width: 100, padding: '6px 10px', fontSize: 12.5, fontFamily: 'var(--mono)', color: short ? 'var(--red)' : undefined }} placeholder="—" value={r.received_units} onChange={e => setRow(i, 'received_units', e.target.value)} />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <button className="btn btn-sm" style={{ background: 'none', border: 'none', color: 'var(--ink-4)', boxShadow: 'none' }} onClick={() => removeRow(i)} title="Remove size">
                          <i className="ph ph-x" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--bg-2)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>Total</td>
                  <td />
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--mono)', fontWeight: 700 }}>{total}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--mono)', fontWeight: 700, color: anyReceived && totalReceived !== total ? 'var(--red)' : undefined }}>
                    {anyReceived ? totalReceived : '—'}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {isFlat && (
            <div className="form-hint" style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--amber-bg, var(--bg-3))', border: '1px solid var(--border-2)', color: 'var(--ink-2)', marginBottom: 12 }}>
              <i className="ph ph-warning" style={{ marginRight: 6, color: 'var(--amber)' }} />
              Every size has the same quantity. Demand almost never does — you will usually sell out of the
              middle sizes while the ends sit, which means lost full-price sales at one end and markdowns at
              the other.
            </div>
          )}

          {anyReceived && totalReceived !== total && (
            <div className="form-hint" style={{ marginBottom: 12, color: 'var(--red)' }}>
              Received {totalReceived} against {total} ordered. Worth resolving with the factory before you pay the balance.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              <i className="ph ph-check" /> {saving ? 'Saving…' : 'Save size curve'}
            </button>
            <button className="btn btn-sm" onClick={addRow}><i className="ph ph-plus" /> Add size</button>
            <button className="btn btn-sm" onClick={applyBenchmark}>Benchmark curve</button>
            <button className="btn btn-sm" onClick={applyFlat}>Flat</button>
          </div>
          <div className="form-hint" style={{ marginTop: 10 }}>
            The benchmark is a typical unisex-top shape, not your data — a starting point to edit, not an
            answer. Saving updates the order total to match.
          </div>
        </>
      )}
    </div>
  );
}

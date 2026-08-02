import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GUIDE, GUIDE_INTRO, GUIDE_COSTS, GUIDE_PLAN_ROWS } from '../data/guide.js';

/* The feature reference, rendered from src/data/guide.js.
   Public on purpose: it is linked from the landing page, so someone deciding
   whether to sign up can read it without an account. */

const PLAN_LABEL = { free: 'Free', basic: 'Basic', premium: 'Premium', soon: 'Coming soon' };
const PLAN_COLOR = { free: 'var(--ink-3)', basic: 'var(--green)', premium: 'var(--amber)', soon: 'var(--ink-4)' };

function PlanTag({ plan }) {
  if (!plan) return null;
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', flexShrink: 0,
      color: PLAN_COLOR[plan], border: `1px solid ${PLAN_COLOR[plan]}`,
      borderStyle: plan === 'soon' ? 'dashed' : 'solid',
    }}>{PLAN_LABEL[plan]}</span>
  );
}

function CostTag({ cost }) {
  if (!cost) return null;
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10.5, padding: '2px 6px', borderRadius: 3,
      background: 'var(--bg-3)', color: 'var(--ink-2)', whiteSpace: 'nowrap', flexShrink: 0,
    }}>{cost} cr</span>
  );
}

function Item({ item }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12,
      alignItems: 'baseline', padding: '11px 14px', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{item.name}</div>
        {/* Location first and always present — "I couldn't find it" is the
            problem this page exists to solve. */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--accent)', margin: '2px 0 4px' }}>
          {item.where}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{item.desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <CostTag cost={item.cost} />
        <PlanTag plan={item.plan} />
      </div>
    </div>
  );
}

export default function Guide() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 16, marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          Atelier · Reference
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '6px 0 10px', letterSpacing: '-0.01em' }}>
          Everything Atelier does, in the order you need it
        </h1>
        <p style={{ margin: 0, maxWidth: '64ch', color: 'var(--ink-2)', fontSize: 14.5, lineHeight: 1.6 }}>
          {GUIDE_INTRO}
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 36 }}>
        {GUIDE.map(s => (
          <a key={s.id} href={`#${s.id}`} style={{
            fontFamily: 'var(--mono)', fontSize: 11.5, textDecoration: 'none', color: 'var(--ink-2)',
            border: '1px solid var(--border-2)', borderRadius: 3, padding: '5px 9px', background: 'var(--bg-2)',
          }}>
            <span style={{ color: 'var(--ink-4)', marginRight: 5 }}>{s.num}</span>{s.title}
          </a>
        ))}
        <a href="#costs" style={{
          fontFamily: 'var(--mono)', fontSize: 11.5, textDecoration: 'none', color: 'var(--ink-2)',
          border: '1px solid var(--border-2)', borderRadius: 3, padding: '5px 9px', background: 'var(--bg-2)',
        }}>Credit costs</a>
        <a href="#plans" style={{
          fontFamily: 'var(--mono)', fontSize: 11.5, textDecoration: 'none', color: 'var(--ink-2)',
          border: '1px solid var(--border-2)', borderRadius: 3, padding: '5px 9px', background: 'var(--bg-2)',
        }}>Plans</a>
      </div>

      {GUIDE.map(section => (
        <section key={section.id} id={section.id} style={{ marginBottom: 44, scrollMarginTop: 16 }}>
          <div style={{ borderTop: `3px solid ${section.hue}`, paddingTop: 12, marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: section.hue, letterSpacing: '0.1em' }}>{section.num}</span>
            <h2 style={{ fontSize: 23, fontWeight: 700, margin: 0 }}>{section.title}</h2>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 12 }}>
            Sidebar → {section.nav}
          </div>
          <p style={{ margin: '0 0 18px', maxWidth: '66ch', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
            {section.lede}
          </p>

          {section.tabs && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 18 }}>
              {section.tabs.map(t => (
                <span key={t} style={{
                  fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)',
                  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 3, padding: '3px 7px',
                }}>{t}</span>
              ))}
            </div>
          )}

          {section.groups.map(group => (
            <div key={group.title} style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--ink-3)', marginBottom: 8,
              }}>{group.title}</div>
              {group.note && (
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>{group.note}</div>
              )}
              <div className="card" style={{ overflow: 'hidden' }}>
                {group.items.map((item, i) => (
                  <div key={item.name} style={i === group.items.length - 1 ? { borderBottom: 'none' } : undefined}>
                    <Item item={item} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {section.callout && (
            <div style={{ borderLeft: `2px solid ${section.hue}`, padding: '2px 0 2px 14px', maxWidth: '64ch' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{section.callout.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{section.callout.body}</div>
            </div>
          )}
        </section>
      ))}

      <section id="costs" style={{ marginBottom: 44, scrollMarginTop: 16 }}>
        <div style={{ borderTop: '3px solid var(--accent)', paddingTop: 12, marginBottom: 12 }}>
          <h2 style={{ fontSize: 23, fontWeight: 700, margin: 0 }}>What each AI action costs</h2>
        </div>
        <p style={{ margin: '0 0 16px', maxWidth: '66ch', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
          Every AI button shows its price before you press it, and a failed call is refunded. Text actions
          are cheap to run; image generation is where credits go.
        </p>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 440 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                <th style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 500 }}>Action</th>
                <th style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 500 }}>Credits</th>
                <th style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 500 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {GUIDE_COSTS.map(c => (
                <tr key={c.action} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 14px' }}>{c.action}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}>{c.cr}</td>
                  <td style={{ padding: '8px 14px', color: 'var(--ink-3)' }}>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="plans" style={{ scrollMarginTop: 16 }}>
        <div style={{ borderTop: '3px solid var(--accent)', paddingTop: 12, marginBottom: 12 }}>
          <h2 style={{ fontSize: 23, fontWeight: 700, margin: 0 }}>What each plan includes</h2>
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                {['', 'Free', 'Basic — $29.99', 'Premium — $79.99'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GUIDE_PLAN_ROWS.map(r => (
                <tr key={r.label} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 14px' }}>{r.label}</td>
                  {['free', 'basic', 'premium'].map(tier => (
                    <td key={tier} style={{ padding: '8px 14px', fontFamily: typeof r[tier] === 'string' ? 'var(--mono)' : undefined, color: r[tier] === false ? 'var(--ink-4)' : undefined }}>
                      {r[tier] === true ? 'Yes' : r[tier] === false ? '—' : r[tier]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '14px 0 0', maxWidth: '64ch', color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.6 }}>
          Free has no time limit. One product, for as long as you want it, and PDF and CSV export are
          included at every tier so your data stays yours.
        </p>
      </section>

      <div style={{ marginTop: 40, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <i className="ph ph-arrow-left" /> Back to Atelier
        </button>
      </div>
    </div>
  );
}

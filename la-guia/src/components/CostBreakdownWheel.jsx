import React, { useState } from 'react';

// Interactive donut chart — no charting library, same "plain inline SVG"
// convention as PriceHistoryChart.jsx. Built with the stroke-dasharray ring
// trick rather than arc paths: much simpler, and plenty for a handful of
// segments. Hovering a segment (or its legend row) highlights it and swaps
// the center label to that segment's share of the unit price.
const SIZE = 220;
const STROKE = 34;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CostBreakdownWheel({ segments, totalAmount }) {
  const [hovered, setHovered] = useState(null);
  const total = segments.reduce((s, x) => s + (x.percent || 0), 0) || 1;

  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const pct = ((seg.percent || 0) / total) * 100;
    const len = (pct / 100) * CIRC;
    const offset = (cumulative / 100) * CIRC;
    cumulative += pct;
    return { ...seg, pct, len, offset, index: i };
  });

  const activeSeg = hovered != null ? arcs[hovered] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          {arcs.map(a => (
            <circle
              key={a.label}
              cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
              stroke={a.color} strokeWidth={hovered === a.index ? STROKE + 6 : STROKE}
              strokeDasharray={`${a.len} ${CIRC - a.len}`}
              strokeDashoffset={-a.offset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-width 0.15s ease, opacity 0.15s ease', opacity: hovered == null || hovered === a.index ? 1 : 0.4, cursor: 'pointer' }}
              onMouseEnter={() => setHovered(a.index)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
          {activeSeg ? (
            <>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{activeSeg.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 25, fontWeight: 800, color: activeSeg.color }}>{Math.round(activeSeg.pct)}%</div>
              {totalAmount != null && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>${((activeSeg.pct / 100) * totalAmount).toFixed(2)}/unit</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Unit price</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 23, fontWeight: 800 }}>{totalAmount != null ? `$${Number(totalAmount).toFixed(2)}` : '—'}</div>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 180 }}>
        {arcs.map(a => (
          <div
            key={a.label}
            onMouseEnter={() => setHovered(a.index)} onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', opacity: hovered == null || hovered === a.index ? 1 : 0.5, transition: 'opacity 0.15s ease' }}
          >
            <span style={{ width: 11, height: 11, borderRadius: 3, background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>{a.label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>{Math.round(a.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

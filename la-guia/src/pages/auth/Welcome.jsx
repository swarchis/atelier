import React from 'react';
import { useNavigate } from 'react-router-dom';

const POINTS = [
  { icon: 'ph-pencil-simple', color: 'var(--c-design)', text: 'Turn a sketch or reference photo into a structured design' },
  { icon: 'ph-ruler', color: 'var(--c-techpack)', text: 'Build tech packs with a live factory readiness score' },
  { icon: 'ph-handshake', color: 'var(--c-vendors)', text: 'Source, quote, and compare vendors without the cold-start problem' },
];

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="auth-shell">
      <div className="auth-card enter" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 26 }}>
          <svg width="26" height="18" viewBox="0 0 24 16" fill="none"><path d="M1 8h9m4 0h9M14 8l-4-4m0 8 4-4M10 8l4-4m-4 4 4 4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 24, fontWeight: 500 }}>Grainline</span>
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 28, fontWeight: 500, marginBottom: 10, lineHeight: 1.25 }}>
          From design to drop, without losing your mind.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 26 }}>
          The production operating system for independent clothing brands.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 30 }}>
          {POINTS.map(p => (
            <div key={p.text} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `color-mix(in srgb, ${p.color} 14%, transparent)`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ph ${p.icon}`} />
              </div>
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, paddingTop: 6 }}>{p.text}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => navigate('/signup')}>
          Get started
        </button>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--ink-3)' }}>
          Already have a workspace? <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Log in</a>
        </div>
      </div>
    </div>
  );
}

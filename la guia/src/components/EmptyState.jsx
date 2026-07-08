import React from 'react';

export default function EmptyState({ icon, title, sub, color = 'var(--accent)', cta, onCta }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ '--es-bg': `color-mix(in srgb, ${color} 14%, transparent)`, '--es-color': color }}>
        <i className={`ph ${icon}`} />
      </div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-sub">{sub}</div>
      {cta && (
        <button className="btn" style={{ marginTop: 22 }} onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  );
}

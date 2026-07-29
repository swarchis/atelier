import React from 'react';

export default function TabBar({ tabs, active, onChange, accent = 'var(--accent)', dataTour }) {
  return (
    <div className="tab-bar" data-tour={dataTour} style={{ '--tab-accent': accent }}>
      {tabs.map(t => (
        <button key={t.key} className={`tab-item ${active === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.icon && <i className={`ph ${t.icon}`} style={{ marginRight: 7 }} />}
          {t.label}
          {/* Set `comingSoon` on a tab whose integration isn't live yet. The tab
              stays reachable on purpose — the panel behind it explains what is
              waiting on platform approval, which is more use than a tab that
              silently does nothing. */}
          {t.comingSoon && (
            <span
              className="tag tag-neutral"
              style={{ marginLeft: 7, fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '1px 6px', verticalAlign: 'middle' }}
            >
              Soon
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

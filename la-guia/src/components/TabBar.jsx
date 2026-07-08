import React from 'react';

export default function TabBar({ tabs, active, onChange, accent = 'var(--accent)' }) {
  return (
    <div className="tab-bar" style={{ '--tab-accent': accent }}>
      {tabs.map(t => (
        <button key={t.key} className={`tab-item ${active === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.icon && <i className={`ph ${t.icon}`} style={{ marginRight: 7 }} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

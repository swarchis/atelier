import React, { useEffect, useState } from 'react';
import { subscribeToToasts } from '../lib/toast.js';

const KIND_STYLE = {
  error: { border: 'var(--red-border)', bg: 'var(--red-bg)', color: 'var(--red)', icon: 'ph-warning-circle' },
  success: { border: 'var(--green-border)', bg: 'var(--green-bg)', color: 'var(--green)', icon: 'ph-check-circle' },
  info: { border: 'var(--border-2)', bg: 'var(--bg-2)', color: 'var(--ink-2)', icon: 'ph-info' },
};

// Bottom-right toast stack for the whole authenticated app. Non-blocking
// replacement for the window.alert() calls that used to interrupt every
// failed save/update; auto-dismisses after ~5s, manual dismiss via the x.
export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribeToToasts((t) => {
    setToasts((prev) => [...prev.slice(-3), t]); // cap the visible stack at 4
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 5200);
  }), []);

  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
      {toasts.map((t) => {
        const s = KIND_STYLE[t.kind] || KIND_STYLE.info;
        return (
          <div key={t.id} className="card-raised" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: 13, boxShadow: 'var(--shadow-lg)' }}>
            <i className={`ph ${s.icon}`} style={{ marginTop: 1.5, flexShrink: 0 }} />
            <div style={{ minWidth: 0, wordBreak: 'break-word' }}>{t.message}</div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 'auto', opacity: 0.7, padding: 0 }}
            >
              <i className="ph ph-x" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

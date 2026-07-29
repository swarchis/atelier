import React from 'react';

// Panel-level banner for a feature that is built but can't be switched on yet
// because the platform hasn't approved us.
//
// It says which platform and why, rather than a bare "coming soon" — waiting on
// someone else's review is a real, specific reason, and a founder deciding
// whether to rely on this deserves to know it isn't a week away by our choice.
export default function ComingSoonNotice({ what, platforms, children }) {
  return (
    <div
      className="form-hint"
      style={{
        padding: '14px 16px', borderRadius: 10, marginBottom: 18,
        background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--ink-2)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      <i className="ph ph-clock-countdown" style={{ fontSize: 18, color: 'var(--ink-3)', marginTop: 1, flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{what} isn't live yet</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          {children || (
            <>
              We're waiting on developer approval from {platforms}. The integration is built — it stays
              switched off until they sign off, rather than showing you a connect button that can't connect.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

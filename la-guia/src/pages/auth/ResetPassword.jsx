import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  return (
    <div className="auth-shell">
      <div className="auth-card enter">
        {sent ? (
          <>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <i className="ph ph-check" style={{ fontSize: 20 }} />
            </div>
            <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Check your inbox</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 22, lineHeight: 1.6 }}>If an account exists for that email, a reset link is on its way.</p>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => navigate('/login')}>Back to log in</button>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Reset your password</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 24 }}>We'll email you a link to get back in.</p>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="you@studio.com" /></div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6 }} onClick={() => setSent(true)}>
              Send reset link
            </button>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--ink-3)' }}>
              <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Back to log in</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

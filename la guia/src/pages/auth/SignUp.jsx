import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SignUp() {
  const navigate = useNavigate();
  return (
    <div className="auth-shell">
      <div className="auth-card enter">
        <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 24, fontWeight: 500, marginBottom: 6 }}>Create your workspace</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 24 }}>One account, one brand to start — you can add more later.</p>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="you@studio.com" /></div>
        <div className="form-group"><label className="form-label">Brand name</label><input className="form-input" placeholder="e.g. Aldercreek Studio" /></div>
        <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" placeholder="••••••••" /></div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6 }} onClick={() => navigate('/')}>
          Create account
        </button>
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--ink-3)' }}>
          Already have an account? <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Log in</a>
        </div>
      </div>
    </div>
  );
}

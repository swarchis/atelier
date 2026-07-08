import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LogIn() {
  const navigate = useNavigate();
  return (
    <div className="auth-shell">
      <div className="auth-card enter">
        <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 24, fontWeight: 500, marginBottom: 6 }}>Welcome back</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 24 }}>Log in to your production workspace.</p>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="you@studio.com" /></div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" />
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <a href="#" style={{ fontSize: 12.5 }} onClick={e => { e.preventDefault(); navigate('/reset-password'); }}>Forgot password?</a>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6 }} onClick={() => navigate('/')}>
          Log in
        </button>
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--ink-3)' }}>
          New to Grainline? <a href="#" onClick={e => { e.preventDefault(); navigate('/signup'); }}>Create a workspace</a>
        </div>
      </div>
    </div>
  );
}

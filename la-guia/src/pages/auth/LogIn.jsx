import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function LogIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logIn, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await logIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
    if (err.message.includes('Email not confirmed')) {
      setError('Your email has not been verified yet. Please check your inbox for the confirmation link.');
    } else {
      setError(err.message);
    }
  }
     finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Pick up where your last run left off."
      footer={<>New here? <a href="#" onClick={e => { e.preventDefault(); navigate('/signup'); }}>Start a workspace</a></>}
    >
      {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--r-sm)', marginBottom: 16, fontSize: 13, border: '1px solid var(--red-border)' }}>{error}</div>}

      <button
        type="button"
        className="btn"
        onClick={handleGoogleSignIn}
        disabled={loading || googleLoading}
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '11px',
          marginBottom: 16,
          background: 'var(--bg-1)',
          borderColor: 'var(--border-2)',
          fontWeight: 600,
          fontSize: 13.5
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 8, flexShrink: 0 }}>
          <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"/>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
          <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
          <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
        </svg>
        {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', color: 'var(--ink-4)' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--ink-3)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" autoComplete="email" placeholder="you@studio.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <a href="#" style={{ fontSize: 12.5 }} onClick={e => { e.preventDefault(); navigate('/reset-password'); }}>Forgot password?</a>
          </div>
        </div>
        <button type="submit" disabled={loading || googleLoading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 6 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
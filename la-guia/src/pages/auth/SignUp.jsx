import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp, signInWithGoogle } = useAuth();

  const [form, setForm] = useState({ email: '', brandName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isInvite, setIsInvite] = useState(false);

  // Catch the URL parameter if they clicked an invite email link
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefillEmail = params.get('email');
    if (prefillEmail) {
      setForm(f => ({ ...f, email: prefillEmail, brandName: 'My Personal Workspace' }));
      setIsInvite(true);
    }
  }, [location.search]);

const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || (!form.brandName && !isInvite) || !form.password) {
      return setError('All fields are required.');
    }
    setLoading(true);
    setError('');
    try {
      const data = await signUp(form.email, form.password, form.brandName || 'Workspace');
      if (data?.user && !data?.session) {
        setEmailSent(true); // Shows the "Check your email" banner
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  {emailSent ? (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)', padding: '20px', borderRadius: 'var(--r-sm)', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--ink-1)' }}>✉️ Check your email</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 16 }}>
            We've sent a verification link to <strong>{form.email}</strong>. Please confirm your email address to activate your account and log in.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')} style={{ width: '100%', justifyContent: 'center' }}>
            Go to Sign In
          </button>
        </div>
      ) : (
        <>
          {/* Keep your existing Google Button, Divider, and Form here */}
        </>
      )}

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
      eyebrow={isInvite ? 'Invitation' : 'Get started'}
      title={isInvite ? 'Join your team' : 'Start a workspace'}
      subtitle={isInvite ? "Set a password and you're in." : 'One account, one label to begin. Add more whenever you like.'}
      footer={<>Already have an account? <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Sign in</a></>}
    >
      {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--r-sm)', marginBottom: 16, fontSize: 13, border: '1px solid var(--red-border)' }}>{error}</div>}

      <button
        type="button"
        className="btn"
        onClick={handleGoogleSignIn}
        disabled={loading || googleLoading}
        style={{
          width: '100%',
          justify: 'center',
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
          <input className="form-input" type="email" autoComplete="email" placeholder="you@studio.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={isInvite} style={isInvite ? { background: 'var(--bg-2)', color: 'var(--ink-3)' } : {}} />
        </div>
        {!isInvite && (
          <div className="form-group">
            <label className="form-label">Brand name</label>
            <input className="form-input" placeholder="e.g. Aldercreek Studio" value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" disabled={loading || googleLoading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', margin: '6px 0 14px' }}>
          {loading ? 'Setting up…' : 'Create account'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', marginBottom: 4, lineHeight: 1.4 }}>
          By creating an account you agree to our <a href="#" onClick={e => { e.preventDefault(); navigate('/terms'); }} style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>Terms</a> and <a href="#" onClick={e => { e.preventDefault(); navigate('/privacy'); }} style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>Privacy Policy</a>.
        </div>
      </form>
      {isInvite && (
        <div className="form-hint" style={{ textAlign: 'center', marginTop: 10 }}>
          Once your account exists, you'll land in the shared workspace automatically.
        </div>
      )}
    </AuthLayout>
  );
}
import React from 'react';
import { isStaleDeployError, recoverFromStaleDeploy } from '../lib/staleDeploy.js';

// The root boundary. Everything below App is lazy — including AuthenticatedApp,
// which is the entire signed-in product — and the Suspense wrapping it had
// `fallback={null}` with no boundary at all. So any failed chunk unmounted the
// tree and left a white page with nothing on it and nothing in the console the
// user would ever see.
//
// Two different failures land here and they need different answers. A stale
// build is fixed by reloading, so do that automatically once. Anything else is
// a real bug, and the honest response is to say so and let the person choose,
// rather than reloading into the same crash forever.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    return { error, recovering: isStaleDeployError(error) };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error at the app root:', error, info);
    if (isStaleDeployError(error)) {
      // Returns false when it has already reloaded recently, which means
      // reloading is not the fix — fall through to the message.
      if (!recoverFromStaleDeploy()) this.setState({ recovering: false });
    }
  }

  render() {
    const { error, recovering } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, background: 'var(--bg, #E8E9E3)', color: 'var(--ink, #16181D)',
        fontFamily: 'var(--sans, system-ui, sans-serif)',
      }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden>
            <i className={recovering ? 'ph ph-arrows-clockwise' : 'ph ph-warning-circle'} />
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px' }}>
            {recovering ? 'Updating to the latest version…' : 'Something broke on this page'}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2, #444851)', margin: '0 0 18px' }}>
            {recovering
              ? 'A new version of Atelier was just released. Reloading to pick it up.'
              : 'Your work is saved. Reloading usually clears it — if it keeps happening, tell us through the suggestion box on Home.'}
          </p>
          {!recovering && (
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 18px', fontSize: 14, borderRadius: 8, cursor: 'pointer',
                background: 'var(--accent, #2F5D7C)', color: '#fff', border: 'none',
              }}
            >
              Reload the page
            </button>
          )}
          {error?.message && (
            <details style={{ marginTop: 18, textAlign: 'left' }}>
              <summary style={{ fontSize: 12, color: 'var(--ink-3, #767B84)', cursor: 'pointer' }}>
                Technical detail
              </summary>
              <pre style={{
                fontSize: 11, marginTop: 8, padding: 10, overflowX: 'auto',
                background: 'var(--bg-2, #EEEFE9)', borderRadius: 6, color: 'var(--ink-2, #444851)',
              }}>{String(error.message)}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

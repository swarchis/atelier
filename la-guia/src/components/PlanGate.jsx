import React from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext.jsx';
import { hasFeature, requiredTier } from '../data/entitlements.js';

// Wraps a page or panel that needs a paid plan. Renders the real thing when the
// brand qualifies, and a lock screen when it doesn't.
//
// Deliberately replaces the content rather than hiding the nav entry. A founder
// who can't find where a feature went assumes it's broken; one who sees it
// locked knows what it is and what it costs. That is also why the lock names
// the plan and links straight to billing instead of saying "upgrade".
export default function PlanGate({ feature, title, blurb, children }) {
  const { activeBrand } = useProducts();
  const tier = activeBrand?.plan_tier || 'free';
  if (hasFeature(tier, feature)) return children;

  const needed = requiredTier(feature) || 'basic';
  const planName = needed.charAt(0).toUpperCase() + needed.slice(1);

  return (
    <div className="card-raised" style={{ maxWidth: 620, margin: '48px auto', padding: '34px 32px', textAlign: 'center' }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
      }}>
        <i className="ph ph-lock-simple" style={{ fontSize: 24, color: 'var(--ink-3)' }} />
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 6 }}>{blurb}</p>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 22 }}>
        Included in the <strong>{planName}</strong> plan.
      </p>
      <Link to="/settings?tab=billing" className="btn btn-primary" style={{ textDecoration: 'none' }}>
        <i className="ph ph-arrow-up-right" /> See {planName}
      </Link>
    </div>
  );
}

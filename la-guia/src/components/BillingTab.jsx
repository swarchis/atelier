import React, { useEffect, useState } from 'react';
import { PLANS, getPlan, planIndex } from '../data/plans.js';
import { CREDIT_PACKS } from '../data/aiCredits.js';
import { useProducts } from '../context/ProductsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAIUsage } from '../context/AIUsageContext.jsx';
import { apiPost } from '../lib/aiApi.js';

export default function BillingTab() {
  const { activeBrand, refreshActiveBrand } = useProducts();
  const { user } = useAuth();
  const { credits, topupCredits, buyPack, topupLoading, topupError, refresh } = useAIUsage();

  const [confirming, setConfirming] = useState(false);
  const [banner, setBanner] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const currentTier = activeBrand?.plan_tier || 'free';
  const currentPlan = getPlan(currentTier);

  // On return from Stripe Checkout, verify the session server-side. The API
  // persists plan_tier and the Stripe ids itself once it has confirmed the
  // session with Stripe — the browser only re-reads the result. It used to do
  // that write here, which meant anyone could set their own tier to premium, or
  // point their brand at another customer's subscription and collect its
  // credits. Those columns are not client-writable any more.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('billing');
    if (!status || !activeBrand) return;

    if (status === 'success') {
      const sessionId = params.get('session_id');
      setConfirming(true);
      apiPost('/api/confirm-checkout', { sessionId })
        .then(r => r.json())
        .then(async (data) => {
          if (!data.ok) throw new Error(data.error);
          await refreshActiveBrand();
          setBanner({ type: 'success', text: `You're now on the ${getPlan(data.plan).name} plan.` });
        })
        .catch(err => setBanner({ type: 'error', text: 'Could not confirm your upgrade: ' + err.message }))
        .finally(() => setConfirming(false));
    } else if (status === 'cancelled') {
      setBanner({ type: 'info', text: 'Checkout cancelled — your plan is unchanged.' });
    }
    window.history.replaceState({}, '', '/settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.id]);

  // On return from a credit-pack purchase. The webhook adds the credits, so
  // just surface a banner and refresh the balance (twice, to cover webhook lag).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('topup');
    if (!t || !activeBrand) return;
    if (t === 'success') {
      setBanner({ type: 'success', text: 'Credits added — your new balance will appear in a moment.' });
      refresh();
      setTimeout(() => refresh(), 2000);
    } else if (t === 'cancelled') {
      setBanner({ type: 'info', text: 'Top-up cancelled — no charge was made.' });
    }
    window.history.replaceState({}, '', '/settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.id]);

  // No webhook is wired up to catch a cancellation made through the Stripe
  // portal, so reconcile against the real subscription status whenever this
  // tab loads for a brand that has one on file — catches "cancelled last
  // week, still shows Premium" within one page load instead of never.
  // The endpoint writes the corrected tier itself (it is the side that just
  // asked Stripe); this only refreshes local state to match.
  useEffect(() => {
    if (!activeBrand?.stripe_subscription_id || activeBrand.plan_tier === 'free') return;
    apiPost('/api/subscription-status', { subscriptionId: activeBrand.stripe_subscription_id })
      .then(r => r.json())
      .then(async (data) => {
        if (!data.ok) return;
        if (!data.active && activeBrand.plan_tier !== 'free') {
          await refreshActiveBrand();
          setBanner({ type: 'info', text: 'Your subscription is no longer active — you\'ve been moved back to the Free plan.' });
        } else if (data.active && data.plan && data.plan !== activeBrand.plan_tier) {
          await refreshActiveBrand();
        }
      })
      .catch(() => {}); // best-effort — don't block the page on this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.id, activeBrand?.stripe_subscription_id]);

  const startCheckout = async (planId) => {
    setCheckoutLoading(planId);
    try {
      const res = await apiPost('/api/create-checkout-session', { plan: planId, brandId: activeBrand.id, brandEmail: user?.email });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
      setCheckoutLoading(null);
    }
  };

  // The DEV-only "Force plan" override used to live here. It set plan_tier
  // straight from the browser to test tier gating without paying Stripe — the
  // same write an attacker would use to grant themselves Premium, which is why
  // that column is no longer client-writable (migration 044). Local dev shares
  // the production Supabase project, so there is no environment where the grant
  // survives and it could only have errored.
  //
  // To test a tier locally now, set it in the Supabase SQL editor, which runs as
  // postgres and is unaffected by the revoke:
  //   update public.brands set plan_tier = 'premium' where id = '<brand-id>';

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await apiPost('/api/create-portal-session', { customerId: activeBrand.stripe_customer_id });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {(confirming || banner) && (
        <div className="form-hint" style={{
          marginBottom: 18, padding: '10px 14px', borderRadius: 8,
          background: banner?.type === 'error' ? 'var(--red-bg)' : banner?.type === 'success' ? 'var(--green-bg)' : 'var(--bg-3)',
          border: `1px solid ${banner?.type === 'error' ? 'var(--red-border)' : banner?.type === 'success' ? 'var(--green-border)' : 'var(--border-2)'}`,
          color: banner?.type === 'error' ? 'var(--red)' : banner?.type === 'success' ? 'var(--green)' : 'var(--ink-2)',
        }}>
          {confirming ? <><i className="ph ph-circle-notch ph-spin" /> Confirming your upgrade…</> : banner.text}
        </div>
      )}

      <div className="card-raised" style={{ marginBottom: 22 }}>
        <div className="card-header"><span className="card-title">Current plan</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{currentPlan.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{currentPlan.price}{currentPlan.priceSuffix ? ` ${currentPlan.priceSuffix}` : ''}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
                AI credits: <strong style={{ color: 'var(--ink-2)' }}>{credits.toLocaleString()}</strong> remaining
                {topupCredits > 0 && <span> ({topupCredits.toLocaleString()} from top-ups)</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="tag tag-accent" style={{ textTransform: 'capitalize' }}>{currentTier}</span>
              {currentTier !== 'free' && activeBrand?.stripe_customer_id && (
                <button className="btn btn-sm" onClick={openPortal} disabled={portalLoading}>
                  {portalLoading ? 'Opening…' : 'Manage subscription'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section-label">Plans</div>
      <div className="grid-3" style={{ marginBottom: 20, alignItems: 'stretch' }}>
        {PLANS.map(p => {
          const isCurrent = p.id === currentTier;
          const isUpgrade = planIndex(p.id) > planIndex(currentTier);
          const isExpanded = expanded === p.id;
          return (
            <div key={p.id} className="card-raised" style={{ padding: 20, display: 'flex', flexDirection: 'column', border: isCurrent ? '1.5px solid var(--accent)' : undefined }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, minHeight: 32 }}>{p.tagline}</div>
              <div style={{ margin: '10px 0 14px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700 }}>{p.price}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}> {p.priceSuffix}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                {(isExpanded ? p.features : p.summary.map(text => ({ text }))).map((feat, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', gap: 7 }}>
                    <i className="ph ph-check" style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0 }} />
                    <span>{feat.text}</span>
                  </li>
                ))}
              </ul>
              <button className="btn btn-sm" style={{ marginBottom: 8, background: 'none', border: 'none', color: 'var(--ink-3)', textDecoration: 'underline', boxShadow: 'none' }} onClick={() => setExpanded(isExpanded ? null : p.id)}>
                {isExpanded ? 'Show summary' : `See all ${p.features.length} features`}
              </button>
              {isCurrent ? (
                <button className="btn btn-sm" disabled style={{ width: '100%', justifyContent: 'center', opacity: 0.6 }}>Current plan</button>
              ) : p.id === 'free' ? (
                <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled title="Use the Stripe customer portal to downgrade">
                  Downgrade via portal
                </button>
              ) : (
                <button
                  className={`btn btn-sm ${isUpgrade ? 'btn-primary' : ''}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => startCheckout(p.id)}
                  disabled={checkoutLoading === p.id}
                >
                  {checkoutLoading === p.id ? 'Redirecting…' : isUpgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-label" style={{ marginTop: 24 }}>Buy AI credits</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>
        One-time top-ups for when your monthly allowance runs out. These credits don't expire and are spent only after your subscription credits.
      </div>
      <div className="grid-3" style={{ marginBottom: 12, alignItems: 'stretch' }}>
        {CREDIT_PACKS.map(p => (
          <div key={p.id} className="card-raised" style={{ padding: 18, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700 }}>{p.credits.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>credits</div>
            <button
              className="btn btn-sm btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
              disabled={!!topupLoading}
              onClick={() => buyPack(p.id)}
            >
              {topupLoading === p.id ? 'Redirecting…' : `Buy — ${p.price}`}
            </button>
          </div>
        ))}
      </div>
      {topupError && (
        <div className="form-hint" style={{ color: 'var(--red)' }}>{topupError}</div>
      )}
    </div>
  );
}

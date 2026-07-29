// Which plan a feature needs. ONE map, because gating used to be a handful of
// ad-hoc `plan.id === 'free'` checks scattered across pages — which is why
// plans.js could advertise a Premium-only feature while a Basic account walked
// straight into it. A feature that isn't listed here is available to everyone.
//
// This file is the FRONTEND half and decides what the UI offers. It is not a
// security boundary: anything that costs money or exposes data must also be
// checked server-side (see requireTier in api/index.js). Treat this as the
// thing that stops honest users hitting a wall, not the thing that stops
// dishonest ones.
//
// Keep the feature lists in plans.js in step — if a line there says Premium,
// its key belongs here.

export const TIER_ORDER = ['free', 'basic', 'premium'];

export const FEATURE_TIER = {
  // ── Basic ────────────────────────────────────────────────────────────────
  'vendor-search': 'basic',
  'vendor-fit-analysis': 'basic',
  'ai-design-studio': 'basic',
  'ai-tech-pack': 'basic',
  'rfq': 'basic',
  'quotes': 'basic',
  'sampling': 'basic',
  'production': 'basic',
  'collections': 'basic',
  'moodboards': 'basic',
  'materials-research': 'basic',
  'ecommerce-integration': 'basic',
  'csv-export': 'basic',

  // ── Premium ──────────────────────────────────────────────────────────────
  'sales-dashboard': 'premium',
  'break-even': 'premium',
  'financial-tools': 'premium',
  'product-insights': 'premium',
  'content-hub': 'premium',
  'influencer-tracking': 'premium',
  'email-campaigns': 'premium',
  'team-chat': 'premium',
  'vendor-comparison': 'premium',
  'readiness-review': 'premium',
};

export function tierRank(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return i === -1 ? 0 : i;
}

// The tier a feature needs, or null when it is open to everyone.
export function requiredTier(feature) {
  return Object.prototype.hasOwnProperty.call(FEATURE_TIER, feature) ? FEATURE_TIER[feature] : null;
}

export function hasFeature(tier, feature) {
  const needed = requiredTier(feature);
  if (!needed) return true;
  return tierRank(tier || 'free') >= tierRank(needed);
}

// Sentence for a lock screen. Names the plan rather than saying "upgrade",
// so the choice is obvious without opening the pricing page.
export function upgradeMessage(feature, label) {
  const needed = requiredTier(feature);
  if (!needed) return '';
  const plan = needed.charAt(0).toUpperCase() + needed.slice(1);
  return `${label || 'This feature'} is part of the ${plan} plan.`;
}

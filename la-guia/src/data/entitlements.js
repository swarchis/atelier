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

// Free features are absent from this map by design — organizing your own work
// and getting your own data back out are not upsells. Collections, moodboards
// and CSV export were listed under Basic and have been moved down: none of them
// costs us anything to serve, and a founder who can't export their own numbers
// has been locked in rather than sold to.
export const FEATURE_TIER = {
  // ── Basic ────────────────────────────────────────────────────────────────
  // Anything that spends an API call on the founder's behalf, plus the
  // vendor→quote→sample→production spine that takes a design to a factory.
  'vendor-search': 'basic',
  'vendor-fit-analysis': 'basic',
  // Comparison sits with search deliberately. Splitting one workflow across two
  // prices — find vendors on Basic, compare them on Premium — reads as a
  // toll booth in the middle of a job the founder already started.
  'vendor-comparison': 'basic',
  'ai-design-studio': 'basic',
  'ai-tech-pack': 'basic',
  'rfq': 'basic',
  'quotes': 'basic',
  'sampling': 'basic',
  'production': 'basic',
  'materials-research': 'basic',
  'ecommerce-integration': 'basic',
  // The factory-readiness gate is the core promise — "will this design survive
  // contact with a factory". Charging Premium for the answer put the most
  // important checkpoint behind the most expensive door.
  'readiness-review': 'basic',

  // ── Premium ──────────────────────────────────────────────────────────────
  // Everything downstream of actually selling: money, marketing, scale.
  'sales-dashboard': 'premium',
  'break-even': 'premium',
  'financial-tools': 'premium',
  'product-insights': 'premium',
  'content-hub': 'premium',
  'influencer-tracking': 'premium',
  'email-campaigns': 'premium',
  'team-chat': 'premium',
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

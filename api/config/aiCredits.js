// api/config/aiCredits.js
// AUTHORITATIVE per-feature credit costs, per-tier grants and top-up packs.
// The backend enforces these; the frontend mirror in
// la-guia/src/data/aiCredits.js is display-only and MUST be kept in sync.
//
// ── PRICING MODEL ───────────────────────────────────────────────────────────
// One rule keeps the whole system safe: NO ACTION MAY COST MORE THAN $0.005 OF
// API SPEND PER CREDIT CHARGED. Because every credit is capped that way, the
// worst case a customer can inflict — burning an entire balance on the single
// most expensive action — is just `credits x $0.005`, which every plan and
// pack is priced to absorb at >75% gross margin (see the table below).
//
// Credits are therefore priced from real API cost, not from vibes:
//     credits = ceil(api_cost / 0.005), rounded to a friendly number
//
// Worst case per product (all credits spent on high-quality silhouettes, the
// priciest action at $0.25 each; Stripe taken as 2.9% + $0.30):
//     Basic    $29.99 -> net $28.82, 1200 cr -> max cost $6.00  (20.8%) -> 79.2% margin
//     Premium  $79.99 -> net $77.37, 3500 cr -> max cost $17.50 (22.6%) -> 77.4% margin
//     Top-up S $10 -> net $9.41,   300 cr -> max cost $1.50  (15.9%) -> 84.1% margin
//     Top-up M $25 -> net $23.98,  800 cr -> max cost $4.00  (16.7%) -> 83.3% margin
//     Top-up L $50 -> net $48.25, 1750 cr -> max cost $8.75  (18.1%) -> 81.9% margin
//
// Text actions (Gemini Flash-Lite, ~$0.001) are effectively free to serve, so
// their credit prices reflect perceived value rather than cost. Image
// generation is the only real cost centre.

const FEATURE_COST = {
  // ── Text / search: API cost ~$0.0005-$0.002, priced for perceived value ──
  'chat-reply': 1,
  'design-color-palette': 3,
  'analyze-design': 5,
  'generate-tech-pack': 5,
  'parse-vendor': 5,
  'draft-vendor-email': 5,
  'analyze-vendor-fit': 5,
  'dashboard-suggestions': 5,
  'quote-economics': 5,
  'cost-simulator': 5,
  'generate-tech-pack-full': 10,
  'search-vendors': 10,
  'design-trend-inspiration': 10,

  // ── Images (OpenAI gpt-image-1): the real cost centre ────────────────────
  'design-generate-element': 10,  // logo/pattern, medium 1024x1024 ~$0.042 -> $0.0042/cr
  'design-ai-image': 15,          // edit modes, medium + input image ~$0.053 -> $0.0035/cr

  // Silhouette quality is user-selectable, so each tier is priced separately
  // against its own API cost (1024x1536 low/medium/high).
  'design-silhouette-low': 5,     // ~$0.016 -> $0.0032/cr
  'design-silhouette-medium': 15, // ~$0.063 -> $0.0042/cr
  'design-silhouette-high': 50,   // ~$0.250 -> $0.0050/cr (the cap)
};

// Fallback for any feature not explicitly priced.
const DEFAULT_COST = 5;

// Silhouette quality tiers → the credit feature key and the gpt-image-1
// `quality` parameter. Anything unrecognised falls back to medium.
const SILHOUETTE_QUALITIES = ['low', 'medium', 'high'];
function silhouetteQuality(q) {
  return SILHOUETTE_QUALITIES.includes(q) ? q : 'medium';
}
function silhouetteFeature(q) {
  return `design-silhouette-${silhouetteQuality(q)}`;
}

// Per-tier monthly subscription grant. MUST match plans.js creditsPerMonth.
// Deliberately generous relative to top-ups (41-44 credits/$ vs 30-35) so a
// subscription is always the better deal and recurring revenue is the
// rational choice for a heavy user.
const TIER_CREDITS = {
  free: 0,
  basic: 1200,   // $29.99 -> 40.0 credits per dollar
  premium: 3500, // $79.99 -> 43.8 credits per dollar
};

// One-time top-up packs. Priced ABOVE the subscription rate per credit on
// purpose — top-ups are a convenience for running dry mid-cycle, not a way to
// buy out of a subscription. Amounts are server-authoritative: checkout always
// looks the price up here by id, never trusts a client-supplied amount.
const CREDIT_PACKS = {
  small:  { id: 'small',  credits: 300,  cents: 1000, label: '300 credits' },  // 30.0 cr/$
  medium: { id: 'medium', credits: 800,  cents: 2500, label: '800 credits' },  // 32.0 cr/$
  large:  { id: 'large',  credits: 1750, cents: 5000, label: '1,750 credits' },// 35.0 cr/$
};

function getPack(packId) {
  return Object.prototype.hasOwnProperty.call(CREDIT_PACKS, packId) ? CREDIT_PACKS[packId] : null;
}

function creditCost(feature) {
  return Object.prototype.hasOwnProperty.call(FEATURE_COST, feature)
    ? FEATURE_COST[feature]
    : DEFAULT_COST;
}

function tierCredits(tier) {
  return Object.prototype.hasOwnProperty.call(TIER_CREDITS, tier)
    ? TIER_CREDITS[tier]
    : 0;
}

module.exports = {
  FEATURE_COST, DEFAULT_COST, TIER_CREDITS, CREDIT_PACKS,
  SILHOUETTE_QUALITIES, silhouetteQuality, silhouetteFeature,
  creditCost, tierCredits, getPack,
};

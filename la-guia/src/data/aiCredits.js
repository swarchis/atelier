// la-guia/src/data/aiCredits.js
// DISPLAY-ONLY mirror of api/config/aiCredits.js (the authoritative source the
// backend enforces). Used to show "this action costs N credits" in the UI.
// Keep in sync with the backend file — see it for the full pricing rationale.

export const FEATURE_COST = {
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
  'design-generate-element': 10,
  'design-ai-image': 15,
  'design-silhouette-low': 5,
  'design-silhouette-medium': 15,
  'design-silhouette-high': 50,
};

export const DEFAULT_COST = 5;

export function creditCost(feature) {
  return Object.prototype.hasOwnProperty.call(FEATURE_COST, feature)
    ? FEATURE_COST[feature]
    : DEFAULT_COST;
}

// Silhouette render quality — the user picks one and the credit cost follows,
// because each tier costs a very different amount to generate.
export const SILHOUETTE_QUALITY_OPTIONS = [
  { key: 'low', label: 'Draft', hint: 'Fast, rough — good for trying ideas' },
  { key: 'medium', label: 'Standard', hint: 'Balanced quality and cost' },
  { key: 'high', label: 'High', hint: 'Sharpest detail, costs the most' },
];

export function silhouetteFeature(quality) {
  const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
  return `design-silhouette-${q}`;
}

// One-time top-up packs. Display mirror of the backend's CREDIT_PACKS — the
// backend is authoritative on price. Deliberately a worse per-credit rate than
// a subscription (30-35 credits/$ vs 41-44), so subscribing is always better
// value for anyone using AI regularly.
export const CREDIT_PACKS = [
  { id: 'small', credits: 300, price: '$10' },
  { id: 'medium', credits: 800, price: '$25' },
  { id: 'large', credits: 1750, price: '$50' },
];

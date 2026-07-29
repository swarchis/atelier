// Subscription tiers.
//
// Every line in `features` is something the app ACTUALLY does today — the old
// `roadmap: true` "Coming soon" entries have been removed rather than shown as
// marketing promises. If a feature isn't built, it doesn't belong in this file.
// Monthly AI credits lead each list; keep `creditsPerMonth` in sync with
// TIER_CREDITS in api/config/aiCredits.js (the backend is authoritative).
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Start planning your first product',
    description: 'Organize one product, build a manual tech pack and manage your basic development workflow.',
    price: '$0',
    priceSuffix: 'forever',
    priceId: null,
    limits: { products: 1, teamMembers: 1, aiPerMonth: 0, creditsPerMonth: 0 },
    summary: [
      'No AI credits',
      '1 active product',
      'Manual tech-pack builder',
      'Design canvas with autosave',
      'Tasks, timeline and sampling checklist',
      'Cost and margin calculator',
      'Collections and moodboards',
      'Branded PDF and CSV export',
    ],
    features: [
      { text: 'No AI credits — AI features are not included' },
      { text: 'One active product' },
      { text: 'Design canvas with layered autosave and version history' },
      { text: 'Manual tech-pack builder' },
      { text: 'Measurements, bill of materials and colorways' },
      { text: 'Product tasks, Kanban and timeline' },
      { text: 'Materials library' },
      { text: 'Cost and margin calculator' },
      { text: 'Vendor directory with manual entry' },
      { text: 'Sampling and production checklists' },
      { text: 'Collections, product grouping and moodboards' },
      { text: 'Branded PDF and spreadsheet (CSV) export' },
      { text: 'One user' },
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Take products from concept to factory',
    description: 'Create production-ready tech packs, find manufacturers, compare quotes and manage sampling in one workspace.',
    price: '$29.99',
    priceSuffix: '/month',
    priceId: 'basic',
    limits: { products: 10, teamMembers: 3, aiPerMonth: 20, creditsPerMonth: 1200 },
    summary: [
      '1,200 AI credits per month',
      'Up to 10 active products',
      'AI design studio and tech packs',
      'AI vendor search, comparison and fit analysis',
      'RFQs, quotes and landed cost',
      'Sampling, production and readiness review',
      'Up to 3 team members',
    ],
    features: [
      { text: '1,200 AI credits per month' },
      { text: 'Up to 10 active products' },
      { text: 'Everything in Free, plus:' },
      { text: 'AI tech-pack generation from a guided questionnaire' },
      { text: 'AI Design Studio — sketch to design, polish, edit, recolor, fabric swap' },
      { text: 'Background removal, flat sketches and alternate garment views' },
      { text: 'AI silhouette generation with draft / standard / high quality' },
      { text: 'AI logo, graphic and seamless pattern generation' },
      { text: 'AI design critique and factory-readiness scoring' },
      { text: 'AI vendor web search, import and fit analysis' },
      { text: 'Vendor comparison and onboarding pipeline' },
      { text: 'Readiness review across every product' },
      { text: 'RFQs, quote comparison and negotiation log' },
      { text: 'Landed-cost calculator and AI cost simulator' },
      { text: 'Sampling rounds with photo annotations and fit feedback' },
      { text: 'Production tracking — QC checklists, issues, shipments, payments' },
      { text: 'AI color palettes and trend research' },
      { text: 'Materials library with cost history and supplier links' },
      { text: 'Ecommerce integration — Shopify, WooCommerce or Etsy' },
      { text: 'Up to 3 team members' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Manage your entire apparel operation',
    description: 'Unlock the full AI suite, unlimited products, sales and financial analytics, marketing tools and team collaboration.',
    price: '$79.99',
    priceSuffix: '/month',
    priceId: 'premium',
    limits: { products: Infinity, teamMembers: 10, aiPerMonth: 200, creditsPerMonth: 3500 },
    summary: [
      '3,500 AI credits per month',
      'Unlimited products',
      'Sales dashboard and break-even tracking',
      'Financial forecasting and MOQ tools',
      'Content planner and influencer tracking',
      'Team chat with an AI assistant',
      'Up to 10 team members',
    ],
    features: [
      { text: '3,500 AI credits per month' },
      { text: 'Unlimited active products' },
      { text: 'Everything in Basic, plus:' },
      { text: 'Sales dashboard with live orders and inventory' },
      { text: 'Per-product break-even and profitability tracking' },
      { text: 'Cash-flow forecasting and MOQ optimization' },
      { text: 'Manufacturing cost history and product insights' },
      { text: 'Content planner — drop calendar, launch planner, grid preview' },
      { text: 'Influencer tracking and email campaigns' },
      { text: 'Team chat with an AI assistant that knows your brand' },
      { text: 'All ecommerce integrations at once' },
      { text: 'Up to 10 team members with roles and permissions' },
    ],
  },
];

export function getPlan(tier) {
  return PLANS.find(p => p.id === tier) || PLANS[0];
}

export function planIndex(tier) {
  return PLANS.findIndex(p => p.id === tier);
}

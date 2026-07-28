// Single source of truth for the Terms of Service and Privacy Policy pages.
//
// ⚠️ FILL THESE IN BEFORE LAUNCH. Several are legally load-bearing:
//   · GOVERNING_LAW / VENUE — a governing-law clause that doesn't name a real
//     jurisdiction is weak-to-unenforceable. A court needs a named state.
//   · LEGAL_ENTITY — the party the contract is actually with. If you have not
//     incorporated, that party is you personally, and the liability cap and
//     indemnity below are the only things standing between a claim and your
//     personal assets. Incorporating before taking payments is the single
//     highest-value legal step available to you.
//   · POSTAL_ADDRESS — required by CAN-SPAM for the campaign feature and
//     expected by GDPR for a controller contact.
//
// LAST_UPDATED is a hardcoded string on purpose. It used to be
// `new Date().toLocaleDateString()`, which re-rendered as *today* on every page
// load — so the document could never evidence which version a user accepted.
// Bump it by hand whenever you change either document, and keep the old copy.

export const LEGAL_ENTITY = 'Atelier';            // TODO: replace with the registered entity once formed
export const APP_NAME = 'Atelier';
export const CONTACT_EMAIL = 'social@atelierlabs.app';
export const PRIVACY_EMAIL = 'social@atelierlabs.app';
export const DMCA_EMAIL = 'social@atelierlabs.app';

// A physical mailing address, NOT an email. Left empty on purpose rather than
// filled with a placeholder: the contact blocks below simply omit the address
// line when this is empty, which is honest. CAN-SPAM separately requires a
// valid physical postal address inside every commercial message the campaign
// feature sends — that obligation is about the outgoing email itself, so fill
// this in before running a campaign.
export const POSTAL_ADDRESS = '';

export const GOVERNING_LAW = 'the State of California, United States';
// Used both as the arbitration seat and the court venue, so it is phrased to
// read correctly in each. Narrow it to a county once you have a business
// address on file — "Los Angeles County, California" and similar are the
// conventional form.
export const VENUE = 'California, United States';
export const WEBSITE = 'https://atelierlabs.app';

export const LAST_UPDATED = 'July 27, 2026';

// Liability cap. Standard SaaS practice is the greater of fees paid in the
// trailing 12 months or a small floor — high enough to look good-faith to a
// court, low enough to be survivable.
export const LIABILITY_FLOOR_USD = 100;

// Every third party that processes customer data, and why. Keeping this list
// accurate is not optional dressing: an inaccurate privacy disclosure is
// itself a deceptive-practice exposure, separate from anything the processor
// does. Update it whenever you add or drop a vendor.
export const SUBPROCESSORS = [
  { name: 'Supabase', purpose: 'Database, authentication and file storage (your account, brand data, uploaded designs)', region: 'United States' },
  { name: 'Stripe', purpose: 'Payment processing and subscription billing. Card details go to Stripe directly and are never stored on our servers', region: 'United States' },
  { name: 'OpenAI', purpose: 'Image generation and editing (AI Design Studio, silhouettes, patterns, logos). Receives the design image and prompt for the request you make', region: 'United States' },
  { name: 'Google (Gemini)', purpose: 'Text generation (tech packs, vendor extraction, cost estimates, chat assistant). Receives the text and any image you attach to that request', region: 'United States' },
  { name: 'Tavily', purpose: 'Web search used to find and research manufacturers. Receives your search terms, not your designs', region: 'United States' },
  { name: 'Photopea', purpose: 'The in-app design canvas is an embedded Photopea editor. Design files you open or save on the canvas are processed in that embedded editor in your browser', region: 'Czech Republic / EU' },
  { name: 'Resend', purpose: 'Outbound email — team invitations, vendor outreach and email campaigns you send', region: 'United States' },
  { name: 'Sentry', purpose: 'Error monitoring. Receives technical error reports which may include your IP address and the page you were on', region: 'United States' },
  { name: 'Railway', purpose: 'Backend application hosting', region: 'United States' },
  { name: 'Cloudflare', purpose: 'Frontend hosting and content delivery', region: 'Global edge network' },
];

// Storefront/social platforms the user may connect. Listed separately because
// the user initiates these and controls the scope granted.
export const OPTIONAL_INTEGRATIONS = 'Shopify, WooCommerce, Etsy, Instagram, TikTok, YouTube and Pinterest';

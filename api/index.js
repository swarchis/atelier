// api/index.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { Resend } = require('resend');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { creditCost, tierCredits, getPack, silhouetteQuality, silhouetteFeature } = require('./config/aiCredits');

// Load the API env first, then tolerate keys placed in the Vite app env.
// Existing process env values win, so deploy/runtime secrets are left alone.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', 'la-guia', '.env.local') });

// Production error monitoring — active only when SENTRY_DSN is set (Railway).
// Captures unhandled route errors via setupExpressErrorHandler below; errors
// that handlers catch and convert to 500 responses themselves are NOT
// reported here (they're part of each handler's own contract).
const Sentry = process.env.SENTRY_DSN ? require('@sentry/node') : null;
if (Sentry) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'production' });
}

const app = express();

// Behind Railway's proxy: trust the first hop so req.ip reflects the real
// client (from X-Forwarded-For) — required for correct per-client rate
// limiting — and stop advertising the framework.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers. CSP / cross-origin isolation headers are disabled because
// this is a pure JSON API consumed cross-origin (Cloudflare Pages frontend →
// Railway API) and used for redirect-based OAuth; the rest of helmet's
// defaults (HSTS, noSniff, frameguard, referrer-policy, …) still apply.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS allowlist. Set ALLOWED_ORIGINS (comma-separated, e.g.
// "https://atelier.pages.dev,https://app.atelier.com") in the API env to lock
// this to your own frontend. Left unset it stays permissive (previous
// behavior) but logs a warning so nothing breaks before it's configured.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
if (allowedOrigins.length === 0) {
  console.warn('⚠️  ALLOWED_ORIGINS not set — CORS is open to all origins. Set it in the API env to restrict to your frontend.');
}
app.use(cors({
  origin(origin, cb) {
    // No Origin header = same-origin, curl, or server-to-server (webhooks) → allow.
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────
// Note: CORS only stops browser cross-site calls; scripts/curl ignore it.
// These limiters are the real abuse/DoS/cost protection. Webhooks are exempt
// (Stripe/Shopify send server-to-server bursts that must not be dropped).
const isWebhookOrHealth = (req) =>
  req.path === '/health' ||
  req.path === '/api/stripe/webhook' ||
  req.path.startsWith('/api/shopify/webhooks/');

// Broad limiter across the whole API — catches blunt flooding.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWebhookOrHealth,
});

// Strict limiter for the expensive AI/generation endpoints — these each cost
// real money (Gemini/Tavily), so cap them tightly per client.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests — please slow down and try again shortly.' },
});

// Tight limiter for outbound email endpoints — abuse here means spam sent
// from your domain.
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many email requests — please wait a few minutes.' },
});

// Social platform reads. The limit that matters here isn't ours — TikTok's
// Display API is rate-limited PER API CLIENT, so one founder holding down "Sync
// now" degrades the feature for every brand on the platform. Capped well below
// what a person could plausibly need.
const socialSyncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sync requests — platform metrics update slowly, so give it a few minutes.' },
});

// The metered AI/generation endpoints — rate-limited, JWT-authenticated, and
// credit-charged (see requireAuth registration + metered() below).
const AI_PATHS = [
  '/api/analyze-design',
  '/api/generate-tech-pack',   // also covers /generate-tech-pack-full (prefix)
  '/api/parse-vendor',
  '/api/draft-vendor-email',
  '/api/search-vendors',
  '/api/analyze-vendor-fit',
  '/api/dashboard-suggestions',
  '/api/design/ai-image',
  '/api/design/generate-element',
  '/api/design/color-palette',
  '/api/design/trend-inspiration',
  '/api/research-materials',
  '/api/chat-reply',
  '/api/quote-economics',
  '/api/cost-simulator',
];

app.use(apiLimiter);
app.use(AI_PATHS, aiLimiter);
app.use(['/api/send-invite', '/api/send-campaign', '/api/send-vendor-email'], emailLimiter);

// Captures the raw buffer body. Required to verify Shopify's SHA-256 HMAC signatures
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ── Auth + AI credit metering ────────────────────────────────────────────────
// requireAuth validates the caller's Supabase JWT (sent as `Authorization:
// Bearer <token>` by the frontend) and attaches req.user. metered() then checks
// the user actually belongs to the brand and atomically debits its credit
// balance before the handler runs, auto-refunding if the handler errors out.

async function requireAuth(req, res, next) {
  if (!supabase) return res.status(500).json({ ok: false, error: 'Auth is not configured on the server.' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Sign in required.' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) return res.status(401).json({ ok: false, error: 'Your session has expired — please sign in again.' });
    req.user = data.user;
    return next();
  } catch (err) {
    console.error('Auth check failed:', err.message);
    return res.status(401).json({ ok: false, error: 'Could not verify your session.' });
  }
}

// Owner of, or active member of, the brand?
async function verifyBrandAccess(userId, brandId) {
  if (!supabase || !userId || !brandId) return false;
  const { data: owned } = await supabase
    .from('brands').select('id').eq('id', brandId).eq('user_id', userId).maybeSingle();
  if (owned) return true;
  const { data: member } = await supabase
    .from('brand_members').select('brand_id')
    .eq('brand_id', brandId).eq('user_id', userId).eq('status', 'active').maybeSingle();
  return !!member;
}

async function debitCredits(brandId, cost, feature) {
  const { data, error } = await supabase.rpc('debit_ai_credits', { p_brand_id: brandId, p_cost: cost, p_feature: feature });
  if (error) throw error;
  return typeof data === 'number' ? data : -1;
}

async function refundCredits(brandId, amount, feature) {
  const { error } = await supabase.rpc('refund_ai_credits', { p_brand_id: brandId, p_amount: amount, p_feature: feature });
  if (error) console.error('Credit refund failed:', error.message);
}

// Per-route middleware: verify brand access, atomically charge the feature's
// credit cost, and schedule an auto-refund if the response ends in an error.
// `feature` is either a fixed key or a (req) => key resolver, for actions
// whose price depends on the request — e.g. silhouette quality, where low /
// medium / high each cost a different amount of API spend and so are priced
// as separate features.
// Server-side plan gating. The frontend map in la-guia/src/data/entitlements.js
// decides what the UI offers; this decides what the API will actually do, which
// is the half that matters — a locked button is a suggestion, and the JWT for a
// Basic account is enough to call a Premium endpoint by hand.
//
// Ordered cheapest-first: a Basic account calling a Premium endpoint is refused
// BEFORE metered() debits it, so a blocked call never costs credits.
const TIER_RANK = { free: 0, basic: 1, premium: 2 };

function requireTier(minTier) {
  return async (req, res, next) => {
    const brandId = (req.body && (req.body.brandId || req.body.brand_id)) || null;
    if (!brandId) return res.status(400).json({ ok: false, error: 'brandId is required.' });
    if (!supabase) return next(); // no DB configured (local dev) — don't lock everything out
    try {
      const { data, error } = await supabase.from('brands').select('plan_tier').eq('id', brandId).maybeSingle();
      if (error) throw error;
      const tier = (data && data.plan_tier) || 'free';
      if ((TIER_RANK[tier] ?? 0) < (TIER_RANK[minTier] ?? 0)) {
        return res.status(403).json({
          ok: false,
          code: 'PLAN_REQUIRED',
          requiredTier: minTier,
          error: `This feature is part of the ${minTier.charAt(0).toUpperCase() + minTier.slice(1)} plan.`,
        });
      }
      return next();
    } catch (err) {
      // Fail CLOSED. An unreadable plan is not a licence to use a paid feature,
      // and this path is cheap to retry.
      console.error('Plan check failed:', err.message);
      return res.status(503).json({ ok: false, error: 'Could not verify your plan — please try again.' });
    }
  };
}

function metered(feature) {
  return async (req, res, next) => {
    const brandId = (req.body && (req.body.brandId || req.body.brand_id)) || null;
    if (!brandId) return res.status(400).json({ ok: false, error: 'brandId is required for AI features.' });
    const access = await verifyBrandAccess(req.user && req.user.id, brandId);
    if (!access) return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });

    const resolved = typeof feature === 'function' ? feature(req) : feature;
    const cost = creditCost(resolved);
    let remaining;
    try {
      remaining = await debitCredits(brandId, cost, resolved);
    } catch (err) {
      console.error('Credit debit error:', err.message);
      return res.status(500).json({ ok: false, error: 'Credit system error — please try again.' });
    }
    if (remaining < 0) {
      return res.status(402).json({ ok: false, error: 'Out of AI credits.', code: 'INSUFFICIENT_CREDITS' });
    }
    // If the handler ends up erroring (>=400), give the credits back.
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        refundCredits(brandId, cost, resolved).catch((e) => console.error('Refund error:', e.message));
      }
    });
    req.aiCredits = { brandId, cost, remaining, feature: resolved };
    return next();
  };
}

// Every metered AI endpoint requires a valid signed-in user. Always registered
// (fail closed): if auth isn't configured, requireAuth returns a clear 500
// rather than letting requests through unauthenticated.
app.use(AI_PATHS, requireAuth);

// ── Security helpers ─────────────────────────────────────────────────────────

// Escapes untrusted values interpolated into an outbound HTML email. Invite
// fields arrive from the client, so without this a crafted brand/inviter name
// could inject markup (a fake link) into a mail sent from our verified domain.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Hostnames that must never be reachable from a server-side fetch: an
// attacker-supplied store URL would otherwise let this API read the cloud
// metadata service or probe services on the private network behind it (SSRF),
// with the response echoed back in the error message.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^metadata(\.google\.internal)?$/i,
  /^\[?::1\]?$/,                                   // IPv6 loopback
  /^\[?(fc|fd)[0-9a-f]{2}:/i,                      // IPv6 unique-local
  /^\[?fe80:/i,                                    // IPv6 link-local
  /^127\./,                                        // IPv4 loopback
  /^10\./,                                         // RFC1918
  /^192\.168\./,                                   // RFC1918
  /^172\.(1[6-9]|2[0-9]|3[01])\./,                 // RFC1918
  /^169\.254\./,                                   // link-local / cloud metadata
  /^0\./,
];

// Validates a founder-supplied storefront URL before the server fetches it.
// HTTPS is required on its own merits here — WooCommerce's key/secret auth is
// Basic auth, so plain HTTP would put the store's credentials on the wire.
// Note this checks the hostname as written: a name that resolves to a private
// address (DNS rebinding) still gets through, which would need connection-time
// IP pinning to close properly. This blocks the direct attack, not that one.
function safeStoreUrl(rawUrl) {
  const raw = String(rawUrl).trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    // Tolerate a bare "your-store.com" (no scheme). Only when the value
    // contains no ':' at all, so something like "javascript:..." still parses
    // as its own scheme below and gets rejected by the https check.
    if (raw.includes(':')) throw new Error('Store URL is not a valid URL — include https:// and the domain.');
    try {
      parsed = new URL(`https://${raw}`);
    } catch {
      throw new Error('Store URL is not a valid URL — include https:// and the domain.');
    }
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Store URL must use https:// — your Consumer Key and Secret travel with every request.');
  }
  const host = parsed.hostname;
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
    throw new Error('That store URL points at a private or local address, which this server will not contact.');
  }
  // Rebuild from parsed parts so query strings, credentials, ports and paths
  // in the supplied value can't reshape the request path we append below.
  return `https://${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
}

// Validates a URL we are about to fetch WITHOUT rewriting it — same https-only
// and no-private-host rules as safeStoreUrl, but path and query are preserved,
// which is what a redirect target needs.
function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('That store redirected somewhere this server cannot parse.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('That store redirected to a non-HTTPS address, which this server will not follow.');
  }
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(parsed.hostname))) {
    throw new Error('That store redirected to a private or local address, which this server will not follow.');
  }
  return parsed.toString();
}

// Follows redirects by hand, re-checking every hop.
//
// safeStoreUrl only ever vetted the FIRST url. Node's fetch defaults to
// redirect:'follow', so a host that passed the check — any public https site the
// caller controls — could answer with a 302 to 169.254.169.254 or 127.0.0.1 and
// the request would go there anyway. The WooCommerce handlers return the
// upstream body verbatim, so that turned a checked hostname into a full read of
// whatever the redirect pointed at, not merely a blind probe.
//
// Validating the entry point is not enough once something else chooses the next
// one. Cap the chain too: a redirect loop would otherwise hang the request.
const MAX_REDIRECT_HOPS = 3;
async function safeFetchFollow(initialUrl, options = {}) {
  let url = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const response = await fetch(url, { ...options, redirect: 'manual' });
    if (response.status < 300 || response.status > 399) return response;
    const location = response.headers.get('location');
    if (!location) return response; // 3xx with no target — nothing to follow.
    // Relative Locations ("/wp-json/...") resolve against the current url.
    url = assertSafeUrl(new URL(location, url).toString());
  }
  throw new Error('That store URL redirected too many times.');
}

// Shopify's admin API only ever lives on <store>.myshopify.com. Pinning to it
// keeps `shop` from being used to point a server-side fetch (or the OAuth
// redirect) anywhere else.
const SHOPIFY_SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
function safeShopifyShop(shop) {
  const clean = String(shop || '').trim().toLowerCase();
  if (!SHOPIFY_SHOP_RE.test(clean)) {
    throw new Error('Shop must be your permanent domain, e.g. your-store.myshopify.com');
  }
  return clean;
}

const MODEL_NAME = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

function cleanAIJSON(text) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

// Renders the brand's stated philosophy for AI prompts. aiPost() on the
// frontend injects `brandProfile` into every AI request automatically, and
// every advice-shaped endpoint appends this block — so an "Aggressive" risk
// tolerance gets bolder recommendations (with risks stated plainly) and a
// conservative budget philosophy gets safer, cheaper options, consistently
// across the whole app rather than only in vendor-fit analysis.
function brandProfileBlock(p) {
  if (!p) return '';
  const known = [
    p.qualityTier && `Quality tier: ${p.qualityTier}`,
    p.budgetPhilosophy && `Budget philosophy: ${p.budgetPhilosophy}`,
    p.sustainability && `Sustainability stance: ${p.sustainability}`,
    p.globalRisk && `Risk tolerance: ${p.globalRisk}`,
  ].filter(Boolean);
  if (!known.length) return '';
  return `

BRAND PROFILE — calibrate every recommendation, tone, and suggestion to this. Match aggressiveness to the stated risk tolerance (bolder options with risks stated plainly for aggressive brands, safer options for conservative ones), and align quality/price/material suggestions with the quality tier, budget philosophy, and sustainability stance:
${known.join('\n')}`;
}

function verifyShopifySignature(rawBody, hmacHeader) {
  if (!rawBody || !hmacHeader) return false;
  // No secret configured = nothing can be verified. Fail closed rather than
  // letting createHmac throw an unhandled 500 out of a webhook handler.
  if (!process.env.SHOPIFY_CLIENT_SECRET) {
    console.warn('⚠️  SHOPIFY_CLIENT_SECRET not set — rejecting Shopify webhook (cannot verify signature).');
    return false;
  }
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(rawBody)
    .digest('base64');
  // Constant-time compare, matching verifyOAuthState — a plain === leaks how
  // much of the digest matched through timing.
  const a = Buffer.from(hash, 'base64');
  const b = Buffer.from(String(hmacHeader), 'base64');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function callGemini(prompt, imageBase64 = null) {
  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: "image/png", data: imageBase64 } });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: { response_mime_type: "application/json" },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("❌ Gemini API Error:", JSON.stringify(data, null, 2));
    throw new Error(data.error?.message || `Gemini Error: ${response.status}`);
  }

  if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("AI Safety Block. Try removing any text from the drawing.");
    }
    throw new Error("Empty response from AI.");
  }

  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(cleanAIJSON(rawText));
}

// ── OpenAI image generation (gpt-image-1) ───────────────────────────────────
// Replaced Stable Diffusion via Pixazo, which followed prompts too loosely
// (duplicate garments, ignored composition instructions). gpt-image-1 adheres
// to instructions far better and, critically, renders REAL transparency —
// so generated logos/silhouettes arrive as usable layers without the
// white-background flood-fill hack SD required.
//
// One helper covers both directions:
//   · no `images`  → POST /v1/images/generations (text-to-image)
//   · with `images`→ POST /v1/images/edits       (image-to-image)
// There is no negativePrompt in this API; callers fold exclusions into the
// prompt as plain language, which this model actually respects.
const OPENAI_IMAGE_MODEL = 'gpt-image-1';

async function callOpenAIImage(prompt, { size = '1024x1024', background = 'auto', images = [], quality = 'medium' } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set — add it in the API environment (platform.openai.com/api-keys).');
  }
  const auth = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
  let response;

  if (images.length) {
    // Image-to-image: multipart. Content-Type is intentionally omitted so
    // fetch sets the multipart boundary itself.
    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', quality);
    if (background !== 'auto') form.append('background', background);
    images.forEach((b64, i) => {
      form.append('image[]', new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' }), `input-${i}.png`);
    });
    response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth, body: form });
  } else {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size,
        quality,
        n: 1,
        ...(background !== 'auto' ? { background } : {}),
      }),
    });
  }

  const data = await response.json();
  if (!response.ok) {
    console.error('❌ OpenAI Image API Error:', JSON.stringify(data, null, 2));
    throw new Error(data.error?.message || `OpenAI image error: ${response.status}`);
  }
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image.');
  return { base64: b64, mimeType: 'image/png' };
}

// ---------------------------------------------------------
// 1. DESIGN & TECH PACK ENDPOINTS
// ---------------------------------------------------------

app.post('/api/analyze-design', metered('analyze-design'), async (req, res) => {
  console.log("📥 Received analysis request...");
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ ok: false, error: 'No image provided' });

    const prompt = `You are an expert fashion technical designer. Analyze this garment design.
Provide a JSON response with exactly this structure:
{
  "score": <number 0-100>,
  "notes": [
    {
      "severity": "green" | "amber" | "blue" | "red",
      "text": "feedback string"
    }
  ]
}`;

    const analysis = await callGemini(prompt + brandProfileBlock(req.body.brandProfile), imageBase64);
    console.log("✅ Analysis successful");
    res.json({ ok: true, analysis });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/generate-tech-pack', metered('generate-tech-pack'), async (req, res) => {
  console.log("📥 Received tech pack request...");
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ ok: false, error: 'No image provided' });

    const prompt = `You are an expert technical fashion designer. Create a Bill of Materials (BOM) and Measurements chart for Size Medium.
Return a JSON object with this exact structure:
{
  "bom": [
    { "id": "bom-1", "material": "string", "supplier": "string", "qtyPerUnit": "string", "unitCost": "string" }
  ],
  "measurements": [
    { "id": "meas-1", "size": "S", "chest": "string", "length": "string", "sleeve": "string" },
    { "id": "meas-2", "size": "M", "chest": "string", "length": "string", "sleeve": "string" },
    { "id": "meas-3", "size": "L", "chest": "string", "length": "string", "sleeve": "string" }
  ]
}`;

    const techPackData = await callGemini(prompt + brandProfileBlock(req.body.brandProfile), imageBase64);
    console.log("✅ Tech Pack successful");
    res.json({ ok: true, techPackData });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Full tech pack generation — takes whatever the founder filled in on the
// intake questionnaire (any field can be blank) plus an optional canvas
// image, and asks Gemini to produce a complete, industry-standard tech pack:
// fills gaps sensibly from the garment category/image, but never overwrites
// anything the founder actually typed. The frontend always shows an
// accuracy warning on AI-filled fields regardless of how confident this
// prompt sounds — there's no way to verify factory-specific details (exact
// supplier names, real cost data) without a human who actually knows them.
app.post('/api/generate-tech-pack-full', metered('generate-tech-pack-full'), async (req, res) => {
  console.log("📥 Received full tech pack generation request...");
  try {
    const { imageBase64, category, answers } = req.body;
    const a = answers || {};

    const prompt = `You are an expert fashion technical designer producing a complete tech pack for a garment: "${category || 'garment'}".

The founder answered an intake questionnaire — anything they left blank, fill in with a sensible industry-standard default for this garment type; anything they filled in, use exactly as given (don't contradict it). Their answers:
${JSON.stringify(a, null, 2)}
${a.other ? `\nThe founder specifically asked for this to be included/handled: "${a.other}" — make sure it's reflected somewhere in the output (as a BOM line, a construction note, a print placement, etc., whichever section fits).` : ''}

Return a JSON object with exactly this structure (every array can be empty if genuinely not applicable, but prefer a reasonable default over leaving something empty):
{
  "bom": [ { "id": "bom-1", "material": "string", "supplier": "string", "qtyPerUnit": "string", "unitCost": "string" } ],
  "measurements": [ { "id": "meas-1", "size": "S", "chest": "string", "length": "string", "sleeve": "string" } ],
  "construction": [ { "id": "con-1", "section": "e.g. Side seam", "stitchType": "e.g. 5-thread overlock", "notes": "string" } ],
  "printPlacements": [ { "id": "pp-1", "name": "e.g. Chest logo", "placement": "e.g. 3in below collar, centered", "size": "e.g. 4in x 4in", "technique": "e.g. screen print", "notes": "string" } ],
  "trims": [ { "id": "trim-1", "name": "e.g. YKK zipper", "supplier": "string", "quantity": "string", "unitCost": "string", "notes": "string" } ],
  "labels": [ { "id": "label-1", "type": "e.g. Main label, Care label, Size label", "placement": "string", "content": "string" } ],
  "packaging": [ { "id": "pack-1", "item": "e.g. Poly bag", "spec": "string", "notes": "string" } ],
  "materialUsage": [ { "id": "mu-1", "material": "string", "consumptionPerUnit": "string", "unit": "e.g. yards", "wastagePercent": "string" } ],
  "manufacturingNotes": "string — general instructions to the factory",
  "complianceNotes": "string — certifications, safety, labeling regulations relevant to this garment/market"
}`;

    const techPackData = await callGemini(prompt + brandProfileBlock(req.body.brandProfile), imageBase64 || null);
    console.log("✅ Full tech pack generation successful");
    res.json({ ok: true, techPackData });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});


// ---------------------------------------------------------
// 2. VENDOR SOURCING & OUTREACH ENDPOINTS
// ---------------------------------------------------------

app.post('/api/parse-vendor', metered('parse-vendor'), async (req, res) => {
  console.log("📥 Received vendor parse request...");
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ ok: false, error: 'No text provided' });

    const prompt = `You are helping a fashion brand founder import a vendor into their sourcing tool.
They pasted the following link, forwarded email, or notes about a manufacturer/vendor:
"""
${text}
"""
Extract whatever you can reasonably infer. Do not invent specifics you can't support from the text (leave a field as an empty string, null, or an empty array instead of guessing).
Return a JSON object with exactly this structure:
{
  "name": "string",
  "category": "string (e.g. Denim, Knitwear, Outerwear, Headwear, Bags)",
  "location": "string (city, country if known)",
  "specialties": ["short phrase", "short phrase"],
  "moq": <number or null>,
  "leadTime": "string or null (e.g. '45 days')",
  "certifications": ["string, e.g. GOTS, OEKO-TEX, WRAP, Fair Trade — only ones actually mentioned"],
  "capabilities": ["short phrase, e.g. in-house printing, small-batch sampling, cut-and-sew, dyeing"],
  "priceRange": "string or null (e.g. '$8-$12/unit FOB') — only if a price is actually mentioned, never estimated"
}`;

    const parsed = await callGemini(prompt);
    console.log("✅ Vendor parse successful");
    res.json({ ok: true, vendor: parsed });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/draft-vendor-email', metered('draft-vendor-email'), async (req, res) => {
  console.log("📥 Received email draft request...");
  try {
    const { vendorName, productName, garmentType, preferences, ask } = req.body;
    if (!vendorName) return res.status(400).json({ ok: false, error: 'No vendor provided' });

    const prompt = `You are an independent fashion brand founder writing an outreach email to a clothing manufacturer.

Write a professional, concise, and polite Request for Quote (RFQ) email to a manufacturer.
Factories are busy and ignore long emails. Get straight to the point.

Details to include:
- Vendor Name: ${vendorName}
- Product: ${productName || 'a new design'} (${garmentType || 'unspecified type'})
- Target Quantity (MOQ): ${preferences?.quantity || 'Not specified yet'}
- Target Unit Cost: ${preferences?.targetUnitCost ? '$' + preferences.targetUnitCost : 'Not specified yet'}
- Target Deadline: ${preferences?.deadline || 'Standard lead time'}
- Additional Founder Note/Ask: ${ask || 'General outreach to introduce the project and ask about working together.'}

Write a concise, professional email (under 200 words), with a placeholder for the sender's name at the bottom. Return a JSON object with exactly this structure:
{
  "subject": "string",
  "body": "string (plain text, use \\n for line breaks, no markdown)"
}`;

    const draft = await callGemini(prompt + brandProfileBlock(req.body.brandProfile));
    console.log("✅ Email draft successful");
    res.json({ ok: true, draft });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/search-vendors', requireTier('basic'), metered('search-vendors'), async (req, res) => {
  console.log("📥 Received vendor search request...");
  try {
    const { keywords, category, location, quantity, moq, targetPrice, certifications, imageBase64 } = req.body;
    const criteria = { keywords, category, location, quantity, moq, targetPrice, certifications };
    if (!Object.values(criteria).some(v => v != null && String(v).trim())) {
      return res.status(400).json({ ok: false, error: 'Give at least one search field — keywords, category, or location.' });
    }
    if (!process.env.TAVILY_API_KEY || process.env.TAVILY_API_KEY.startsWith('get_a_free_key')) {
      return res.status(400).json({ ok: false, error: 'TAVILY_API_KEY is not set in api/.env — get a free key at tavily.com' });
    }

    // Build a sharper query from structured fields instead of trusting one
    // free-text box to carry material + MOQ + price + location on its own —
    // each constraint gets folded in explicitly so Tavily sees it clearly.
    const coreParts = [keywords, category].filter(v => v && String(v).trim());
    const tightParts = [...coreParts, 'manufacturer'];
    if (location) tightParts.push(`in ${location}`);
    if (moq) tightParts.push(`MOQ under ${moq} units`);
    if (targetPrice) tightParts.push(`target price $${targetPrice}/unit`);
    if (certifications) tightParts.push(`${certifications} certified`);
    const tightQuery = tightParts.join(' ');

    const MFG_BIAS = 'private label OR white label OR OEM ODM OR contract manufacturer OR wholesale factory -shop -"our collection"';

    // FOUR searches, deduped, not one. Tavily caps max_results at 20 per query,
    // so a single search set a hard ceiling of 20 candidates — and after the
    // brand-vs-manufacturer filter and the dead-link check, ~4-5 survived.
    // Volume has to come from more queries, not a bigger max_results.
    //
    // Each angle finds vendors the others miss: the directory query surfaces
    // aggregator listings (which carry many factories per page), and the
    // contact query is aimed squarely at pages that publish an email, since
    // that is the single most valuable field to come back with.
    const queries = [
      { q: `${tightQuery} ${MFG_BIAS}`, raw: true },
      { q: `${coreParts.join(' ') || category || keywords} clothing manufacturer directory list${location ? ` ${location}` : ''}`, raw: false },
      { q: `${coreParts.join(' ') || category || keywords} apparel factory${location ? ` ${location}` : ''} contact email address "@"`, raw: true },
      { q: `${coreParts.join(' ') || category || keywords} cut and sew manufacturer small batch${location ? ` ${location}` : ''} minimum order`, raw: false },
    ];

    // include_raw_content pulls the cleaned page body rather than a snippet.
    // Contact details live below the fold, so a snippet almost never contains
    // an email — this is what makes email extraction possible at all. Only the
    // two queries most likely to carry contact details pay the token cost.
    const searches = await Promise.all(queries.map(async ({ q, raw }) => {
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: q,
            search_depth: 'advanced',
            max_results: 20,
            include_raw_content: raw,
          }),
        }).then(x => x.json());
        return r.error ? [] : (r.results || []);
      } catch {
        return []; // one failed angle shouldn't lose the other three
      }
    }));

    const seen = new Set();
    const results = searches.flat().filter(r => {
      if (!r || !r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (results.length === 0) {
      return res.json({ ok: true, recommended: [], broader: [] });
    }

    // Harvest candidate addresses with a regex rather than asking the model to
    // spot them in truncated text. An address is a fact that either appears on
    // the page or doesn't — pulling it out mechanically means the model picks
    // between real candidates instead of pattern-matching a plausible one, and
    // an invented vendor email is worse than none (mail to a stranger, or a
    // bounce the founder reads as our bug).
    const EMAIL_RX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    // Addresses that are never a vendor's sales contact: asset filenames that
    // happen to contain @ (retina images), and the platform/tooling addresses
    // that litter page source.
    const EMAIL_NOISE = /(\.(png|jpe?g|gif|svg|webp|css|js)$|@(2x|3x)\.|example\.|sentry\.|wixpress\.|godaddy\.|squarespace\.|shopify\.|cloudflare\.|schema\.org|\.png@|sentry-next)/i;
    function emailsFrom(text) {
      if (!text) return [];
      return [...new Set((String(text).match(EMAIL_RX) || [])
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length < 80 && !EMAIL_NOISE.test(e)))]
        .slice(0, 6);
    }

    // Raw page bodies are large; cap what reaches the prompt. The harvested
    // emails are passed separately, so truncation can't cost us the address.
    const MAX_RESULTS_TO_MODEL = 45;
    const forModel = results.slice(0, MAX_RESULTS_TO_MODEL).map((r, i) => {
      const body = (r.raw_content || r.content || '').slice(0, 1200);
      const found = emailsFrom(r.raw_content || r.content);
      return `[${i}] ${r.title}\nURL: ${r.url}\n${found.length ? `EMAILS FOUND ON THIS PAGE: ${found.join(', ')}\n` : ''}${body}`;
    }).join('\n\n');

    const criteriaLines = [
      keywords && `Material/style keywords: ${keywords}`,
      category && `Category: ${category}`,
      location && `Preferred location: ${location}`,
      quantity && `Quantity needed: ${quantity} units`,
      moq && `Max acceptable MOQ: ${moq} units`,
      targetPrice && `Target unit price: $${targetPrice}`,
      certifications && `Certifications wanted: ${certifications}`,
    ].filter(Boolean).join('\n');

    const prompt = `A fashion brand founder searched for a MANUFACTURER with this request:
${criteriaLines}
${imageBase64 ? '\nAn image of the founder\'s own product design is attached — use it only to judge what garment category, fabric weight, and construction complexity this vendor would need to handle (does their stated specialty plausibly cover it?). The image shows the FOUNDER\'S product, not anything belonging to the vendor — never attribute the image itself to a vendor.' : ''}

Here are real web search results, gathered from four different searches (a tight match, a directory search, a contact-details search, and a small-batch search) and merged:
${forModel}

CRITICAL FILTER — apply this before anything else:
The founder needs a company that will MANUFACTURE GARMENTS FOR THEM based on a design/tech pack they send in — private label, white label, OEM/ODM, contract manufacturing, cut-make-trim, "start your own clothing line" production partners.
EXCLUDE any company that is itself a clothing BRAND selling finished products under its own name directly to end consumers — even if it mentions organic cotton, sustainable materials, or "manufactured ethically." A brand talking about how ITS OWN products are made is not a match.
Signals a result IS a manufacturer-for-hire (include): "private label," "white label," "wholesale," "MOQ for your brand," "start your clothing line," "we manufacture for brands," "contract manufacturing," "OEM/ODM," "sample and bulk production," "sourcing agent," "factory partner," pricing/MOQ framed around a business customer.
Signals a result is a retail BRAND instead (exclude): online shop / storefront language, "shop now," "add to cart," "our collection," a founder's personal story about their own product line, sizing charts for individual customers, no mention of producing for other businesses.
If a result is clearly a retail brand, drop it. If you are UNSURE whether it is a manufacturer-for-hire, keep it and put it in "broader" — an uncertain lead the founder can check in ten seconds is useful; silently discarding it is not. Only drop what you are confident is wrong.

AIM FOR ABOUT 20 MANUFACTURERS IN TOTAL across the two groups. The searches above deliberately cover several angles, so there is usually enough material — if you are returning fewer than 10, re-read the results for ones you skipped over rather than stopping early. Never pad the list with retail brands or invented companies to reach a number.
A directory or listicle page that names several manufacturers should yield ONE ENTRY PER MANUFACTURER NAMED, not one entry for the directory itself — the founder wants the factories, not the article about them.

After applying that filter, split what's left into two groups:
- "recommended": manufacturers that match essentially everything specific the founder gave above (location, MOQ, target price, certifications, category — whichever fields were actually filled in).
- "broader": manufacturers that match the general category but miss one or more of the specific fields the founder filled in — still include these, don't drop them, since "recommended" can be wrong and the founder should see other real options.
If the founder only gave vague/generic fields, most results likely belong in "broader" since there's nothing specific to fully match yet.
It's completely fine for a group to be empty if nothing qualifies — an empty list beats a wrong one.

For each manufacturer, figure out the source carefully:
- If the result IS the manufacturer's own website/page (domain matches the company, or it's their official site/contact page), set "sourceType": "vendor" and "sourceUrl" to that link.
- If the result is actually a THIRD PARTY talking about the manufacturer (an Instagram account that reviews manufacturers, a blog post, a directory listing, a marketplace aggregator page) rather than their own presence, set "sourceType": "review". If the snippet text itself mentions the manufacturer's own website, email, or handle, put THAT as "sourceUrl" and put the original review/mention link as "reviewUrl". If no direct link can be found anywhere, "sourceUrl" should be the review link itself (still set "sourceType": "review").

Fill in as many fields as the text genuinely supports. Leave null/empty/empty-array rather than guessing — but do READ for these, because a vendor that arrives already filled in saves the founder an afternoon:
- email: THE HIGHEST-VALUE FIELD. Take it from the "EMAILS FOUND ON THIS PAGE" line for that result when present, choosing the best business contact (prefer sales@, info@, contact@, hello@, export@ over a personal name; never pick a careers@, jobs@, press@, privacy@, unsubscribe@, or webmaster@ address). If a result has no such line and no address in its text, return null. NEVER construct, complete, or guess an address — not from the domain, not from a pattern, not "info@" + their website. A wrong address emails a stranger; an empty one just asks the founder to look it up.
- website: the manufacturer's own domain (homepage), if it can be identified
- phone: a business phone number if one appears in the text
- specialties: short phrases describing what they specialize in (materials, garment types, techniques)
- moq: minimum order quantity as a number
- leadTime: e.g. "45 days"
- certifications: e.g. GOTS, OEKO-TEX, WRAP, Fair Trade, ISO — only ones actually named in the text
- capabilities: short phrases on factory capabilities, e.g. "in-house printing", "small-batch sampling", "cut-and-sew", "dyeing", "embroidery"
- priceRange: a string like "$8-$12/unit" ONLY if the text actually states a price — never estimate one

Do not invent details not supported by the text. Return a JSON object with exactly this structure:
{
  "recommended": [
    { "name": "string", "category": "string", "location": "string or empty", "description": "one sentence on why this matches", "email": "string or null", "website": "string or null", "phone": "string or null", "sourceUrl": "string", "sourceType": "vendor" | "review", "reviewUrl": "string or null", "specialties": ["string"], "moq": <number or null>, "leadTime": "string or null", "certifications": ["string"], "capabilities": ["string"], "priceRange": "string or null" }
  ],
  "broader": [ same shape as above ]
}`;

    const parsed = await callGemini(prompt + brandProfileBlock(req.body.brandProfile), imageBase64 || null);

    // Every address the searches actually contained. The prompt forbids
    // inventing one, but "the prompt says not to" is not a guarantee — and this
    // field ends up in a To: line, so it gets checked rather than trusted. An
    // address the model returned that appears nowhere in the source text is
    // dropped: the vendor still arrives, just without a fabricated contact.
    const harvestedEmails = new Set(
      results.flatMap(r => emailsFrom(r.raw_content || r.content))
    );
    let discardedEmails = 0;
    function verifyEmail(v) {
      if (!v || !v.email) return v;
      const claimed = String(v.email).trim().toLowerCase();
      if (harvestedEmails.has(claimed)) return { ...v, email: claimed };
      discardedEmails++;
      return { ...v, email: null };
    }

    const PARKING_SIGNALS = ['buy this domain', 'domain is for sale', 'this domain may be for sale', 'domain for sale', 'sedo.com', 'hugedomains', 'afternic', 'dan.com', 'godaddy.com/domainsearch', 'the lease to own', 'inquire about this domain'];
    // These urls come from Tavily results as filtered by Gemini — web text, so
    // untrusted, even though no user types them directly. Two guards: refuse
    // private/loopback/metadata hosts outright, and do not follow redirects,
    // since a public host answering 302 -> 169.254.169.254 would otherwise walk
    // this straight into the internal network. http is still allowed here (real
    // vendor sites are often plain http) — only the destination is constrained.
    // Any throw falls through to `return true`, i.e. "assume alive, keep the
    // result", which is the existing lenient behaviour on failure.
    async function isLikelyAlive(url) {
      if (!url) return true;
      try {
        const host = new URL(url).hostname;
        if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) return true;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const r = await fetch(url, { signal: controller.signal, redirect: 'manual' });
        clearTimeout(timeout);
        if (!r.ok) return true;
        const text = (await r.text()).toLowerCase().slice(0, 5000);
        return !PARKING_SIGNALS.some(s => text.includes(s));
      } catch {
        return true;
      }
    }
    async function filterAlive(list) {
      const checks = await Promise.all((list || []).map(async v => ({ v, alive: await isLikelyAlive(v.sourceUrl) })));
      return checks.filter(c => c.alive).map(c => verifyEmail(c.v));
    }

    const [recommended, broader] = await Promise.all([
      filterAlive(parsed.recommended),
      filterAlive(parsed.broader),
    ]);

    const total = recommended.length + broader.length;
    const withEmail = [...recommended, ...broader].filter(v => v.email).length;
    console.log(`✅ Vendor search successful — ${results.length} pages searched, ${total} vendors returned, ${withEmail} with a verified email${discardedEmails ? `, ${discardedEmails} unverifiable email(s) dropped` : ''}`);
    res.json({ ok: true, recommended, broader });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/analyze-vendor-fit', requireTier('basic'), metered('analyze-vendor-fit'), async (req, res) => {
  console.log("📥 Received vendor fit request...");
  try {
    const { vendor, product, brand, quoteHistory, bom } = req.body;
    if (!vendor || !product) return res.status(400).json({ ok: false, error: 'Vendor and product are required' });
    if (!product.budget) {
      return res.status(400).json({ ok: false, error: 'No budget set for this product — enter one before analyzing, there is nothing to compare vendor cost against otherwise.' });
    }

    const prompt = `You are a sourcing advisor helping a fashion brand founder judge whether a vendor is a good fit for a specific product. Be honest and specific — flag real risks rather than being generically positive.

Vendor:
Name: ${vendor.name}
Category: ${vendor.category || 'unknown'}
Location: ${vendor.location || 'unknown'}
MOQ: ${vendor.moq ?? 'unknown'}
Lead time: ${vendor.lead_time || 'unknown'}
Specialties: ${(vendor.specialties || []).join(', ') || 'none listed'}
Rating: ${vendor.rating ?? 'no rating'}
Founder's own notes about this vendor: ${vendor.notes || 'none'}
Trust label: ${vendor.label}

Product to be made:
Name: ${product.name}
Category: ${product.category}
Budget: $${product.budget}
Risk tolerance for this product: ${product.risk}
Factory readiness score: ${product.readiness}%

Bill of materials for this product (this matters a lot — a vendor's fit strongly depends on whether they plausibly work with these specific materials/components):
${bom && bom.length ? bom.map(b => `- ${b.material}${b.qtyPerUnit ? `, ${b.qtyPerUnit}/unit` : ''}${b.unitCost ? `, ~$${b.unitCost}/unit material cost` : ''}`).join('\n') : 'No BOM on file yet for this product.'}

Brand context:
Quality tier: ${req.body.brandProfile?.qualityTier || brand?.quality_tier || 'unknown'}
Budget philosophy: ${req.body.brandProfile?.budgetPhilosophy || brand?.budget_philosophy || 'unknown'}
Sustainability preference: ${req.body.brandProfile?.sustainability || brand?.sustainability || 'unknown'}
Global risk tolerance: ${req.body.brandProfile?.globalRisk || brand?.global_risk || 'unknown'}

Quote history with this vendor for this product: ${quoteHistory && quoteHistory.length ? JSON.stringify(quoteHistory) : 'none yet'}

Assess, in this order of importance:
1. Material/BOM compatibility — do this vendor's specialties/category plausibly cover the specific materials listed in the BOM? Call out any material that looks like a stretch for their stated specialties (e.g. a denim specialist being asked to produce a technical shell fabric).
2. Whether the MOQ makes sense against the stated budget — rough unit economics: divide budget by MOQ for a rough per-unit ceiling, and compare that against the BOM's per-unit material costs if given (materials alone eating most of that ceiling is a red flag — there's nothing left for labor, overhead, or margin).
3. Location/lead-time risk relative to the stated risk tolerance.
4. Anything concerning in the notes or quote history (a quoted price far above budget, no specialties overlap, no track record at all).
If quote history with this vendor exists, weight it heavily — real quotes are much stronger evidence than category matching alone.
If there's very little data available (no quotes, no notes, no rating, no BOM), say so explicitly and reflect that as lower confidence rather than inventing certainty.

Return a JSON object with exactly this structure:
{
  "score": <number 0-100, overall fit/profitability confidence>,
  "notes": [
    { "severity": "green" | "amber" | "blue" | "red", "text": "specific, actionable feedback string" }
  ]
}`;

    const analysis = await callGemini(prompt);
    console.log("✅ Vendor fit analysis successful");
    res.json({ ok: true, analysis });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 3. BILLING (Stripe)
// ---------------------------------------------------------
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const PRICE_IDS = { basic: process.env.STRIPE_PRICE_BASIC, premium: process.env.STRIPE_PRICE_PREMIUM };
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

function requireStripe(res) {
  if (!stripe) {
    res.status(400).json({ ok: false, error: 'Billing is not configured yet — add STRIPE_SECRET_KEY to api/.env and run scripts/setup-stripe-products.js.' });
    return false;
  }
  return true;
}

app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const { plan, brandId, brandEmail } = req.body;
    const priceId = PRICE_IDS[plan];
    if (!priceId) return res.status(400).json({ ok: false, error: `Unknown or unconfigured plan: ${plan}` });
    if (!brandId) return res.status(400).json({ ok: false, error: 'No brand provided' });
    if (!(await verifyBrandAccess(req.user && req.user.id, brandId))) {
      return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: brandEmail || undefined,
      client_reference_id: brandId,
      metadata: { brandId, plan },
      success_url: `${APP_URL}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/settings?billing=cancelled`,
    });
    res.json({ ok: true, url: session.url });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/confirm-checkout', requireAuth, async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'No session id provided' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(400).json({ ok: false, error: 'Checkout has not completed yet.' });
    }
    const confirmBrandId = session.client_reference_id || (session.metadata && session.metadata.brandId);
    if (!(await verifyBrandAccess(req.user && req.user.id, confirmBrandId))) {
      return res.status(403).json({ ok: false, error: 'You do not have access to this checkout.' });
    }

    // Write the plan here rather than handing it back for the browser to save.
    // plan_tier decides what the user is entitled to, and stripe_customer_id is
    // what the invoice.paid webhook matches on when granting a cycle's AI
    // credits — so a client able to set them could hand itself Premium, or point
    // its own brand at someone else's paying customer and collect their credits.
    // This is the only code path that has just verified the session with Stripe,
    // so it is the right place to persist the result.
    const confirmedPlan = session.metadata?.plan;
    if (!PRICE_IDS[confirmedPlan]) {
      // Unrecognised plan in metadata — refuse rather than writing a tier that
      // doesn't map to a real price.
      return res.status(400).json({ ok: false, error: 'This checkout is not for a recognised plan.' });
    }
    const { error: persistError } = await supabase
      .from('brands')
      .update({
        plan_tier: confirmedPlan,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
      })
      .eq('id', confirmBrandId);
    if (persistError) {
      // The payment already succeeded, so failing silently here would leave a
      // paying customer on the free tier with no signal. Say so plainly.
      console.error('Failed to persist plan after checkout:', persistError.message);
      return res.status(500).json({ ok: false, error: 'Your payment went through, but we could not activate the plan. Contact support and we will sort it out.' });
    }

    res.json({
      ok: true,
      plan: confirmedPlan,
      brandId: session.client_reference_id,
      customerId: session.customer,
      subscriptionId: session.subscription,
    });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// One-time credit-pack purchase (Phase 2 top-ups). The price is looked up
// server-side by pack id — never taken from the client — and the credit amount
// is stamped into metadata so the checkout.session.completed webhook can grant
// it on successful payment.
app.post('/api/create-topup-session', requireAuth, async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const { packId, brandId, brandEmail } = req.body;
    if (!brandId) return res.status(400).json({ ok: false, error: 'No brand provided' });
    const access = await verifyBrandAccess(req.user && req.user.id, brandId);
    if (!access) return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });
    const pack = getPack(packId);
    if (!pack) return res.status(400).json({ ok: false, error: `Unknown credit pack: ${packId}` });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pack.cents,
          product_data: { name: `Atelier AI credits — ${pack.label}` },
        },
      }],
      customer_email: brandEmail || undefined,
      client_reference_id: brandId,
      metadata: { brandId, credits: String(pack.credits), packId: pack.id, kind: 'ai_topup' },
      success_url: `${APP_URL}/settings?topup=success`,
      cancel_url: `${APP_URL}/settings?topup=cancelled`,
    });
    res.json({ ok: true, url: session.url });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/create-portal-session', requireAuth, async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ ok: false, error: 'No Stripe customer on file for this brand yet.' });
    let portalBrand = null;
    if (supabase) {
      const { data } = await supabase.from('brands').select('id').eq('stripe_customer_id', customerId).maybeSingle();
      portalBrand = data;
    }
    if (!portalBrand || !(await verifyBrandAccess(req.user && req.user.id, portalBrand.id))) {
      return res.status(403).json({ ok: false, error: 'You do not have access to this billing account.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/settings`,
    });
    res.json({ ok: true, url: session.url });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/subscription-status', requireAuth, async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ ok: false, error: 'No subscription id provided' });
    let subBrand = null;
    if (supabase) {
      const { data } = await supabase.from('brands').select('id').eq('stripe_subscription_id', subscriptionId).maybeSingle();
      subBrand = data;
    }
    if (!subBrand || !(await verifyBrandAccess(req.user && req.user.id, subBrand.id))) {
      return res.status(403).json({ ok: false, error: 'You do not have access to this subscription.' });
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    let plan = null;
    if (isActive) {
      const priceId = sub.items.data[0]?.price?.id;
      plan = Object.entries(PRICE_IDS).find(([, id]) => id === priceId)?.[0] || null;
    }

    // Reconcile the stored tier here too. This is BillingTab's catch-all for a
    // cancellation made in the Stripe portal (no webhook covers that), and it
    // used to work by having the browser write plan_tier back — the same hole
    // as confirm-checkout. Only update when Stripe gave a definite answer: an
    // active subscription on a price we don't recognise leaves the tier alone
    // rather than silently downgrading a paying customer.
    const reconciledPlan = !isActive ? 'free' : plan;
    if (reconciledPlan) {
      const { error: reconcileError } = await supabase
        .from('brands')
        .update({ plan_tier: reconciledPlan })
        .eq('id', subBrand.id);
      if (reconcileError) console.error('Plan reconcile failed:', reconcileError.message);
    }

    res.json({ ok: true, active: isActive, plan, status: sub.status });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// OAUTH HANDOFF HELPER — shared by every platform integration below
// (Shopify, WooCommerce validation, Etsy, Instagram, TikTok, YouTube,
// Pinterest). Two problems with a plain redirect-based OAuth flow:
//   1. `state` was just the raw brandId — anyone could construct a
//      callback URL themselves and satisfy the frontend's post-hoc check.
//      Signing it closes that CSRF gap without needing server-side session
//      storage.
//   2. The access token used to travel in the browser's URL bar (visible
//      in history, referrer headers, server logs) on its way back to the
//      frontend, which is the only thing with an RLS-scoped Supabase
//      client able to persist it (this backend has no DB access itself —
//      see the architecture note above). A short-lived, single-use code
//      swap keeps that handoff out of the URL/history entirely.
// ---------------------------------------------------------
const oauthHandoffStore = new Map(); // code -> { payload, expiresAt }
const OAUTH_HANDOFF_TTL_MS = 2 * 60 * 1000;

// The signing key for OAuth `state`. Unset, this used to fall back to a
// constant published in this repo — which meant the signature protecting every
// connect flow could be forged by anyone who had read the source. The fallback
// is now random per boot instead: local dev still works with no configuration,
// but nobody outside this process can mint a valid state. The cost is that
// in-flight connect flows don't survive a restart (a 2-minute window, same as
// the handoff TTL), so a real deployment should still set the env var.
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.OAUTH_STATE_SECRET) {
  console.warn('⚠️  OAUTH_STATE_SECRET not set — using a random per-boot secret. Connect flows started before a restart will fail; set it in the API env to make them durable.');
}

function signOAuthState(brandId) {
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${brandId}.${nonce}`;
  const sig = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyOAuthState(state) {
  if (!state) return null;
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [brandId, nonce, sig] = parts;
  const expected = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(`${brandId}.${nonce}`).digest('hex');
  const sigBuf = Buffer.from(sig || '', 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  return brandId;
}

function createOAuthHandoff(payload) {
  const code = crypto.randomBytes(20).toString('hex');
  oauthHandoffStore.set(code, { payload, expiresAt: Date.now() + OAUTH_HANDOFF_TTL_MS });
  return code;
}

app.get('/api/oauth/consume', (req, res) => {
  const { code } = req.query;
  const entry = code && oauthHandoffStore.get(code);
  oauthHandoffStore.delete(code); // single-use regardless of outcome
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(410).json({ ok: false, error: 'This connection link has expired or was already used — try connecting again.' });
  }
  res.json({ ok: true, ...entry.payload });
});

app.post('/api/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.warn("⚠️ STRIPE_WEBHOOK_SECRET missing in .env");
    return res.status(400).send('Webhook secret missing');
  }

  let event;
  try {
    // Stripe requires the raw, unparsed body buffer to cryptographically verify the signature
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Stripe Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle subscription cancellation
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    if (supabase) {
      try {
        const { error } = await supabase
          .from('brands')
          .update({ plan_tier: 'free' })
          .eq('stripe_customer_id', customerId);
          
        if (error) throw error;
        // Zero the AI credit grant for the brand(s) on this customer.
        const { data: brands, error: brandsErr } = await supabase.from('brands').select('id').eq('stripe_customer_id', customerId);
        if (brandsErr) throw brandsErr;
        for (const b of brands || []) {
          const { error: rpcErr } = await supabase.rpc('grant_subscription_credits', { p_brand_id: b.id, p_amount: 0, p_reset_at: null });
          if (rpcErr) throw rpcErr;
        }
        console.log(`✅ Automatically downgraded canceled Stripe customer ${customerId} to Free plan.`);
      } catch (err) {
        console.error("❌ Failed to downgrade brand in Supabase:", err.message);
        return res.status(500).send('Database error');
      }
    }
  }

  // One-time credit-pack purchase completed → add topup credits. Idempotent:
  // top-ups ADD (unlike grants which SET), so guard against Stripe retries by
  // checking the ledger for this session id before crediting.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (supabase && session.mode === 'payment' && session.payment_status === 'paid'
        && session.metadata && session.metadata.kind === 'ai_topup') {
      const brandId = session.metadata.brandId;
      const credits = parseInt(session.metadata.credits, 10);
      if (brandId && credits > 0) {
        try {
          // supabase-js RESOLVES with { error } on failure — it does not reject.
          // Every one of these has to be checked by hand or the catch below is
          // decorative: a failed RPC would log success, return 200, and Stripe
          // would never retry. That is exactly how a paid top-up goes missing
          // with nothing anywhere saying so.
          const { data: seen, error: seenErr } = await supabase.from('ai_credit_ledger')
            .select('id').eq('stripe_ref', session.id).eq('type', 'topup').maybeSingle();
          if (seenErr) throw seenErr;
          if (!seen) {
            const { error: rpcErr } = await supabase.rpc('add_topup_credits', { p_brand_id: brandId, p_amount: credits, p_stripe_ref: session.id });
            if (rpcErr) throw rpcErr;
            console.log(`✅ Added ${credits} top-up credits to brand ${brandId} (${session.id}).`);
          }
        } catch (err) {
          console.error('❌ Failed to add top-up credits:', err.message);
          return res.status(500).send('Top-up credit error');
        }
      }
    }
  }

  // Subscription paid (initial + every renewal) → grant that cycle's AI credits.
  // Uses SET semantics (grant_subscription_credits), so Stripe retries are
  // idempotent — the balance is set to the tier allowance, never stacked.
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    const line = (invoice.lines && invoice.lines.data && invoice.lines.data[0]) || null;
    // Stripe REMOVED `price` from invoice lines in the 2025+ API versions (this
    // account is on 2026-06-24.dahlia); the id moved to
    // pricing.price_details.price. Reading only the old shape left priceId null,
    // so `tier` was null, so a paid subscription skipped the grant entirely —
    // the plan flipped (confirm-checkout writes that) but no credits arrived.
    // Both shapes are read so this survives whichever version the account is
    // pinned to, including older accounts still sending `price`.
    const priceId = line
      ? ((line.pricing && line.pricing.price_details && line.pricing.price_details.price)
          || (line.price && line.price.id)
          || null)
      : null;
    const tier = priceId ? (Object.entries(PRICE_IDS).find(([, id]) => id === priceId) || [])[0] : null;

    // An unrecognised price id means STRIPE_PRICE_BASIC/PREMIUM don't match the
    // account the invoice came from — the classic symptom of test-mode price ids
    // left in a live deploy. Without this the block just falls through and a
    // paid subscription grants nothing, with no trace of why.
    if (supabase && customerId && !tier) {
      console.error(`❌ invoice.paid for customer ${customerId} with unmapped price ${priceId} — check STRIPE_PRICE_BASIC / STRIPE_PRICE_PREMIUM.`);
    }

    if (supabase && customerId && tier) {
      try {
        const amount = tierCredits(tier);
        // Period end from the invoice line (unix seconds) → the next reset.
        const periodEnd = line && line.period && line.period.end
          ? new Date(line.period.end * 1000).toISOString()
          : null;
        const { data: brands, error: brandsErr } = await supabase.from('brands').select('id').eq('stripe_customer_id', customerId);
        if (brandsErr) throw brandsErr;
        // A customer with no matching brand row means the grant silently went
        // nowhere — the subscription is paid but nobody got credits, so fail
        // loudly and let Stripe retry rather than logging a success.
        if (!brands || !brands.length) throw new Error(`No brand found for Stripe customer ${customerId}`);
        for (const b of brands) {
          const { error: rpcErr } = await supabase.rpc('grant_subscription_credits', { p_brand_id: b.id, p_amount: amount, p_reset_at: periodEnd });
          if (rpcErr) throw rpcErr;
        }
        console.log(`✅ Granted ${amount} AI credits (${tier}) to Stripe customer ${customerId}.`);
      } catch (err) {
        console.error('❌ Failed to grant AI credits:', err.message);
        return res.status(500).send('Credit grant error');
      }
    }
  }

  res.status(200).json({ received: true });
});

// ---------------------------------------------------------
// 4. SHOPIFY INTEGRATION
// ---------------------------------------------------------

app.get('/api/shopify/auth', (req, res) => {
  const { shop, brandId } = req.query;
  if (!shop || !brandId) return res.status(400).send('Missing shop or brandId');

  if (!process.env.SHOPIFY_CLIENT_ID) {
    return res.status(400).send('SHOPIFY_CLIENT_ID is missing from api/.env.');
  }

  // Pinned to *.myshopify.com: `shop` lands in a redirect Location, so an
  // unchecked value turns this into an open redirect from our own domain.
  let shopDomain;
  try {
    shopDomain = safeShopifyShop(shop);
  } catch (err) {
    return res.status(400).send(err.message);
  }

  const scopes = 'read_orders,read_products';
  const redirectUri = `${API_URL}/api/shopify/callback`;
  const state = signOAuthState(brandId);
  const installUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  res.redirect(installUrl);
});

app.get('/api/shopify/callback', async (req, res) => {
  const { shop, code, state } = req.query;
  const brandId = verifyOAuthState(state);
  if (!shop || !code || !brandId) return res.status(400).send('Missing or invalid parameters');

  try {
    const shopDomain = safeShopifyShop(shop);
    const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Failed to get token');

    const handoffCode = createOAuthHandoff({ platform: 'shopify', shop: shopDomain, accessToken: data.access_token, brandId });
    res.redirect(`${APP_URL}/sales?shopify_success=true&handoff=${handoffCode}&brandId=${brandId}`);
  } catch (err) {
    console.error('Shopify OAuth Error:', err);
    res.redirect(`${APP_URL}/sales?shopify_error=true`);
  }
});

app.post('/api/shopify/fetch-orders', requireAuth, async (req, res) => {
  const { shop, token } = req.body;
  if (!shop || !token) return res.status(400).json({ ok: false, error: 'Missing shop or token' });

  try {
    const response = await fetch(`https://${safeShopifyShop(shop)}/admin/api/2024-01/orders.json?status=any&limit=250`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.errors || 'Failed to fetch orders');
    res.json({ ok: true, orders: data.orders });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Mandatory Shopify App Uninstalled Webhook
app.post('/api/shopify/webhooks/app_uninstalled', async (req, res) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const shopDomain = req.headers['x-shopify-shop-domain'];

  console.log(`📥 Received Shopify Uninstall Webhook for ${shopDomain}`);

  // 1. Verify the signature is genuinely from Shopify
  if (!verifyShopifySignature(req.rawBody, hmacHeader)) {
    console.warn("⚠️ Unauthorized Shopify Webhook Attempt");
    return res.status(401).send('Unauthorized');
  }

  if (!supabase) {
    console.error("❌ Supabase client not initialized on backend.");
    return res.status(500).send('Database connection error');
  }

  try {
    // 2. Locate the existing connection
    const { data: conn, error: findError } = await supabase
      .from('store_connections')
      .select('id')
      .eq('shop_domain', shopDomain)
      .eq('platform', 'shopify')
      .maybeSingle();

    if (findError) throw findError;

    if (conn) {
      // 3. Delete the connection (Cascades automatically to sales_data)
      const { error: deleteError } = await supabase
        .from('store_connections')
        .delete()
        .eq('id', conn.id);

      if (deleteError) throw deleteError;
      console.log(`✅ Successfully disconnected Shopify store: ${shopDomain}`);
    } else {
      console.log(`ℹ️ No connection found for store: ${shopDomain}`);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error("❌ Failed to process uninstall webhook:", err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Read-only stock levels, for the Analytics Inventory tab's "what your
// storefront reports" comparison — already covered by the existing
// read_products scope, no reconnect needed. Not the same as the README's
// long-standing "no inventory endpoint" note, which was about a live
// write-back sync; this only reads.
app.post('/api/shopify/fetch-inventory', requireAuth, async (req, res) => {
  const { shop, token } = req.body;
  if (!shop || !token) return res.status(400).json({ ok: false, error: 'Missing shop or token' });
  try {
    const response = await fetch(`https://${safeShopifyShop(shop)}/admin/api/2024-01/products.json?limit=250`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.errors || 'Failed to fetch products');
    const products = (data.products || []).flatMap(p => (p.variants || []).map(v => ({ sku: v.sku, stock_quantity: v.inventory_quantity })));
    res.json({ ok: true, products });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 4B. WOOCOMMERCE INTEGRATION
// ---------------------------------------------------------
// WooCommerce's REST API is plain Basic Auth over HTTPS with a Consumer
// Key/Secret the founder generates themselves in wp-admin (WooCommerce >
// Settings > Advanced > REST API) — no OAuth app, no platform review,
// unlike every other integration in this batch. This validates those
// credentials with a real call before the frontend persists them.

function wooAuthHeader(consumerKey, consumerSecret) {
  return 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
}

// Validates and canonicalizes the founder-supplied store URL (https only, no
// private/loopback hosts) — see safeStoreUrl. Throws on anything unsafe, which
// each handler below converts into a 400.
function normalizeStoreUrl(url) {
  return safeStoreUrl(url);
}

app.post('/api/woocommerce/validate', requireAuth, async (req, res) => {
  const { storeUrl, consumerKey, consumerSecret } = req.body;
  if (!storeUrl || !consumerKey || !consumerSecret) return res.status(400).json({ ok: false, error: 'Missing store URL or credentials' });
  try {
    const base = normalizeStoreUrl(storeUrl);
    const response = await safeFetchFollow(`${base}/wp-json/wc/v3/system_status`, {
      headers: { Authorization: wooAuthHeader(consumerKey, consumerSecret) }
    });
    if (!response.ok) {
      // Deliberately not echoing the response body: this is a server-side
      // fetch of a user-supplied URL, so reflecting what came back turns any
      // reachable endpoint into a readable one.
      throw new Error(response.status === 401
        ? 'Invalid Consumer Key/Secret'
        : `Store responded with ${response.status}. Check the URL points at your WooCommerce site and the REST API is enabled.`);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/woocommerce/fetch-orders', requireAuth, async (req, res) => {
  const { storeUrl, consumerKey, consumerSecret } = req.body;
  if (!storeUrl || !consumerKey || !consumerSecret) return res.status(400).json({ ok: false, error: 'Missing store URL or credentials' });
  try {
    const base = normalizeStoreUrl(storeUrl);
    const response = await safeFetchFollow(`${base}/wp-json/wc/v3/orders?per_page=100&status=any`, {
      headers: { Authorization: wooAuthHeader(consumerKey, consumerSecret) }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch orders');
    res.json({ ok: true, orders: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/woocommerce/fetch-inventory', requireAuth, async (req, res) => {
  const { storeUrl, consumerKey, consumerSecret } = req.body;
  if (!storeUrl || !consumerKey || !consumerSecret) return res.status(400).json({ ok: false, error: 'Missing store URL or credentials' });
  try {
    const base = normalizeStoreUrl(storeUrl);
    const response = await safeFetchFollow(`${base}/wp-json/wc/v3/products?per_page=100`, {
      headers: { Authorization: wooAuthHeader(consumerKey, consumerSecret) }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch products');
    res.json({ ok: true, products: (data || []).map(p => ({ sku: p.sku, stock_quantity: p.stock_quantity })) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Creates a real, live product on the connected store — only ever called
// after the founder has explicitly confirmed a preview in the UI, never
// automatically. Requires the connected Consumer Key to actually have
// write access (WooCommerce keys are read-only by default).
app.post('/api/woocommerce/publish-product', requireAuth, async (req, res) => {
  const { storeUrl, consumerKey, consumerSecret, name, description, price, sku, imageUrl } = req.body;
  if (!storeUrl || !consumerKey || !consumerSecret || !name || !price) return res.status(400).json({ ok: false, error: 'Missing required fields' });
  try {
    const base = normalizeStoreUrl(storeUrl);
    const response = await safeFetchFollow(`${base}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: { Authorization: wooAuthHeader(consumerKey, consumerSecret), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, type: 'simple', regular_price: String(price), description: description || '', sku: sku || undefined,
        images: imageUrl ? [{ src: imageUrl }] : undefined,
        status: 'draft', // safer default — the founder reviews and publishes live in WooCommerce themselves
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to create product');
    res.json({ ok: true, externalId: String(data.id), externalUrl: data.permalink });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 4C. ETSY INTEGRATION
// ---------------------------------------------------------
// Etsy Open API v3 requires OAuth 2.0 with PKCE (mandatory, not optional
// like most providers) — the client generates a random code_verifier,
// sends its SHA-256 hash (code_challenge) with the auth request, then
// proves it knew the original by sending code_verifier back at token
// exchange. PKCE verifiers are short-lived and single-use per attempt, so
// they're kept in the same in-memory pattern as the OAuth handoff store
// above (this backend has no database of its own).
const etsyPkceStore = new Map(); // state -> { verifier, expiresAt }
const PKCE_TTL_MS = 10 * 60 * 1000; // Etsy's own consent screen can take a few minutes

function base64url(buffer) {
  return buffer.toString('base64url');
}

app.get('/api/etsy/auth', (req, res) => {
  const { brandId } = req.query;
  if (!brandId) return res.status(400).send('Missing brandId');
  if (!process.env.ETSY_KEYSTRING) return res.status(400).send('ETSY_KEYSTRING is missing from api/.env.');

  const state = signOAuthState(brandId);
  const verifier = base64url(crypto.randomBytes(32));
  etsyPkceStore.set(state, { verifier, expiresAt: Date.now() + PKCE_TTL_MS });
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());

  const redirectUri = `${API_URL}/api/etsy/callback`;
  const scopes = 'transactions_r listings_r listings_w shops_r'; // listings_w: needed for Product Publishing
  const authUrl = `https://www.etsy.com/oauth/connect?response_type=code&client_id=${process.env.ETSY_KEYSTRING}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
  res.redirect(authUrl);
});

app.get('/api/etsy/callback', async (req, res) => {
  const { code, state } = req.query;
  const brandId = verifyOAuthState(state);
  const pkce = state && etsyPkceStore.get(state);
  etsyPkceStore.delete(state);

  if (!code || !brandId || !pkce || pkce.expiresAt < Date.now()) {
    return res.redirect(`${APP_URL}/sales?etsy_error=true`);
  }

  try {
    const redirectUri = `${API_URL}/api/etsy/callback`;
    const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.ETSY_KEYSTRING,
        redirect_uri: redirectUri,
        code,
        code_verifier: pkce.verifier,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Failed to get token');

    // Etsy access tokens are formatted "{numeric_user_id}.{token}" — the
    // user id is needed to look up which shop they own.
    const userId = tokenData.access_token.split('.')[0];
    const shopsRes = await fetch(`https://openapi.etsy.com/v3/application/users/${userId}/shops`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'x-api-key': process.env.ETSY_KEYSTRING },
    });
    const shopsData = await shopsRes.json();
    if (!shopsRes.ok || !shopsData.shop_id) throw new Error('Could not find an Etsy shop for this account');

    const handoffCode = createOAuthHandoff({
      platform: 'etsy',
      shopId: String(shopsData.shop_id),
      shopName: shopsData.shop_name,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      brandId,
    });
    res.redirect(`${APP_URL}/sales?etsy_success=true&handoff=${handoffCode}&brandId=${brandId}`);
  } catch (err) {
    console.error('Etsy OAuth Error:', err);
    res.redirect(`${APP_URL}/sales?etsy_error=true`);
  }
});

app.post('/api/etsy/refresh-token', requireAuth, async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ ok: false, error: 'Missing refresh token' });
  try {
    const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', client_id: process.env.ETSY_KEYSTRING, refresh_token: refreshToken }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(data.error_description || 'Failed to refresh token');
    res.json({ ok: true, accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Etsy prices come back as Money objects ({amount, divisor, currency_code}
// — real value is amount/divisor) and each receipt's line items live in
// a nested `transactions` array — normalized here, server-side, so the
// frontend adapter gets the same flat { created_at, total_price,
// line_items } shape every other platform already produces.
function etsyMoney(m) {
  return m ? m.amount / m.divisor : 0;
}

app.post('/api/etsy/fetch-orders', requireAuth, async (req, res) => {
  const { shopId, accessToken } = req.body;
  if (!shopId || !accessToken) return res.status(400).json({ ok: false, error: 'Missing shopId or accessToken' });
  try {
    const response = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/receipts?limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-api-key': process.env.ETSY_KEYSTRING },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch receipts');
    const receipts = (data.results || []).map(r => ({
      created_at: new Date(r.created_timestamp * 1000).toISOString(),
      total_price: etsyMoney(r.grandtotal),
      line_items: (r.transactions || []).map(t => ({ sku: t.sku, price: etsyMoney(t.price), quantity: t.quantity })),
    }));
    res.json({ ok: true, receipts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/etsy/fetch-inventory', requireAuth, async (req, res) => {
  const { shopId, accessToken } = req.body;
  if (!shopId || !accessToken) return res.status(400).json({ ok: false, error: 'Missing shopId or accessToken' });
  try {
    const response = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings?limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-api-key': process.env.ETSY_KEYSTRING },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch listings');
    res.json({ ok: true, listings: (data.results || []).map(l => ({ sku: (l.skus || [])[0], stock_quantity: l.quantity })) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Creates a real, live (draft or active, per `state`) listing — only
// ever called after the founder has explicitly confirmed a preview in
// the UI. Etsy requires a numeric taxonomy_id (its category system) on
// every listing and there's no safe default across garment types, so
// the founder has to supply one (see README) rather than this guessing
// wrong and miscategorizing a real listing. Etsy image upload is a
// separate multipart endpoint this doesn't call — the listing is created
// text-only; photos get added directly in Etsy afterward.
app.post('/api/etsy/publish-listing', requireAuth, async (req, res) => {
  const { shopId, accessToken, title, description, price, quantity, taxonomyId, sku } = req.body;
  if (!shopId || !accessToken || !title || !price || !taxonomyId) return res.status(400).json({ ok: false, error: 'Missing required fields (title, price, and an Etsy taxonomy ID are all required)' });
  try {
    const response = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'x-api-key': process.env.ETSY_KEYSTRING, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: quantity || 1, title, description: description || '', price: Number(price),
        who_made: 'i_did', when_made: 'made_to_order', taxonomy_id: Number(taxonomyId),
        sku: sku ? [sku] : undefined, state: 'draft',
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create listing');
    res.json({ ok: true, externalId: String(data.listing_id), externalUrl: data.url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 4D. TIKTOK SHOP — honest stub, not a real connection
// ---------------------------------------------------------
// Unlike Shopify/WooCommerce/Etsy, TikTok Shop's Partner API isn't
// self-serve — a developer app alone doesn't grant access; TikTok has to
// approve the seller/partner relationship first, and the exact OAuth
// shape varies by API version and region in ways not confidently
// verifiable without an approved account to test against. Rather than
// guess at an auth URL that might be wrong, this always returns a clear
// "not available yet" response instead of attempting a redirect —
// honest about what it is, consistent with how this app already handles
// the Shopify connection while its own App Store review is pending.
app.get('/api/tiktokshop/auth', (req, res) => {
  res.status(400).json({ ok: false, error: 'TikTok Shop requires an approved TikTok Shop Partner Center account, not just a developer app — this connection is not available yet.' });
});

// ---------------------------------------------------------
// 5. EMAIL INTEGRATION (Resend)
// ---------------------------------------------------------

// Authenticated and brand-scoped: this sends from our own verified domain, so
// an open version of it is a phishing relay wearing our SPF and DKIM. The
// caller must be signed in AND belong to the brand they're inviting into.
app.post('/api/send-invite', requireAuth, async (req, res) => {
  console.log("📥 Received invite email request...");
  if (!resend) {
    // Used to return ok:true "skipped because no key was found" — so with the
    // key unset, invites reported success forever while /api/send-vendor-email
    // (which said so plainly) looked like the broken one. Same failure, two
    // different stories. Say it here too.
    console.warn("⚠️ RESEND_API_KEY missing. Cannot send invite email.");
    return res.status(400).json({ ok: false, error: 'RESEND_API_KEY is not set on the API — the teammate was added, but no invite email could be sent.' });
  }

  try {
    const { email, brandName, inviterName, role, brandId } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: 'No recipient provided' });
    if (!brandId) return res.status(400).json({ ok: false, error: 'brandId is required.' });
    if (!(await verifyBrandAccess(req.user && req.user.id, brandId))) {
      return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });
    }
    const inviteLink = `${APP_URL}/signup?email=${encodeURIComponent(email)}`;

    // Every interpolated value below is caller-supplied — escape it before it
    // becomes markup, or a crafted brand/inviter name injects its own link.
    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; color: #222;">
        <h2>You've been invited to Atelier!</h2>
        <p><strong>${escapeHtml(inviterName || 'A teammate')}</strong> has invited you to join the <strong>${escapeHtml(brandName)}</strong> workspace as an ${escapeHtml(role)}.</p>
        <p>Atelier is a production operating system for fashion brands.</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #211D18; color: #fff; text-decoration: none; border-radius: 8px; margin-top: 10px;">
          Join Workspace
        </a>
      </div>
    `;

    // resend.emails.send RESOLVES with { data, error } — it does not reject.
    // Returning the response as-is reported ok:true on a refused send, which is
    // how "the invite was sent" and "no invite ever arrived" were both true at
    // once. The caller needs Resend's actual reason (unverified domain,
    // recipient not allowed on the free tier, invalid address) to act on it.
    const { data, error: sendError } = await resend.emails.send({
      from: 'Atelier <invites@atelierlabs.app>',
      to: email,
      subject: `Join ${brandName} on Atelier`,
      html: htmlBody,
    });
    if (sendError) throw new Error(sendError.message || 'Resend refused the send.');

    res.json({ ok: true, data });
  } catch (error) {
    console.error('❌ Email Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Real send via Resend, one call per recipient (Resend's batch endpoint caps
// at 100 and this app has no queue/retry infra, so a simple sequential loop
// with per-recipient error capture is the honest choice over pretending a
// bulk-send guarantee this doesn't have). Only ever called after the founder
// explicitly confirms in the UI — this can email real people.
// Authenticated and brand-scoped for the same reason as /api/send-invite —
// arbitrary subject, arbitrary HTML body and an arbitrary recipient list is
// exactly the shape of a phishing blast if anyone can call it.
const CAMPAIGN_RECIPIENT_CAP = 500;

app.post('/api/send-campaign', requireAuth, async (req, res) => {
  console.log("📥 Received campaign send request...");
  if (!resend) {
    return res.status(400).json({ ok: false, error: 'RESEND_API_KEY is missing from api/.env — no campaign can be sent without it.' });
  }
  try {
    const { subject, body, recipients, brandId } = req.body;
    if (!subject || !body || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ ok: false, error: 'Missing subject, body, or recipients' });
    }
    if (!brandId) return res.status(400).json({ ok: false, error: 'brandId is required.' });
    if (!(await verifyBrandAccess(req.user && req.user.id, brandId))) {
      return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });
    }
    // The per-IP rate limit counts requests, not recipients — without a cap one
    // allowed request is an unbounded send.
    if (recipients.length > CAMPAIGN_RECIPIENT_CAP) {
      return res.status(400).json({ ok: false, error: `A single campaign is capped at ${CAMPAIGN_RECIPIENT_CAP} recipients (this one has ${recipients.length}). Split it into smaller sends.` });
    }

    let sent = 0;
    const failures = [];
    for (const email of recipients) {
      try {
        // { error } rather than a rejection — see /api/send-invite. Without this
        // check every recipient counted as sent no matter what Resend said, and
        // the campaign reported a clean 12/12 having delivered nothing.
        const { error: sendError } = await resend.emails.send({ from: 'Atelier <invites@atelierlabs.app>', to: email, subject, html: body });
        if (sendError) throw new Error(sendError.message || 'Resend refused the send.');
        sent++;
      } catch (err) {
        failures.push({ email, error: err.message });
      }
    }

    console.log(`✅ Campaign sent: ${sent}/${recipients.length}`);
    res.json({ ok: true, sent, failed: failures.length, failures });
  } catch (error) {
    console.error('❌ Campaign Send Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Brand-scoped for the same reason as /api/send-invite and /api/send-campaign:
// arbitrary recipient + arbitrary body sent from our own verified domain is a
// phishing relay wearing our SPF and DKIM. requireAuth alone wasn't enough —
// signup is open, so "signed in" is a formality.
app.post('/api/send-vendor-email', requireAuth, async (req, res) => {
  console.log("📥 Received vendor email send request...");
  if (!resend) {
    return res.status(400).json({ ok: false, error: 'RESEND_API_KEY is missing from api/.env — cannot send email.' });
  }
  try {
    const { to, subject, body, vendorName, brandId } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ ok: false, error: 'Missing recipient email (to), subject, or body.' });
    }
    if (!brandId) return res.status(400).json({ ok: false, error: 'brandId is required.' });
    if (!(await verifyBrandAccess(req.user && req.user.id, brandId))) {
      return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });
    }

    // Format plain text line breaks into HTML for clean rendering in email
    // clients. The body is always plain text (QuoteTracker composes it, and
    // /api/draft-vendor-email is prompted for plain text with \n breaks), so
    // escaping first costs nothing visually and stops the caller from putting
    // its own markup — a fake link, say — into mail sent from our domain.
    // Escape BEFORE the newline substitution, or the <br/> tags get escaped too.
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #16181D; line-height: 1.6; font-size: 15px;">
        ${escapeHtml(body).replace(/\n/g, '<br/>')}
      </div>
    `;

    // { error }, not a rejection — see /api/send-invite. This is the one that
    // matters most: the RFQ UI reports per-vendor delivery to the founder, so a
    // swallowed error here means being told a factory was contacted when it
    // wasn't, and waiting on a quote that was never requested.
    const { data, error: sendError } = await resend.emails.send({
      from: 'Atelier Outreach <invites@atelierlabs.app>',
      to: [to],
      subject: subject,
      html: htmlBody,
    });
    if (sendError) {
      console.error('❌ Resend refused vendor email:', sendError.message);
      return res.status(502).json({ ok: false, error: sendError.message || 'Resend refused the send.' });
    }

    console.log(`✅ RFQ email sent to vendor: ${vendorName || to}`);
    res.json({ ok: true, data });
  } catch (error) {
    console.error('❌ Vendor Email Send Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 5. DASHBOARD AI SUGGESTIONS
// ---------------------------------------------------------
const SUGGESTION_CATEGORIES = ['readiness', 'deadline', 'vendor', 'budget', 'team', 'billing', 'design', 'general'];

app.post('/api/dashboard-suggestions', metered('dashboard-suggestions'), async (req, res) => {
  console.log("📥 Received dashboard suggestions request...");
  try {
    const { brand, products, upcomingDeadlines, gateFlags, aiUsage, aiCredits, seats } = req.body;

    const prompt = `You are a production-operations advisor for an independent clothing brand founder, reviewing their dashboard for anything worth flagging today. Be specific and reference real product names when relevant — never invent products, vendors, or numbers that weren't given to you. If the data below looks genuinely healthy with nothing urgent, say so plainly instead of inventing a concern.

Brand: ${brand?.name || 'Unknown'}, plan tier: ${brand?.plan_tier || 'free'}

Active products (name, stage, readiness %, risk, budget):
${products && products.length ? products.map(p => `- ${p.name}: ${p.stage}, ${p.readiness}% ready, ${p.risk} risk, $${p.budget || 0} budget`).join('\n') : 'None yet.'}

Products below the 80% readiness gate while in sourcing: ${gateFlags ?? 0}

Upcoming production due dates:
${upcomingDeadlines && upcomingDeadlines.length ? upcomingDeadlines.map(d => `- ${d.product}: due ${d.due_date} (${d.stage})`).join('\n') : 'None scheduled.'}

AI credits: ${aiCredits ? `${aiCredits.remaining} remaining of ${aiCredits.monthlyAllowance} monthly` : `${aiUsage?.used ?? 0} / ${aiUsage?.limit ?? 0} used`}
Team seats used: ${seats?.used ?? 0} / ${seats?.limit ?? 0}

Return a JSON object with exactly this structure:
{
  "suggestions": [
    { "category": one of ${JSON.stringify(SUGGESTION_CATEGORIES)}, "severity": "info" | "warning" | "success", "text": "specific, actionable sentence" }
  ]
}
Return 2 to 4 suggestions, ordered most important first. Use "warning" only for things that need action soon (a gate flag, a near-term deadline, hitting a plan limit); use "success" sparingly, only when something is genuinely going well and worth acknowledging; otherwise "info".`;

    const result = await callGemini(prompt + brandProfileBlock(req.body.brandProfile));
    console.log("✅ Dashboard suggestions successful");
    res.json({ ok: true, suggestions: result.suggestions || [] });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 6. AI DESIGN STUDIO — image generation & editing
// ---------------------------------------------------------
// One endpoint, many "modes" — every tool here needs to see and faithfully
// edit the founder's *actual* existing design (recolor, fabric-swap, etc.),
// so these run image-to-image on gpt-image-1 via /v1/images/edits, passing the
// current canvas in as the reference. Section "7." below handles the opposite
// kind of tool — generating a brand new, isolated element to *add* to the
// design — on the same model with no reference image. Both go through
// callOpenAIImage; they stay separate endpoints because editing an existing
// image and generating an isolated asset are genuinely different capabilities
// (different prompt rules, options, and credit prices), not one with a flag.
// Hard rules appended to EVERY design-image prompt. In real use the two
// biggest failure modes were (a) the model returning a contact sheet of
// several variations on one canvas and (b) the rendering style drifting run
// to run — so every mode pins: one subject, one panel, consistent
// presentation, no stray text.
const IMAGE_OUTPUT_RULES = `

STRICT OUTPUT RULES (always apply):
- Produce exactly ONE image showing exactly ONE version of the garment. Never a grid, collage, contact sheet, storyboard, or multiple variations/angles side by side. No split panels.
- One garment, centered, filling most of the frame, fully in view.
- Plain solid white background unless the instruction above explicitly describes a different setting.
- No text, labels, captions, annotations, arrows, watermarks, borders, or color swatches anywhere in the image.
- Match the rendering style, lighting, and level of realism of the reference image unless the instruction is specifically about changing the rendering style.`;

// Per-mode options for the image-to-image (edit) modes. `size: 'auto'` lets
// gpt-image-1 keep the reference image's proportions instead of forcing a
// square crop. Background removal finally returns REAL alpha rather than the
// painted-white approximation the old model could only fake.
const IMAGE_MODE_OPTIONS = {
  'bg-remove': { size: 'auto', background: 'transparent' },
  'flat-sketch': { size: 'auto', background: 'transparent' },
};

const IMAGE_MODE_PROMPTS = {
  // Takes an UPLOADED photo/scan of a hand-drawn sketch (not the canvas) and
  // turns it into a usable mockup. Detail preservation is the whole point —
  // the founder's drawing is the spec, so the model tidies the linework
  // without redesigning anything.
  'sketch-to-design': (p) => `You are given a photo or scan of a hand-drawn garment sketch. Redraw it as ONE clean apparel mockup illustration. PRESERVE EVERY DESIGN DETAIL exactly as drawn — silhouette, proportions, seam lines, panels, pockets, closures, zips, drawcords, cuffs, collar, and any graphic or print placement. Do not invent details that are not in the sketch, and do not drop any that are. Clean up wobbly hand-drawn linework into crisp confident lines, ignore paper texture, smudges, shadows, ruled lines and any handwritten annotations, and add soft light-grey shading that describes the garment's volume. Present it as a blank garment mockup, front view, centered.${p ? ` Style direction: ${p}.` : ''}`,
  // What "sketch-to-design" used to do: polish whatever is already on the
  // canvas, in place.
  'polish-design': (p) => `You are a fashion technical illustrator. Take this rough sketch and render it as ONE clean, professional garment design image — polished linework, soft fabric drape and shading, single garment only, no model.${p ? ` Style direction: ${p}.` : ''} Keep the same silhouette, proportions and every design detail from the sketch — you are rendering it, not redesigning it.`,
  'ai-edit': (p) => `You are editing this garment design image. Apply exactly this one change and nothing else: ${p || 'a small refinement'}. Everything else about the garment — silhouette, color, fabric, details, camera angle, background, and composition — must remain identical to the reference.`,
  'bg-remove': () => `Cut the garment out from its background completely, leaving a fully transparent background behind it. Keep the garment itself pixel-identical — do not alter its colour, shape, shading or details, and keep its edges clean and accurate. Only the area OUTSIDE the garment's outer edge becomes transparent: never erase or punch holes through any part of the garment itself, including collars, plackets, facings and inner layers visible through a neckline or armhole.`,
  'recolor': (p) => `Recolor the garment in this image to ${p || 'a different color'}. Change ONLY the color: fabric texture, shading, folds, construction details, silhouette, camera angle, and background stay exactly as they are.`,
  'fabric-swap': (p) => `Change the fabric of the garment in this image to ${p || 'a different fabric'}, updating texture and drape to realistically reflect that fabric while keeping the exact same garment silhouette, cut, color palette, design details, camera angle, and background.`,
  'mockup': (p) => `Create ONE professional product photograph of this garment: ${p || 'worn by a single model in a studio setting with clean, even lighting'}. The garment's design, color, and details must match the reference image exactly. One photo, at most one model, one angle.`,
  'flat-sketch': () => `Convert this garment image into ONE clean technical flat sketch — precise black linework on a fully transparent background, no shading or colour, front view only, the kind used in a professional tech pack.`,
  'view': (p) => `Generate ONE image of this exact same garment seen from the ${p || 'back'} — same color, fabric, construction, and design details as the reference, same rendering style, just rotated to that single viewpoint. Do not show the original view alongside it.`,
  'variant': (p) => `Create ONE design variation of this garment: ${p || 'a stylistic variation'}. Apply the change once, to a single garment, and show only the result — not the original, not multiple options. It must stay recognizably the same garment with only this change; match the reference's rendering style, angle, and composition.`,
};

app.post('/api/design/ai-image', metered('design-ai-image'), async (req, res) => {
  console.log("📥 Received AI image request...");
  try {
    const { mode, prompt, images } = req.body;
    const builder = IMAGE_MODE_PROMPTS[mode];
    if (!builder) return res.status(400).json({ ok: false, error: 'Unknown AI image mode: ' + mode });
    if (!images || images.length === 0) {
      return res.status(400).json({ ok: false, error: 'No reference image provided' });
    }
    const fullPrompt = builder(prompt) + IMAGE_OUTPUT_RULES;
    const result = await callOpenAIImage(fullPrompt, {
      images,
      ...(IMAGE_MODE_OPTIONS[mode] || { size: 'auto', background: 'auto' }),
    });
    console.log("✅ AI image successful:", mode);
    res.json({ ok: true, imageBase64: result.base64, mimeType: result.mimeType });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 7. AI DESIGN STUDIO — new element generation (OpenAI gpt-image-1)
// ---------------------------------------------------------
// Generates a standalone graphic (a logo/icon, or a pattern swatch) with no
// input image — this is what feeds the frontend's "add as a new layer"
// action (PhotopeaEditor.addLayer) instead of the Gemini modes above, which
// replace the whole canvas. Kept as a separate endpoint/provider rather than
// folded into /api/design/ai-image since it's a genuinely different
// capability (isolated-asset generation vs. whole-image editing), not just
// another prompt template.
const ELEMENT_MODE_PROMPTS = {
  'add-element': (p) => `exactly one single graphic, centered: ${p || 'a simple minimalist icon'}. One design only — no alternates, no variations, no sheet of options`,
  'pattern': (p) => `a seamless, tileable, repeating textile pattern: ${p || 'an abstract pattern'}`,
  // Used for Design.jsx's "Generate silhouette" (custom garment types outside
  // the 9 hand-drawn presets). An earlier version had Gemini guess raw SVG
  // path coordinates for this, which is a spatial-reasoning task text models
  // are bad at blind — results were unrecognizable for anything but the
  // simplest shapes. An actual image model reasons in pixel space, so it's
  // structurally better suited to rendering a coherent garment.
  //
  // Style note: this deliberately targets a "ghost mannequin" blank apparel
  // mockup — the dimensional, softly shaded blank a designer prints artwork
  // onto — NOT a flat CAD line drawing. Flat line-art came back as a bare
  // uniform outline that gave founders nothing to build on; a shaded blank
  // reads as an actual garment and is far more useful as a starting canvas.
  'silhouette': (p) => `A blank ${p || 'garment'} apparel mockup drawn as a clean digital VECTOR ILLUSTRATION — not a photograph. Front view, centered, vertically symmetric, filling most of the frame. Smooth flat shapes with crisp dark outlines and soft light-grey cel shading that suggests the garment's three-dimensional volume, plus thin seam lines. Illustrated apparel-template style — simplified and graphic, with just enough shading to read as a real garment rather than a bare outline.

STRICTLY WHITE: the garment is plain white fabric shaded only in neutral light greys. No colour anywhere in the image — no tints, no coloured fabric, no coloured trims, zips, buttons, drawcords, eyelets, labels or stitching. Every component is white or grey. No branding, print, pattern, logo or text on the garment.

TRANSPARENCY BOUNDARY: only the area OUTSIDE the garment's outer edge is transparent. The garment itself is completely opaque — every part of it stays filled with solid white fabric, including collars, plackets, facings, hems, waistbands, straps and any inner layer visible through a neckline, armhole, face opening or hood. Never punch holes inside the garment's outline and never let the transparent background bleed into the garment. Exactly one garment, exactly one view`,
};

// Per-mode generation options for gpt-image-1.
//
// `size`: a SQUARE frame invites side-by-side duplicates for garments (the
// model fills spare width with a front+back pair), so silhouettes render
// portrait — a shape that fits one garment and leaves no room for a neighbour.
// `background`: gpt-image-1 renders true alpha, so logos and silhouettes come
// back as drop-in layers. Patterns stay opaque — a tile must fill its frame.
const ELEMENT_MODE_OPTIONS = {
  'add-element': { size: '1024x1024', background: 'transparent' },
  'pattern':     { size: '1024x1024', background: 'opaque' },
  // quality is overridden per-request from the user's low/medium/high choice.
  'silhouette':  { size: '1024x1536', background: 'transparent', quality: 'medium' },
};

// Framing appended to every element prompt. Replaces the old "draw it on solid
// white so we can flood-fill the white out" workaround, which real
// transparency makes unnecessary.
const ELEMENT_STYLE_SUFFIX = {
  'add-element': 'Flat vector-style graphic, centered, on a fully transparent background. No scene, no mockup, no photograph, no shadow, no frame or border, no text or watermark — just the graphic itself.',
  'pattern': 'A flat, evenly lit repeating swatch that tiles seamlessly edge to edge and fills the entire frame. No garment, no mockup, no shadow, no text or watermark.',
  'silhouette': 'Flat digital illustration style — clean vector artwork, NOT a photograph and not a 3D render. Isolated on a fully transparent background: no backdrop, no surface, no ground shadow, no coloured background of any kind. Pure greyscale palette — white fabric, grey shading, dark outlines, and nothing else. No text, no watermark, no frame or border.',
};

// gpt-image-1 has no negativePrompt parameter — exclusions go in the prompt as
// plain language, which this model follows reliably (unlike SDXL).
const ELEMENT_MODE_EXCLUSIONS = {
  'add-element': 'Draw only one design: no alternates, no variations, no grid or sheet of options.',
  'silhouette': 'The garment must be empty: no person, face, skin, hair, eyes, hands, arms, legs, and no visible mannequin, dress form or hanger. Do not render a back view, side view, three-quarter view, turnaround, spec sheet or any second garment — exactly one garment, from the front, once. Do not use any colour — the result must be pure greyscale. Do not erase, cut out or make transparent any part of the garment itself, especially collars, necklines, plackets and facings; transparency belongs only outside its outer edge. Aim between the two extremes: NOT a photorealistic photograph, no fabric weave texture, no realistic studio lighting; but also NOT a bare uniform-weight CAD outline with no shading. It should read as a clean illustrated apparel mockup template.',
};

// Silhouettes are priced per quality tier (low/medium/high cost very
// different amounts of API spend), so the credit feature is resolved from the
// request rather than fixed.
app.post('/api/design/generate-element', metered((req) => (
  req.body?.mode === 'silhouette'
    ? silhouetteFeature(req.body?.quality)
    : 'design-generate-element'
)), async (req, res) => {
  console.log("📥 Received element generation request...");
  try {
    const { mode, prompt, quality } = req.body;
    const builder = ELEMENT_MODE_PROMPTS[mode];
    if (!builder) return res.status(400).json({ ok: false, error: 'Unknown element mode: ' + mode });
    const opts = { ...(ELEMENT_MODE_OPTIONS[mode] || { size: '1024x1024', background: 'auto' }) };
    // Honour the caller's chosen render quality; the credit charge above was
    // resolved from the same value, so price and cost always agree.
    if (mode === 'silhouette') opts.quality = silhouetteQuality(quality);
    const fullPrompt = [
      builder(prompt),
      ELEMENT_STYLE_SUFFIX[mode],
      ELEMENT_MODE_EXCLUSIONS[mode],
    ].filter(Boolean).join('. ');
    const result = await callOpenAIImage(fullPrompt, opts);
    console.log("✅ Element generation successful:", mode);
    res.json({ ok: true, imageBase64: result.base64, mimeType: result.mimeType });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/design/color-palette', metered('design-color-palette'), async (req, res) => {
  console.log("📥 Received color palette request...");
  try {
    const { imageBase64, brief } = req.body;
    if (!imageBase64 && !brief) return res.status(400).json({ ok: false, error: 'Provide a design image or a brief description' });

    const prompt = `You are a fashion colorist advising an independent clothing brand. ${imageBase64 ? 'Based on the attached garment design image,' : `Based on this brief: "${brief}",`} suggest a cohesive 5-color palette for this product or collection — think about what would actually work together in production (dye-ability, how the accent reads against the base), not just what looks nice in a swatch.

Return a JSON object with exactly this structure:
{ "palette": [ { "name": "descriptive color name", "hex": "#RRGGBB", "role": "primary" | "secondary" | "accent" | "neutral" } ] }
Exactly 5 entries: one primary, one secondary, one accent, and two neutrals.`;

    const result = await callGemini(prompt + brandProfileBlock(req.body.brandProfile), imageBase64 || null);
    console.log("✅ Color palette successful");
    res.json({ ok: true, palette: result.palette || [] });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/design/trend-inspiration', metered('design-trend-inspiration'), async (req, res) => {
  console.log("📥 Received trend inspiration request...");
  try {
    const { category } = req.body;
    if (!category || !category.trim()) return res.status(400).json({ ok: false, error: 'No garment category provided' });
    if (!process.env.TAVILY_API_KEY || process.env.TAVILY_API_KEY.startsWith('get_a_free_key')) {
      return res.status(400).json({ ok: false, error: 'TAVILY_API_KEY is not set in api/.env — get a free key at tavily.com' });
    }

    const searchRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${category} fashion design trends this season silhouettes colors fabrics`,
        search_depth: 'advanced',
        max_results: 10,
      }),
    }).then(r => r.json());
    if (searchRes.error) throw new Error(searchRes.error);

    const results = searchRes.results || [];
    if (results.length === 0) {
      return res.json({ ok: true, trends: [] });
    }

    const prompt = `A fashion brand founder wants current design trend inspiration for: "${category}"

Real web search results:
${results.map((r, i) => `[${i}] ${r.title}\n${(r.content || '').slice(0, 700)}`).join('\n\n')}

Synthesize this into concrete, actionable design trend points a founder could actually use when briefing a design — silhouettes, colors, fabrics, details/trims. Don't invent trends not supported by the search results; if the results are thin, return fewer, more grounded points rather than padding it out.

Return a JSON object with exactly this structure:
{ "trends": [ { "theme": "short trend name", "detail": "1-2 sentence description of what this means for the design", "category": "silhouette" | "color" | "fabric" | "detail" } ] }
Return 3 to 6 entries.`;

    const result = await callGemini(prompt + brandProfileBlock(req.body.brandProfile));
    console.log("✅ Trend inspiration successful");
    res.json({ ok: true, trends: result.trends || [] });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Researches materials named in a tech pack's bill of materials so they can be
// added to the Materials Library with real information rather than a bare name.
//
// One Tavily search PER MATERIAL (they share no facts — "12oz cotton twill" and
// "YKK #5 zipper" have nothing to say about each other), then a SINGLE Gemini
// pass over all of them. That keeps this at one metered charge per save no
// matter how many materials are on the row, which is why it takes an array
// rather than being called in a loop from the client.
const MATERIAL_RESEARCH_CAP = 8;

app.post('/api/research-materials', requireTier('basic'), metered('research-materials'), async (req, res) => {
  console.log("📥 Received material research request...");
  try {
    const { materials, garmentType } = req.body;
    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ ok: false, error: 'No materials provided' });
    }
    const names = materials
      .map(m => String(m || '').trim())
      .filter(Boolean)
      .slice(0, MATERIAL_RESEARCH_CAP);
    if (names.length === 0) return res.status(400).json({ ok: false, error: 'No usable material names provided' });

    if (!process.env.TAVILY_API_KEY || process.env.TAVILY_API_KEY.startsWith('get_a_free_key')) {
      return res.status(400).json({ ok: false, error: 'TAVILY_API_KEY is not set in api/.env — get a free key at tavily.com' });
    }

    // In parallel: the searches are independent and this runs while someone is
    // watching a save spinner. A failed search yields no results for that
    // material rather than failing the whole batch — the others still get filled.
    const searches = await Promise.all(names.map(async name => {
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: `${name} textile material properties composition weight care handling sustainability certifications`,
            search_depth: 'advanced',
            max_results: 5,
          }),
        }).then(x => x.json());
        return { name, results: r.error ? [] : (r.results || []) };
      } catch {
        return { name, results: [] };
      }
    }));

    const block = searches.map(s => (
      `MATERIAL: ${s.name}\n${s.results.length
        ? s.results.map((r, i) => `  [${i}] ${r.title}\n  ${(r.content || '').slice(0, 500)}`).join('\n')
        : '  (no search results found)'}`
    )).join('\n\n');

    const prompt = `A clothing brand is building a materials library${garmentType ? ` for a ${garmentType}` : ''}. For each material below, extract what the real web search results actually support.

${block}

Rules that matter more than completeness:
- Use ONLY what the search results support. If a field isn't supported, return null for it. Do not guess a fibre content, a certification, or a supplier.
- A material with no search results should come back with its name and nulls, not invented facts.
- "certifications" must list only certifications named in the results (e.g. GOTS, OEKO-TEX). Empty array if none are mentioned.
- "warning" is for genuine production risks (shrinkage, colour bleeding, needing a specific needle or temperature), not marketing copy.
- "availability" must be one of: "In Stock", "Low Stock", "Backordered", "Discontinued", "Unknown". Use "Unknown" unless the results clearly say otherwise — you cannot know this brand's supplier stock.

Return a JSON object with exactly this structure, one entry per material, in the same order:
{ "materials": [ { "name": "exactly the material name given", "category": "short fibre/material family e.g. Cotton, Polyester, Metal hardware, or null", "type": "fabric" | "trim" | "notion", "riskLevel": "Low" | "Medium" | "High" | null, "warning": "string or null", "handlingNotes": "string or null", "sustainabilityInfo": "string or null", "certifications": [], "availability": "Unknown" } ] }`;

    const result = await callGemini(prompt + brandProfileBlock(req.body.brandProfile));
    console.log(`✅ Material research successful (${names.length} material${names.length === 1 ? '' : 's'})`);
    res.json({ ok: true, materials: result.materials || [] });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 8. SOCIAL MEDIA OAUTH (Instagram, TikTok, YouTube, Pinterest)
// ---------------------------------------------------------
// Rebuilt on the same shared OAuth handoff helper Shopify/Etsy use
// (signed state, single-use handoff code instead of a raw token in the
// URL) — the previous version here had two real bugs: `state` was just
// the bare brandId (no CSRF protection, same gap Shopify had), and
// ContentContext.jsx's connectAccount() never actually read the `token`
// query param at all, so every "connected" account had no real access
// token behind it — the OAuth handshake ran for nothing. Both fixed now.
const SOCIAL_OAUTH = {
  instagram: {
    envId: 'INSTAGRAM_CLIENT_ID', envSecret: 'INSTAGRAM_CLIENT_SECRET',
    authUrl: (redirectUri, state) => `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user_profile,user_media&response_type=code&state=${state}`,
    getToken: async (code, redirectUri) => {
      const form = new URLSearchParams({ client_id: process.env.INSTAGRAM_CLIENT_ID, client_secret: process.env.INSTAGRAM_CLIENT_SECRET, grant_type: 'authorization_code', redirect_uri: redirectUri, code });
      const response = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_message || 'Instagram token exchange failed');
      return { accessToken: data.access_token };
    },
    getHandle: async ({ accessToken }) => {
      const response = await fetch(`https://graph.instagram.com/me?fields=username&access_token=${accessToken}`);
      const data = await response.json();
      return data.username || 'Connected';
    },
  },
  tiktok: {
    envId: 'TIKTOK_CLIENT_KEY', envSecret: 'TIKTOK_CLIENT_SECRET',
    // Scopes come from the env, NOT hardcoded, because the safe value differs by
    // environment: Sandbox grants the read scopes immediately, while production
    // rejects the whole authorize request for any scope the app hasn't been
    // approved for. Hardcoding the wide set would break connecting in production
    // until the review passes; hardcoding the narrow set is what made the reads
    // fail with scope_not_authorized no matter what the portal said.
    //
    // Set TIKTOK_SCOPES=user.info.basic,user.info.stats,video.list in Sandbox, and
    // in production only once TikTok has approved them. The default is the
    // approved-today set, so an unset variable degrades to what already works.
    authUrl: (redirectUri, state) => {
      const scopes = process.env.TIKTOK_SCOPES || 'user.info.basic';
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&response_type=code&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    },
    getToken: async (code, redirectUri) => {
      const form = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
      const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'TikTok token exchange failed');
      // refresh_token and expires_in were both being dropped here, so every
      // TikTok connection died 24 hours later with no way to renew it.
      //
      // grantedScopes is carried purely so the callback can log what the token
      // ACTUALLY came back with. TikTok grants whatever intersection of requested
      // and approved scopes it likes and reports success either way, so a token
      // silently missing video.publish is indistinguishable from a working one
      // until a call fails — which cost two rounds of guessing.
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        expiresIn: data.expires_in,
        grantedScopes: data.scope || null,
      };
    },
    // TikTok is the only platform with a refresh path today because it is the
    // only one whose token expires fast enough to matter (24h). Pinterest and
    // YouTube hand back refresh tokens that are stored but not yet used; adding
    // them here is a one-liner each when their own reads land.
    refresh: async (refreshToken) => {
      const form = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refreshToken });
      const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || data.message || 'TikTok token refresh failed');
      // TikTok rotates the refresh token on use, so the new one must replace the
      // old or the next refresh fails against a spent credential.
      return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken, expiresIn: data.expires_in };
    },
    getHandle: async ({ accessToken }) => {
      const response = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      return data.data?.user?.display_name || 'Connected';
    },
    // ── Display API reads ────────────────────────────────────────────────────
    // Both of these need scopes the app has NOT been granted yet
    // (user.info.stats, video.list), so until the TikTok revision is approved
    // they fail with scope_not_authorized. tiktokDisplayCall turns that into a
    // sentence a founder can act on rather than a raw platform error.
    fetchStats: async (accessToken) => {
      const data = await tiktokDisplayCall(
        'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count',
        accessToken,
        {},
        'user.info.stats',
      );
      return {
        handle: data.user?.display_name || null,
        followers: Number.isFinite(data.user?.follower_count) ? data.user.follower_count : null,
      };
    },
    fetchPosts: async (accessToken) => {
      const fields = [
        'id', 'create_time', 'cover_image_url', 'share_url', 'embed_link',
        'video_description', 'title',
        'like_count', 'comment_count', 'share_count', 'view_count',
      ].join(',');
      const data = await tiktokDisplayCall(
        `https://open.tiktokapis.com/v2/video/list/?fields=${fields}`,
        accessToken,
        // max_count's ceiling is 20, and one page per sync is a DECISION, not a
        // stub — cursor paging was considered and declined. TikTok's rate limit is
        // per API client rather than per user, so walking one brand's full history
        // spends every brand's budget. A founder with 200 posts gets their newest
        // 20; that is the intended behaviour. Don't add paging here without a
        // per-brand throttle in front of it.
        { method: 'POST', body: JSON.stringify({ max_count: 20 }) },
        'video.list',
      );
      const videos = Array.isArray(data.videos) ? data.videos : [];
      return {
        hasMore: !!data.has_more,
        posts: videos.map(v => ({
          externalId: String(v.id),
          caption: v.title || v.video_description || null,
          coverImageUrl: v.cover_image_url || null,
          shareUrl: v.share_url || null,
          embedLink: v.embed_link || null,
          postedAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
          likeCount: v.like_count ?? null,
          commentCount: v.comment_count ?? null,
          shareCount: v.share_count ?? null,
          viewCount: v.view_count ?? null,
        })),
      };
    },
  },
  youtube: {
    envId: 'YOUTUBE_CLIENT_ID', envSecret: 'YOUTUBE_CLIENT_SECRET',
    authUrl: (redirectUri, state) => `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload')}&state=${state}`,
    getToken: async (code, redirectUri) => {
      const form = new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID, client_secret: process.env.YOUTUBE_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || 'YouTube token exchange failed');
      return { accessToken: data.access_token, refreshToken: data.refresh_token };
    },
    getHandle: async ({ accessToken }) => {
      const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      return data.items?.[0]?.snippet?.title || 'Connected';
    },
  },
  pinterest: {
    envId: 'PINTEREST_CLIENT_ID', envSecret: 'PINTEREST_CLIENT_SECRET',
    authUrl: (redirectUri, state) => `https://www.pinterest.com/oauth/?client_id=${process.env.PINTEREST_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('boards:read,pins:read,pins:write')}&state=${state}`,
    getToken: async (code, redirectUri) => {
      const basic = Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString('base64');
      const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      const response = await fetch('https://api.pinterest.com/v5/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Pinterest token exchange failed');
      return { accessToken: data.access_token, refreshToken: data.refresh_token };
    },
    getHandle: async ({ accessToken }) => {
      const response = await fetch('https://api.pinterest.com/v5/user_account', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      return data.username || 'Connected';
    },
  },
};

// TikTok's Display API answers HTTP 200 with a non-'ok' error.code on failure,
// so response.ok alone will happily hand you an empty result and call it success.
// Every read goes through here so that check can't be forgotten.
//
// The scope errors are translated because they are the expected state right now,
// not an edge case: the app has user.info.basic and nothing else until the
// revision is approved, so "not authorised" is what a founder will actually hit.
// `requiredScope` is not decoration. This helper is shared by the reads and by
// publishing, and naming the wrong scope in a scope error sends you to the wrong
// part of the developer portal — which it did: a publish blocked by a missing
// video.publish reported "video.list and user.info.stats" and read as the reads
// being broken when they were working fine.
async function tiktokDisplayCall(url, accessToken, options = {}, requiredScope = null) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));
  const code = payload.error?.code;

  if (code && code !== 'ok') {
    if (code === 'scope_not_authorized' || code === 'scope_permission_missed') {
      throw new Error(requiredScope
        ? `TikTok hasn't approved the ${requiredScope} permission yet, so this can't run until that review passes.`
        : "TikTok hasn't approved the permissions this needs yet.");
    }
    if (code === 'access_token_invalid' || code === 'access_token_expired') {
      throw new Error('This TikTok connection is no longer valid. Reconnect the account and try again.');
    }
    if (code === 'rate_limit_exceeded') {
      throw new Error('TikTok is rate-limiting us right now. Try again in a few minutes.');
    }
    // Deliberately not echoing payload.error.message — it is an upstream body,
    // and the audit's rule is that those don't get reflected back to a client.
    console.error('TikTok Display API error:', code, payload.error?.message, payload.error?.log_id);
    throw new Error('TikTok refused that request.');
  }
  if (!response.ok) {
    console.error('TikTok Display API HTTP error:', response.status);
    throw new Error('TikTok refused that request.');
  }
  return payload.data || {};
}

// The connected row is written here, with the service-role key, rather than
// handed to the browser for the client to insert. Migration 054 revokes SELECT on
// access_token/refresh_token and INSERT/UPDATE entirely, so this is now the only
// way a social account gets connected.
//
// Written to degrade rather than fail if 054 hasn't run yet: token_expires_at is
// dropped and the write retried, same pattern as psd_url elsewhere. An
// out-of-date database should lose the expiry tracking, not the connection.
async function persistSocialAccount(brandId, platform, handle, tokenData) {
  const base = {
    brand_id: brandId,
    platform: platform.toLowerCase(),
    handle,
    connected: true,
    access_token: tokenData.accessToken || null,
    refresh_token: tokenData.refreshToken || null,
  };
  const expiresAt = tokenData.expiresIn
    ? new Date(Date.now() + Number(tokenData.expiresIn) * 1000).toISOString()
    : null;

  let { error } = await supabase
    .from('social_accounts')
    .upsert({ ...base, token_expires_at: expiresAt }, { onConflict: 'brand_id, platform' });

  if (error && /token_expires_at/.test(error.message || '')) {
    ({ error } = await supabase
      .from('social_accounts')
      .upsert(base, { onConflict: 'brand_id, platform' }));
  }
  if (error) throw new Error(error.message);
}

// Loads a connected account and returns a usable access token, refreshing first
// if it is within the skew window. Refresh failure is surfaced rather than
// swallowed — a dead connection the user can reconnect beats a confusing 400
// from the platform two calls later.
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

async function getSocialAccessToken(brandId, platform) {
  const cfg = SOCIAL_OAUTH[platform];
  const { data: account, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('brand_id', brandId)
    .eq('platform', platform.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!account || !account.access_token) return null;

  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : null;
  const expiringSoon = expiresAt !== null && expiresAt - Date.now() < TOKEN_REFRESH_SKEW_MS;
  if (!expiringSoon || !cfg?.refresh || !account.refresh_token) return account.access_token;

  const refreshed = await cfg.refresh(account.refresh_token);
  await persistSocialAccount(brandId, platform, account.handle, refreshed);
  return refreshed.accessToken;
}

app.get('/api/social/auth/:platform', (req, res) => {
  const { platform } = req.params;
  const { brandId } = req.query;
  const cfg = SOCIAL_OAUTH[platform];
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  if (!brandId) return res.status(400).send('Missing brandId');
  if (!cfg) return res.status(400).send('Unsupported platform');
  if (!process.env[cfg.envId]) return res.redirect(`${appUrl}/content?social_error=missing_keys`);

  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  const redirectUri = `${apiUrl}/api/social/callback/${platform}`;
  const state = signOAuthState(brandId);
  res.redirect(cfg.authUrl(redirectUri, state));
});

app.get('/api/social/callback/:platform', async (req, res) => {
  const { platform } = req.params;
  const { code, state } = req.query;
  const cfg = SOCIAL_OAUTH[platform];
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  const brandId = verifyOAuthState(state);

  if (!code || !brandId || !cfg) return res.redirect(`${appUrl}/content?social_error=missing_params`);

  try {
    const redirectUri = `${apiUrl}/api/social/callback/${platform}`;
    const tokenData = await cfg.getToken(code, redirectUri);
    const handle = await cfg.getHandle(tokenData).catch(() => 'Connected');

    // What the token actually carries, not what we asked for. First thing to check
    // when a platform call fails with scope_not_authorized: if the scope isn't in
    // this line, the portal config is irrelevant — the request never asked for it.
    if (tokenData.grantedScopes) {
      console.log(`🔑 ${platform} token granted scopes: ${tokenData.grantedScopes}`);
    }

    // brandId came out of the HMAC-signed state, so it is safe to write against
    // without a user JWT — there isn't one on a platform redirect.
    await persistSocialAccount(brandId, platform, handle, tokenData);

    // The handoff still exists so the frontend learns the connection succeeded
    // and can refresh, but it no longer carries the tokens. /api/oauth/consume is
    // unauthenticated, so anything in this payload is readable by whoever holds
    // the code; a handle is fine, a bearer token was not.
    const handoffCode = createOAuthHandoff({ platform, handle, brandId });
    res.redirect(`${appUrl}/content?social_success=true&platform=${platform}&handoff=${handoffCode}&brandId=${brandId}`);
  } catch (err) {
    console.error(`${platform} OAuth Error:`, err);
    res.redirect(`${appUrl}/content?social_error=true`);
  }
});

// Real publish attempt — only Pinterest's connect flow actually requested a
// write scope (pins:write, granted at OAuth time). Instagram/TikTok were
// connected with read-only scopes (user_profile/user_media, user.info.basic)
// on purpose — real content-publish permissions on both platforms require a
// separate business-verified app review this integration doesn't have, so
// attempting the call would just fail in a confusing way. Rather than build
// a call guaranteed to fail, this says so plainly. YouTube did request an
// upload scope, but content_posts only stores an image_url — there's no
// video file to upload, so there's genuinely nothing to publish yet.
// ── TikTok photo publishing ────────────────────────────────────────────────
// Photo posts go through /v2/post/publish/content/init/ with media_type PHOTO and
// post_mode DIRECT_POST. The call returns a publish_id and completes
// asynchronously, so the result has to be polled — a 200 from init means "TikTok
// accepted the job", not "the post is live".
//
// PRIVACY: an unaudited client can only post SELF_ONLY (private). Requesting
// PUBLIC_TO_EVERYONE before the audit passes gets the call rejected outright, so
// the default here is the honest one and the env var is what widens it once the
// audit is done. The UI tells the user which of the two they're getting — quietly
// posting privately while implying public is the exact dishonesty this codebase
// is built to avoid.
const TIKTOK_PUBLISH_POLL_ATTEMPTS = 10;
const TIKTOK_PUBLISH_POLL_DELAY_MS = 3000;

async function publishTikTokPhoto(accessToken, { caption, mediaUrl }) {
  const privacyLevel = process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';
  const title = (caption || '').slice(0, 90);       // 90 UTF-16 runes, per spec
  const description = (caption || '').slice(0, 4000);

  const init = await tiktokDisplayCall(
    'https://open.tiktokapis.com/v2/post/publish/content/init/',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        post_info: { title, description, privacy_level: privacyLevel },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_images: [mediaUrl],
          photo_cover_index: 0,
        },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      }),
    },
    'video.publish',
  );

  const publishId = init.publish_id;
  if (!publishId) throw new Error('TikTok accepted the request but returned no publish id.');

  // Poll until TikTok reports the post published or failed. Bounded, because a
  // job that never resolves must not hold a request (or a scheduler tick) open.
  for (let attempt = 0; attempt < TIKTOK_PUBLISH_POLL_ATTEMPTS; attempt++) {
    await new Promise(resolve => setTimeout(resolve, TIKTOK_PUBLISH_POLL_DELAY_MS));
    const status = await tiktokDisplayCall(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      accessToken,
      { method: 'POST', body: JSON.stringify({ publish_id: publishId }) },
      'video.publish',
    );

    if (status.status === 'PUBLISH_COMPLETE') {
      // TikTok does not return a permalink here. Reporting the post as published
      // without a link is accurate; inventing a URL from the publish id would not
      // be. The next Sync picks the real post up with its share_url.
      return { externalUrl: Array.isArray(status.publicaly_available_post_id) && status.publicaly_available_post_id.length
        ? `https://www.tiktok.com/video/${status.publicaly_available_post_id[0]}`
        : null, privacyLevel };
    }
    if (status.status === 'FAILED') {
      throw new Error(`TikTok could not publish that post${status.fail_reason ? ` (${status.fail_reason})` : ''}.`);
    }
  }

  throw new Error('TikTok is still processing that post. It may still go live — check the app before retrying.');
}

// One publish path, used by BOTH the manual button and the scheduler, so the two
// can't drift into behaving differently. Throws with a user-facing message;
// returns { externalUrl } on success.
async function publishPost(platform, brandId, post) {
  const cfg = SOCIAL_OAUTH[platform];
  if (!cfg) throw new Error('Unsupported platform');

  const accessToken = await getSocialAccessToken(brandId, platform);
  if (!accessToken) throw new Error(`No connected ${platform} account for this brand.`);

  if (platform === 'tiktok') {
    if (!post.image_url) throw new Error('That post has no image to publish.');
    if (!process.env.API_URL) throw new Error('API_URL is not set, so TikTok has no verified address to pull the image from.');
    // TikTok pulls from our verified domain, not from Supabase directly.
    const mediaUrl = `${process.env.API_URL.replace(/\/+$/, '')}/api/media/content/${post.id}`;
    return publishTikTokPhoto(accessToken, { caption: post.caption, mediaUrl });
  }

  if (platform === 'pinterest') {
    if (!post.image_url) throw new Error('That post has no image to publish.');
    if (!post.board_id) throw new Error('Pinterest requires a board ID to pin to — add one in the post composer.');
    const response = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: post.board_id,
        title: (post.caption || '').slice(0, 100),
        description: post.caption || '',
        media_source: { source_type: 'image_url', url: post.image_url },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Pinterest rejected the pin');
    return { externalUrl: `https://www.pinterest.com/pin/${data.id}/` };
  }

  // Still honestly unsupported. Same wording as before — these need their own
  // platform review, and a call built to fail would just fail more confusingly.
  if (platform === 'instagram') {
    throw new Error("This Instagram connection only has read-only access (user_profile, user_media) — publishing needs Instagram's separate Business Login flow with a content-publish scope, which requires Meta App Review. Not attempted.");
  }
  if (platform === 'youtube') {
    throw new Error("This YouTube connection has upload access, but Content Hub only stores an image per post — there's no video file to upload yet, so there's nothing to publish.");
  }
  throw new Error('Unsupported platform');
}

// ── Media proxy for PULL_FROM_URL ──────────────────────────────────────────
// TikTok's photo posting supports ONLY PULL_FROM_URL — FILE_UPLOAD is video-only
// — and it will only pull from a domain the app has verified in the developer
// portal. Post media lives on *.supabase.co, which we don't own, so TikTok cannot
// fetch it directly. This serves the same bytes from api.atelierlabs.app, which is
// verified as a URL property.
//
// Deliberately unauthenticated: TikTok's servers do the fetching and carry no
// session. That is not a new exposure — content_media is a public bucket and
// these images already had public URLs — but it does mean the ONLY thing that
// makes this safe is the validation below.
//
// SSRF is the real risk here. image_url is written by the client, so without a
// check this route would fetch any URL a user could store and hand back the body,
// which is exactly the hole safeStoreUrl() exists to prevent elsewhere. So the
// stored URL is required to be the public object path of our own content_media
// bucket, matched against SUPABASE_URL — not merely "https", not "looks like
// Supabase". Anything else is refused without fetching it.
function contentMediaPrefix() {
  if (!process.env.SUPABASE_URL) return null;
  return `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/content_media/`;
}

app.get('/api/media/content/:postId', async (req, res) => {
  if (!supabase) return res.status(503).send('Storage is not configured.');
  const prefix = contentMediaPrefix();
  if (!prefix) return res.status(503).send('Storage is not configured.');

  try {
    const { data: post, error } = await supabase
      .from('content_posts').select('image_url').eq('id', req.params.postId).maybeSingle();
    if (error || !post || !post.image_url) return res.status(404).send('Not found.');

    // Exact-prefix match against our own bucket. A stored URL pointing anywhere
    // else — another host, another bucket, a private address — is refused here
    // rather than fetched and proxied.
    if (!post.image_url.startsWith(prefix)) {
      console.error('Refusing to proxy off-bucket media for post', req.params.postId);
      return res.status(400).send('Unsupported media location.');
    }

    const objectPath = decodeURIComponent(post.image_url.slice(prefix.length));
    // Downloaded through the service-role client rather than re-fetched over HTTP,
    // so there is no outbound request to a client-influenced URL at all.
    const { data: file, error: downloadError } = await supabase.storage
      .from('content_media').download(objectPath);
    if (downloadError || !file) return res.status(404).send('Not found.');

    const buffer = Buffer.from(await file.arrayBuffer());
    res.setHeader('Content-Type', file.type || 'image/png');
    res.setHeader('Content-Length', buffer.length);
    // TikTok may fetch more than once while a post initialises.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) {
    console.error('Media proxy failed:', err.message);
    res.status(500).send('Could not read that media.');
  }
});

// Pull the brand's own posts and follower count from the platform into
// social_posts_synced. Not metered — no AI model is involved, so it costs no
// credits; the rate limiter is what protects the shared platform quota.
app.post('/api/social/sync/:platform', requireAuth, socialSyncLimiter, async (req, res) => {
  const { platform } = req.params;
  const { brandId } = req.body;
  const cfg = SOCIAL_OAUTH[platform];

  if (!cfg) return res.status(400).json({ ok: false, error: 'Unsupported platform' });
  if (!brandId) return res.status(400).json({ ok: false, error: 'brandId is required.' });
  if (!(await verifyBrandAccess(req.user && req.user.id, brandId))) {
    return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });
  }
  if (!cfg.fetchPosts) {
    return res.status(400).json({ ok: false, error: `Reading posts from ${platform} isn't built yet — only TikTok is, and only once its review passes.` });
  }

  try {
    const accessToken = await getSocialAccessToken(brandId, platform);
    if (!accessToken) {
      return res.status(400).json({ ok: false, error: `No connected ${platform} account for this brand.` });
    }

    const { posts, hasMore } = await cfg.fetchPosts(accessToken);
    // Stats are secondary — a follower count we couldn't read shouldn't lose the
    // posts we could. Left null rather than guessed at.
    const stats = cfg.fetchStats ? await cfg.fetchStats(accessToken).catch(() => null) : null;

    if (posts.length) {
      const { error: upsertError } = await supabase.from('social_posts_synced').upsert(
        posts.map(p => ({
          brand_id: brandId,
          platform,
          external_id: p.externalId,
          caption: p.caption,
          cover_image_url: p.coverImageUrl,
          share_url: p.shareUrl,
          embed_link: p.embedLink,
          posted_at: p.postedAt,
          like_count: p.likeCount,
          comment_count: p.commentCount,
          share_count: p.shareCount,
          view_count: p.viewCount,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'brand_id, platform, external_id' },
      );
      if (upsertError) throw new Error(upsertError.message);
    }

    // Prune posts the user has since deleted on the platform — but ONLY when this
    // sync saw their whole list. With has_more true we're looking at the newest
    // page, and anything older would be deleted for being absent from a window it
    // was never in.
    if (!hasMore) {
      // Digits only: these go into a PostgREST `in.(...)` list, which is a string
      // filter, so an id carrying a comma or a quote would change the query's
      // shape rather than just failing. TikTok ids are numeric; anything that
      // isn't gets left out of the keep-list rather than trusted.
      const keptIds = posts.map(p => p.externalId).filter(id => /^\d+$/.test(id));
      let prune = supabase.from('social_posts_synced').delete()
        .eq('brand_id', brandId).eq('platform', platform);
      if (keptIds.length) prune = prune.not('external_id', 'in', `(${keptIds.join(',')})`);
      const { error: pruneError } = await prune;
      if (pruneError) console.error('Pruning removed posts failed:', pruneError.message);
    }

    const accountUpdate = { stats_synced_at: new Date().toISOString() };
    if (stats?.followers !== null && stats?.followers !== undefined) accountUpdate.followers = stats.followers;
    if (stats?.handle) accountUpdate.handle = stats.handle;

    let { error: accountError } = await supabase.from('social_accounts')
      .update(accountUpdate).eq('brand_id', brandId).eq('platform', platform);
    // Degrade rather than fail if 055 hasn't run — the posts are already saved,
    // and losing the "synced at" stamp is a smaller loss than losing the sync.
    if (accountError && /stats_synced_at/.test(accountError.message || '')) {
      const { stats_synced_at, ...withoutStamp } = accountUpdate;
      if (Object.keys(withoutStamp).length) {
        ({ error: accountError } = await supabase.from('social_accounts')
          .update(withoutStamp).eq('brand_id', brandId).eq('platform', platform));
      } else {
        accountError = null;
      }
    }
    if (accountError) console.error('Updating synced account failed:', accountError.message);

    res.json({ ok: true, synced: posts.length, followers: stats?.followers ?? null });
  } catch (err) {
    console.error(`${platform} sync failed:`, err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Writes the outcome onto the post. Kept in one place so the manual button and
// the scheduler record a publish identically — a status the two paths disagreed
// about would be worse than either being wrong.
//
// Media is deliberately NOT deleted after publishing. An earlier version of this
// plan said it should be, on the grounds that the file was only needed until the
// post went up. That was wrong: image_url is also what renders the post in the
// user's own calendar and history, so deleting it saves cents and breaks the
// screen they planned in. Revisit when video lands and the numbers are real.
async function recordPublishResult(postId, { externalUrl = null, error = null }) {
  const update = error
    ? { status: 'Failed', publish_error: error }
    : { status: 'Posted', published_at: new Date().toISOString(), external_url: externalUrl, publish_error: null };

  const { error: writeError } = await supabase
    .from('content_posts').update(update).eq('id', postId);

  // Degrade if 056 hasn't run: the status still has to land, or a published post
  // sits in 'Publishing' forever and gets retried.
  if (writeError && /external_url|published_at|publish_error/.test(writeError.message || '')) {
    const { error: fallbackError } = await supabase
      .from('content_posts').update({ status: update.status }).eq('id', postId);
    if (fallbackError) console.error('Recording publish result failed:', fallbackError.message);
    return;
  }
  if (writeError) console.error('Recording publish result failed:', writeError.message);
}

// The access token is no longer accepted from the client. It used to arrive in
// the request body, read straight out of social_accounts in the browser, which
// meant every member of a brand — including viewers — held the brand's platform
// credential. It is now looked up server-side from brandId. See migration 054.
//
// Takes a postId rather than loose caption/imageUrl fields, so the server reads
// what it is publishing from the row it will then stamp — the client cannot
// publish one thing and have a different thing recorded.
app.post('/api/social/publish/:platform', requireAuth, async (req, res) => {
  const { platform } = req.params;
  const { brandId, postId, boardId } = req.body;

  if (!SOCIAL_OAUTH[platform]) return res.status(400).json({ ok: false, error: 'Unsupported platform' });
  if (!brandId) return res.status(400).json({ ok: false, error: 'brandId is required.' });
  if (!postId) return res.status(400).json({ ok: false, error: 'postId is required.' });
  if (!(await verifyBrandAccess(req.user && req.user.id, brandId))) {
    return res.status(403).json({ ok: false, error: 'You do not have access to this brand.' });
  }

  const { data: post, error: postError } = await supabase
    .from('content_posts').select('*').eq('id', postId).eq('brand_id', brandId).maybeSingle();
  if (postError || !post) return res.status(404).json({ ok: false, error: 'That post no longer exists.' });
  // published_at, not status: the status tag is user-editable, so it can be cycled
  // away from 'Posted' and would let the same post go out twice. Same reasoning as
  // the claim in 056.
  if (post.published_at || post.status === 'Posted') {
    return res.status(400).json({ ok: false, error: 'That post has already been published.' });
  }

  try {
    const result = await publishPost(platform, brandId, { ...post, board_id: boardId });
    await recordPublishResult(post.id, { externalUrl: result.externalUrl });
    res.json({
      ok: true,
      externalUrl: result.externalUrl,
      // Surfaced so the UI can say "posted privately" rather than let the user
      // assume it went out publicly while the app is still unaudited.
      privacyLevel: result.privacyLevel || null,
    });
  } catch (err) {
    console.error(`${platform} publish failed:`, err.message);
    await recordPublishResult(post.id, { error: err.message });
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------
// 9. CHAT ASSISTANT
// ---------------------------------------------------------
// The frontend gathers a text summary of the brand's own products/vendors/
// etc. from its already-loaded contexts (same "client assembles context,
// server just prompts" shape as /api/dashboard-suggestions) and posts it
// here alongside the message and a short prior-turn transcript. callGemini
// always asks for JSON back, so a conversational reply gets wrapped in a
// single { "reply": "..." } object rather than returned as raw text.
app.post('/api/chat-reply', requireTier('premium'), metered('chat-reply'), async (req, res) => {
  console.log("📥 Received chat message...");
  try {
    const { message, history, brandContext } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ ok: false, error: 'No message provided' });

    const transcript = (history || [])
      .slice(-20)
      .map(h => `${h.senderType === 'ai' ? 'Assistant' : 'Founder'}: ${h.body}`)
      .join('\n');

    const prompt = `You are a helpful assistant embedded inside Atelier, a tool an independent clothing brand founder uses to manage design, tech packs, vendors, and production. Answer the founder's question using ONLY the brand data given below plus general apparel-industry knowledge — never invent specific numbers, vendor names, or product details that aren't in the data given to you.

Brand data:
${brandContext || 'No brand data available.'}
${transcript ? `\nConversation so far:\n${transcript}\n` : ''}
Founder's new message: "${message}"

Be concise and direct — a couple of short paragraphs or a short list at most, not an essay. If the brand data doesn't contain what's needed to answer confidently, say so plainly instead of guessing.

Return a JSON object with exactly this structure:
{ "reply": "string, plain text, use \\n for line breaks, no markdown headers or bullet asterisks" }`;

    const result = await callGemini(prompt + brandProfileBlock(req.body.brandProfile));
    console.log("✅ Chat reply successful");
    res.json({ ok: true, reply: result.reply });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 10. RFQ & QUOTE ECONOMICS
// ---------------------------------------------------------
// Fixed set of common apparel cost levers for the AI Cost Simulator — a
// curated list rather than something AI invents per-call, so the UI can show
// a stable set of toggles ("like configuring a car") instead of a different
// random list every time.
const COST_LEVERS = [
  {
    id: 'gsm', label: 'Fabric weight (GSM)', type: 'choice',
    options: [
      { id: 'gsm-220', label: '~220 GSM (lightweight)' },
      { id: 'gsm-320', label: '~320 GSM (midweight)' },
      { id: 'gsm-380', label: '~380 GSM (standard heavyweight)' },
      { id: 'gsm-450', label: '~450 GSM (heavy)' },
      { id: 'gsm-550', label: '~550 GSM (heaviest)' },
    ],
  },
  { id: 'add-embroidery', label: 'Add embroidery or a printed detail', type: 'toggle', hint: 'one placement, standard size' },
  { id: 'organic-cotton', label: 'Switch to organic/premium cotton', type: 'toggle', hint: 'vs. standard cotton blend' },
  { id: 'move-region', label: 'Move production to a higher-cost region', type: 'toggle', hint: 'e.g. Portugal/EU instead of current sourcing' },
  { id: 'smaller-moq', label: 'Cut order quantity to a smaller MOQ tier', type: 'toggle', hint: 'per-unit cost typically rises' },
  { id: 'premium-trim', label: 'Add a premium trim (woven label, metal hardware)', type: 'toggle', hint: '' },
];

app.post('/api/quote-economics', requireTier('basic'), metered('quote-economics'), async (req, res) => {
  console.log("📥 Received quote economics request...");
  try {
    const { vendor, product, quote, bom } = req.body;
    if (!quote || quote.amount == null) return res.status(400).json({ ok: false, error: 'This quote needs an amount before economics can be estimated.' });

    const totalAmount = Number(quote.amount);
    const fabricCost = (bom || []).reduce((sum, b) => sum + ((parseFloat(b.qtyPerUnit) || 0) * (parseFloat(b.unitCost) || 0)), 0);
    const fabricPercent = totalAmount > 0 ? Math.min(100, (fabricCost / totalAmount) * 100) : 0;
    const remainingPercent = Math.max(0, 100 - fabricPercent);

    const prompt = `You are a costing analyst helping an independent clothing brand founder understand where their per-unit quoted price actually goes.

Product: ${product?.name || 'unknown'} (${product?.category || 'unspecified category'})
Vendor: ${vendor?.name || 'unknown'}, location: ${vendor?.location || 'unknown'}
Quoted unit price: $${totalAmount.toFixed(2)}
Real bill-of-materials fabric/trim cost (already computed, do not change it): $${fabricCost.toFixed(2)} (${fabricPercent.toFixed(1)}% of the quoted price)
Order quantity: ${quote?.preferences?.quantity || 'unspecified'}

The fabric percentage above is fixed and real — your job is only to split the REMAINING ${remainingPercent.toFixed(1)}% of the quoted price across Labor, Shipping, Packaging, and Profit (margin the vendor is likely keeping), based on typical cut-and-sew economics for this kind of garment, vendor location, and order size. These four numbers must sum to exactly ${remainingPercent.toFixed(1)}.

Also give a rough shipping cost estimate per unit (freight from ${vendor?.location || 'the vendor'} to the brand, for this order size) and a rough import duty rate estimate (as a percent, based on general HS-code ballparks for this garment category) — both clearly framed as rough planning estimates, not customs or tax advice.

Return a JSON object with exactly this structure:
{
  "laborPercent": <number>,
  "shippingPercent": <number>,
  "packagingPercent": <number>,
  "profitPercent": <number>,
  "shippingEstimatePerUnit": <number>,
  "shippingNote": "one short sentence",
  "dutyRatePercent": <number>,
  "dutyNote": "one short sentence, including a reminder this isn't customs/tax advice"
}`;

    const result = await callGemini(prompt + brandProfileBlock(req.body.brandProfile));
    console.log("✅ Quote economics successful");
    res.json({
      ok: true,
      breakdown: {
        fabricCost, fabricPercent,
        laborPercent: result.laborPercent, shippingPercent: result.shippingPercent,
        packagingPercent: result.packagingPercent, profitPercent: result.profitPercent,
      },
      shippingEstimatePerUnit: result.shippingEstimatePerUnit,
      shippingNote: result.shippingNote,
      dutyRatePercent: result.dutyRatePercent,
      dutyNote: result.dutyNote,
    });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Basic, not Premium: the simulator runs on a quote in QuoteDetail, and quotes
// are a Basic feature. Gating it Premium would have refused a line Basic
// explicitly advertises ("Landed-cost calculator and AI cost simulator").
// The Premium financial tools are the separate cash-flow/MOQ page.
app.post('/api/cost-simulator', requireTier('basic'), metered('cost-simulator'), async (req, res) => {
  console.log("📥 Received cost simulator request...");
  try {
    const { vendor, product, quote, bom } = req.body;

    const prompt = `You are a costing analyst helping an independent clothing brand founder understand how specific changes would move their per-unit production cost — like a car configurator showing the price impact of each option.

Product: ${product?.name || 'unknown'} (${product?.category || 'unspecified category'})
Vendor: ${vendor?.name || 'unknown'}, location: ${vendor?.location || 'unknown'}
Current quoted unit price: ${quote?.amount != null ? `$${Number(quote.amount).toFixed(2)}` : 'not yet quoted — estimate from typical costs for this category'}
Current bill of materials: ${bom && bom.length ? bom.map(b => `${b.material} (${b.qtyPerUnit || '?'}/unit, ~$${b.unitCost || '?'})`).join(', ') : 'none on file'}

For EACH of the following possible changes, estimate the per-unit cost delta in dollars (positive = more expensive, can be negative if plausible) versus the current quoted price, if this single change were made on its own, holding everything else constant:
${COST_LEVERS.map(l => l.type === 'choice'
    ? `- id "${l.id}" (${l.label}) has MULTIPLE mutually-exclusive options — estimate a separate delta for EACH: ${l.options.map(o => `"${o.id}" (${o.label})`).join(', ')}`
    : `- id "${l.id}": ${l.label}${l.hint ? ` (${l.hint})` : ''}`
  ).join('\n')}

Return a JSON object with exactly this structure:
{
  "levers": [
    { "id": "a toggle lever id from above", "deltaPerUnit": <number, dollars>, "note": "under 12 words explaining why" }
  ],
  "choiceLevers": [
    { "id": "a choice lever id from above (e.g. gsm)", "options": [ { "id": "the option id, e.g. gsm-450", "deltaPerUnit": <number, dollars>, "note": "under 10 words" } ] }
  ]
}
Include one "levers" entry for every non-choice id, and one "choiceLevers" entry (with every one of its listed option ids) for every choice id.`;

    const result = await callGemini(prompt + brandProfileBlock(req.body.brandProfile));
    console.log("✅ Cost simulator successful");
    res.json({ ok: true, levers: result.levers || [], choiceLevers: result.choiceLevers || [] });
  } catch (error) {
    console.error('❌ Endpoint Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 9. HEALTH CHECK (For Railway)
// ---------------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).json({ ok: true, message: 'Atelier API is running successfully.' });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});


// ---------------------------------------------------------
// 10. SHOPIFY MANDATORY GDPR WEBHOOKS (Required for App Store Review)
// ---------------------------------------------------------
// These endpoints are legally mandated by Shopify. They do not need complex
// database logic for your app, but they MUST verify the HMAC and respond 401
// to an unverified request — Shopify's automated review explicitly tests that,
// and an endpoint that 200s for anyone is an unauthenticated endpoint whether
// or not it currently does anything.
function shopifyWebhookGuard(req, res, next) {
  if (!verifyShopifySignature(req.rawBody, req.headers['x-shopify-hmac-sha256'])) {
    console.warn('⚠️ Unauthorized Shopify GDPR webhook attempt');
    return res.status(401).send('Unauthorized');
  }
  return next();
}

app.post('/api/shopify/webhooks/customers/data_request', shopifyWebhookGuard, (req, res) => {
  console.log("📥 Shopify GDPR Webhook: Customer Data Request");
  res.status(200).send('OK');
});

app.post('/api/shopify/webhooks/customers/redact', shopifyWebhookGuard, (req, res) => {
  console.log("📥 Shopify GDPR Webhook: Customer Redact");
  res.status(200).send('OK');
});

app.post('/api/shopify/webhooks/shop/redact', shopifyWebhookGuard, (req, res) => {
  console.log("📥 Shopify GDPR Webhook: Shop Redact");
  res.status(200).send('OK');
});



// Deploy verification for error monitoring: throws on purpose so you can
// confirm events arrive in Sentry. Covered by the global rate limiter, and
// only meaningful when SENTRY_DSN is configured.
app.get('/api/debug-sentry', () => {
  throw new Error('Sentry backend test event — wiring works.');
});

// Sentry must see errors before the last-resort handler converts them into
// generic 500 responses.
if (Sentry) Sentry.setupExpressErrorHandler(app);

// Unknown route → generic 404 (no framework/route details leaked).
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Last-resort error handler: log the real error server-side, return a generic
// message to the client so stack traces / internal details never leak.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  const status = err && err.status ? err.status : 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : (err.message || 'Error') });
});

// ---------------------------------------------------------
// SCHEDULED PUBLISHING
// ---------------------------------------------------------
// What makes `scheduled_for` mean something. Ticks, claims whatever is due, and
// publishes it.
//
// ── WHY IN-PROCESS, NOT pg_cron ─────────────────────────────────────────────
// The earlier plan called for pg_cron + pg_net on the grounds that a Railway
// restart would drop due posts. That reasoning was wrong: due posts are found by
// querying content_posts, not held in memory, so a restart misses one tick and
// the next one picks the same rows up. Given that, an in-process ticker needs no
// extensions, no stored secret, and no second system to keep in sync.
//
// The genuine risk — two instances publishing the same post — is handled in the
// database by claim_due_content_posts (FOR UPDATE SKIP LOCKED), not by assuming
// there is only one instance.
//
// ── ON WHEN DEPLOYED, OFF ON A LAPTOP ───────────────────────────────────────
// The thing worth preventing is real: api/.env points a local machine at the
// production database, so a default-on scheduler would publish real posts to real
// accounts from a laptop running `node index.js`.
//
// But that does NOT need a hand-set variable, which was the first version of this
// and was simply over-engineered — it made a deployment step out of something the
// platform already tells us. Railway injects RAILWAY_ENVIRONMENT into every
// deploy and nothing sets it locally, so "am I deployed?" is already answerable.
//
// ENABLE_PUBLISH_SCHEDULER is still honoured when explicitly set, in either
// direction: 'true' to run it locally on purpose, 'false' to stop it in
// production without a code change. Unset — the normal case — it just works.
function schedulerEnabled() {
  const override = process.env.ENABLE_PUBLISH_SCHEDULER;
  if (override === 'true') return true;
  if (override === 'false') return false;
  return !!process.env.RAILWAY_ENVIRONMENT;
}
const SCHEDULER_INTERVAL_MS = 60 * 1000;
const SCHEDULER_BATCH = 5;
let schedulerRunning = false;
let schedulerMigrationWarned = false;

async function runScheduledPublishes() {
  // A tick that overruns the interval must not stack up behind itself; the rows
  // it claimed are already marked 'Publishing', so skipping is safe.
  if (schedulerRunning || !supabase) return;
  schedulerRunning = true;

  try {
    const { data: claimed, error } = await supabase.rpc('claim_due_content_posts', { p_limit: SCHEDULER_BATCH });

    if (error) {
      // Migration 056 not run yet. Say so once rather than every minute.
      if (!schedulerMigrationWarned) {
        console.warn('⚠️  Scheduled publishing is idle:', error.message, '— run migration 056.');
        schedulerMigrationWarned = true;
      }
      return;
    }
    schedulerMigrationWarned = false;
    if (!claimed || !claimed.length) return;

    console.log(`📆 Publishing ${claimed.length} due post(s)...`);
    for (const post of claimed) {
      try {
        const result = await publishPost(post.platform, post.brand_id, post);
        await recordPublishResult(post.id, { externalUrl: result.externalUrl });
        console.log(`✅ Published ${post.id} to ${post.platform}`);
      } catch (err) {
        // Recorded on the row, not just logged, so the user sees why in the UI.
        // publish_attempts caps the retries; after that it stays Failed.
        console.error(`❌ Publish failed for ${post.id} (${post.platform}):`, err.message);
        await recordPublishResult(post.id, { error: err.message });
      }
    }
  } catch (err) {
    console.error('Scheduler tick failed:', err.message);
  } finally {
    schedulerRunning = false;
  }
}

const PORT = process.env.PORT || 3001;
// Explicitly bind to '0.0.0.0' so Railway's proxy can route traffic to it
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧠 Backend running on port ${PORT}`);

  if (schedulerEnabled()) {
    setInterval(runScheduledPublishes, SCHEDULER_INTERVAL_MS);
    console.log(`📆 Scheduled publishing on, checking every ${SCHEDULER_INTERVAL_MS / 1000}s`);
  } else {
    console.log('📆 Scheduled publishing off — not a deployed environment (ENABLE_PUBLISH_SCHEDULER=true overrides)');
  }
});

// One-time setup: ensures the Basic ($29.99/mo) and Premium ($79.99/mo) Stripe
// Products + Prices exist for whichever key is in api/.env, and reports the
// resulting Price IDs. Safe to re-run — it never creates something it can find.
//
// TEST vs LIVE matters here:
//   sk_test_… — writes the Price IDs into api/.env, because that file is the
//               local dev config and test IDs belong there.
//   sk_live_… — prints the Price IDs and writes NOTHING. Live IDs belong in
//               Railway's env vars, not in a file on a laptop; silently
//               overwriting api/.env with live IDs is how a local dev server
//               ends up charging real cards.
//
// Prices are immutable in Stripe: changing an amount means creating a NEW price
// and re-pointing the env var at it. That's why matching is by amount, not id.
//
// Usage: add STRIPE_SECRET_KEY to api/.env, then from the api/ folder run:
//   node scripts/setup-stripe-products.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('❌ STRIPE_SECRET_KEY is not set in api/.env — add it first.');
  process.exit(1);
}

const IS_LIVE = key.startsWith('sk_live');
const stripe = require('stripe')(key);
const ENV_PATH = path.join(__dirname, '..', '.env');

// `aliases` are the other names the same product may already carry — the live
// account's products were created by hand as plain "Basic"/"Premium". Without
// this the search misses them and the script cheerfully creates a duplicate
// product that no price ID points at.
const TIERS = [
  { name: 'Atelier Basic', aliases: ['Basic'], envKey: 'STRIPE_PRICE_BASIC', unitAmount: 2999 },
  { name: 'Atelier Premium', aliases: ['Premium'], envKey: 'STRIPE_PRICE_PREMIUM', unitAmount: 7999 },
];

async function findProduct(names) {
  for (const n of names) {
    const found = await stripe.products.search({ query: `name:'${n}' AND active:'true'` });
    if (found.data[0]) return found.data[0];
  }
  return null;
}

async function ensureProductAndPrice({ name, aliases = [], unitAmount }) {
  let product = await findProduct([name, ...aliases]);
  if (!product) {
    product = await stripe.products.create({ name });
    console.log(`Created product: ${name}`);
  } else {
    console.log(`Found existing product: ${product.name} (${product.id})`);
  }

  const prices = await stripe.prices.list({ product: product.id, active: true });
  let price = prices.data.find(p => p.unit_amount === unitAmount && p.recurring?.interval === 'month');
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`Created price for ${product.name}: ${price.id} ($${(unitAmount / 100).toFixed(2)}/mo)`);
  } else {
    console.log(`Found existing price for ${product.name}: ${price.id} ($${(unitAmount / 100).toFixed(2)}/mo)`);
  }
  return price.id;
}

async function main() {
  console.log(IS_LIVE
    ? '⚠️  LIVE MODE — real products and prices. api/.env will NOT be modified.\n'
    : '🧪 TEST MODE — price IDs will be written to api/.env.\n');

  const results = {};
  for (const tier of TIERS) {
    results[tier.envKey] = await ensureProductAndPrice(tier);
  }

  if (IS_LIVE) {
    console.log('\n✅ Done. Set these in Railway (Variables), then redeploy:');
    Object.entries(results).forEach(([k, v]) => console.log(`   ${k}=${v}`));
    console.log('\nAlso confirm STRIPE_WEBHOOK_SECRET is the LIVE endpoint secret,');
    console.log('and that the live webhook subscribes to invoice.paid,');
    console.log('checkout.session.completed and customer.subscription.deleted');
    console.log('(run scripts/setup-stripe-webhook.js to fix that).');
    return;
  }

  let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  for (const [envKey, value] of Object.entries(results)) {
    const line = `${envKey}=${value}`;
    const regex = new RegExp(`^${envKey}=.*$`, 'm');
    if (regex.test(envContent)) envContent = envContent.replace(regex, line);
    else envContent += (envContent.endsWith('\n') || envContent === '' ? '' : '\n') + line + '\n';
  }
  fs.writeFileSync(ENV_PATH, envContent);

  console.log('\n✅ Done. Added to api/.env:');
  Object.entries(results).forEach(([k, v]) => console.log(`   ${k}=${v}`));
  console.log('\nRestart the backend (node index.js) to pick these up.');
}

main().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});

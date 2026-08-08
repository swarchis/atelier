// The feature reference, as data.
//
// One source for both the in-app /guide page and the shareable web version, so
// the two cannot drift. Every item carries WHERE it lives, because "I couldn't
// find it" was the actual complaint — a description without a location is a
// feature the reader still can't reach.
//
// `plan` values match la-guia/src/data/entitlements.js. `cost` is credits, from
// api/config/aiCredits.js. Keep all three in step.

export const GUIDE_INTRO =
  "Atelier runs one path: an idea becomes a design, the design becomes a tech pack, the tech pack goes " +
  "out to factories, a factory makes samples, samples become a production run, and the run goes on sale. " +
  "The sections below follow that path. Skip any of them, do them out of order if you like, but this is " +
  "the shape the app was built around.";

export const GUIDE = [
  {
    id: 'design',
    num: '01',
    title: 'Design',
    hue: 'var(--c-design)',
    nav: 'Designs · Collections',
    lede: 'Where a piece starts. Draw it, upload it, or have AI draft a blank mockup to work over. The canvas is a full Photopea editor with real layers and real PSD files, and it saves while you work.',
    groups: [
      {
        title: 'The canvas',
        items: [
          { name: 'Design canvas', where: 'Designs → open a piece → Canvas', desc: 'Layered editor with autosave. Start from a preset garment, your own sketch, or a PSD you already have.', plan: 'free' },
          { name: 'Version history', where: 'Designs → open a piece → History & Comments', desc: 'Every save is kept. Reopen any earlier version with its layers intact, or leave a comment for a teammate.', plan: 'free' },
          { name: 'Save as a reusable mockup', where: 'Designs → open a piece → Save as mockup', desc: 'Keep a base block you have perfected and start future designs from it.', plan: 'free' },
          { name: 'Assets & media', where: 'Designs → open a piece → Assets & Media', desc: 'Files attached to this piece: uploads, exports and generated images.', plan: 'free' },
          { name: 'Collections', where: 'Sidebar → Collections', desc: 'Group pieces into a drop or capsule, with a shared launch window and total cost.', plan: 'free' },
          { name: 'Moodboards, palettes and fabric tags', where: 'Designs → open a piece → Inspiration', desc: 'Pin references, colours and fabric notes so the intent travels with the piece into the tech pack.', plan: 'free' },
        ],
      },
      {
        title: 'AI Studio',
        note: 'Eleven tools, all working on the design you have open.',
        items: [
          { name: 'Sketch to Design', where: 'Designs → open a piece → AI Studio', desc: 'Upload a hand drawing and get a clean mockup with the details kept.', cost: 15, plan: 'basic' },
          { name: 'Polish Design', where: 'AI Studio', desc: 'Render what is on the canvas as a finished mockup.', cost: 15, plan: 'basic' },
          { name: 'AI Edit', where: 'AI Studio', desc: 'Describe any change in plain English.', cost: 15, plan: 'basic' },
          { name: 'Recolor', where: 'AI Studio', desc: 'Change the garment colour and keep everything else exactly as drawn.', cost: 15, plan: 'basic' },
          { name: 'Fabric Swap', where: 'AI Studio', desc: 'Swap the fabric, keep the silhouette.', cost: 15, plan: 'basic' },
          { name: 'Background Remover', where: 'AI Studio', desc: 'Cut the garment out onto transparency.', cost: 15, plan: 'basic' },
          { name: 'Flat Sketch', where: 'AI Studio', desc: 'Technical line art in tech-pack style.', cost: 15, plan: 'basic' },
          { name: 'Mockup Generator', where: 'AI Studio', desc: 'Turn the design into a product photo.', cost: 15, plan: 'basic' },
          { name: 'Generate a View', where: 'AI Studio', desc: 'Another angle of the same garment. It lands beside your current view on the same canvas, so you can see front and back together.', cost: 15, plan: 'basic' },
          { name: 'Silhouette generator', where: 'AI Studio', desc: 'A blank garment mockup from nothing at all. Choose Draft, Standard or High quality.', cost: '5 · 15 · 50', plan: 'basic' },
          { name: 'Add Element', where: 'AI Studio', desc: 'Generate a logo or graphic and drop it in as its own layer.', cost: 10, plan: 'basic' },
          { name: 'Pattern Generator', where: 'AI Studio', desc: 'A standalone tileable pattern swatch.', cost: 10, plan: 'basic' },
        ],
      },
      {
        title: 'Feedback and variations',
        items: [
          { name: 'Design review', where: 'Designs → open a piece → Review this design', desc: 'Scores how ready the design is to become a tech pack across seven weighted dimensions, and names what is still undecided.', cost: 5, plan: 'basic' },
          { name: 'Colour palette', where: 'Designs → open a piece → Inspiration', desc: 'Pull a coherent palette from the piece.', cost: 3, plan: 'basic' },
          { name: 'Trend inspiration', where: 'Designs → open a piece → Inspiration', desc: 'What is current in this category, from live web search.', cost: 10, plan: 'basic' },
          { name: 'Image variants', where: 'Designs → open a piece → Image Variants', desc: 'Colourway and detail variations side by side for comparison.', plan: 'basic' },
          { name: 'SKUs & variants', where: 'Designs → open a piece → SKUs & Variants', desc: 'The colourway × size matrix, with a generated SKU code for each combination.', plan: 'free' },
        ],
      },
    ],
    callout: {
      title: 'The review is meant to be harsh',
      body: 'A good-looking sketch with nothing decided scores in the 30s. That is the intended behaviour. It asks one question: could someone else write a tech pack from this drawing without coming back to ask what you meant?',
    },
  },

  {
    id: 'techpack',
    num: '02',
    title: 'Tech Pack',
    hue: 'var(--c-techpack)',
    nav: 'Tech Packs · Material Library',
    lede: 'The document a factory quotes from. Nine tabs, because a real tech pack carries nine kinds of information.',
    tabs: ['Overview', 'Bill of Materials', 'Measurements', 'Construction', 'Print & Trims', 'Labels & Packaging', 'Materials & Notes', 'Sampling', 'History & Approval'],
    groups: [
      {
        title: 'Building it',
        items: [
          { name: 'Manual builder', where: 'Tech Packs → open one', desc: 'Fill in every section yourself. No part of it is gated.', plan: 'free' },
          { name: 'AI draft from a questionnaire', where: 'Tech Packs → open one → Generate with AI', desc: 'Answer a few questions on materials, sizing and construction; Atelier drafts the bill of materials and measurement charts. Read every line before it leaves your hands.', cost: '5–10', plan: 'basic' },
          { name: 'Measurements and grading', where: 'Tech Packs → Measurements', desc: 'Points of measure per size across the size run.', plan: 'free' },
          { name: 'Approval workflow', where: 'Tech Packs → History & Approval', desc: 'Snapshot a version, send it for approval, and keep a record of who signed off and when.', plan: 'free' },
          { name: 'Export', where: 'Tech Packs → Export', desc: 'Branded PDF and spreadsheet (CSV).', plan: 'free' },
        ],
      },
      {
        title: 'Materials',
        items: [
          { name: 'Material Library', where: 'Sidebar → Material Library', desc: 'Fabrics, trims and notions with handling warnings, risk level and sustainability notes.', plan: 'free' },
          { name: 'Cost history and suppliers', where: 'Material Library → open a material → Cost & Suppliers', desc: 'What you have paid over time, and which vendors supply it.', plan: 'free' },
          { name: 'Where a material is used', where: 'Material Library → open a material → Usage', desc: 'Every product whose bill of materials includes it.', plan: 'free' },
          { name: 'Auto-fill from your BOM', where: 'Automatic when you save a tech pack', desc: 'Every material named in the bill of materials is added to your library, researched from the web. Charged once per save however many materials are new.', cost: 10, plan: 'basic' },
        ],
      },
      {
        title: 'Checking it',
        items: [
          { name: 'Readiness Review', where: 'Sidebar → Readiness Review', desc: 'Every product checked against the factory-readiness gate at once, worst first.', plan: 'basic' },
          { name: 'Readiness score', where: 'Shown on each product', desc: 'Rises as the pack fills in. Sending an RFQ needs 80%.', plan: 'free' },
        ],
      },
    ],
    callout: {
      title: 'What the 80% gate does',
      body: 'A product below 80% readiness is blocked from sending an RFQ. A checkbox lets you send it anyway. The gate is there to make you look before you commit a factory’s time, and it will step aside when you are sure.',
    },
  },

  {
    id: 'sourcing',
    num: '03',
    title: 'Sourcing & Quotes',
    hue: 'var(--c-vendors)',
    nav: 'Vendors · Quotes & Pricing',
    lede: 'Finding factories, asking them for prices, and comparing what comes back.',
    groups: [
      {
        title: 'Finding factories',
        items: [
          { name: 'Vendor search', where: 'Vendors → Discover & Compare → Search', desc: 'Searches the live web for manufacturers by material, category, location, MOQ, target price and certification, and fills in a contact email where the factory publishes one.', cost: 10, plan: 'basic' },
          { name: 'Add a vendor by hand', where: 'Vendors → Add vendor', desc: 'Paste in factories you already know, including their contact email.', plan: 'free' },
          { name: 'Import from a listing', where: 'Vendors → Add vendor → paste text', desc: 'Paste a directory listing or email and Atelier pulls out the fields.', cost: 5, plan: 'basic' },
          { name: 'Favourites and blocking', where: 'Vendors → Favorites · Blocked', desc: 'Star the ones worth keeping. Block the ones that wasted your time, and they stop appearing.', plan: 'free' },
        ],
      },
      {
        title: 'Judging them',
        items: [
          { name: 'Fit analysis', where: 'Vendors → open a vendor → Assess fit', desc: 'Scores this vendor against one specific product, its budget and its bill of materials.', cost: 5, plan: 'basic' },
          { name: 'Compare side by side', where: 'Vendors → Compare', desc: 'Up to five vendors on MOQ, lead time, price, certifications and capabilities.', plan: 'basic' },
          { name: 'Trust labels and verification', where: 'Vendors → open a vendor', desc: 'Mark a vendor verified yourself and record what you checked. Atelier never marks one verified for you.', plan: 'free' },
          { name: 'Onboarding stage', where: 'Vendors → open a vendor', desc: 'Prospect, contacted, sampling, onboarded — where each relationship stands.', plan: 'free' },
          { name: 'Price history', where: 'Vendors → open a vendor', desc: 'What this vendor has quoted you over time.', plan: 'free' },
        ],
      },
      {
        title: 'Asking for prices',
        items: [
          { name: 'RFQ to many vendors', where: 'Quotes & Pricing → New RFQ', desc: 'Write one message and send it to every selected vendor. Each vendor’s name is filled in on their copy, so the quotes come back comparable.', plan: 'basic' },
          { name: 'Draft the email with AI', where: 'Quotes & Pricing → New RFQ → Draft with AI', desc: 'Optional. Charged once for the whole RFQ, not once per vendor.', cost: 5, plan: 'basic' },
          { name: 'Email a single vendor', where: 'Vendors → open a vendor → Draft an email', desc: 'Compose and send straight from the vendor page.', plan: 'basic' },
          { name: 'Quote tracking', where: 'Sidebar → Quotes & Pricing', desc: 'Everything that comes back in one place. Record the price, then accept or decline.', plan: 'basic' },
          { name: 'Landed cost', where: 'Quotes & Pricing → open a quote', desc: 'Duty, freight and customs on top of the unit price, so you compare the real number.', plan: 'basic' },
          { name: 'Cost simulator', where: 'Quotes & Pricing → open a quote → Simulate', desc: 'Price each change the way a car configurator does.', cost: 5, plan: 'basic' },
        ],
      },
    ],
    callout: {
      title: 'A vendor needs an email before you can send them an RFQ',
      body: 'Search fills it in when the factory publishes one. Otherwise add it under Contact email on the vendor page, or type it into the RFQ and Atelier saves it to that vendor for next time.',
    },
  },

  {
    id: 'sampling',
    num: '04',
    title: 'Sampling',
    hue: 'var(--c-finalcheck)',
    nav: 'Sampling',
    lede: 'The back and forth with the factory before anyone cuts three hundred units.',
    groups: [
      {
        title: 'Rounds',
        items: [
          { name: 'Sample rounds', where: 'Sidebar → Sampling → open a product', desc: 'Proto, fit, size set and pre-production rounds, each keeping its own history so you can see what changed.', plan: 'basic' },
          { name: 'Photo annotations', where: 'Sampling → open a round → a photo', desc: 'Pin a note to the exact spot on the sample that is wrong.', plan: 'basic' },
          { name: 'Fit feedback', where: 'Sampling → open a round', desc: 'Structured comments a factory can act on, rather than a paragraph of prose.', plan: 'basic' },
          { name: 'Approval', where: 'Sampling → open a round', desc: 'Approve a round and it feeds the readiness checklist on the tech pack.', plan: 'basic' },
        ],
      },
    ],
  },

  {
    id: 'production',
    num: '05',
    title: 'Production',
    hue: 'var(--c-materials)',
    nav: 'Production Orders',
    lede: 'The real order: units, sizes, milestones, quality, money and delivery.',
    tabs: ['Overview', 'Size Curve', 'Quality & Issues', 'Shipment & Inventory', 'Payments'],
    groups: [
      {
        title: 'The order',
        items: [
          { name: 'Create a production order', where: 'Sidebar → Production Orders → New order', desc: 'Product, vendor, units, due date and PO number.', plan: 'basic' },
          { name: 'Size curve', where: 'Production Orders → open one → Size Curve', desc: 'How the order splits across sizes, ordered and received. The factory needs this, and it decides how much of the run sells at full price.', plan: 'basic' },
          { name: 'Milestones', where: 'Production Orders → open one → Overview', desc: 'Cutting, sewing, QC and packing, editable per order.', plan: 'basic' },
          { name: 'Timeline and stage', where: 'Production Orders → open one', desc: 'Sampling, in production, shipped, delivered.', plan: 'basic' },
        ],
      },
      {
        title: 'Quality and money',
        items: [
          { name: 'QC checklist', where: 'Production Orders → Quality & Issues', desc: 'Your own checks, not a generic template.', plan: 'basic' },
          { name: 'Issue log', where: 'Production Orders → Quality & Issues', desc: 'Defects by severity, and whether each was resolved.', plan: 'basic' },
          { name: 'Payments', where: 'Production Orders → Payments', desc: 'Log the deposit and the balance against the order total.', plan: 'basic' },
          { name: 'Shipment and inventory', where: 'Production Orders → Shipment & Inventory', desc: 'Tracking, units received, and a delivery estimate based on the dates you actually have.', plan: 'basic' },
        ],
      },
    ],
    callout: {
      title: 'Avoid a flat size curve',
      body: 'Give every size the same quantity and you will usually sell out of the middle sizes while the ends sit and get marked down. Atelier flags a flat curve and offers a benchmark shape to edit. Treat the benchmark as a starting point; your own sell-through beats it as soon as you have any.',
    },
  },

  {
    id: 'selling',
    num: '06',
    title: 'Selling & Money',
    hue: 'var(--c-analytics)',
    nav: 'Overview · Financial Tools',
    lede: 'What happened after it launched, and whether the numbers hold up.',
    tabs: ['Overview', 'Vendors', 'Manufacturing', 'Inventory', 'Listings', 'Marketing', 'Reports', 'Connections'],
    groups: [
      {
        title: 'Sales',
        items: [
          { name: 'Sales dashboard', where: 'Sidebar → Overview', desc: 'Live orders and inventory from your connected store.', plan: 'premium' },
          { name: 'Vendor and manufacturing analytics', where: 'Overview → Vendors · Manufacturing', desc: 'What you have spent with whom, and how your production has run.', plan: 'premium' },
          { name: 'Inventory', where: 'Overview → Inventory', desc: 'Units on hand against units sold.', plan: 'premium' },
          { name: 'Reports and CSV export', where: 'Overview → Reports', desc: 'Export anything you can see.', plan: 'free' },
          { name: 'Per-product performance', where: 'A product → Performance', desc: 'Financial model against live performance for a single piece.', plan: 'premium' },
        ],
      },
      {
        title: 'Financial tools',
        items: [
          { name: 'Cost & profit', where: 'Sidebar → Financial Tools → Cost & Profit', desc: 'The basic maths on a single product.', plan: 'free' },
          { name: 'Break-even and pricing', where: 'Financial Tools → Break-Even & Pricing', desc: 'How many units until a piece pays for itself, and what price changes that.', plan: 'premium' },
          { name: 'MOQ optimization', where: 'Financial Tools → MOQ Optimization', desc: 'Trade unit cost against the cash you would tie up at each order size.', plan: 'premium' },
          { name: 'Cash flow and forecast', where: 'Financial Tools → Cash Flow & Forecast', desc: 'What you owe and when, against what is coming in.', plan: 'premium' },
          { name: 'Manufacturing cost history', where: 'Financial Tools → Manufacturing Cost History', desc: 'What making things has actually cost you over time.', plan: 'premium' },
        ],
      },
      {
        title: 'Store connections',
        items: [
          { name: 'Shopify, WooCommerce, Etsy', where: 'Overview → Connections', desc: 'Pull real orders and inventory into the sales dashboard.', plan: 'soon' },
          { name: 'Publish listings', where: 'Overview → Listings', desc: 'Push a finished product to your store as a draft listing.', plan: 'soon' },
        ],
      },
    ],
    callout: {
      title: 'What "coming soon" means here',
      body: 'The store and social integrations are built. They stay switched off until those platforms approve us as a developer, which is their timeline rather than ours. Everything you plan in the meantime is saved.',
    },
  },

  {
    id: 'marketing',
    num: '07',
    title: 'Marketing',
    hue: 'var(--c-content)',
    nav: 'Content Hub',
    lede: 'Planning the launch around the production dates you already have.',
    tabs: ['Grid Preview', 'Drop Calendar', 'Launch Planner', 'Influencers', 'Email Campaigns', 'Analytics', 'Accounts'],
    groups: [
      {
        title: 'Planning',
        items: [
          { name: 'Drop calendar', where: 'Content Hub → Drop Calendar', desc: 'Schedule posts against the week stock actually lands.', plan: 'premium' },
          { name: 'Launch planner', where: 'Content Hub → Launch Planner', desc: 'The run-up to a drop as a checklist with dates.', plan: 'premium' },
          { name: 'Grid preview', where: 'Content Hub → Grid Preview', desc: 'See the feed before you post it.', plan: 'premium' },
        ],
      },
      {
        title: 'Outreach',
        items: [
          { name: 'Influencer tracking', where: 'Content Hub → Influencers', desc: 'Prospect, contacted, negotiating, active, completed.', plan: 'premium' },
          { name: 'Email campaigns', where: 'Content Hub → Email Campaigns', desc: 'Send from your own verified domain, with per-recipient results.', plan: 'premium' },
        ],
      },
      {
        title: 'Social accounts',
        items: [
          { name: 'Instagram, TikTok, YouTube, Pinterest', where: 'Content Hub → Accounts', desc: 'Connect an account to schedule and publish.', plan: 'soon' },
          { name: 'Post analytics', where: 'Content Hub → Analytics', desc: 'Reach and engagement, once the accounts are connected.', plan: 'soon' },
        ],
      },
    ],
  },

  {
    id: 'everywhere',
    num: '·',
    title: 'Runs alongside everything',
    hue: 'var(--c-settings)',
    nav: 'Home · the chat button on every page · Settings',
    lede: 'The parts that are not tied to one stage.',
    groups: [
      {
        title: 'Home',
        items: [
          { name: 'Continue where you left off', where: 'Home', desc: 'The piece you last worked on, and the last few things you opened.', plan: 'free' },
          { name: 'Project health', where: 'Home', desc: 'Readiness across your products, and anything sitting at a gate.', plan: 'free' },
          { name: 'Calendar timeline', where: 'Home', desc: 'What is due, and when.', plan: 'free' },
          { name: 'Pinned', where: 'Home', desc: 'Products you have starred, plus your own notes.', plan: 'free' },
          { name: 'AI suggestions', where: 'Home → Get suggestions', desc: 'Reads your workspace and says what needs attention today.', cost: 5, plan: 'basic' },
          { name: 'Suggestion inbox', where: 'Home', desc: 'Send us a feature request or a bug report without leaving the app.', plan: 'free' },
        ],
      },
      {
        title: 'Working with other people',
        items: [
          { name: 'Team chat', where: 'Chat button, bottom right of any page', desc: 'Group chats with your teammates, updating live.', plan: 'basic' },
          { name: 'AI assistant', where: 'Chat button → Assistant', desc: 'Knows your products, vendors and production status, and answers about your own data.', cost: 1, plan: 'premium' },
          { name: 'Invite teammates', where: 'Settings → Team', desc: 'Admin, editor or viewer. Viewers can read everything and change nothing.', plan: 'basic' },
          { name: 'Comments', where: 'On designs, tech packs and vendors', desc: 'Leave a note on the thing itself rather than in a separate thread.', plan: 'free' },
        ],
      },
      {
        title: 'Settings',
        items: [
          { name: 'Brand details', where: 'Settings → Brand Details', desc: 'Name, quality tier, budget philosophy and sustainability stance. These feed every AI answer.', plan: 'free' },
          { name: 'Risk tolerance', where: 'Settings → Risk Tolerance', desc: 'Conservative, Balanced or Aggressive. Changes how bold the AI advice is across the app.', plan: 'free' },
          { name: 'Billing and credits', where: 'Settings → Billing & Plan', desc: 'Your plan, your credit balance, and top-ups.', plan: 'free' },
          { name: 'Notifications', where: 'Settings → Notifications · Sidebar → Notifications', desc: 'What Atelier tells you about, and an inbox of what it has.', plan: 'free' },
          { name: 'Multiple brands', where: 'Sidebar → brand name at the top', desc: 'Run more than one label from one account and switch between them.', plan: 'free' },
        ],
      },
      {
        title: 'Getting around',
        items: [
          { name: 'Search everything', where: 'Ctrl+K anywhere', desc: 'Products, vendors, materials, pages.', plan: 'free' },
          { name: 'Keyboard shortcuts', where: 'Press ? · Sidebar → Keyboard shortcuts', desc: 'The full list.', plan: 'free' },
          { name: 'Take a tour', where: 'Sidebar → Take a tour', desc: 'The guided walkthrough, replayable any time.', plan: 'free' },
        ],
      },
    ],
    callout: {
      title: 'Credits are per brand',
      body: 'Your whole team draws from one pool, and every AI button shows its price before you press it. A failed call is refunded automatically.',
    },
  },
];

// All AI prices in one table. Mirrors api/config/aiCredits.js.
export const GUIDE_COSTS = [
  { action: 'AI assistant message', cr: 1, note: 'Per reply' },
  { action: 'Colour palette', cr: 3, note: '' },
  { action: 'Design review', cr: 5, note: 'Includes a live trend search' },
  { action: 'Tech pack draft', cr: 5, note: 'Full guided version: 10' },
  { action: 'Vendor fit analysis', cr: 5, note: 'Against one product' },
  { action: 'Import a vendor from pasted text', cr: 5, note: '' },
  { action: 'Draft a vendor email', cr: 5, note: 'Once per RFQ, not per vendor' },
  { action: 'Quote economics · cost simulator', cr: 5, note: '' },
  { action: 'Dashboard suggestions', cr: 5, note: '' },
  { action: 'Silhouette — Draft', cr: 5, note: 'Fast and rough, for trying ideas' },
  { action: 'Vendor search', cr: 10, note: 'Searches the live web' },
  { action: 'Trend inspiration', cr: 10, note: '' },
  { action: 'Material research', cr: 10, note: 'Once per tech pack save' },
  { action: 'Logo, graphic or pattern', cr: 10, note: '' },
  { action: 'Silhouette — Standard', cr: 15, note: '' },
  { action: 'Every AI Studio edit', cr: 15, note: 'Recolor, fabric swap, views, mockups, flat sketches' },
  { action: 'Silhouette — High', cr: 50, note: 'Sharpest detail, and the most expensive button in the app' },
];

export const GUIDE_PLAN_ROWS = [
  { label: 'Monthly AI credits', free: '0', basic: '1,200', premium: '3,500' },
  { label: 'Active products', free: '1', basic: '10', premium: 'Unlimited' },
  { label: 'Team members', free: '1', basic: '3', premium: '10' },
  { label: 'Design canvas, collections, exports', free: true, basic: true, premium: true },
  { label: 'Manual tech packs and material library', free: true, basic: true, premium: true },
  { label: 'AI Studio and AI tech packs', free: false, basic: true, premium: true },
  { label: 'Vendor search, RFQs, quotes', free: false, basic: true, premium: true },
  { label: 'Sampling and production tracking', free: false, basic: true, premium: true },
  { label: 'Readiness review', free: false, basic: true, premium: true },
  { label: 'Sales, financials, forecasting', free: false, basic: false, premium: true },
  { label: 'Content planner and campaigns', free: false, basic: false, premium: true },
  { label: 'AI assistant', free: false, basic: false, premium: true },
];

// Compact feature index for the AI assistant: one line per feature, name then
// location. Derived from GUIDE rather than written twice, so "where is X" can
// never answer with a path that no longer exists.
//
// Sent with each assistant message. Roughly 1.5k tokens against a 1-credit
// action whose ceiling is $0.005, so the cost is noise next to being able to
// answer the single most common support question.
export function featureLocationIndex() {
  const lines = [];
  for (const section of GUIDE) {
    for (const group of section.groups) {
      for (const item of group.items) {
        const bits = [`${item.name} — ${item.where}`];
        if (item.cost) bits.push(`${item.cost} credits`);
        if (item.plan && item.plan !== 'free') bits.push(item.plan === 'soon' ? 'not live yet' : `${item.plan} plan`);
        lines.push(`- ${bits.join(' · ')}`);
      }
    }
  }
  return lines.join('\n');
}

// The product tour. Ordered the way a founder actually works — brand, board,
// design, tech pack, sourcing, production, sales — so it teaches the flow
// rather than the sidebar.
//
// Deliberately short. This was 26 steps, most of them pointing at a single
// widget, and nobody finishes a 26-step tour. Each step now covers a whole
// area of the app; a feature that's discoverable on its own (the bell, the
// favourites widget) doesn't get a step at all.
//
// `selector` targets a real `data-tour="..."` element and the tour navigates
// to `path` first. A step without a selector just centres its card, so a
// missing anchor degrades instead of breaking.
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    path: '/',
    selector: '[data-tour="brand-switcher"]',
    title: 'Welcome to Atelier',
    body: "Everything lives inside a brand: its products, vendors, and settings. Switch brands or add another one here. The tour takes about a minute — skip it whenever you like, and reopen it later from the sidebar.",
  },
  {
    id: 'dashboard',
    path: '/',
    selector: '[data-tour="dashboard-widgets"]',
    title: 'Your dashboard',
    body: "Home shows what's moving: the product you're furthest along with, what you had open last, upcoming due dates, and how readiness is tracking. The AI suggestions card reads your workspace and tells you what needs attention today.",
  },
  {
    id: 'board',
    path: '/',
    selector: '[data-tour="kanban-board"]',
    title: 'How work moves',
    body: 'Every product sits on this board, grouped into stages that run top to bottom: Design, Tech Pack, Sourcing, Sampling, Production, Launched. Drag a piece onto another stage to move it, or use the move button on the card itself. The rest of this tour follows the same path.',
  },
  {
    id: 'design',
    path: '/design',
    selector: '[data-tour="design-new"]',
    title: 'Start a design',
    body: "Pick a preset garment, upload your own sketch or PSD, or have AI draw a blank mockup for something that isn't in the list. The canvas keeps your layers and saves as you work. AI Studio can recolour it, swap the fabric, clean up a rough sketch, or generate another angle as its own view. Group related pieces into a collection to track a drop together.",
  },
  {
    id: 'tech-pack',
    path: '/tech-packs',
    selector: '[data-tour="tech-packs"]',
    title: 'Turn it into a tech pack',
    body: "Answer a few questions about materials, sizing and construction, and Atelier drafts the bill of materials and measurement charts. Read every line before it leaves your hands. The Material Library flags fabrics that shrink, bleed, or cost more than you'd expect, and Readiness Review is the gate a pack clears before a factory sees it.",
  },
  {
    id: 'sourcing',
    path: '/vendors',
    selector: '[data-tour="vendor-tabs"]',
    title: 'Find a factory',
    body: 'Search the web for manufacturers, or paste in ones you already know. Atelier scores each against your product, budget and materials, then drafts the first email. Quotes come back to one place where you can compare landed cost side by side.',
  },
  {
    id: 'production',
    path: '/production',
    selector: '[data-tour="production-orders"]',
    title: 'Samples and production',
    body: 'Track sample rounds with photos and fit notes until you approve one. From there, production orders carry units, QC checks, issues, payments and shipping right through to delivery.',
  },
  {
    id: 'sales',
    path: '/sales',
    selector: '[data-tour="sales-dashboard"]',
    title: 'After it launches',
    body: 'Connect Shopify, WooCommerce or Etsy to pull in real orders and watch each product cross its break-even line. Financial Tools cover cash flow and minimum order quantities. The content planner lines your drop up against production dates.',
  },
  {
    id: 'credits-team',
    path: '/settings',
    selector: '[data-tour="settings-tabs"]',
    title: 'Credits, team and settings',
    body: "AI features run on credits. Your plan includes a monthly allowance, every AI button shows its cost before you press it, and you can top up here. Settings is also where you invite teammates and set your brand's risk tolerance, which changes how bold the AI's advice is.",
  },
  {
    id: 'outro',
    path: '/',
    title: "That's the tour",
    body: 'Two things worth remembering: Ctrl+K searches everything you have, and ? lists the keyboard shortcuts. Reopen this tour from the sidebar any time.',
  },
];

### 1. `README.md`
**Copy and save this to the root of your project.**

```markdown
# Grainline — Production OS for Independent Clothing Brands

Takes a founder from a rough sketch to a manufactured, sellable product — design, tech pack, vendor sourcing, quoting, and (eventually) production and sales — in one tool instead of a scattered stack of spreadsheets, DMs, and freelance tech-pack files.

**Positioning, on purpose:** this is *production intelligence*, not an AI design generator. The AI never makes creative or final business decisions — it drafts, extracts, scores, and warns; the founder always reviews and decides. Every AI feature in this repo follows that rule.

---

## Architecture

```text
grainline/
├── la-guia/                 React + Vite frontend
│   ├── src/
│   │   ├── components/      Sidebar, Photopea embed, garment silhouettes, charts, shared UI
│   │   ├── context/         AuthContext, ProductsContext, VendorsContext — all Supabase-backed
│   │   ├── lib/              Supabase client, formatters
│   │   └── pages/            One file per route
│   ├── .env.local           VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (not committed)
│   └── package.json
├── api/                      Express backend — the only place secret keys are used
│   ├── index.js              All AI endpoints (Gemini + Tavily)
│   ├── .env                  GEMINI_API_KEY, TAVILY_API_KEY, PORT (not committed)
│   └── package.json
└── supabase/
    └── migrations/           SQL Schema for your Supabase project
```

**The split is deliberate:** the frontend talks to Supabase *directly* for all data (products, designs, vendors, quotes), protected by Row Level Security — no backend round-trip needed for CRUD. The Express backend (`api/`) exists **only** for calls that need a secret key that can't live in browser code (Gemini, Tavily).

**Design canvas:** the Design Studio embeds [Photopea](https://www.photopea.com) via `postMessage`. Vendor web search uses Tavily feeding real results to Gemini for structuring.

---

## What's real vs. mock

The frontend was scaffolded with static mock data first, then converted page-by-page to real Supabase data. 

**Real (Supabase-backed):**
Auth · Brands · Products · Designs · Tech Packs · Collections · Materials · Vendors · Quotes · Production Orders (Creation & List view) · Readiness Review

**Still static mock data** (`la-guia/src/data/mockData.js`):
`ProductionOrderDetail.jsx` (Needs refactor) · `SalesDashboard.jsx` · `ContentHub.jsx` · `NotificationsInbox.jsx`

---

## Local setup

### 1. Supabase project
You need access to your Supabase project. Run these in the SQL Editor in order:
1. `supabase/migrations/001_initial_schema.sql` (Initial core tables)
2. `supabase/migrations/002_vendors_and_quotes.sql`
3. `supabase/migrations/003_vendor_enhancements.sql`

- **Storage bucket**: A public bucket named `mockups` must exist for Design Studio snapshots.
- **Auth**: "Confirm email" should be disabled in Auth settings for local testing.

### 2. Backend (`api/`)
```bash
cd api
npm install
node index.js
```
Create `api/.env` with `PORT`, `GEMINI_API_KEY`, and `TAVILY_API_KEY`.

### 3. Frontend (`la-guia/`)
```bash
cd la-guia
npm install
npm run dev
```
Create `la-guia/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Open **http://localhost:5173**. Both servers must be running.

---

## API reference (`api/index.js`)

| Endpoint | Purpose |
|---|---|
| `/api/analyze-design` | Scores a captured canvas snapshot |
| `/api/generate-tech-pack` | Generates BOM + graded measurements from canvas |
| `/api/parse-vendor` | Extracts structured profile from pasted text |
| `/api/search-vendors` | Real-time web search via Tavily + Gemini extraction |
| `/api/analyze-vendor-fit` | Scores vendor/product material & economic fit |
| `/api/draft-vendor-email` | Drafts a structured vendor outreach email |

---

## Known gaps / next up

- **Task 1.2:** Refactor `ProductionOrderDetail.jsx` to remove `mockData.js`.
- **Task 2.1:** Implement backend AI Text-to-SVG logic for silhouette generation.
- **Phase 3:** Replace Sales and Content dashboards with real Shopify/Social integrations.

## Gotchas

- **Never commit `node_modules`.**
- **Gemini Search grounding needs billing** — use Tavily instead.
- **Photopea resizing** — the container doesn't reliably resize; use the capture/remount pattern in `DesignDetail.jsx`.
```
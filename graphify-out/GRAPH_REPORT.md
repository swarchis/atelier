# Graph Report - .  (2026-07-15)

## Corpus Check
- 126 files · ~112,329 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 570 nodes · 1479 edges · 16 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.68)
- Token cost: 120,251 input · 0 output

## Community Hubs (Navigation)
- App Shell & History
- Dashboard Widgets & Shared UI
- Billing & AI Suggestions
- Shared Navigation Components
- Calendar & Revenue Charts
- Favorites & Project Health
- Vite Entry & Context Providers
- Backend AI Helpers
- AI Design Studio Tools
- Mock Data Fixtures
- Frontend Dependencies
- Backend Dependencies
- Ecommerce & Marketing Integrations
- Materials Library
- Stripe Setup Script

## God Nodes (most connected - your core abstractions)
1. `useProducts()` - 86 edges
2. `useAuth()` - 39 edges
3. `supabase` - 31 edges
4. `useProduction()` - 29 edges
5. `useVendors()` - 25 edges
6. `currency()` - 23 edges
7. `EmptyState()` - 19 edges
8. `useAIUsage()` - 17 edges
9. `useUserPreferences()` - 17 edges
10. `readinessColor()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Readiness Gate Bypass` --references--> `VendorDetail()`  [EXTRACTED]
  README.md → la-guia/src/pages/VendorDetail.jsx
- `ConfirmDeleteModal()` --shares_data_with--> `Materials Library`  [EXTRACTED]
  la-guia/src/components/ConfirmDeleteModal.jsx → README.md
- `ConfirmDeleteModal()` --shares_data_with--> `Product Management`  [EXTRACTED]
  la-guia/src/components/ConfirmDeleteModal.jsx → README.md
- `ConfirmDeleteModal()` --shares_data_with--> `Tech Pack Builder`  [EXTRACTED]
  la-guia/src/components/ConfirmDeleteModal.jsx → README.md
- `RFQ & Quote Economics` --references--> `CostBreakdownWheel()`  [EXTRACTED]
  README.md → la-guia/src/components/CostBreakdownWheel.jsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Storefront Platform Adapter Pattern** — readme_shopify_service, readme_woocommerce_integration, readme_etsy_integration, la_guia_src_lib_ecommercesync_ecommercesync [EXTRACTED 1.00]
- **Shared OAuth Handoff Flow** — readme_shopify_service, readme_etsy_integration, readme_marketing_foundation, la_guia_src_lib_oauthhandoff_oauthhandoff [EXTRACTED 1.00]
- **AI Design Studio Provider Split** — readme_transform_tools, readme_addition_tools, readme_gemini_api, readme_pixazo_service [EXTRACTED 1.00]

## Communities (16 total, 0 thin omitted)

### Community 0 - "App Shell & History"
Cohesion: 0.06
Nodes (43): AppShellInner(), ProtectedRoute(), SuggestionInbox(), Comments(), HistoryTab(), timeAgo(), VersionHistory(), findTarget() (+35 more)

### Community 1 - "Dashboard Widgets & Shared UI"
Cohesion: 0.06
Nodes (46): CostBreakdownWheel(), ContinueWhereYouLeftOff(), resolveTitle(), TYPE_META, EmptyState(), firstMatch(), SidebarSearch(), AppUIContext (+38 more)

### Community 2 - "Billing & AI Suggestions"
Cohesion: 0.06
Nodes (45): BillingTab(), AISuggestions(), cacheKey(), CATEGORY_PATH, SEVERITY_COLOR, SEVERITY_ICON, FloatingChat(), timeLabel() (+37 more)

### Community 3 - "Shared Navigation Components"
Cohesion: 0.08
Nodes (34): TYPES, EditableSectionTable(), FLOW_STAGES, FlowStepper(), TabBar(), FIELDS, TechPackQuestionnaire(), AuthContext (+26 more)

### Community 4 - "Calendar & Revenue Charts"
Cohesion: 0.07
Nodes (41): CalendarTimeline(), daysUntil(), formatWhen(), STAGE_COLOR, RevenueChart(), ProductionContext, useProduction(), useSales() (+33 more)

### Community 5 - "Favorites & Project Health"
Cohesion: 0.11
Nodes (31): ConfirmDeleteModal(), FavoriteProjects(), ProjectHealth(), RISK_COLOR, RISK_ORDER, DEFAULT_NOTE(), StickyNotes(), PhotoPanel() (+23 more)

### Community 6 - "Vite Entry & Context Providers"
Cohesion: 0.06
Nodes (38): Favicon (inline SVG), Google Fonts (Newsreader, Inter, Space Mono, Caveat, Archivo), index.html (Vite Entry Document), main.jsx (module script entry), Phosphor Icons (unpkg script), App(), ChatContext, VendorsContext (+30 more)

### Community 7 - "Backend AI Helpers"
Cohesion: 0.07
Nodes (21): app, callGemini(), callPixazoElement(), cleanAIJSON(), cors, COST_LEVERS, crypto, dotenv (+13 more)

### Community 8 - "AI Design Studio Tools"
Cohesion: 0.13
Nodes (20): ADDITION_TOOLS, AIStudioTab(), downloadPng(), ToolCard(), TRANSFORM_TOOLS, InspirationTab(), Moodboard(), SkuVariantsTab() (+12 more)

### Community 9 - "Mock Data Fixtures"
Cohesion: 0.07
Nodes (23): brands, collections, contentPosts, designs, financialModels, materials, notifications, productionOrders (+15 more)

### Community 10 - "Frontend Dependencies"
Cohesion: 0.07
Nodes (27): framer-motion, dependencies, framer-motion, react, react-dom, react-router-dom, @supabase/supabase-js, description (+19 more)

### Community 11 - "Backend Dependencies"
Cohesion: 0.08
Nodes (24): author, dependencies, cors, dotenv, express, resend, sharp, stripe (+16 more)

### Community 12 - "Ecommerce & Marketing Integrations"
Cohesion: 0.09
Nodes (23): api/index.js, ContentContext, csvExport.js, ecommerceSync.js, oauthHandoff.js, techPackExcel.js, Analytics Expansion (Sales Dashboard), sales_data Missing platform Column Bug (+15 more)

### Community 13 - "Materials Library"
Cohesion: 0.15
Nodes (16): PriceHistoryChart(), MaterialsContext, MaterialsProvider(), useMaterials(), AVAILABILITY_OPTIONS, MaterialDetail(), TABS, TONE_BY_RISK (+8 more)

### Community 14 - "Stripe Setup Script"
Cohesion: 0.29
Nodes (7): ensureProductAndPrice(), ENV_PATH, fs, main(), path, stripe, TIERS

## Knowledge Gaps
- **184 isolated node(s):** `path`, `express`, `cors`, `dotenv`, `{ Resend }` (+179 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useProducts()` connect `Dashboard Widgets & Shared UI` to `App Shell & History`, `Billing & AI Suggestions`, `Shared Navigation Components`, `Calendar & Revenue Charts`, `Favorites & Project Health`, `Vite Entry & Context Providers`, `AI Design Studio Tools`, `Materials Library`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `WaxSeal()` connect `Frontend Dependencies` to `App Shell & History`, `Favorites & Project Health`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `path`, `express`, `cors` to the rest of the system?**
  _184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & History` be split into smaller, more focused modules?**
  _Cohesion score 0.06394230769230769 - nodes in this community are weakly interconnected._
- **Should `Dashboard Widgets & Shared UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06187202538339503 - nodes in this community are weakly interconnected._
- **Should `Billing & AI Suggestions` be split into smaller, more focused modules?**
  _Cohesion score 0.0647307924984876 - nodes in this community are weakly interconnected._
- **Should `Shared Navigation Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08080808080808081 - nodes in this community are weakly interconnected._
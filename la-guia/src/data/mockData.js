// Static placeholder data for the rudimentary layout pass.
// No backend yet — every page reads from here.

export const brands = [
  {
    id: 'aldercreek',
    name: 'Aldercreek Studio',
    qualityTier: 'Premium contemporary',
    targetCustomer: 'Minimalist streetwear, ages 22–34, mid-premium price point',
    budgetPhilosophy: 'Quality over speed — willing to pay more for fewer, better-made drops',
    sustainability: 'Prefers GOTS-certified cotton where cost allows',
    manufacturerPreferences: 'Small-batch, Portugal or Vietnam, no MOQ above 500 units',
    globalRisk: 'Balanced',
  },
  {
    id: 'fieldwork',
    name: 'Fieldwork Supply Co.',
    qualityTier: 'Value / accessible',
    targetCustomer: 'Outdoor-inspired basics, ages 25–45',
    budgetPhilosophy: 'Speed over polish — fast iteration on core styles',
    sustainability: 'Not a current priority',
    manufacturerPreferences: 'Domestic (US) only, quick-turn programs',
    globalRisk: 'Aggressive',
  },
];

export const activeBrandId = 'aldercreek';

export const STAGES = [
  { key: 'concept', label: 'Concept', section: 'design' },
  { key: 'design', label: 'Design', section: 'design' },
  { key: 'techpack', label: 'Tech Pack', section: 'techpack' },
  { key: 'sourcing', label: 'Sourcing & RFQ', section: 'vendors' },
  { key: 'sampling', label: 'Sampling', section: 'materials' },
  { key: 'production', label: 'Production', section: 'materials' },
  { key: 'launched', label: 'Launched', section: 'success' },
];

export const RISK_LEVELS = ['Conservative', 'Balanced', 'Aggressive'];

export const collections = [
  { id: 'fall-capsule-02', name: 'Fall Capsule 02', launchWindow: 'Oct 14 – Oct 28', timelineConflict: true },
  { id: 'core-basics', name: 'Core Basics', launchWindow: 'Rolling', timelineConflict: false },
  { id: 'spring-preview', name: 'Spring Preview', launchWindow: 'Feb 02 – Feb 16', timelineConflict: false },
  { id: 'resort-capsule', name: 'Resort Capsule', launchWindow: 'Mar 20 – Apr 03', timelineConflict: false },
];

export const products = [
  { id: 'heavyweight-hoodie-ash', name: 'Heavyweight Hoodie — Ash', category: 'Hoodie', collectionId: 'fall-capsule-02', stage: 'sampling', risk: 'Balanced', budget: 18500, readiness: 82 },
  { id: 'selvedge-straight-jean', name: 'Selvedge Straight Jean', category: 'Denim', collectionId: 'fall-capsule-02', stage: 'sourcing', risk: 'Conservative', budget: 24000, readiness: 64 },
  { id: 'wool-blend-overcoat', name: 'Wool-Blend Overcoat', category: 'Outerwear', collectionId: 'fall-capsule-02', stage: 'techpack', risk: 'Aggressive', budget: 31000, readiness: 41 },
  { id: 'raglan-crewneck', name: 'Raglan Crewneck — Moss', category: 'Sweatshirt', collectionId: 'fall-capsule-02', stage: 'design', risk: 'Balanced', budget: 12800, readiness: 22 },
  { id: 'boxy-tee-natural', name: 'Boxy Tee — Natural', category: 'Tee', collectionId: 'core-basics', stage: 'production', risk: 'Balanced', budget: 9200, readiness: 96 },
  { id: 'canvas-work-cap', name: 'Canvas Work Cap', category: 'Headwear', collectionId: 'core-basics', stage: 'launched', risk: 'Conservative', budget: 4100, readiness: 100 },
  { id: 'ribbed-tank', name: 'Ribbed Tank — Bone', category: 'Tank', collectionId: 'core-basics', stage: 'techpack', risk: 'Conservative', budget: 5400, readiness: 58 },
  { id: 'ripstop-utility-jacket', name: 'Ripstop Utility Jacket', category: 'Outerwear', collectionId: 'spring-preview', stage: 'concept', risk: 'Aggressive', budget: 27500, readiness: 12 },
  { id: 'pleated-utility-short', name: 'Pleated Utility Short', category: 'Shorts', collectionId: 'spring-preview', stage: 'concept', risk: 'Balanced', budget: 8900, readiness: 8 },
  { id: 'merino-crew-sock', name: 'Merino Crew Sock (3-pack)', category: 'Accessories', collectionId: 'spring-preview', stage: 'design', risk: 'Conservative', budget: 3200, readiness: 30 },
  { id: 'linen-camp-shirt', name: 'Linen Camp Shirt', category: 'Shirt', collectionId: 'resort-capsule', stage: 'sourcing', risk: 'Balanced', budget: 14200, readiness: 71 },
  { id: 'toweling-polo', name: 'Toweling Polo — Sand', category: 'Polo', collectionId: 'resort-capsule', stage: 'sampling', risk: 'Aggressive', budget: 10600, readiness: 55 },
  { id: 'canvas-tote', name: 'Waxed Canvas Tote', category: 'Bag', collectionId: 'resort-capsule', stage: 'production', risk: 'Conservative', budget: 6700, readiness: 90 },
  { id: 'shearling-collar-vest', name: 'Shearling-Collar Vest', category: 'Outerwear', collectionId: 'fall-capsule-02', stage: 'techpack', risk: 'Aggressive', budget: 22800, readiness: 37 },
];

// baseType: 'silhouette' (started from a preset garment template) | 'upload' (a founder's
// own mockup image) | 'ai-silhouette' (the one AI-generated exception — a custom blank
// silhouette, used only when nothing in the preset library fits).
export const designs = {
  'raglan-crewneck': {
    garmentType: 'Sweatshirt', silhouette: 'hoodie', baseType: 'silhouette', colorway: 'Moss / Ecru trim',
    status: 'Refining',
    layers: [
      { name: 'Silhouette base', visible: true },
      { name: 'Sketch — front panel', visible: true },
      { name: 'Trim notes', visible: true },
    ],
    analysis: {
      score: 74,
      notes: [
        { severity: 'amber', text: 'Raglan seam angle looks steep for a heavyweight fleece — may pucker at the shoulder.' },
        { severity: 'blue', text: 'Silhouette overlaps ~62% with your existing "Heavyweight Hoodie — Ash" — consider differentiating the hem.' },
      ],
    },
  },
  'ripstop-utility-jacket': {
    garmentType: 'Jacket', silhouette: 'jacket', baseType: 'silhouette', colorway: 'Olive / Black hardware',
    status: 'Sketching',
    layers: [{ name: 'Silhouette base', visible: true }],
    analysis: null,
  },
  'pleated-utility-short': {
    garmentType: 'Shorts', silhouette: 'shorts', baseType: 'upload', colorway: 'Stone',
    status: 'Sketching',
    layers: [{ name: 'Uploaded mockup', visible: true }],
    analysis: null,
  },
  'merino-crew-sock': {
    garmentType: 'Accessory', silhouette: null, baseType: 'ai-silhouette', colorway: 'Charcoal / Natural',
    status: 'Ready',
    layers: [
      { name: 'AI-generated base silhouette', visible: true },
      { name: 'Sketch — front', visible: true },
      { name: 'Color notes', visible: false },
    ],
    analysis: {
      score: 91,
      notes: [
        { severity: 'green', text: 'Proportions are consistent with your approved sock block from last season.' },
      ],
    },
  },
};

export const techPacks = {
  'wool-blend-overcoat': {
    bom: [
      { material: 'Wool-Cashmere Melton 24oz', supplier: 'TBD', qtyPerUnit: '2.1m', unitCost: 38.5 },
      { material: 'Bemberg Cupro Lining', supplier: 'TBD', qtyPerUnit: '1.6m', unitCost: 9.2 },
      { material: 'Horn Buttons, 28L', supplier: 'TBD', qtyPerUnit: '6', unitCost: 0.9 },
    ],
    measurements: [
      { size: 'S', chest: 104, length: 78, sleeve: 63 },
      { size: 'M', chest: 110, length: 80, sleeve: 64.5 },
      { size: 'L', chest: 116, length: 82, sleeve: 66 },
    ],
    materialWarnings: [{ material: 'Wool-Cashmere Melton', warning: 'High shrink variance across mills — request pre-shrunk swatch', severity: 'amber' }],
    samplingRounds: [],
    readinessChecklist: [
      { item: 'Bill of materials complete', status: 'done' },
      { item: 'Graded measurements — all sizes', status: 'pending' },
      { item: 'Construction notes reviewed', status: 'pending' },
    ],
  },
  'ribbed-tank': {
    bom: [
      { material: '2x1 Rib Cotton-Elastane', supplier: 'TBD', qtyPerUnit: '0.6m', unitCost: 6.1 },
    ],
    measurements: [
      { size: 'XS', chest: 76, length: 58, sleeve: '—' },
      { size: 'S', chest: 80, length: 60, sleeve: '—' },
      { size: 'M', chest: 84, length: 62, sleeve: '—' },
    ],
    materialWarnings: [],
    samplingRounds: [],
    readinessChecklist: [
      { item: 'Bill of materials complete', status: 'done' },
      { item: 'Graded measurements — all sizes', status: 'done' },
      { item: 'Construction notes reviewed', status: 'pending' },
    ],
  },
  'shearling-collar-vest': {
    bom: [
      { material: 'Genuine Shearling Panel', supplier: 'TBD', qtyPerUnit: '0.4m', unitCost: 64 },
      { material: 'Waxed Cotton Canvas 12oz', supplier: 'TBD', qtyPerUnit: '1.8m', unitCost: 14.3 },
    ],
    measurements: [
      { size: 'M', chest: 112, length: 68, sleeve: '—' },
      { size: 'L', chest: 118, length: 70, sleeve: '—' },
    ],
    materialWarnings: [{ material: 'Genuine Shearling', warning: 'Price moved +18% since last quote — confirm before RFQ', severity: 'red' }],
    samplingRounds: [],
    readinessChecklist: [
      { item: 'Bill of materials complete', status: 'done' },
      { item: 'Graded measurements — all sizes', status: 'pending' },
      { item: 'Construction notes reviewed', status: 'pending' },
    ],
  },
  'selvedge-straight-jean': {
    bom: [
      { material: '14.5oz Selvedge Denim', supplier: 'Norte Textile Co.', qtyPerUnit: '1.4m', unitCost: 11.8 },
      { material: 'Copper Rivets', supplier: 'TBD', qtyPerUnit: '6', unitCost: 0.4 },
      { material: 'Leather Patch', supplier: 'TBD', qtyPerUnit: '1', unitCost: 1.1 },
    ],
    measurements: [
      { size: '30', chest: '—', length: 108, sleeve: '—' },
      { size: '32', chest: '—', length: 110, sleeve: '—' },
      { size: '34', chest: '—', length: 112, sleeve: '—' },
    ],
    materialWarnings: [],
    samplingRounds: [
      { round: 1, type: 'Proto', status: 'Approved', notes: 'Rise confirmed, no changes', date: 'Jun 02' },
      { round: 2, type: 'Fit sample', status: 'In review', notes: 'Checking thigh block on size 32', date: 'Jun 28' },
    ],
    readinessChecklist: [
      { item: 'Bill of materials complete', status: 'done' },
      { item: 'Graded measurements — all sizes', status: 'done' },
      { item: 'Construction notes reviewed', status: 'done' },
    ],
  },
  'linen-camp-shirt': {
    bom: [{ material: 'Belgian Linen 4.5oz', supplier: 'TBD', qtyPerUnit: '1.7m', unitCost: 13.4 }],
    measurements: [
      { size: 'S', chest: 108, length: 74, sleeve: 22 },
      { size: 'M', chest: 114, length: 76, sleeve: 23 },
    ],
    materialWarnings: [],
    samplingRounds: [],
    readinessChecklist: [
      { item: 'Bill of materials complete', status: 'done' },
      { item: 'Graded measurements — all sizes', status: 'pending' },
      { item: 'Construction notes reviewed', status: 'pending' },
    ],
  },
  'heavyweight-hoodie-ash': {
    bom: [
      { material: '460gsm Brushed Fleece', supplier: 'Sable & Loom', qtyPerUnit: '1.9m', unitCost: 10.6 },
      { material: 'Flat Drawcord + Metal Tips', supplier: 'TBD', qtyPerUnit: '1.4m', unitCost: 0.7 },
    ],
    measurements: [
      { size: 'M', chest: 118, length: 70, sleeve: 62 },
      { size: 'L', chest: 124, length: 72, sleeve: 64 },
    ],
    materialWarnings: [],
    samplingRounds: [
      { round: 1, type: 'Proto', status: 'Approved', notes: '', date: 'May 12' },
      { round: 2, type: 'Fit sample', status: 'Approved', notes: '', date: 'May 30' },
      { round: 3, type: 'Size set', status: 'In review', notes: 'Confirming grade rule on sleeve length', date: 'Jun 20' },
    ],
    readinessChecklist: [
      { item: 'Bill of materials complete', status: 'done' },
      { item: 'Graded measurements — all sizes', status: 'done' },
      { item: 'Construction notes reviewed', status: 'done' },
    ],
  },
  'toweling-polo': {
    bom: [{ material: 'Cotton Toweling Terry', supplier: 'TBD', qtyPerUnit: '1.5m', unitCost: 8.9 }],
    measurements: [{ size: 'M', chest: 108, length: 68, sleeve: 21 }],
    materialWarnings: [{ material: 'Cotton Toweling Terry', warning: 'Prone to loop-pull — recommend reinforced cuffs', severity: 'amber' }],
    samplingRounds: [{ round: 1, type: 'Proto', status: 'Revision requested', notes: 'Collar too heavy, requesting lighter interfacing', date: 'Jun 18' }],
    readinessChecklist: [
      { item: 'Bill of materials complete', status: 'done' },
      { item: 'Graded measurements — all sizes', status: 'pending' },
      { item: 'Construction notes reviewed', status: 'pending' },
    ],
  },
};

export const vendors = [
  { id: 1, name: 'Norte Textile Co.', category: 'Denim', location: 'Guadalajara, MX', label: 'Previously quoted', rating: 4.6, moq: 300, leadTime: '45 days', specialties: ['Selvedge denim', 'Raw indigo', 'Small-batch runs'], quoteHistory: 3 },
  { id: 2, name: 'Sable & Loom', category: 'Knitwear', location: 'Porto, PT', label: 'Verified partner', rating: 4.9, moq: 200, leadTime: '38 days', specialties: ['Brushed fleece', 'Jersey', 'Garment dye'], quoteHistory: 5 },
  { id: 3, name: 'Kanto Garment Works', category: 'Outerwear', location: 'Ho Chi Minh City, VN', label: 'Sample completed', rating: 4.3, moq: 500, leadTime: '60 days', specialties: ['Technical outerwear', 'Bonded seams'], quoteHistory: 2 },
  { id: 4, name: 'instagram.com/duvalstitch', category: 'Headwear', location: 'Unknown', label: 'Unverified', rating: null, moq: null, leadTime: '—', specialties: ['Caps', 'Embroidery'], quoteHistory: 0 },
  { id: 5, name: 'Pressline Manufacturing', category: 'Tee / Basics', location: 'Los Angeles, US', label: 'Production completed', rating: 4.7, moq: 150, leadTime: '21 days', specialties: ['Domestic quick-turn', 'Tees', 'Fleece'], quoteHistory: 8 },
  { id: 6, name: 'Altiplano Leatherworks', category: 'Bags / Leather goods', location: 'León, MX', label: 'External source', rating: null, moq: 100, leadTime: '35 days', specialties: ['Canvas', 'Leather trim'], quoteHistory: 0 },
];

export const TRUST_LABELS = [
  { label: 'Imported by user', tone: 'neutral' },
  { label: 'External source', tone: 'neutral' },
  { label: 'Unverified', tone: 'amber' },
  { label: 'Verified partner', tone: 'green' },
  { label: 'Previously quoted', tone: 'blue' },
  { label: 'Sample completed', tone: 'blue' },
  { label: 'Production completed', tone: 'green' },
];

export const quotes = [
  { id: 1, vendorName: 'Norte Textile Co.', productId: 'selvedge-straight-jean', productName: 'Selvedge Straight Jean', status: 'Received', amount: 22.4, requestedAt: 'Jun 04' },
  { id: 2, vendorName: 'Sable & Loom', productId: 'heavyweight-hoodie-ash', productName: 'Heavyweight Hoodie — Ash', status: 'Accepted', amount: 18.9, requestedAt: 'May 10' },
  { id: 3, vendorName: 'Kanto Garment Works', productId: 'wool-blend-overcoat', productName: 'Wool-Blend Overcoat', status: 'Requested', amount: null, requestedAt: 'Jun 30' },
  { id: 4, vendorName: 'Pressline Manufacturing', productId: 'boxy-tee-natural', productName: 'Boxy Tee — Natural', status: 'Accepted', amount: 6.1, requestedAt: 'Apr 22' },
  { id: 5, vendorName: 'Altiplano Leatherworks', productId: 'canvas-tote', productName: 'Waxed Canvas Tote', status: 'Received', amount: 9.8, requestedAt: 'Jun 12' },
  { id: 6, vendorName: 'Norte Textile Co.', productId: 'linen-camp-shirt', productName: 'Linen Camp Shirt', status: 'Requested', amount: null, requestedAt: 'Jul 02' },
];

export const materials = [
  { id: 1, name: 'Recycled Polyester Fleece', category: 'Knits', riskLevel: 'amber', warning: 'Higher pilling rate after 10 washes vs. virgin poly', usedIn: [] },
  { id: 2, name: 'Ring-Spun Cotton Jersey', category: 'Knits', riskLevel: 'green', warning: 'Stable — pre-shrink recommended for prints over 40% coverage', usedIn: ['Boxy Tee — Natural'] },
  { id: 3, name: 'YKK Excella Zipper', category: 'Trims', riskLevel: 'green', warning: 'No known issues at any MOQ', usedIn: [] },
  { id: 4, name: 'Genuine Shearling', category: 'Specialty', riskLevel: 'red', warning: 'Price volatility — moved +18% in the last quarter', usedIn: ['Shearling-Collar Vest'] },
  { id: 5, name: 'Ripstop Nylon 70D', category: 'Wovens', riskLevel: 'amber', warning: 'DWR coating can crack under 4°C — confirm cold-weather use case', usedIn: [] },
  { id: 6, name: 'Merino Wool 19.5 micron', category: 'Knits', riskLevel: 'amber', warning: 'Return rate up on itch complaints below 18.5 micron blends', usedIn: [] },
];

export const productionOrders = [
  { id: 1, productId: 'boxy-tee-natural', productName: 'Boxy Tee — Natural', vendorName: 'Pressline Manufacturing', stage: 'In production', units: 800, poNumber: 'PO-2214', dueDate: 'Aug 09' },
  { id: 2, productId: 'canvas-tote', productName: 'Waxed Canvas Tote', vendorName: 'Altiplano Leatherworks', stage: 'In production', units: 400, poNumber: 'PO-2231', dueDate: 'Aug 22' },
  { id: 3, productId: 'canvas-work-cap', productName: 'Canvas Work Cap', vendorName: 'instagram.com/duvalstitch', stage: 'Delivered', units: 600, poNumber: 'PO-2109', dueDate: 'Jun 01' },
  { id: 4, productId: 'heavyweight-hoodie-ash', productName: 'Heavyweight Hoodie — Ash', vendorName: 'Sable & Loom', stage: 'Sampling', units: 0, poNumber: '—', dueDate: 'TBD' },
];

export const salesData = {
  connectedStore: 'Shopify — aldercreekstudio.com',
  connected: true,
  totalRevenue: 48200,
  totalOrders: 612,
  topProducts: [
    { name: 'Canvas Work Cap', unitsSold: 340, revenue: 13940 },
    { name: 'Boxy Tee — Natural', unitsSold: 512, revenue: 18944 },
  ],
  monthly: [
    { month: 'Feb', revenue: 4200 },
    { month: 'Mar', revenue: 5100 },
    { month: 'Apr', revenue: 6800 },
    { month: 'May', revenue: 9200 },
    { month: 'Jun', revenue: 11400 },
    { month: 'Jul', revenue: 11500 },
  ],
};

export const productPerformance = {
  'canvas-work-cap': { sellThrough: 0.71, inventoryRisk: 'Low', unitsSold: 340, unitsRemaining: 138 },
  'boxy-tee-natural': { sellThrough: 0.64, inventoryRisk: 'Watch', unitsSold: 512, unitsRemaining: 288 },
};

export const financialModels = {
  'canvas-work-cap': { unitCost: 6.4, wholesalePrice: 18, retailPrice: 41, breakEvenUnits: 219, suggestedRetail: 42, marginAtRetail: 0.85 },
  'boxy-tee-natural': { unitCost: 5.8, wholesalePrice: 16, retailPrice: 37, breakEvenUnits: 331, suggestedRetail: 38, marginAtRetail: 0.84 },
  'heavyweight-hoodie-ash': { unitCost: 21.2, wholesalePrice: 52, retailPrice: 118, breakEvenUnits: 128, suggestedRetail: 124, marginAtRetail: 0.82 },
};

export const contentPosts = [
  { id: 1, platform: 'instagram', caption: 'Fall Capsule 02 preview — the overcoat is coming.', status: 'Scheduled', scheduledFor: 'Jul 12, 9:00 AM', productId: 'wool-blend-overcoat' },
  { id: 2, platform: 'tiktok', caption: 'Behind the scenes: sampling the hoodie in Ash', status: 'Scheduled', scheduledFor: 'Jul 09, 5:30 PM', productId: 'heavyweight-hoodie-ash' },
  { id: 3, platform: 'instagram', caption: 'Restock: Canvas Work Cap', status: 'Posted', scheduledFor: 'Jun 28, 10:00 AM', productId: 'canvas-work-cap' },
  { id: 4, platform: 'youtube', caption: 'Studio tour + how we source denim', status: 'Draft', scheduledFor: '—', productId: null },
];

export const socialAccounts = [
  { platform: 'instagram', handle: '@aldercreekstudio', connected: true, followers: 18400 },
  { platform: 'tiktok', handle: '@aldercreek', connected: true, followers: 6200 },
  { platform: 'youtube', handle: 'Aldercreek Studio', connected: false, followers: 0 },
];

export const notifications = [
  { id: 1, title: 'Readiness score cleared the gate', body: 'Heavyweight Hoodie — Ash reached 82% factory readiness.', time: '2h ago', read: false, type: 'success' },
  { id: 2, title: 'Vendor quote received', body: 'Norte Textile Co. quoted $22.40/unit for Selvedge Straight Jean.', time: '1d ago', read: false, type: 'info' },
  { id: 3, title: 'Material price alert', body: 'Genuine Shearling moved +18% since your last quote.', time: '2d ago', read: true, type: 'warning' },
  { id: 4, title: 'Sample revision requested', body: 'Toweling Polo proto needs a lighter collar interfacing.', time: '4d ago', read: true, type: 'warning' },
  { id: 5, title: 'Timeline conflict flagged', body: 'Fall Capsule 02 has two products behind their launch window.', time: '5d ago', read: true, type: 'warning' },
];

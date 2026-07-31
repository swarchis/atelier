// Per-platform adapters for pulling orders/inventory (and, where
// supported, publishing a product) to/from a connected storefront. One
// sync engine, not a copy-pasted syncSales() per platform — SalesDashboard.jsx
// calls these and does the SKU-matching/aggregation itself (same shape as
// the original Shopify-only sync), so every platform's raw order format
// gets normalized in one place per adapter rather than leaking
// platform-specific fields further into the app.
import { apiPost } from './aiApi.js';

// These endpoints proxy a request to the connected storefront using the
// founder's own store credentials, so the backend requires a signed-in caller
// — apiPost attaches the Supabase JWT. Response handling is unchanged.
async function postJSON(path, body) {
  const res = await apiPost(path, body);
  const data = await res.json().catch(() => null);
  if (!data || !data.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}

// Normalizes a WooCommerce order into the same shape syncSales() already
// expects from Shopify: { created_at, total_price, line_items: [{ sku, price, quantity }] }.
function normalizeWooOrder(o) {
  return {
    created_at: o.date_created,
    total_price: o.total,
    line_items: (o.line_items || []).map(li => ({ sku: li.sku, price: li.price, quantity: li.quantity })),
  };
}

// Etsy's hourly token expiry used to be handled here: the browser watched
// token_expires_at, called /api/etsy/refresh-token with the refresh token it was
// holding, and handed the new pair back for the caller to persist. All of that
// depended on the browser having the credentials in the first place. It now
// happens inside the backend's getStoreConnection, and that endpoint is gone.
//
// These adapters send only `brandId`. The backend looks up the connection,
// refreshes it if needed, and never accepts a credential from the caller.
//
// Shopify is intentionally excluded from `publishProduct` — the
// connection itself is disabled ("coming soon") pending Atelier's own
// App Store review, so there's no live connection to publish through
// yet even though the read side (fetchOrders/fetchInventory) still
// works for any pre-existing test connection.
export const platformAdapters = {
  shopify: {
    label: 'Shopify',
    async fetchOrders(conn) {
      const { orders } = await postJSON('/api/shopify/fetch-orders', { brandId: conn.brand_id });
      return orders || [];
    },
    async fetchInventory(conn) {
      const { products } = await postJSON('/api/shopify/fetch-inventory', { brandId: conn.brand_id });
      return products || [];
    },
  },
  woocommerce: {
    label: 'WooCommerce',
    // The one place credentials legitimately cross the wire: the founder types
    // them into the connect form. The backend validates them against the store
    // and stores them, so this is the last time the browser sees them.
    async connect({ brandId, storeUrl, consumerKey, consumerSecret }) {
      await postJSON('/api/woocommerce/connect', { brandId, storeUrl, consumerKey, consumerSecret });
    },
    async fetchOrders(conn) {
      const { orders } = await postJSON('/api/woocommerce/fetch-orders', { brandId: conn.brand_id });
      return (orders || []).map(normalizeWooOrder);
    },
    async fetchInventory(conn) {
      const { products } = await postJSON('/api/woocommerce/fetch-inventory', { brandId: conn.brand_id });
      return products || [];
    },
    // Creates a draft product — the founder reviews and publishes live
    // themselves in WooCommerce. Returns { externalId, externalUrl }.
    async publishProduct(conn, { name, description, price, sku, imageUrl }) {
      return postJSON('/api/woocommerce/publish-product', {
        brandId: conn.brand_id, name, description, price, sku, imageUrl,
      });
    },
  },
  etsy: {
    label: 'Etsy',
    async fetchOrders(conn) {
      const { receipts } = await postJSON('/api/etsy/fetch-orders', { brandId: conn.brand_id });
      return receipts || [];
    },
    async fetchInventory(conn) {
      const { listings } = await postJSON('/api/etsy/fetch-inventory', { brandId: conn.brand_id });
      return listings || [];
    },
    // Creates a draft listing (text only — Etsy image upload is a
    // separate multipart endpoint this doesn't call). Requires a real
    // Etsy taxonomy_id; see README, there's no safe default to guess.
    async publishProduct(conn, { name, description, price, sku, quantity, taxonomyId }) {
      return postJSON('/api/etsy/publish-listing', {
        brandId: conn.brand_id,
        title: name, description, price, sku, quantity, taxonomyId,
      });
    },
  },
};

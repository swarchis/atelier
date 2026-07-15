// Every OAuth connect flow (Shopify, Etsy, Instagram, TikTok, YouTube,
// Pinterest) redirects back here with a short-lived one-time `handoff`
// code instead of the raw access token in the URL — see api/index.js's
// OAuth handoff helper for why. This consumes that code exactly once.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function consumeOAuthHandoff(code) {
  const res = await fetch(`${API_BASE}/api/oauth/consume?code=${encodeURIComponent(code)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Could not complete the connection.');
  return data;
}

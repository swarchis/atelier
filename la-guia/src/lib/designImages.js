import { supabase } from './supabase.js';

export function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

export async function urlToBase64(url) {
  const blob = await fetch(url).then(r => r.blob());
  return { blob, base64: await blobToBase64(blob) };
}

export function base64ToDataUrl(base64, mimeType = 'image/png') {
  return `data:${mimeType};base64,${base64}`;
}

export async function base64ToBlob(base64, mimeType = 'image/png') {
  const res = await fetch(base64ToDataUrl(base64, mimeType));
  return res.blob();
}

// The rolling design_versions row that stores the full layered Photopea
// document (PSD) — the design's working file. Display surfaces (previews,
// history, activity) must SKIP rows with this label; the canvas-restore path
// PREFERS it so reopening a design brings the whole layer stack back.
export const PSD_VERSION_LABEL = 'Working file (PSD)';

// Uploads the layered working file. Timestamped name on purpose: public URLs
// are CDN-cached, so reusing one filename would serve stale bytes.
export async function uploadDesignPsd(blob, productId) {
  const fileName = `${productId}-working-${Date.now()}.psd`;
  const { error } = await supabase.storage.from('mockups').upload(fileName, blob, { contentType: 'image/vnd.adobe.photoshop', upsert: true });
  if (error) throw new Error('PSD upload failed: ' + error.message);
  const { data: { publicUrl } } = supabase.storage.from('mockups').getPublicUrl(fileName);
  return publicUrl;
}

// Formats a browser can actually paint in an <img>. A PSD (or TIFF) can be
// stored and reopened in the editor, but it can never be a thumbnail.
const RENDERABLE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const NON_RENDERABLE_EXT = /\.(psd|psb|tiff?|ai|eps)$/i;

export function isRenderableImageUrl(url) {
  if (!url) return false;
  const path = String(url).split('?')[0];
  if (NON_RENDERABLE_EXT.test(path)) return false;
  // Unknown/extension-less URLs get the benefit of the doubt; an onError
  // fallback in the UI catches anything that still fails to paint.
  return RENDERABLE_EXT.test(path) || !/\.[a-z0-9]{2,4}$/i.test(path);
}

// Map a blob's real type to a file extension, so what we store matches what
// it actually is. This used to force `.png` + image/png on everything, which
// silently stored an uploaded PSD's bytes under a .png name — the file was
// then unrenderable everywhere it appeared as a thumbnail.
const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/vnd.adobe.photoshop': 'psd',
  'application/x-photoshop': 'psd',
  'image/tiff': 'tiff',
};

// Uploads a generated/edited image to the shared `mockups` bucket (same one
// Design Studio snapshots and tech pack images already use) and returns its
// public URL for storing on a design_versions row, moodboard entry, etc.
export async function uploadDesignImage(blob, productId, prefix = 'ai') {
  const type = blob?.type || 'image/png';
  const ext = EXT_BY_TYPE[type] || 'png';
  const contentType = EXT_BY_TYPE[type] ? type : 'image/png';
  const fileName = `${productId}-${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('mockups').upload(fileName, blob, { contentType, upsert: true });
  if (error) throw new Error('Image upload failed: ' + error.message);
  const { data: { publicUrl } } = supabase.storage.from('mockups').getPublicUrl(fileName);
  return publicUrl;
}

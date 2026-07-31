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

// Removes files from `mockups` that nothing points at any more.
//
// Every autosave uploads a NEW timestamped file (see above — the timestamp is
// required, since reusing a name serves stale CDN bytes) and repoints the rolling
// version row at it. Nothing ever removed the file it replaced, which is why the
// bucket reached 2304 MB of orphans against 65 MB of live data, 1933 MB of it
// superseded working PSDs.
//
// Call this AFTER the row that replaces them has been written. Deleting first
// means a failed write leaves a row pointing at a file that no longer exists,
// which is worse than an orphan — a broken design instead of a wasted megabyte.
//
// Deletion is best-effort by design. The DELETE policy added in 057 is
// owner-scoped, so removing a file uploaded by a different team member matches no
// rows and returns `{data: [], error: null}` — success-shaped and inert. That is
// logged rather than treated as failure, because the save it follows genuinely
// did succeed and there is nothing the user could do about it.
export async function deleteMockupFiles(urls) {
  const prefix = import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/mockups/`
    : null;
  if (!prefix) return;

  const names = [...new Set(
    (urls || [])
      .filter(u => typeof u === 'string' && u.startsWith(prefix))
      .map(u => decodeURIComponent(u.slice(prefix.length).split('?')[0]))
      .filter(Boolean)
  )];
  if (!names.length) return;

  try {
    const { data: removed, error } = await supabase.storage.from('mockups').remove(names);
    if (error) {
      console.warn('Could not remove superseded mockup files:', error.message);
    } else if (!removed || removed.length < names.length) {
      console.warn(
        `Removed ${removed?.length || 0}/${names.length} superseded mockup files — ` +
        'the rest were uploaded by another member and are not deletable under the owner-scoped policy.'
      );
    }
  } catch (err) {
    console.warn('Could not remove superseded mockup files:', err.message);
  }
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

// True when a file is a Photoshop document (by MIME or extension — browsers
// report PSD inconsistently, and often not at all).
export function isPsdFile(file) {
  if (!file) return false;
  return /photoshop|psd/i.test(file.type || '') || /\.psb?$|\.psd$/i.test(file.name || '');
}

// Render a PSD's flattened composite to a PNG blob so it can be used as a
// thumbnail. A PSD can't be painted by an <img>, so without this every
// preview surface has to fall back to a placeholder icon. ag-psd is imported
// lazily — it's only needed on the rare upload, and shouldn't sit in the main
// bundle. Returns null if the file has no usable composite, in which case the
// caller just goes without a thumbnail.
export async function psdToPngBlob(file, maxEdge = 1200) {
  const { readPsd } = await import('ag-psd');
  const buffer = await file.arrayBuffer();
  // Layer bitmaps are irrelevant here and by far the most expensive part to
  // decode; only the merged composite is needed for a thumbnail.
  const psd = readPsd(buffer, { skipLayerImageData: true, skipThumbnail: false });
  const source = psd.canvas;
  if (!source || !source.width || !source.height) return null;

  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

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

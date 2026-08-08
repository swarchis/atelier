// What a file input is allowed to accept, and why.
//
// Two problems this closes.
//
// 1. The Product Media Bin had no `accept` at all, so any file went up.
// 2. Worse, uploadProductAsset built the storage path from the user's own
//    filename: `file.name.split('.').pop()`. An upload called `x.html` or
//    `x.svg` therefore landed at a PUBLIC url on our storage domain, serving
//    whatever it contained. SVG carries <script>, so that is stored XSS on our
//    own origin. The extension now comes from a validated allowlist rather
//    than from the caller.
//
// `accept` on an <input> is a file-picker hint, not a control — it is trivially
// bypassed by drag-drop or a crafted request. This module is the actual check,
// and it runs before anything is uploaded.

// Per purpose, because these are genuinely different jobs. The media bin is
// meant to hold video (factory footage), the canvas is not.
const KINDS = {
  // Canvas documents: flat images plus layered working files.
  design: {
    label: 'an image or PSD',
    maxBytes: 80 * 1024 * 1024,
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/vnd.adobe.photoshop': 'psd',
      'application/x-photoshop': 'psd',
      'application/octet-stream': null, // resolved by extension below
    },
    exts: { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', psd: 'psd', psb: 'psb' },
  },
  // Anywhere an image is read or shown: moodboards, AI inputs, extra views.
  image: {
    label: 'a PNG, JPG or WebP image',
    maxBytes: 20 * 1024 * 1024,
    types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' },
    exts: { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp' },
  },
  // The product media bin: photography, factory video, artwork, spec PDFs.
  asset: {
    label: 'an image, video or PDF',
    maxBytes: 200 * 1024 * 1024,
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
    },
    exts: { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', gif: 'gif', mp4: 'mp4', mov: 'mov', webm: 'webm', pdf: 'pdf' },
  },
};

// Never allowed anywhere, whatever the MIME type claims. SVG and HTML execute
// script when opened from a public url; the rest are executables and archives
// with no business in a garment workspace.
const BLOCKED_EXT = /^(svg|svgz|html?|xhtml|xml|js|mjs|jsx|json|php|phtml|asp|aspx|jsp|sh|bash|bat|cmd|com|exe|dll|msi|scr|vbs|ps1|jar|apk|app|dmg|zip|rar|7z|tar|gz|iso)$/i;

export function acceptAttr(kind) {
  const spec = KINDS[kind];
  if (!spec) return undefined;
  return Object.keys(spec.exts).map(e => `.${e}`).join(',');
}

// Throws with a message worth showing the user, or returns the extension and
// content type the upload should actually be stored with.
export function validateUpload(file, kind = 'image') {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`Unknown upload kind: ${kind}`);
  if (!file) throw new Error('No file selected.');

  const name = String(file.name || '');
  const rawExt = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

  if (BLOCKED_EXT.test(rawExt)) {
    throw new Error(`.${rawExt} files can't be uploaded. Atelier only takes ${spec.label}.`);
  }

  // The extension has to be on the allowlist. Browsers report an empty or
  // generic MIME type often enough (PSD especially) that the extension is the
  // more reliable of the two, so it decides.
  const ext = spec.exts[rawExt];
  if (!ext) {
    throw new Error(`${name || 'That file'} isn't a supported type. Upload ${spec.label}.`);
  }

  // If the browser did give a type, it has to agree with the allowlist too.
  // A .png carrying a video/mp4 type is not something to store quietly.
  const mime = String(file.type || '').toLowerCase();
  if (mime && !Object.prototype.hasOwnProperty.call(spec.types, mime)) {
    const looksRight = mime.startsWith('image/') && ['png', 'jpg', 'webp', 'gif'].includes(ext);
    if (!looksRight) {
      throw new Error(`That file says it is ${mime}, which doesn't match its .${rawExt} name. Upload ${spec.label}.`);
    }
  }

  if (file.size > spec.maxBytes) {
    const mb = Math.round(spec.maxBytes / (1024 * 1024));
    throw new Error(`That file is ${Math.round(file.size / (1024 * 1024))}MB. The limit here is ${mb}MB.`);
  }

  return { ext, contentType: mime || 'application/octet-stream' };
}

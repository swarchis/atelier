// Two separate questions, deliberately not the same answer.
//
// The landing page runs, all at once: a three.js intro with bloom
// post-processing, four 30-58vw divs under `filter: blur(90px)`, an SVG goo
// filter over animated blobs, a 1400px cursor orb, and a page of scroll-driven
// framer-motion. On integrated graphics that can starve the compositor badly
// enough that nothing paints but the background.
//
//   isLowPowerDevice()  → drop the sustained CSS paint cost (ds-lite).
//   shouldSkipIntro()   → don't play the WebGL intro at all.
//
// These started as one check, which was a mistake: it meant a laptop reporting
// 4 cores lost the brand animation entirely to save paint cost it was probably
// coping with fine. The CSS profile is nearly invisible, so it can apply
// broadly. Skipping the intro is the loud one, so it now needs real evidence
// the machine cannot render it — and it no longer has to carry the blank-screen
// risk on its own, because the intro can't strand anyone any more: it and the
// page no longer mount together, it auto-advances after 10s, it bails on a lost
// WebGL context, and a failed chunk hits an error boundary.
let liteCache = null;
let skipCache = null;

function manualOverride() {
  // /welcome?lite=1 sticks, ?lite=0 clears it. Detection is a guess, and
  // someone whose machine still can't cope needs a way through that doesn't
  // require us to ship a fix.
  try {
    const param = new URLSearchParams(window.location.search).get('lite');
    if (param === '1') localStorage.setItem('atelier_lite', '1');
    if (param === '0') localStorage.removeItem('atelier_lite');
    return localStorage.getItem('atelier_lite') === '1';
  } catch {
    return false; // private mode blocks localStorage
  }
}

// Reports the GPU string when the driver allows it. Software rasterisers name
// themselves here, and they are the one case where the intro is hopeless.
function rendererInfo() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return { webgl2: false, renderer: '' };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl2: true, renderer };
  } catch {
    return { webgl2: false, renderer: '' };
  }
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;

// Cheap CSS profile. Errs toward applying: what it costs is some glow.
export function isLowPowerDevice() {
  if (liteCache !== null) return liteCache;
  if (typeof window === 'undefined') { liteCache = true; return liteCache; }

  if (manualOverride()) { liteCache = true; return liteCache; }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { liteCache = true; return liteCache; }

  // deviceMemory is Chromium-only, reported in GiB rounded down to a power of
  // two and capped at 8. Absent (Safari, Firefox) means unknown, not low.
  const memory = navigator.deviceMemory;
  if (typeof memory === 'number' && memory <= 4) { liteCache = true; return liteCache; }

  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0 && cores <= 4) { liteCache = true; return liteCache; }

  const { webgl2, renderer } = rendererInfo();
  liteCache = !webgl2 || SOFTWARE_GPU.test(renderer);
  return liteCache;
}

// Skipping the intro needs a real reason, not a guess. Four cores is an
// ordinary ultrabook, and those run a 10-second animation perfectly well.
export function shouldSkipIntro() {
  if (skipCache !== null) return skipCache;
  if (typeof window === 'undefined') { skipCache = true; return skipCache; }

  if (manualOverride()) { skipCache = true; return skipCache; }
  // An explicit accessibility preference, so it outranks any capability guess.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { skipCache = true; return skipCache; }

  // Genuinely tiny machines only.
  const memory = navigator.deviceMemory;
  if (typeof memory === 'number' && memory <= 2) { skipCache = true; return skipCache; }
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0 && cores <= 2) { skipCache = true; return skipCache; }

  // No WebGL2 means it cannot render at all; a software rasteriser means it
  // renders at about two frames a second. Both are facts, not estimates.
  const { webgl2, renderer } = rendererInfo();
  skipCache = !webgl2 || SOFTWARE_GPU.test(renderer);
  return skipCache;
}

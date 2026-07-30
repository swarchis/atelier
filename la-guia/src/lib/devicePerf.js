// Is this machine likely to choke on the landing page's heavy effects?
//
// The landing page runs, all at once: a three.js intro with bloom
// post-processing, four 30-58vw divs under `filter: blur(90px)`, an SVG goo
// filter over animated blobs, a 1400px cursor orb, and a page of scroll-driven
// framer-motion. On a laptop with integrated graphics that combination can
// starve the compositor badly enough that nothing paints but the background —
// which is the bug this exists to prevent.
//
// The checks are deliberately blunt. Guessing "slow" wrongly costs a visitor
// some decoration; guessing "fast" wrongly costs them the whole page.
let cached = null;

export function isLowPowerDevice() {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') { cached = true; return cached; }

  // Manual escape hatch. Detection is a guess, and someone whose machine still
  // can't cope needs a way through that doesn't require us to ship a fix:
  // /welcome?lite=1 sticks, ?lite=0 clears it.
  try {
    const param = new URLSearchParams(window.location.search).get('lite');
    if (param === '1') localStorage.setItem('atelier_lite', '1');
    if (param === '0') localStorage.removeItem('atelier_lite');
    if (localStorage.getItem('atelier_lite') === '1') { cached = true; return cached; }
  } catch { /* private mode blocks localStorage; fall through to detection */ }

  // Asked for less motion — honour it before measuring anything.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { cached = true; return cached; }

  // navigator.deviceMemory is Chromium-only and reports in GiB, rounded down
  // to a power of two. Absent (Safari, Firefox) means unknown, not low.
  const memory = navigator.deviceMemory;
  if (typeof memory === 'number' && memory <= 4) { cached = true; return cached; }

  // 4 or fewer logical cores covers the low-end laptops this is aimed at.
  // Older browsers omit it, so only act when it is actually reported.
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0 && cores <= 4) { cached = true; return cached; }

  // No WebGL2 means either very old hardware or a blocklisted driver. Either
  // way the intro cannot render, and the CSS filters will be software-painted.
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) { cached = true; return cached; }
    // Software renderers (SwiftShader, llvmpipe, "Software Adapter") report
    // themselves here. They will run the intro — at about two frames a second.
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) { cached = true; return cached; }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = true;
    return cached;
  }

  cached = false;
  return cached;
}

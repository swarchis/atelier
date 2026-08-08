// Recovery for a browser holding a stale build.
//
// _headers stops this happening for new visits. This handles the two cases it
// cannot: a tab that was already open when you deployed, and a CDN edge that
// has not caught up yet. In both, a dynamic import asks for a chunk filename
// from the previous build and gets a 404 or an HTML error page back.
//
// Vite fires `vite:preloadError` on window for exactly this, so we do not have
// to pattern-match error strings for the common path. The message matcher is a
// backstop for import failures that arrive some other way.

const RELOAD_KEY = 'atelier_stale_reload_at';
const BUSTER = '_v';
// Long enough that a genuinely broken build cannot put the tab in a reload
// loop, short enough that a second real deploy later in the session still
// recovers on its own.
const RELOAD_COOLDOWN_MS = 30000;

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i;

export function isStaleDeployError(err) {
  if (!err) return false;
  const message = typeof err === 'string' ? err : (err.message || '');
  return CHUNK_ERROR.test(message);
}

// Reloads once, with a cache-busting query so the request cannot be answered
// from the very cache that caused the problem. Returns false when it has
// already tried recently, so callers can show a real message instead of
// bouncing the tab forever.
export function recoverFromStaleDeploy() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch { /* private mode */ }
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* ignore */ }

  const url = new URL(window.location.href);
  url.searchParams.set(BUSTER, String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

// Takes the cache-buster back out of the address bar once the app is running,
// so a recovered session does not leave a confusing url to bookmark or share.
export function cleanUpBuster() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(BUSTER)) return;
    url.searchParams.delete(BUSTER);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch { /* ignore */ }
}

export function installStaleDeployHandler() {
  // Vite's own signal, fired when a preloaded chunk fails to load.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault(); // stop it becoming an unhandled error before we act
    console.warn('A chunk from an older build failed to load; reloading to pick up the new one.');
    recoverFromStaleDeploy();
  });

  // Backstop: an import that rejects outside the preload path surfaces here.
  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleDeployError(event.reason)) {
      console.warn('Dynamic import failed against an older build; reloading.');
      recoverFromStaleDeploy();
    }
  });

  cleanUpBuster();
}

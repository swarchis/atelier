// Tiny app-wide toast bus — no dependency, no React context required. Import
// `toast` anywhere and call toast.error / toast.success / toast.info; the
// ToastHost component (mounted once in the authenticated shell) renders and
// auto-dismisses them. Replaces the old blocking window.alert() error UX.
const listeners = new Set();
let nextId = 1;

function push(kind, message) {
  const t = { id: nextId++, kind, message: String(message) };
  listeners.forEach((fn) => fn(t));
}

export const toast = {
  error: (m) => push('error', m),
  success: (m) => push('success', m),
  info: (m) => push('info', m),
};

export function subscribeToToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

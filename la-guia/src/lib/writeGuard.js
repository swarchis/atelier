// la-guia/src/lib/writeGuard.js
//
// Turns a silently-refused write into a real error.
//
// ── WHY ─────────────────────────────────────────────────────────────────────
// An UPDATE or DELETE that RLS refuses is NOT an error. Postgres matches zero
// rows and PostgREST returns `{ data: null, error: null }` (update) or
// `{ data: [], error: null }` (delete) — indistinguishable from success unless
// you look at what came back. That is how autosave reported success while
// saving nothing for months, and how nine `.remove()` call sites let the
// mockups bucket reach 2304 MB of orphans.
//
// This matters most for VIEWERS. 111 restrictive policies across 37 tables
// require `has_brand_write_access()`, which admits only owner/admin/editor —
// a viewer is excluded by definition. So every UPDATE/DELETE a viewer attempts
// on those tables matches zero rows and reports success to the UI.
//
// INSERTs are not affected: a blocked INSERT violates the WITH CHECK and raises
// a real error, so those call sites already fail loudly.
//
// ── USAGE ───────────────────────────────────────────────────────────────────
//   await assertWrote(
//     supabase.from('products').update({ stage }).eq('id', id).select('id')
//   );
//
// The `.select(...)` is REQUIRED — it is what makes the refusal visible. A
// query without it always resolves to null data and would trip this guard on
// every call, which is why the helper says so explicitly rather than guessing.

// Deliberately vague about the cause: from the client we cannot tell a
// permission refusal from a row that was deleted out from under us, and
// claiming the wrong one sends people debugging in the wrong place.
const BLOCKED = 'That change was not saved — you may not have permission to edit this, or it no longer exists.';

export async function assertWrote(query, message = BLOCKED) {
  const { data, error } = await query;
  if (error) throw error;
  // `data` is null when the caller forgot .select(); an empty array when the
  // statement ran but matched nothing. Both mean "nothing was written".
  if (!data || (Array.isArray(data) && data.length === 0)) throw new Error(message);
  return data;
}

// Same check, without throwing — for callers that already branch on an error
// value rather than a rejection. Returns an Error or null, matching the shape
// `const { error } = await ...` call sites already destructure.
export async function checkWrote(query, message = BLOCKED) {
  const { data, error } = await query;
  if (error) return error;
  if (!data || (Array.isArray(data) && data.length === 0)) return new Error(message);
  return null;
}

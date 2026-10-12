// Supabase auth storage adapter. Falls back to undefined during SSR (no window).
export function authStorage() {
  if (typeof window === "undefined") return undefined;
  return localStorage;
}

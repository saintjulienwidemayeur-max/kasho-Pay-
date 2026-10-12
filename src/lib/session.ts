// Real session backed by Supabase Auth + the user's profile row.
// `getSession()` is synchronous (reads a cache that `loadSession()` fills before any
// authenticated page renders), so existing components keep working.
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRow } from "@/integrations/supabase/types";

export type KashoSession = {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  kashoId: string;
  profile: ProfileRow | null;
};

let cache: KashoSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function build(user: { id: string; email?: string | null; user_metadata?: Record<string, any> }, p: ProfileRow | null): KashoSession {
  const meta = user.user_metadata ?? {};
  const firstName = p?.first_name ?? meta["first_name"] ?? "";
  const lastName = p?.last_name ?? meta["last_name"] ?? "";
  const email = user.email ?? "";
  const name = (p?.display_name || `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Kasho User").trim();
  return {
    id: user.id, name, email, firstName, lastName,
    username: p?.username ?? "",
    kashoId: p?.kasho_id ?? "",
    profile: p,
  };
}

export async function loadSession(): Promise<KashoSession | null> {
  if (typeof window === "undefined") return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    cache = null;
    emit();
    return null;
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  cache = build(user, (profile as ProfileRow | null) ?? null);
  emit();
  return cache;
}

export const refreshSession = loadSession;

export function getSession(): KashoSession | null {
  return cache;
}

export function useSession(): KashoSession | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSession,
    () => null,
  );
}

export async function clearSession() {
  await supabase.auth.signOut();
  cache = null;
  emit();
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Short, friendly name for greetings. A real full name yields the first name.
// A single long token (e.g. an email local-part) falls back to its initial.
export function greetingName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "there";
  if (parts.length > 1) return capitalize(parts[0]!);
  const token = parts[0]!;
  return token.length <= 12 ? capitalize(token) : `${token[0]!.toUpperCase()}.`;
}

function capitalize(s: string) {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

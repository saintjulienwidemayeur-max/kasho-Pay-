import { toast } from "sonner";

// App-wide toast behaviour, applied once to the shared `toast` function:
//  - the same message shown twice is one toast (id = kind + text), so repeated taps do not stack copies;
//  - errors and successes disappear faster than sonner's 4 s default;
//  - a cancelled action (user closed a 2FA / password prompt) never shows anything;
//  - dismissStaleToasts() clears toasts left over from the previous screen on navigation.
const shownAt = new Map<string | number, number>();
const DURATION: Record<string, number> = { error: 3000, success: 2500, warning: 3500 };

for (const kind of ["success", "error", "warning", "info", "message"] as const) {
  const original = toast[kind] as (m: unknown, d?: Record<string, unknown>) => string | number;
  (toast as unknown as Record<string, unknown>)[kind] = (message: unknown, data?: Record<string, unknown>) => {
    if (message === "cancelled") return "";
    const id = (data?.["id"] as string | number | undefined) ?? (typeof message === "string" ? `${kind}:${message}` : undefined);
    const duration = (data?.["duration"] as number | undefined) ?? DURATION[kind];
    const res = original(message, { ...data, ...(id !== undefined ? { id } : {}), ...(duration !== undefined ? { duration } : {}) });
    shownAt.set(res, Date.now());
    return res;
  };
}

/** Dismisses toasts that were already on screen before a navigation (not the one the navigation itself caused). */
export function dismissStaleToasts(graceMs = 800) {
  const now = Date.now();
  for (const [id, t] of shownAt) {
    if (now - t > graceMs) { toast.dismiss(id); shownAt.delete(id); }
  }
}

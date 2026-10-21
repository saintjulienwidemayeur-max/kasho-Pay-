// Bridge between plain API code (src/lib/api.ts) and the 2FA prompt dialog (MfaPrompt in stepup.tsx).
// The dialog registers itself here when the authenticated layout mounts; `call` asks for a code when the backend
// answers 403 MFA_REQUIRED, then retries the request once.
type Prompt = () => Promise<void>;

let prompt: Prompt | null = null;
let inFlight: Promise<void> | null = null;

export function registerMfaPrompt(fn: Prompt | null) {
  prompt = fn;
}

/** True when a prompt is mounted and can ask the user. */
export const canPromptMfa = () => prompt !== null;

/** Resolves once the session is aal2; rejects with Error("cancelled") if the user gives up. Concurrent calls share one prompt. */
export function requestMfa(): Promise<void> {
  if (!prompt) return Promise.reject(new Error("2FA is required."));
  inFlight ??= prompt().finally(() => { inFlight = null; });
  return inFlight;
}

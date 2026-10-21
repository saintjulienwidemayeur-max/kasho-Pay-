// Re-authentication before sensitive actions: password, plus the 2FA code when 2FA is enabled.
import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/format";

/** Returns the verified TOTP factor id, or null if the user has no 2FA. */
export async function verifiedTotpFactor(): Promise<string | null> {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.[0]?.id ?? null; // listFactors().totp only contains verified factors
}

type StepUpAsk = {
  /** Asks for the password (and the 2FA code when needed) and resolves with the password. */
  (): Promise<string>;
  /**
   * Same, but runs `action(password)` while the dialog stays open. A wrong password (PASSWORD_INVALID) shows an inline
   * error and lets the user try again; any other error closes the dialog and is thrown to the caller.
   */
  <T>(action: (password: string) => Promise<T>): Promise<T>;
};

export function useStepUp() {
  const [open, setOpen] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: (v: unknown) => void; reject: (e: Error) => void; action?: ((p: string) => Promise<unknown>) | undefined } | null>(null);

  const ask = useCallback((async (action?: (p: string) => Promise<unknown>): Promise<unknown> => {
    const factor = await verifiedTotpFactor();
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Code needed only if 2FA is on and this session has not passed it yet.
    setNeedsCode(!!factor && aal?.currentLevel !== "aal2");
    setPassword(""); setCode(""); setError("");
    setOpen(true);
    return new Promise<unknown>((resolve, reject) => { pending.current = { resolve, reject, action }; });
  }) as StepUpAsk, []);

  const close = (err?: Error) => {
    setOpen(false);
    if (err) pending.current?.reject(err);
    pending.current = null;
  };

  const submit = async () => {
    if (!password) return setError("Enter your password");
    setBusy(true);
    setError("");
    try {
      if (needsCode) {
        const factorId = await verifiedTotpFactor();
        if (!factorId) throw new Error("2FA is not set up.");
        const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
        if (mfaErr) { setCode(""); setError("Invalid 2FA code"); return; }
        setNeedsCode(false); // the session is aal2 now: a wrong password below must not ask for a code again
      }
      const p = pending.current;
      if (!p) return;
      let result: unknown = password;
      if (p.action) {
        try {
          result = await p.action(password);
        } catch (e) {
          if ((e as { code?: string } | null)?.code === "PASSWORD_INVALID") {
            setPassword("");
            setError("Wrong password. Try again.");
            setTimeout(() => document.getElementById("su-pw")?.focus(), 0);
            return;
          }
          pending.current = null;
          setOpen(false);
          p.reject(e instanceof Error ? e : new Error(errorMessage(e)));
          return;
        }
      }
      pending.current = null;
      setOpen(false);
      p.resolve(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) close(new Error("cancelled")); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Confirm it's you</DialogTitle>
          <DialogDescription>For your security, confirm your password{needsCode ? " and enter your 2FA code" : ""} to continue.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="su-pw">Password</Label>
            <Input id="su-pw" type="password" autoComplete="current-password" autoFocus className="h-11 rounded-xl" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} aria-invalid={!!error && !needsCode} aria-describedby={error ? "su-err" : undefined} />
          </div>
          {needsCode && (
            <div className="space-y-2">
              <Label htmlFor="su-code">2FA code</Label>
              <Input id="su-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="h-11 rounded-xl" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }} />
            </div>
          )}
          {error && <p id="su-err" role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl" disabled={busy || !password || (needsCode && code.length !== 6)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
  return { ask, dialog };
}

export const isCancelled = (e: unknown) => e instanceof Error && e.message === "cancelled";

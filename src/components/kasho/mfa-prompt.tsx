import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { status } from "@/components/kasho/status-modal";
import { errorMessage } from "@/lib/format";
import { registerMfaPrompt } from "@/lib/mfa-gate";
import { verifiedTotpFactor } from "@/lib/stepup";

/**
 * Asks for the 6-digit authenticator code when the backend answers 403 MFA_REQUIRED (2FA on, session not yet aal2).
 * Mount once inside the authenticated layout; src/lib/api.ts reaches it through mfa-gate, so it also works from
 * non-React code. On success the session is aal2 and the original request is retried by `call`.
 */
export function MfaPrompt() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  useEffect(() => {
    registerMfaPrompt(() => new Promise<void>((resolve, reject) => {
      pending.current?.reject(new Error("cancelled"));
      pending.current = { resolve, reject };
      status.close(); // a "Sending..." modal would sit on top of / under the code prompt
      setCode(""); setError(""); setOpen(true);
    }));
    return () => {
      registerMfaPrompt(null);
      pending.current?.reject(new Error("cancelled"));
      pending.current = null;
    };
  }, []);

  const cancel = () => {
    setOpen(false);
    pending.current?.reject(new Error("cancelled"));
    pending.current = null;
  };

  const submit = async () => {
    if (code.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const factorId = await verifiedTotpFactor();
      if (!factorId) throw new Error("2FA is not set up.");
      const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (mfaErr) { setCode(""); setError("Invalid 2FA code"); return; }
      await supabase.auth.refreshSession(); // the next request must carry the aal2 token
      const p = pending.current;
      pending.current = null;
      setOpen(false);
      p?.resolve();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) cancel(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Enter your 2FA code</DialogTitle>
          <DialogDescription>Open your authenticator app and enter the 6-digit code to continue.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">2FA code</Label>
            <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" autoFocus className="h-11 rounded-xl" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }} aria-invalid={!!error} aria-describedby={error ? "mfa-err" : undefined} />
          </div>
          {error && <p id="mfa-err" role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

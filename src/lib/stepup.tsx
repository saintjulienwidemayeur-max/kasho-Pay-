// Re-authentication before sensitive actions: password, plus the 2FA code when 2FA is enabled.
import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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

export function useStepUp() {
  const [open, setOpen] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: (p: string) => void; reject: (e: Error) => void } | null>(null);

  const ask = useCallback(async (): Promise<string> => {
    const factor = await verifiedTotpFactor();
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Code needed only if 2FA is on and this session has not passed it yet.
    setNeedsCode(!!factor && aal?.currentLevel !== "aal2");
    setPassword(""); setCode("");
    setOpen(true);
    return new Promise<string>((resolve, reject) => { pending.current = { resolve, reject }; });
  }, []);

  const close = (err?: Error) => {
    setOpen(false);
    if (err) pending.current?.reject(err);
    pending.current = null;
  };

  const submit = async () => {
    if (!password) return toast.error("Enter your password");
    setBusy(true);
    try {
      if (needsCode) {
        const factorId = await verifiedTotpFactor();
        if (!factorId) throw new Error("2FA is not set up.");
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
        if (error) throw new Error("Invalid 2FA code");
      }
      const p = pending.current;
      pending.current = null;
      setOpen(false);
      p?.resolve(password);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(new Error("cancelled")); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Confirm it's you</DialogTitle>
          <DialogDescription>For your security, confirm your password{needsCode ? " and enter your 2FA code" : ""} to continue.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="su-pw">Password</Label>
            <Input id="su-pw" type="password" autoComplete="current-password" autoFocus className="h-11 rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {needsCode && (
            <div className="space-y-2">
              <Label htmlFor="su-code">2FA code</Label>
              <Input id="su-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="h-11 rounded-xl" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
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

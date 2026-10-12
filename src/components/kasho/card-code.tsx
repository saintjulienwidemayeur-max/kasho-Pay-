// 4-digit card code: created once, then required to reveal card details.
import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { setCardCode } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { refreshSession } from "@/lib/session";
import { verifiedTotpFactor } from "@/lib/stepup";

type Mode = "create" | "enter";

/** Resolves with the 4-digit code once the user has entered (or created) it. Rejects with "cancelled". */
export function useCardCode(codeIsSet: boolean) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("enter");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: (c: string) => void; reject: (e: Error) => void } | null>(null);

  const ask = useCallback(async (): Promise<string> => {
    const factor = await verifiedTotpFactor();
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setNeeds2fa(!!factor && aal?.currentLevel !== "aal2");
    setMode(codeIsSet ? "enter" : "create");
    setCode(""); setConfirm(""); setPassword(""); setTotp("");
    setOpen(true);
    return new Promise<string>((resolve, reject) => { pending.current = { resolve, reject }; });
  }, [codeIsSet]);

  const close = () => {
    setOpen(false);
    pending.current?.reject(new Error("cancelled"));
    pending.current = null;
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (needs2fa) {
        const factorId = await verifiedTotpFactor();
        if (!factorId) throw new Error("2FA is not set up.");
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: totp.trim() });
        if (error) throw new Error("Invalid 2FA code");
      }
      if (mode === "create") {
        if (code !== confirm) throw new Error("The codes do not match.");
        await setCardCode({ data: { currentPassword: password, code } });
        await refreshSession();
      }
      const p = pending.current;
      pending.current = null;
      setOpen(false);
      p?.resolve(code);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const ready =
    code.length === 4 &&
    (mode === "enter" || (confirm.length === 4 && password.length > 0)) &&
    (!needs2fa || totp.length === 6);

  const otp = (value: string, onChange: (v: string) => void, id: string) => (
    <InputOTP id={id} maxLength={4} inputMode="numeric" pattern="[0-9]*" value={value} onChange={(v) => onChange(v.replace(/\D/g, ""))}>
      <InputOTPGroup>
        {[0, 1, 2, 3].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />)}
      </InputOTPGroup>
    </InputOTP>
  );

  const dialog = (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create your 4-digit code" : "Enter your 4-digit code"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "You need this code every time you view your card details. Do not share it."
              : "Enter your code to view your card details."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="cc-code">{mode === "create" ? "New code" : "Code"}</Label>
            {otp(code, setCode, "cc-code")}
          </div>
          {mode === "create" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cc-confirm">Confirm code</Label>
                {otp(confirm, setConfirm, "cc-confirm")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-pw">Password</Label>
                <Input id="cc-pw" type="password" autoComplete="current-password" className="h-11 rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}
          {needs2fa && (
            <div className="space-y-2">
              <Label htmlFor="cc-2fa">2FA code</Label>
              <Input id="cc-2fa" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="h-11 rounded-xl" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl" disabled={busy || !ready}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "create" ? "Create code" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
  return { ask, dialog };
}

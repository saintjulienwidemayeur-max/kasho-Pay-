import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/format";
import { clearSession } from "@/lib/session";

type State = "loading" | "setup" | "code" | "ok";

/**
 * Two-factor authentication is mandatory. Nothing of the app is shown until the account has a verified authenticator (TOTP) factor
 * and the session has passed it (aal2): a new account sets it up here, an account that has it types its code at every sign-in.
 * The backend enforces the same rule (REQUIRE_2FA_ALL), so skipping this screen does not open any money endpoint.
 */
export function TwoFactorGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    const { data: f } = await supabase.auth.mfa.listFactors();
    const verified = f?.totp?.[0]?.id ?? null; // listFactors().totp only holds verified factors
    setFactorId(verified);
    if (!verified) return setState("setup");
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setState(aal?.currentLevel === "aal2" ? "ok" : "code");
  }, []);
  useEffect(() => { void check().catch(() => setState("setup")); }, [check]);

  const start = async () => {
    setBusy(true); setError("");
    try {
      // Remove abandoned, never-verified attempts first.
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const x of (all?.all ?? []).filter((y) => y.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: x.id });
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Kasho Pay" });
      if (err) throw err;
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const verify = async (id: string) => {
    setBusy(true); setError("");
    try {
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: code.trim() });
      if (err) { setCode(""); setError("Invalid 2FA code"); return; }
      await supabase.auth.refreshSession(); // the next request must carry the aal2 token
      setSetup(null); setCode("");
      await check();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const signOut = async () => { await supabase.auth.signOut(); await clearSession(); window.location.assign("/welcome"); };

  if (state === "ok") return <>{children}</>;
  if (state === "loading") {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><ShieldCheck className="h-5 w-5" /></span>
          <h1 className="text-lg font-semibold">{state === "setup" ? "Turn on two-factor authentication" : "Enter your 2FA code"}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {state === "setup"
            ? "Kasho Pay only works with 2FA, because these tools can move money. Your authentication code is asked at every sign-in."
            : "Open your authenticator app and enter the 6-digit code to continue."}
        </p>

        {state === "setup" && !setup && (
          <Button className="h-11 w-full rounded-xl" disabled={busy} onClick={start}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enable 2FA
          </Button>
        )}

        {(setup || state === "code") && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const id = setup?.id ?? factorId; if (id && code.length === 6) void verify(id); }}>
            {setup && (
              <>
                <p className="text-sm">1. Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password).</p>
                <img src={setup.qr} alt="2FA QR code" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
                <p className="break-all text-xs text-muted-foreground">Can't scan? Enter this key: <span className="font-mono">{setup.secret}</span></p>
                <p className="text-sm">2. Enter the 6-digit code it shows.</p>
              </>
            )}
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" autoFocus aria-label="2FA code" aria-invalid={!!error}
              className="h-11 rounded-xl" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }} />
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {setup ? "Verify" : "Confirm"}
            </Button>
          </form>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="button" onClick={signOut} className="w-full text-center text-xs text-muted-foreground underline">Sign out</button>
      </div>
    </div>
  );
}

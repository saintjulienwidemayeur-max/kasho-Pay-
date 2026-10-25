import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/kasho/auth-layout";
import { PasswordStrength } from "@/components/kasho/password-strength";
import { verifiedTotpFactor } from "@/lib/stepup";
import { supabase } from "@/integrations/supabase/client";
import { noIndexMeta } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Réinitialiser le mot de passe | Kasho Pay" }, ...noIndexMeta] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [linkError, setLinkError] = useState(false);

  // The email link can arrive two ways: with the recovery session already in the URL (supabase-js reads it), or as
  // ?token_hash=...&type=recovery (checked here, so mail scanners that only fetch the page cannot use the link up).
  // An expired or already used link comes back as #error=...&error_code=otp_expired.
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (hash.get("error") || hash.get("error_code")) {
      setLinkError(true);
      return;
    }
    const tokenHash = url.searchParams.get("token_hash");
    if (tokenHash && url.searchParams.get("type") === "recovery") {
      void supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
        if (error) setLinkError(true);
        else window.history.replaceState(null, "", "/reset-password");
      });
    }
  }, []);

  // Accounts with 2FA must also give a valid code before the password can be reset by email link.
  useEffect(() => {
    void verifiedTotpFactor().then((f) => setNeedsCode(!!f)).catch(() => {});
  }, []);

  // The link in the email signs the user into a recovery session (handled by supabase-js from the URL).
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    if (needsCode) {
      const factorId = await verifiedTotpFactor();
      if (factorId) {
        const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
        if (mfaErr) { setLoading(false); return toast.error("Invalid 2FA code"); }
      }
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/" });
  };

  if (linkError) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm space-y-5 text-center lg:text-left">
          <h1 className="text-2xl font-semibold">This reset link has expired</h1>
          <p className="text-sm text-muted-foreground">The link is invalid, was already used, or is older than one hour. Request a new one from the log in page.</p>
          <Button className="h-11 w-full rounded-xl" onClick={() => navigate({ to: "/auth" })}>Back to log in</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form method="post" className="w-full max-w-sm space-y-5" onSubmit={submit}>
        <div className="text-center lg:text-left">
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Open this page from the link in your reset email.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="np">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="np" type="password" autoComplete="new-password" className="h-11 rounded-xl pl-10" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="np-strength" />
          </div>
          <PasswordStrength id="np-strength" password={password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp">Confirm password</Label>
          <Input id="cp" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={confirm.length > 0 && confirm !== password} />
          {confirm.length > 0 && confirm !== password && <p role="alert" className="text-xs text-destructive">Passwords don't match</p>}
        </div>
        {needsCode && (
          <div className="space-y-2">
            <Label htmlFor="rc">2FA code</Label>
            <Input id="rc" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="h-11 rounded-xl" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
        )}
        <Button type="submit" disabled={loading || (needsCode && code.length !== 6)} className="h-12 w-full rounded-xl shadow-neon">
          {loading ? "Saving..." : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}

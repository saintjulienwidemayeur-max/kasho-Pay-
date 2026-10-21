import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/kasho/auth-layout";
import { verifiedTotpFactor } from "@/lib/stepup";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password | Kasho Pay" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");

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
            <Input id="np" type="password" autoComplete="new-password" className="h-11 rounded-xl pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp">Confirm password</Label>
          <Input id="cp" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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

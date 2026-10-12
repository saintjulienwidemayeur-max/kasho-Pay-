import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/kasho/auth-layout";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in | Kasho Pay" },
      { name: "description", content: "Log in to your Kasho Pay account." },
      { property: "og:title", content: "Log in | Kasho Pay" },
      { property: "og:description", content: "Log in to your Kasho Pay account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  // Coming back from the verification link in the email: Supabase puts the session in the URL
  // and the client picks it up. If a session exists, go straight to the app.
  useEffect(() => {
    let active = true;
    const fromEmailLink = typeof window !== "undefined" && window.location.hash.includes("type=signup");
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (fromEmailLink) toast.success("Email verified. Welcome to Kasho Pay.");
        navigate({ to: "/" });
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    setLoading(true);
    setUnconfirmed(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        setUnconfirmed(true);
        toast.error("Please verify your email first.");
      } else {
        toast.error("Wrong email or password");
      }
      return;
    }
    void logActivity({ data: { event: "Successful login" } }).catch(() => {});
    toast.success("Welcome back");
    navigate({ to: "/" });
  };

  const resendVerification = async () => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error(error.message);
    else toast.success(`Verification email sent to ${email.trim()}`);
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      toast.error("Enter your email above first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("If this email has an account, a reset link is on its way.");
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">

        <div className="mb-7">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Log in to manage your money.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="h-12 rounded-xl pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button type="button" onClick={handleForgot} className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                className="h-12 rounded-xl pl-10 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {unconfirmed && (
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Your email is not verified yet. Check your inbox for the verification email.{" "}
              <button type="button" onClick={resendVerification} className="font-medium text-primary hover:underline">Resend it</button>
            </div>
          )}

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl text-sm font-semibold shadow-neon">
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">Create one</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

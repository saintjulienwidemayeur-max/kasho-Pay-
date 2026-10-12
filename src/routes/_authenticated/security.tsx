import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { LogOut, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSession, useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/format";
import { changePassword } from "@/lib/api";
import { isCancelled, useStepUp } from "@/lib/stepup";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({
    meta: [
      { title: "Security & Activity | Kasho Pay" },
      { name: "description", content: "Review login activity, manage active sessions and update your password." },
      { property: "og:title", content: "Security & Activity | Kasho Pay" },
      { property: "og:description", content: "Review login activity, manage active sessions and update your password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SecurityPage,
});

function describeDevice(ua: string | null | undefined) {
  const s = ua ?? "";
  const browser = /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "Browser";
  const os = /Windows/.test(s) ? "Windows" : /Android/.test(s) ? "Android" : /iPhone|iPad|iOS/.test(s) ? "iOS" : /Mac OS/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function SecurityPage() {
  const navigate = useNavigate();
  const session = useSession();
  const stepUp = useStepUp();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);
  const DeviceIcon = isMobile ? Smartphone : Monitor;
  const thisDevice = describeDevice(typeof navigator !== "undefined" ? navigator.userAgent : "");

  const handleLogOutOthers = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) toast.error(error.message);
    else toast.success("Signed out of all other devices");
  };

  const handleLogOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: "global" });
    await clearSession();
    toast.success("Signed out of all devices");
    navigate({ to: "/welcome" });
  };

  const handleChangePassword = async () => {
    if (!next || !confirm) return toast.error("Fill in every field");
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("New passwords don't match");
    setBusy(true);
    try {
      // Password (and 2FA code if enabled) is re-checked by the server before the change.
      const currentPassword = await stepUp.ask();
      await changePassword({ data: { currentPassword, newPassword: next } });
      toast.success("Password updated");
      setNext(""); setConfirm("");
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {stepUp.dialog}
      <div>
        <p className="text-sm text-muted-foreground">Your account</p>
        <h1 className="mt-1 text-3xl font-semibold">Security & activity</h1>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Active session</h2>
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <DeviceIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{thisDevice}<span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">This device</span></p>
            <p className="truncate text-xs text-muted-foreground">{session?.email}</p>
          </div>
        </div>
        <div className="grid gap-2 border-t border-border px-5 py-4 sm:grid-cols-2">
          <Button variant="outline" className="rounded-xl" onClick={handleLogOutOthers}>
            <LogOut /> Sign out other devices
          </Button>
          <Button variant="outline" className="rounded-xl text-destructive hover:text-destructive" onClick={handleLogOutEverywhere}>
            <LogOut /> Sign out everywhere
          </Button>
        </div>
      </section>

      <TwoFactor stepUp={stepUp} />

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold">Change password</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sec-new">New password</Label>
              <Input id="sec-new" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-confirm">Confirm new password</Label>
              <Input id="sec-confirm" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <Button className="h-11 w-full rounded-xl shadow-neon" disabled={busy} onClick={handleChangePassword}>
            {busy ? "Updating..." : "Update password"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Recent activity</h2>
        </div>
        {activity.data?.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>}
        {activity.data?.map((a, i) => (
          <div key={a.id} className={`flex items-center justify-between gap-4 px-5 py-4 ${i !== 0 ? "border-t border-border" : ""}`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.event}</p>
              <p className="truncate text-xs text-muted-foreground">{[describeDevice(a.user_agent), a.ip].filter(Boolean).join(" · ")}</p>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d · hh:mm a")}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function TwoFactor({ stepUp }: { stepUp: ReturnType<typeof useStepUp> }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp?.[0]?.id ?? null);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const start = async () => {
    setBusy(true);
    try {
      // Remove abandoned, never-verified attempts first.
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of (all?.all ?? []).filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Kasho Pay" });
      if (error) throw error;
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    if (!setup) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code: code.trim() });
      if (error) throw new Error("Invalid code. Check your authenticator app and try again.");
      toast.success("Two-factor authentication enabled");
      setSetup(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!factorId) return;
    setBusy(true);
    try {
      await stepUp.ask(); // password + current 2FA code
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("Two-factor authentication disabled");
      await load();
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Two-factor authentication (2FA)</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ask for a code from an authenticator app (Google Authenticator, Authy, 1Password) to reveal your card, withdraw or change your password.</p>
        </div>
        {!loading && factorId && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">Enabled</span>}
      </div>
      {!loading && !factorId && !setup && (
        <Button className="mt-4 rounded-xl" disabled={busy} onClick={start}>Enable 2FA</Button>
      )}
      {!loading && factorId && (
        <Button variant="outline" className="mt-4 rounded-xl text-destructive hover:text-destructive" disabled={busy} onClick={disable}>Disable 2FA</Button>
      )}
      {setup && (
        <div className="mt-4 space-y-4">
          <p className="text-sm">1. Scan this QR code with your authenticator app.</p>
          <img src={setup.qr} alt="2FA QR code" className="h-44 w-44 rounded-xl bg-white p-2" />
          <p className="break-all text-xs text-muted-foreground">Can't scan? Enter this key: <span className="font-mono">{setup.secret}</span></p>
          <p className="text-sm">2. Enter the 6-digit code it shows.</p>
          <div className="flex gap-2">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="h-11 rounded-xl" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <Button className="h-11 rounded-xl" disabled={busy || code.length !== 6} onClick={confirmSetup}>Verify</Button>
          </div>
        </div>
      )}
    </section>
  );
}

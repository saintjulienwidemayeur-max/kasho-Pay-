import { useState } from "react";
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
      await stepUp.ask((currentPassword) => changePassword({ data: { currentPassword, newPassword: next } }));
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

function TwoFactor(_props: { stepUp: ReturnType<typeof useStepUp> }) {
  // Two-factor authentication is mandatory (TwoFactorGate asks for it before the app opens): this card only reports it.
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Two-factor authentication (2FA)</h2>
          <p className="mt-1 text-xs text-muted-foreground">Kasho Pay only works with 2FA, because these tools can move money. Your authentication code is asked at every sign-in.</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">Enabled</span>
      </div>
    </section>
  );
}

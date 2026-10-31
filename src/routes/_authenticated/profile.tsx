import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronRight, CreditCard, HelpCircle, LogOut, Lock, Settings, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { clearSession, initials, refreshSession, useSession } from "@/lib/session";
import { useVerification } from "@/lib/verification-store";
import { DEFAULT_PREFS, saveNotificationPrefs, type NotificationPrefs } from "@/lib/notifications-store";
import { getSettings, setSettings, type KashoSettings } from "@/lib/settings-store";
import { supabase } from "@/integrations/supabase/client";
import { changeEmail, sendSupportMessage } from "@/lib/api";
import { isCancelled, useStepUp } from "@/lib/stepup";
import { useTransactions } from "@/lib/queries";
import { downloadBlob, makeSimplePdf } from "@/lib/pdf";
import { errorMessage } from "@/lib/format";
import { LanguageSwitch } from "@/lib/i18n";
import { disablePush, enablePush, getCurrentSubscription, pushErrorMessage, pushSupported } from "@/lib/push";
import { sendTestPush } from "@/lib/api";
import { useConfig } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile | Kasho Pay" },
      { name: "description", content: "Manage your Kasho Pay profile, security and account settings." },
      { property: "og:title", content: "Profile | Kasho Pay" },
      { property: "og:description", content: "Manage your Kasho Pay profile, security and account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type MenuKey = "personal" | "cards" | "security" | "notifications" | "verification" | "settings" | "help";

function ProfilePage() {
  const navigate = useNavigate();
  const session = useSession();
  const name = session?.name ?? "Kasho User";
  const email = session?.email ?? "";
  const verification = useVerification();
  const [open, setOpen] = useState<MenuKey | null>(null);

  const verificationBadge = verification.status === "verified" ? "Verified" : verification.status === "pending" ? "Pending" : verification.status === "rejected" ? "Rejected" : "Not verified";

  const menu: { key: MenuKey; label: string; sub: string; icon: typeof User; badge?: string }[] = [
    { key: "personal", label: "Personal information", sub: "Name, phone, email", icon: User },
    { key: "cards", label: "Cards", sub: "Manage your virtual cards", icon: CreditCard },
    { key: "security", label: "Security & activity", sub: "Password, sessions, login history", icon: Lock },
    { key: "notifications", label: "Notifications", sub: "Alerts and preferences", icon: Bell },
    { key: "verification", label: "Verification", sub: "Identity verification status", icon: ShieldCheck, badge: verificationBadge },
    { key: "settings", label: "Settings", sub: "App preferences", icon: Settings },
    { key: "help", label: "Help & support", sub: "FAQs and contact us", icon: HelpCircle },
  ];

  const handleSignOut = async () => {
    await clearSession();
    toast.success("Signed out");
    navigate({ to: "/welcome" });
  };

  const handleMenuClick = (key: MenuKey) => {
    if (key === "cards") { navigate({ to: "/card" }); return; }
    if (key === "verification") { navigate({ to: "/kyc" }); return; }
    if (key === "security") { navigate({ to: "/security" }); return; }
    setOpen(key);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Your account</p>
        <h1 className="mt-1 text-3xl font-semibold">Profile</h1>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:text-left">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-avatar text-lg font-bold text-background">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{email || "No email on file"}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-primary sm:justify-start">
            <ShieldCheck className="h-3.5 w-3.5" /> {`Kasho ID · ${session?.kashoId || "-"}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen("personal")}>Edit</Button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {menu.map(({ key, label, sub, icon: Icon, badge }, i) => (
          <button
            key={key}
            onClick={() => handleMenuClick(key)}
            className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-secondary ${i !== 0 ? "border-t border-border" : ""}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{sub}</span>
            </span>
            {badge && (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${badge === "Verified" ? "bg-primary/15 text-primary" : badge === "Pending" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}>
                {badge}
              </span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </section>

      <Button variant="outline" className="h-12 w-full rounded-xl text-destructive hover:text-destructive" onClick={handleSignOut}>
        <LogOut /> Sign out
      </Button>

      <PersonalInfoDialog open={open === "personal"} onOpenChange={(v) => setOpen(v ? "personal" : null)} />
      <NotificationsDialog open={open === "notifications"} onOpenChange={(v) => setOpen(v ? "notifications" : null)} />
      <SettingsDialog open={open === "settings"} onOpenChange={(v) => setOpen(v ? "settings" : null)} />
      <HelpDialog open={open === "help"} onOpenChange={(v) => setOpen(v ? "help" : null)} />
    </div>
  );
}

function PersonalInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const session = useSession();
  const p = session?.profile;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState("+509");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState({ street: "", city: "", state: "", postal: "" });
  const [busy, setBusy] = useState(false);
  const stepUp = useStepUp();
  // After a verified identity check, the whole section is read-only (also enforced by the database and the server).
  const nameLocked = p?.kyc_status === "verified";

  const load = () => {
    setFirstName(p?.first_name ?? session?.firstName ?? "");
    setLastName(p?.last_name ?? session?.lastName ?? "");
    setEmail(session?.email ?? "");
    setPhoneCode(p?.phone_code ?? "+509");
    setPhone(p?.phone_number ?? "");
    setAddr({ street: p?.address_street ?? "", city: p?.address_city ?? "", state: p?.address_state ?? "", postal: p?.address_postal_code ?? "" });
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Name and email can't be empty");
      return;
    }
    if (!session || nameLocked) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        first_name: firstName.trim(), last_name: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`,
        phone_code: phoneCode.trim() || "+509", phone_number: phone.replace(/\D/g, "") || null,
        address_street: addr.street.trim() || null, address_city: addr.city.trim() || null,
        address_state: addr.state.trim() || null, address_postal_code: addr.postal.trim() || null,
      }).eq("id", session.id);
      if (error) throw error;

      if (email.trim().toLowerCase() !== session.email.toLowerCase()) {
        // password + 2FA code, enforced again by the server; a wrong password is retried inline
        await stepUp.ask((currentPassword) => changeEmail({ data: { currentPassword, newEmail: email.trim() } }));
        toast.message("Check your inbox to confirm your new email address.");
      }
      await refreshSession();
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (v) load(); onOpenChange(v); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Personal information</DialogTitle>
          <DialogDescription>Update the details on your Kasho Pay account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {nameLocked && (
            <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Your personal information is locked because your identity is verified. Contact support if something is wrong.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pi-first">First name</Label>
              <Input id="pi-first" className="h-11 rounded-xl" disabled={nameLocked} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pi-last">Last name</Label>
              <Input id="pi-last" className="h-11 rounded-xl" disabled={nameLocked} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pi-email">Email</Label>
            <Input disabled={nameLocked} id="pi-email" type="email" className="h-11 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pi-phone">Phone</Label>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <Input disabled={nameLocked} aria-label="Country code" className="h-11 rounded-xl text-center" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/[^\d+]/g, ""))} />
              <Input disabled={nameLocked} id="pi-phone" type="tel" className="h-11 rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pi-street">Street address</Label>
            <Input disabled={nameLocked} id="pi-street" className="h-11 rounded-xl" value={addr.street} onChange={(e) => setAddr((v) => ({ ...v, street: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2"><Label htmlFor="pi-city">City</Label><Input disabled={nameLocked} id="pi-city" className="h-11 rounded-xl" value={addr.city} onChange={(e) => setAddr((v) => ({ ...v, city: e.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="pi-state">State</Label><Input disabled={nameLocked} id="pi-state" className="h-11 rounded-xl" value={addr.state} onChange={(e) => setAddr((v) => ({ ...v, state: e.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="pi-zip">Postal code</Label><Input disabled={nameLocked} id="pi-zip" className="h-11 rounded-xl" value={addr.postal} onChange={(e) => setAddr((v) => ({ ...v, postal: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button className="h-11 w-full rounded-xl shadow-neon" disabled={busy || nameLocked} onClick={handleSave}>{busy ? "Saving..." : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {stepUp.dialog}
    </>
  );
}

function NotificationsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const session = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs>(session?.profile?.notification_prefs ?? DEFAULT_PREFS);

  const { data: config } = useConfig();
  const [subscribed, setSubscribed] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (open) void getCurrentSubscription().then((s) => setSubscribed(!!s));
  }, [open]);

  const update = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!session) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      if (key === "push" && value && config?.pushPublicKey && pushSupported() && !(await getCurrentSubscription())) {
        await enablePush(config.pushPublicKey);
        setSubscribed(true);
      }
      await saveNotificationPrefs(session.id, next);
      if (key === "push" && !value && subscribed) {
        await disablePush();
        setSubscribed(false);
      }
    } catch (e) {
      setPrefs(previous);
      toast.error(key === "push" && value ? pushErrorMessage(e) : "Could not save your preference");
    }
  };

  const testPush = async () => {
    setTesting(true);
    try {
      const { sent } = await sendTestPush();
      if (sent > 0) toast.success("Test notification sent");
      else toast.error("No device received the notification. Turn on notifications and try again.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTesting(false);
    }
  };

  const rows: { key: keyof NotificationPrefs; label: string; sub: string }[] = [
    { key: "push", label: "Push notifications", sub: "Transaction and account alerts on this device" },
    { key: "email", label: "Email alerts", sub: "Receipts and account activity by email" },
    { key: "sms", label: "SMS alerts", sub: "Text message alerts for large transactions" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) setPrefs(session?.profile?.notification_prefs ?? DEFAULT_PREFS); onOpenChange(v); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Notification preferences</DialogTitle>
          <DialogDescription>Choose how Kasho Pay lets you know about account activity.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {rows.map(({ key, label, sub }, i) => (
            <div key={key} className={`flex items-center justify-between gap-4 py-3 ${i !== 0 ? "border-t border-border" : ""}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <Switch checked={prefs[key]} onCheckedChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>
        {subscribed && (
          <Button variant="outline" className="h-10 w-full rounded-xl" onClick={testPush} disabled={testing}>
            Send a test notification
          </Button>
        )}
        <DialogFooter>
          <Button className="h-11 w-full rounded-xl shadow-neon" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [settings, setSettingsState] = useState<KashoSettings>(getSettings);

  const toggleBiometric = (v: boolean) => {
    const next = { ...settings, biometricLogin: v };
    setSettingsState(next);
    setSettings(next);
    toast.success(v ? "Biometric login enabled" : "Biometric login disabled");
  };

  const session = useSession();
  const { items } = useTransactions();

  const downloadStatement = () => {
    const now = new Date();
    const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const rows = items
      .filter((t) => { const d = new Date(t.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .slice(0, 35)
      .map((t) => `${new Date(t.createdAt).toLocaleDateString()}  ${t.title.slice(0, 28).padEnd(28)}  ${(t.amount < 0 ? "-" : "+") + "$" + Math.abs(t.amount).toFixed(2)}  ${t.status}`);
    const blob = makeSimplePdf([
      "Kasho Pay Statement", monthLabel, `${session?.name ?? ""}  |  Kasho ID ${session?.kashoId ?? ""}`, "Currency: USD", "",
      ...(rows.length ? rows : ["No transactions this month."]),
    ]);
    downloadBlob(blob, `kasho-statement-${monthLabel.replace(" ", "-")}.pdf`);
    toast.success("Statement downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>App settings</DialogTitle>
          <DialogDescription>Preferences for how Kasho Pay works for you.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5">
            <p className="text-sm font-medium">Language</p>
            <LanguageSwitch />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Currency</p>
              <p className="text-xs text-muted-foreground">Kasho Pay is a USD-only account</p>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">USD ($)</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Biometric login</p>
              <p className="text-xs text-muted-foreground">Use Face ID / fingerprint to open Kasho Pay</p>
            </div>
            <Switch checked={settings.biometricLogin} onCheckedChange={toggleBiometric} />
          </div>

          <Button variant="outline" className="w-full rounded-xl" onClick={downloadStatement}>
            Download this month's statement
          </Button>
        </div>

        <DialogFooter>
          <Button className="h-11 w-full rounded-xl shadow-neon" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [message, setMessage] = useState("");

  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) { toast.error("Write a quick message first"); return; }
    setBusy(true);
    try {
      await sendSupportMessage({ data: { message } });
      toast.success("Message sent. We'll respond within 24h.");
      setMessage("");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Help & support</DialogTitle>
          <DialogDescription>Reach the Kasho Pay team at support@kashopay.com, or send a message below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="help-message">Message</Label>
          <Textarea
            id="help-message"
            placeholder="How can we help?"
            className="min-h-28 rounded-xl"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button className="h-11 w-full rounded-xl shadow-neon" disabled={busy} onClick={handleSend}>{busy ? "Sending..." : "Send message"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Bell, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/lib/queries";
import { enablePush, pushErrorMessage, getCurrentSubscription, isIos, isStandalonePwa, PushError, pushPermission, pushSupported } from "@/lib/push";

const DISMISS_KEY = "kasho-push-card-dismissed";
const SNOOZE_MS = 7 * 24 * 3600 * 1000;

function recentlyDismissed(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(t) && t > 0 && Date.now() - t < SNOOZE_MS;
  } catch {
    return false;
  }
}

type Mode = "hidden" | "card" | "ios";

export function PushCard() {
  const { data: config } = useConfig();
  const [mode, setMode] = useState<Mode>("hidden");
  const [busy, setBusy] = useState(false);
  const key = config?.pushPublicKey ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!key || recentlyDismissed()) return;
      if (isIos() && !isStandalonePwa()) { setMode("ios"); return; }
      if (!pushSupported() || pushPermission() === "denied") return;
      const sub = await getCurrentSubscription();
      if (!cancelled && !(sub && pushPermission() === "granted")) setMode("card");
    })();
    return () => { cancelled = true; };
  }, [key]);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setMode("hidden");
  };

  if (mode === "ios") {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="flex-1">On iPhone, add Kasho Pay to your home screen first (Share &gt; Add to Home Screen), then turn on notifications.</p>
        <Button variant="ghost" size="sm" className="h-8 rounded-lg" onClick={dismiss}>Not now</Button>
      </section>
    );
  }

  const enable = async () => {
    if (!key) return;
    setBusy(true);
    try {
      await enablePush(key);
      toast.success("Notifications are on");
      setMode("hidden");
    } catch (e) {
      toast.error(pushErrorMessage(e));
      if (e instanceof PushError && e.code === "denied") setMode("hidden");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Turn on notifications</h2>
          <p className="mt-1 text-xs text-muted-foreground">Get a good morning message every day and an alert for every transaction.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="h-10 rounded-xl" onClick={enable} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Turn on notifications
            </Button>
            <Button variant="ghost" className="h-10 rounded-xl" onClick={dismiss} disabled={busy}>Not now</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

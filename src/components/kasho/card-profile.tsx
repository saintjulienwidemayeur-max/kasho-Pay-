// The customer's card holder at the card issuer (new card program) and how to add a card to Apple Pay / Google Pay.
// A card can only be created once the issuer has verified the holder: until then the card page shows where it is.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cardProfileFn, retryCardProfileFn, type CardProfile } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { refreshSession, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/** The holder state, polled every 8 seconds while the issuer is verifying it. */
export function useCardProfile(enabled = true) {
  return useQuery({
    queryKey: ["card-profile"],
    queryFn: () => cardProfileFn(),
    enabled,
    retry: false,
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s === "pending" || s === "none" ? 8000 : false;
    },
  });
}

/** Fields the customer can fill in here (the others come from the identity verification). */
const CONTACT_FIELDS = new Set(["phone number", "street address", "city", "state", "postal code"]);

/** Shown instead of the card form while the holder is not ready. Returns nothing once it is ready. */
export function CardProfilePanel({ profile, onClose }: { profile: CardProfile; onClose?: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      const r = await retryCardProfileFn();
      qc.setQueryData(["card-profile"], r);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  if (profile.state === "ready") return null;
  if (profile.state === "needs_kyc") {
    return (
      <Box tone="muted" icon={<AlertTriangle className="h-5 w-5 text-warning" />} title="Verify your identity first">
        <p>A card is issued in your name: we need to verify your identity (ID document and a quick selfie) before.</p>
        <Link to="/kyc" onClick={onClose} className="mt-3 inline-block font-medium text-primary hover:underline">Verify now</Link>
      </Box>
    );
  }
  if (profile.state === "needs_profile") {
    const onlyContact = profile.missing.every((m) => CONTACT_FIELDS.has(m));
    return onlyContact
      ? <ContactForm onSaved={retry} busy={busy} />
      : (
        <Box tone="muted" icon={<AlertTriangle className="h-5 w-5 text-warning" />} title="Some details are missing">
          <p>{profile.reason}</p>
          <p className="mt-1">Please contact support so we can complete your profile.</p>
        </Box>
      );
  }
  if (profile.state === "failed") {
    return (
      <Box tone="bad" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} title="Your card profile was not verified">
        <p>{profile.reason ?? "The card issuer could not verify your identity. Please contact support."}</p>
        {profile.canRetry && (
          <Button variant="outline" className="mt-3 rounded-xl" disabled={busy} onClick={retry}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try again
          </Button>
        )}
      </Box>
    );
  }
  // none / pending: the issuer is verifying the holder
  return (
    <Box tone="muted" icon={<Loader2 className="h-5 w-5 animate-spin text-primary" />} title="Your card profile is being verified">
      <p>The card issuer is verifying your identity. This usually takes a few minutes. You can create your card as soon as it is done, and we will notify you.</p>
      <Button variant="outline" size="sm" className="mt-3 rounded-full" disabled={busy} onClick={() => void qc.invalidateQueries({ queryKey: ["card-profile"] })}>
        <RefreshCw className="h-3.5 w-3.5" /> Check again
      </Button>
    </Box>
  );
}

function Box({ tone, icon, title, children }: { tone: "muted" | "bad"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("flex gap-3 rounded-xl border p-4 text-sm", tone === "bad" ? "border-destructive/40 bg-destructive/10" : "border-border bg-secondary/40")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 text-muted-foreground"><p className="mb-1 font-medium text-foreground">{title}</p>{children}</div>
    </div>
  );
}

/** The phone number and address the card issuer needs, when they are missing from the profile. */
function ContactForm({ onSaved, busy }: { onSaved: () => Promise<void>; busy: boolean }) {
  const session = useSession();
  const [c, setC] = useState({ phoneCode: "+509", phone: "", street: "", city: "", state: "", postal: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const p = session?.profile;
    setC({ phoneCode: p?.phone_code || "+509", phone: p?.phone_number ?? "", street: p?.address_street ?? "", city: p?.address_city ?? "", state: p?.address_state ?? "", postal: p?.address_postal_code ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);
  const set = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement>) => setC((v) => ({ ...v, [k]: e.target.value }));
  const ok = c.phone.replace(/\D/g, "").length >= 7 && [c.street, c.city, c.state, c.postal].every((v) => v.trim().length > 1);
  const save = async () => {
    if (!session || !ok) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        phone_code: c.phoneCode.trim() || "+509", phone_number: c.phone.replace(/\D/g, ""), address_street: c.street.trim(),
        address_city: c.city.trim(), address_state: c.state.trim(), address_postal_code: c.postal.trim(),
      }).eq("id", session.id);
      if (error) throw error;
      await refreshSession();
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setSaving(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">The card issuer needs your phone number and your address to register you.</p>
      <div className="space-y-2">
        <Label htmlFor="cp-phone">Phone number</Label>
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
          <Input aria-label="Country code" className="h-11 rounded-xl text-center" value={c.phoneCode} onChange={(e) => setC((v) => ({ ...v, phoneCode: e.target.value.replace(/[^\d+]/g, "") }))} />
          <Input id="cp-phone" type="tel" className="h-11 rounded-xl" value={c.phone} onChange={set("phone")} />
        </div>
      </div>
      <div className="space-y-2"><Label htmlFor="cp-street">Street address</Label><Input id="cp-street" className="h-11 rounded-xl" value={c.street} onChange={set("street")} /></div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2"><Label htmlFor="cp-city">City</Label><Input id="cp-city" className="h-11 rounded-xl" value={c.city} onChange={set("city")} /></div>
        <div className="space-y-2"><Label htmlFor="cp-state">State</Label><Input id="cp-state" className="h-11 rounded-xl" value={c.state} onChange={set("state")} /></div>
        <div className="space-y-2"><Label htmlFor="cp-zip">Postal code</Label><Input id="cp-zip" className="h-11 rounded-xl" value={c.postal} onChange={set("postal")} /></div>
      </div>
      <Button className="h-11 w-full rounded-xl" disabled={!ok || saving || busy} onClick={save}>
        {(saving || busy) && <Loader2 className="h-4 w-4 animate-spin" />} Save and continue
      </Button>
    </div>
  );
}

/** A small line saying the card works with Apple Pay and Google Pay. */
export function WalletPayBadge({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Works with Apple Pay and Google Pay
    </p>
  );
}

/** How to add the card to a phone (Freda docs: "Ajouter la carte à Apple Pay ou Google Pay"). */
export function WalletPayGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-card">
      <button type="button" className="flex w-full items-center justify-between gap-3 p-5 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Smartphone className="h-5 w-5" /></span>
          <span>
            <span className="block text-sm font-semibold">Add your card to Apple Pay or Google Pay</span>
            <span className="block text-xs text-muted-foreground">Pay contactless and online with your phone.</span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border p-5 text-sm">
          <p className="text-muted-foreground">You need the card number, the expiry date and the CVV: tap "Show details" above. Never share them with anyone.</p>
          <div>
            <p className="mb-2 font-medium">iPhone (Apple Pay)</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open the Wallet app.</li>
              <li>Tap +, then Debit or Credit Card, then Continue.</li>
              <li>Choose Enter Card Details Manually and type the cardholder name, the number, the expiry date and the CVV.</li>
              <li>Accept the terms. If a verification code is asked, follow the instructions on the screen.</li>
            </ol>
          </div>
          <div>
            <p className="mb-2 font-medium">Android (Google Wallet)</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open Google Wallet.</li>
              <li>Tap Add to Wallet, then Payment card, then New credit or debit card.</li>
              <li>Scan or type the number, the expiry date and the CVV, then the cardholder name and address.</li>
              <li>Accept the terms and finish the verification if it is asked.</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">To pay contactless, Google Wallet must be your default payment app and NFC must be on.</p>
          </div>
          <p className="text-xs text-muted-foreground">The card balance applies to Apple Pay and Google Pay too. A frozen card is declined there; remove a closed card from your phone. If adding the card is refused, check that the name is exactly the one on the card, then try again.</p>
          <p className="text-xs text-muted-foreground">New cards work with Apple Pay and Google Pay. A card created before may be refused there: create a new card.</p>
        </div>
      )}
    </section>
  );
}

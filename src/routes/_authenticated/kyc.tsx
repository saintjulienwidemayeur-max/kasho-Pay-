import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, IdCard, Loader2, RefreshCw, ScanFace, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createKycSession, syncKyc } from "@/lib/api";
import { refreshSession } from "@/lib/session";
import { useVerification } from "@/lib/verification-store";
import { useRefreshAll } from "@/lib/queries";
import { errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({
    meta: [
      { title: "Identity Verification | Kasho Pay" },
      { name: "description", content: "Securely verify your identity for Kasho Pay." },
      { property: "og:title", content: "Identity Verification | Kasho Pay" },
      { property: "og:description", content: "Securely verify your identity for Kasho Pay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KycPage,
});

function useKycSync(active: boolean) {
  const refreshAll = useRefreshAll();
  const [checking, setChecking] = useState(false);
  const check = async (quiet = true) => {
    setChecking(true);
    try {
      const r = await syncKyc();
      if (r.status === "verified" || r.status === "rejected") {
        await refreshSession();
        refreshAll();
      }
    } catch (e) {
      if (!quiet) toast.error(errorMessage(e));
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    if (!active) return;
    void check();
    const t = setInterval(() => void check(), 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return { checking, check };
}

function KycPage() {
  const verification = useVerification();
  const { checking, check } = useKycSync(verification.status === "pending");

  if (verification.status === "verified") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-neon">
          <ShieldCheck className="h-9 w-9" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">You're verified</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Your identity has been confirmed. You have full access to Kasho Pay.</p>
      </div>
    );
  }

  if (verification.status === "pending") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-warning/15 text-warning">
          <Clock3 className="h-9 w-9" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">Verification in progress</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          If you finished the steps, we are checking your result. This page updates by itself. If you left before the end, you can continue below.
        </p>
        {verification.reference && (
          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-warning/15 px-4 py-2 text-sm text-warning">
            <span className="h-2 w-2 rounded-full bg-warning" />
            Reference {verification.reference}
          </span>
        )}
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button variant="outline" onClick={() => void check(false)} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check status
          </Button>
          <StartButton label="Continue verification" />
        </div>
      </div>
    );
  }

  const rejected = verification.status === "rejected";
  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="text-center">
        <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${rejected ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
          {rejected ? <XCircle className="h-9 w-9" /> : <ShieldCheck className="h-9 w-9" />}
        </div>
        <h1 className="mt-6 text-3xl font-semibold">{rejected ? "Verification declined" : "Verify your identity"}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {rejected
            ? "We could not verify your identity. Make sure your document is valid, readable and well lit, then try again."
            : "It takes about two minutes. You will scan an ID document and do a quick live face check."}
        </p>
      </div>
      <div className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5 text-sm">
        <div className="flex items-center gap-3"><IdCard className="h-5 w-5 text-primary" /> A valid passport, national ID or driver's license</div>
        <div className="flex items-center gap-3"><ScanFace className="h-5 w-5 text-primary" /> A live selfie to confirm it is really you</div>
        <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /> Handled by our secure verification partner</div>
      </div>
      <div className="mt-6 flex justify-center">
        <StartButton label={rejected ? "Try again" : "Start verification"} />
      </div>
    </div>
  );
}

function StartButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const { url } = await createKycSession();
      // Only follow an https link to the verification provider.
      const u = new URL(url);
      if (u.protocol !== "https:") throw new Error("Invalid verification link.");
      window.location.href = u.toString();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Button size="lg" onClick={start} disabled={busy}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />} {label}
    </Button>
  );
}

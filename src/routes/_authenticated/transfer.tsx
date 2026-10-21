import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Check, ChevronRight, Delete, Link2, ScanLine, Search, Send, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { status } from "@/components/kasho/status-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { KashoMark } from "@/components/kasho/brand";
import { QrScanner } from "@/components/kasho/qr-scanner";
import { useConfig, useRefreshAll, useTransactions, useWalletState } from "@/lib/queries";
import { feeFor } from "@/lib/fees";
import { searchUsers, sendMoney } from "@/lib/api";
import { useSession, initials } from "@/lib/session";
import { errorMessage, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transfer")({
  validateSearch: (s: Record<string, unknown>): { to?: string } => (typeof s["to"] === "string" ? { to: s["to"] } : {}),
  head: () => ({
    meta: [
      { title: "Send & Receive Money | Kasho Pay" },
      { name: "description", content: "Send or receive money instantly with Kasho Pay." },
      { property: "og:title", content: "Send & Receive Money | Kasho Pay" },
      { property: "og:description", content: "Send or receive money instantly with Kasho Pay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransferPage,
});

type Recipient = { username: string; name: string; kashoId?: string | undefined; email?: string | undefined };

function TransferPage() {
  const { to } = Route.useSearch();
  const session = useSession();
  const { walletBalance } = useWalletState();
  const { items } = useTransactions();
  const refresh = useRefreshAll();

  const [amount, setAmount] = useState("0");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string } | null>(null);
  const [qr, setQr] = useState("");
  const [scanning, setScanning] = useState(false);

  const username = session?.username ?? "";
  const payLink = typeof window !== "undefined" && username ? `${window.location.origin}/transfer?to=${username}` : "";

  // Recent recipients, from real transfer history.
  const recents = useMemo(() => {
    const seen = new Map<string, Recipient>();
    for (const t of items) {
      if (t.kind === "transfer_out" && t.username && !seen.has(t.username)) seen.set(t.username, { username: t.username, name: t.title });
    }
    return [...seen.values()].slice(0, 4);
  }, [items]);

  // Real-time username search.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const results = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () => searchUsers({ data: { q: debounced } }),
    enabled: debounced.replace(/^@/, "").length >= 2,
  });

  // Opened from a QR code or a "Send again" button: ?to=username
  useEffect(() => {
    if (!to) return;
    searchUsers({ data: { q: to } }).then((r) => {
      const exact = r.find((u) => u.username === to.toLowerCase() || u.kashoId?.toLowerCase() === to.toLowerCase()) ?? (r.length === 1 ? r[0] : undefined);
      if (exact) setRecipient(exact);
      else toast.error("We could not find that Kasho user.");
    }).catch(() => {});
  }, [to]);

  useEffect(() => {
    if (payLink) QRCode.toDataURL(payLink, { width: 360, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } }).then(setQr);
  }, [payLink]);

  // A scanned code is a payment link (...?to=username), a Kasho ID or a username.
  const handleScan = (text: string) => {
    setScanning(false);
    let target = text.trim();
    try { target = new URL(text).searchParams.get("to") ?? target; } catch { /* not a URL */ }
    searchUsers({ data: { q: target } }).then((r) => {
      const hit = r.find((u) => u.username === target.toLowerCase() || u.kashoId?.toLowerCase() === target.toLowerCase()) ?? (r.length === 1 ? r[0] : undefined);
      if (hit) { setRecipient(hit); toast.success(`Recipient: ${hit.name}`); }
      else toast.error("We could not find that Kasho user.");
    }).catch(() => toast.error("We could not read this QR code."));
  };

  const key = (n: string) =>
    setAmount((a) => {
      if (n === "back") return a.length > 1 ? a.slice(0, -1) : "0";
      if (n === "." && a.includes(".")) return a;
      if (a.includes(".") && a.split(".")[1]!.length >= 2) return a;
      return (a === "0" && n !== "." ? n : a + n).slice(0, 8);
    });

  const { data: config } = useConfig();
  const parsed = Number(amount);
  const feeOrNull = feeFor(config?.fees, "transfer", parsed);
  const fee = feeOrNull ?? 0;
  const tooMuch = parsed + fee > walletBalance; // the sender pays the amount plus the fee
  const share = async () => {
    if (navigator.share) await navigator.share({ title: `Pay ${session?.name ?? ""} on Kasho`, url: payLink });
    else {
      await navigator.clipboard.writeText(payLink);
      toast.success("Payment link copied");
    }
  };

  const submit = async () => {
    if (!recipient) return;
    setBusy(true);
    try {
      status.processing("Sending your money...");
      const res = await sendMoney({ data: { username: recipient.username, amountUsd: parsed, note: note || undefined } });
      setDone({ reference: res.reference });
      status.success("Money sent", `${usd(parsed)} sent to ${recipient.name}`);
      void refresh();
    } catch (e) {
      status.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const closeDrawer = () => {
    setConfirm(false);
    if (done) {
      setDone(null);
      setAmount("0");
      setNote("");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <p className="text-sm text-muted-foreground">Move money</p>
        <h1 className="mt-1 text-3xl font-semibold">Send & receive</h1>
      </div>

      <Tabs defaultValue="send" className="mt-7">
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-card">
          <TabsTrigger value="send" className="h-10 rounded-lg">Send money</TabsTrigger>
          <TabsTrigger value="receive" className="h-10 rounded-lg">Receive money</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-sm font-semibold">Choose recipient</h2>
              <div className="mt-4 flex gap-2">
                <label className="relative block min-w-0 flex-1">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input aria-label="Search for a recipient" placeholder="Name, email, Kasho ID or phone" className="h-11 rounded-xl pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl" onClick={() => setScanning(true)} aria-label="Scan a QR code"><ScanLine />Scan</Button>
              </div>

              {debounced.length >= 2 && (
                <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {results.isLoading && <p className="p-3 text-xs text-muted-foreground">Searching...</p>}
                  {results.data?.length === 0 && <p className="p-3 text-xs text-muted-foreground">No Kasho user found. Type the full email address, the Kasho ID or the phone number.</p>}
                  {results.data?.map((u) => (
                    <button key={u.username} onClick={() => { setRecipient(u); setQuery(""); }} className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-avatar text-xs font-bold text-background">{initials(u.name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[u.email, u.kashoId].filter(Boolean).join(" · ") || `@${u.username}`}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {recents.length > 0 && (
                <div className="mt-5 grid grid-cols-4 gap-3">
                  {recents.map((c) => (
                    <button key={c.username} onClick={() => setRecipient(c)} className={cn("flex min-w-0 flex-col items-center gap-2 rounded-xl border p-2", recipient?.username === c.username ? "border-primary bg-primary/10" : "border-transparent")}>
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-avatar text-xs font-bold text-background">{initials(c.name)}</div>
                      <span className="w-full truncate text-xs">{c.name.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-border pt-5">
                <p className="text-xs text-muted-foreground">Sending to</p>
                {recipient ? (
                  <p className="mt-1 font-semibold">{recipient.name} <span className="block text-xs font-normal text-muted-foreground">{[recipient.email, recipient.kashoId].filter(Boolean).join(" · ") || `@${recipient.username}`}</span></p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Search for a recipient above or scan a QR code.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Amount</p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs">USD · $</span>
              </div>
              <div className="my-6 text-center">
                <p className="text-5xl font-semibold">${amount}</p>
                <p className={cn("mt-2 text-xs", tooMuch ? "text-destructive" : "text-muted-foreground")}>{tooMuch ? (fee > 0 ? "More than your balance (fee included)" : "More than your balance") : `Available ${usd(walletBalance)}`}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((n) => (
                  <Button key={n} variant="ghost" className="h-12 rounded-xl text-lg" onClick={() => key(n)} aria-label={n === "back" ? "Delete digit" : n}>
                    {n === "back" ? <Delete /> : n}
                  </Button>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-primary bg-primary/10 p-4">
              <Smartphone className="h-5 w-5 text-primary" />
              <span><span className="block text-sm font-medium">Kasho transfer</span><span className="block text-xs text-muted-foreground">{parsed > 0 && fee > 0 ? `Instant · Fee ${usd(fee)} · total ${usd(parsed + fee)}` : fee > 0 ? "Instant" : "Instant · Free"}</span></span>
            </div>
            <Input placeholder="Add a note (optional)" maxLength={140} className="mt-4 h-11 rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="mt-5 h-12 w-full rounded-xl" disabled={!recipient || parsed <= 0 || feeOrNull === null || tooMuch} onClick={() => setConfirm(true)}>
              Review transfer<Send />
            </Button>
            {(!recipient || parsed <= 0) && <p className="mt-2 text-center text-xs text-muted-foreground">{!recipient ? "Choose a recipient to continue." : "Enter an amount to continue."}</p>}
          </section>
        </TabsContent>

        <TabsContent value="receive" className="mt-6">
          <section className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <p className="text-sm text-muted-foreground">Scan to pay {session?.firstName || session?.name}</p>
            <div className="relative mx-auto mt-5 w-fit rounded-3xl bg-foreground p-4">
              {qr && <img src={qr} alt="Kasho Pay QR code" className="h-60 w-60 rounded-xl" />}
              <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border-4 border-foreground bg-background">
                <KashoMark className="h-8 w-8" />
              </span>
            </div>
            <p className="mt-5 text-xl font-semibold">{session?.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">@{username}</p>
            <p className="mt-1 text-sm text-muted-foreground">Kasho ID · {session?.kashoId}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11" onClick={() => { navigator.clipboard.writeText(payLink); toast.success("Payment link copied"); }}><Link2 />Copy link</Button>
              <Button className="h-11" onClick={share}><Share2 />Share QR</Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <QrScanner open={scanning} onOpenChange={setScanning} onResult={handleScan} />

      <Drawer open={confirm} onOpenChange={(v) => { if (!v) closeDrawer(); else setConfirm(true); }}>
        <DrawerContent className="mx-auto max-w-xl border-border bg-panel">
          <DrawerHeader>
            <DrawerTitle>Confirm transfer</DrawerTitle>
            <DrawerDescription>Review your payment before sending.</DrawerDescription>
          </DrawerHeader>
          {done ? (
            <div className="px-6 pb-8 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground"><Check /></div>
              <h2 className="mt-5 text-2xl font-semibold">Money sent</h2>
              <p className="mt-2 text-sm text-muted-foreground">{usd(parsed)} is on its way to {recipient?.name}.</p>
              <p className="mt-1 text-xs text-muted-foreground">Reference {done.reference}</p>
              <Button className="mt-6 h-11 w-full" onClick={closeDrawer}>Done</Button>
            </div>
          ) : (
            <div className="px-6 pb-8">
              <div className="text-center">
                <p className="text-4xl font-semibold">{usd(parsed)}</p>
                <p className="mt-2 text-sm font-medium">{recipient?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{[recipient?.email, recipient?.kashoId].filter(Boolean).join(" · ") || `@${recipient?.username}`}</p>
              </div>
              <dl className="mt-6 divide-y divide-border text-sm">
                {[["Method", "Kasho transfer"], ["Fee", usd(fee)], ["Total", usd(parsed + fee)]].map(([a, b]) => (
                  <div className="flex justify-between gap-4 py-3" key={a}><dt className="text-muted-foreground">{a}</dt><dd className="text-right font-medium">{b}</dd></div>
                ))}
              </dl>
              <Button className="mt-5 h-14 w-full rounded-full shadow-neon" disabled={busy} onClick={submit}>
                {busy ? "Sending..." : "Confirm and send"} {!busy && <ChevronRight />}
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

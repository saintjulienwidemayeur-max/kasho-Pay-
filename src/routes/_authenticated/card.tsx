import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, isSameMonth, isToday, isYesterday } from "date-fns";
import { ArrowDownToLine, Check, ChevronLeft, ChevronRight, Trash2, Eye, EyeOff, Lock, Pencil, Plus, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useConfig, useRefreshAll, useTransactions, useWalletState, type CardColor, type KashoCard } from "@/lib/queries";
import { feeFor } from "@/lib/fees";
import { CARD_COLOR_PRESETS } from "@/lib/card-colors";
import { refreshSession, useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { status } from "@/components/kasho/status-modal";
import { isCancelled, useStepUp } from "@/lib/stepup";
import { useCardCode } from "@/components/kasho/card-code";
import {
  cardTransactionsFn, createCardFn, freezeCardFn, fundCardFn, revealCardFn,
  syncCardFn, terminateCardFn, removeCardFn, updateCardFn, withdrawCardFn,
} from "@/lib/api";
import { cleanAmount, errorMessage, usd } from "@/lib/format";
import type { Transaction } from "@/components/kasho/data";
import { TransactionList } from "@/components/kasho/transactions-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/card")({
  head: () => ({
    meta: [
      { title: "Card | Kasho Pay" },
      { name: "description", content: "Your Kasho Pay virtual debit card, top-ups and card settings." },
      { property: "og:title", content: "Card | Kasho Pay" },
      { property: "og:description", content: "Your Kasho Pay virtual debit card, top-ups and card settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CardPage,
});

const QUICK_AMOUNTS = [10, 20, 50, 100];
const HIDDEN_TYPES = new Set(["FUNDING", "WITHDRAWAL", "TERMINATION", "SETTLEMENT"]);
const TYPE_LABEL: Record<string, string> = {
  AUTHORIZATION: "Purchase", DECLINE: "Declined", REFUND: "Refund", REVERSAL: "Reversal", "CROSS-BORDER": "Cross-border",
};

type Revealed = { number: string; cvv: string; expiryMonth: string; expiryYear: string };

function CardPage() {
  const { walletBalance, cards, loading } = useWalletState();
  const session = useSession();
  const refresh = useRefreshAll();
  const walletTx = useTransactions();
  const stepUp = useStepUp();
  const cardCode = useCardCode(!!session?.profile?.card_code_set);
  const swipeStart = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0];
  const go = (dir: 1 | -1) => {
    if (cards.length < 2) return;
    const i = Math.max(0, cards.findIndex((c) => c.id === selected?.id));
    setSelectedId(cards[(i + dir + cards.length) % cards.length]!.id);
    setRevealed(null);
  };

  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  // A new card is created asynchronously by the issuer: poll until it leaves "pending".
  const pendingId = selected?.status === "pending" ? selected.id : null;
  useEffect(() => {
    if (!pendingId) return;
    const t = setInterval(async () => {
      try {
        const r = await syncCardFn({ data: { cardId: pendingId } });
        if (r.status !== "pending") void refresh();
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId]);

  // Refresh the selected card's real balance/status once when it is opened.
  useEffect(() => {
    if (!selected?.id || selected.status === "pending" || selected.status === "terminated") return;
    syncCardFn({ data: { cardId: selected.id } }).then(() => refresh()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Hide revealed details automatically after 30 seconds, and whenever the card changes.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(null), 30_000);
    return () => clearTimeout(t);
  }, [revealed]);
  useEffect(() => setRevealed(null), [selected?.id]);

  const activity = useQuery({
    queryKey: ["card-tx", selected?.id],
    queryFn: () => cardTransactionsFn({ data: { cardId: selected!.id } }),
    enabled: !!selected && selected.status !== "pending",
    retry: false,
  });

  const history: Transaction[] = useMemo(() => {
    if (!selected) return [];
    const fromWallet = walletTx.items.filter((t) => t.cardId === selected.id);
    const fromCard: Transaction[] = (activity.data?.items ?? [])
      .filter((c) => !HIDDEN_TYPES.has(c.type))
      .map((c) => {
        // Never let one odd timestamp from the card issuer crash the whole page.
        let d = new Date(c.createdAt);
        if (Number.isNaN(d.getTime())) d = new Date();
        const date: Transaction["date"] = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : isSameMonth(d, new Date()) ? "This Month" : "Earlier";
        return {
          id: c.id, dbId: `card-${c.id}`, title: c.title, initials: c.title.slice(0, 2).toUpperCase(),
          amount: c.amount, fee: 0, time: date === "Today" || date === "Yesterday" ? format(d, "hh:mm a") : format(d, "MMM d · hh:mm a"),
          date, category: TYPE_LABEL[c.type] ?? "Card", status: c.type === "DECLINE" || c.status === "failed" ? "Failed" : "Completed",
          method: `Card •••• ${selected.last4}`, cardId: selected.id, kind: "card_activity", username: null, createdAt: c.createdAt,
        };
      });
    return [...fromWallet, ...fromCard].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  }, [selected, walletTx.items, activity.data]);

  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading...</p>;

  if (!selected) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-3xl font-semibold">Your cards</h1>
        <p className="mt-3 text-sm text-muted-foreground">You don't have a card yet. Create a virtual card and pay online anywhere.</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button className="h-12 rounded-xl px-8 shadow-neon" onClick={() => setNewCardOpen(true)}><Plus /> Create a card</Button>
        </div>
        <NewCardDialog open={newCardOpen} onOpenChange={setNewCardOpen} walletBalance={walletBalance} onCreated={setSelectedId} />
      </div>
    );
  }

  const preset = CARD_COLOR_PRESETS[selected.color] ?? CARD_COLOR_PRESETS.mint;
  const cardholderName = session?.name || "Kasho User";
  const usable = selected.status === "active";

  const handleReveal = async () => {
    if (revealed) return setRevealed(null);
    setBusy(true);
    try {
      const code = await cardCode.ask();
      setRevealed(await revealCardFn({ data: { cardId: selected.id, code } }));
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFreeze = async () => {
    setBusy(true);
    try {
      const freeze = selected.status === "active";
      status.processing(freeze ? "Freezing your card..." : "Unfreezing your card...");
      await freezeCardFn({ data: { cardId: selected.id, freeze } });
      status.success(freeze ? "Card frozen" : "Card unfrozen");
      void refresh();
    } catch (e) {
      status.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const formatNumber = (n: string) => n.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {stepUp.dialog}
      {cardCode.dialog}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Your cards</p>
          <h1 className="mt-1 truncate text-3xl font-semibold">{selected.label}</h1>
        </div>
        <div className="mt-1 flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="icon" aria-label="Create new card" onClick={() => setNewCardOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={selected.status === "terminated"}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-md touch-pan-y select-none"
        onTouchStart={(e) => { swipeStart.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const start = swipeStart.current; swipeStart.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start === null || end === undefined || cards.length < 2) return;
          const dx = end - start;
          if (Math.abs(dx) < 50) return;
          go(dx < 0 ? 1 : -1);
        }}
      >
      <section key={selected.id} className="card-swipe relative w-full min-h-[230px] overflow-hidden rounded-3xl p-5 text-white shadow-card sm:aspect-[1.6/1] sm:p-7" style={{ background: preset.gradient }}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border-[28px] border-white/10" />
        {(selected.status === "frozen" || selected.status === "terminated" || selected.status === "pending") && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-background/60 backdrop-blur-sm">
            <span className="rounded-full bg-background px-4 py-1.5 text-xs font-semibold text-foreground">
              {selected.status === "frozen" ? "Card frozen" : selected.status === "terminated" ? "Card terminated" : "Creating your card..."}
            </span>
          </div>
        )}
        <div className="relative z-10 flex h-full min-h-[190px] flex-col justify-between gap-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[.16em]">{selected.label}</p>
                <Badge variant="outline" className="border-white/30 text-[10px] text-white">{selected.brand}</Badge>
              </div>
              <p className="mt-2 text-xl font-bold sm:text-2xl">{usd(selected.balance)}</p>
              <p className="text-[11px] text-white/70">Card balance, separate from your wallet</p>
            </div>
            <Wifi className="h-7 w-7 shrink-0 rotate-90" />
          </div>
          <div>
            <p className="mb-3 whitespace-nowrap font-mono text-base sm:text-xl">
              {revealed ? formatNumber(revealed.number) : `••••  ••••  ••••  ${selected.last4}`}
            </p>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 text-xs">
              <div className="min-w-0 flex-1 basis-32">
                <p className="text-white/70">CARDHOLDER</p>
                <p className="mt-1 truncate font-bold uppercase">{cardholderName}</p>
              </div>
              {revealed && (
                <div className="shrink-0 text-right">
                  <p className="text-white/70">CVV</p>
                  <p className="mt-1 font-bold">{revealed.cvv}</p>
                </div>
              )}
              <div className="shrink-0 text-right">
                <p className="text-white/70">EXPIRES</p>
                <p className="mt-1 font-bold">{revealed ? `${revealed.expiryMonth.padStart(2, "0")}/${revealed.expiryYear.slice(-2)}` : selected.expiry}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {cards.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" aria-label="Previous card" className="grid h-11 w-11 place-items-center rounded-full border border-border" onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex gap-1.5">
            {cards.map((c) => (
              <button key={c.id} type="button" aria-label={c.label} onClick={() => setSelectedId(c.id)} className="grid h-11 min-w-6 place-items-center"><span className={cn("block h-2 rounded-full transition-all", c.id === selected.id ? "w-5 bg-primary" : "w-2 bg-muted-foreground/40")} /></button>
            ))}
          </div>
          <button type="button" aria-label="Next card" className="grid h-11 w-11 place-items-center rounded-full border border-border" onClick={() => go(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button variant="outline" className="h-20 flex-col gap-1.5 rounded-2xl" disabled={!usable || busy} onClick={handleReveal}>
          {revealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          <span className="text-xs">{revealed ? "Hide details" : "Show details"}</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-1.5 rounded-2xl" disabled={busy || !(selected.status === "active" || selected.status === "frozen")} onClick={handleFreeze}>
          <Lock className="h-5 w-5" />
          <span className="text-xs">{selected.status === "frozen" ? "Unfreeze card" : "Freeze card"}</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-1.5 rounded-2xl" disabled={!usable} onClick={() => setTopUpOpen(true)}>
          <Plus className="h-5 w-5" />
          <span className="text-xs">Add money</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-1.5 rounded-2xl" disabled={!usable || selected.balance <= 0} onClick={() => setWithdrawOpen(true)}>
          <ArrowDownToLine className="h-5 w-5" />
          <span className="text-xs">Back to wallet</span>
        </Button>
      </div>
      <Button
        variant="outline"
        className="h-12 w-full rounded-2xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={selected.status === "pending"}
        onClick={() => setTerminateOpen(true)}
      >
        <Trash2 className="h-4 w-4" /> {selected.status === "terminated" ? "Remove card" : "Terminate card"}
      </Button>
      {activity.data && activity.data.monthSpend > 0 && (
        <p className="text-center text-xs text-muted-foreground">Spent on this card this month: {usd(activity.data.monthSpend)}</p>
      )}

      <MoveMoneyDialog mode="in" open={topUpOpen} onOpenChange={setTopUpOpen} card={selected} walletBalance={walletBalance} />
      <MoveMoneyDialog mode="out" open={withdrawOpen} onOpenChange={setWithdrawOpen} card={selected} walletBalance={walletBalance} />
      <NewCardDialog open={newCardOpen} onOpenChange={setNewCardOpen} walletBalance={walletBalance} onCreated={setSelectedId} />
      <EditCardDialog open={editOpen} onOpenChange={setEditOpen} card={selected} />
      <TerminateCardDialog open={terminateOpen} onOpenChange={setTerminateOpen} card={selected} />

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold">Transaction history · {selected.label}</h2>
        <TransactionList items={history} selected={selectedTxn} onSelect={setSelectedTxn} />
        {activity.isError && <p className="mt-3 text-center text-xs text-muted-foreground">Card purchases could not be loaded right now.</p>}
      </section>
    </div>
  );
}

function MoveMoneyDialog({ mode, open, onOpenChange, card, walletBalance }: { mode: "in" | "out"; open: boolean; onOpenChange: (v: boolean) => void; card: KashoCard; walletBalance: number }) {
  const refresh = useRefreshAll();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: config } = useConfig();
  const parsed = Number(amount);
  const feeOrNull = feeFor(config?.fees, mode === "in" ? "card_fund" : "card_withdraw", parsed);
  const fee = feeOrNull ?? 0;
  // Adding: the wallet pays amount + fee. Moving back: the fee is taken from the amount, so it must be larger than the fee.
  const max = mode === "in" ? walletBalance - fee : card.balance;
  const valid = parsed > 0 && feeOrNull !== null && parsed <= max && (mode === "in" || parsed > fee);

  const handleConfirm = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      status.processing(mode === "in" ? "Adding money to your card..." : "Moving money to your wallet...");
      if (mode === "in") await fundCardFn({ data: { cardId: card.id, amountUsd: parsed } });
      else await withdrawCardFn({ data: { cardId: card.id, amountUsd: parsed } });
      status.success(mode === "in" ? "Money added" : "Money moved", mode === "in" ? `${usd(parsed)} added to ${card.label}` : `${usd(parsed)} moved back to your wallet`);
      void refresh();
      setAmount("");
      onOpenChange(false);
    } catch (e) {
      status.error(errorMessage(e));
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "in" ? "Add money to card" : "Move money back to wallet"}</DialogTitle>
          <DialogDescription>{mode === "in" ? `Move money from your wallet onto ${card.label}.` : `Move money from ${card.label} back to your wallet.`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" className="h-11 rounded-xl pl-7" value={amount} onChange={(e) => setAmount(cleanAmount(e.target.value))} />
            </div>
            <p className="text-xs text-muted-foreground">{mode === "in" ? `From wallet · ${usd(walletBalance)} available` : `On card · ${usd(card.balance)} available`}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((v) => (
              <Button key={v} type="button" variant="outline" size="sm" className="h-11 min-w-14 rounded-full px-4 text-sm" onClick={() => setAmount(String(v))}>${v}</Button>
            ))}
          </div>
          {parsed > 0 && feeOrNull !== null && (
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium" role="status">
              {mode === "in"
                ? `Fee ${usd(fee)} · total taken from your wallet ${usd(parsed + fee)}`
                : `Fee ${usd(fee)} · your wallet receives ${usd(Math.max(0, parsed - fee))}`}
            </p>
          )}
          {amount && !valid && (
            <p className="text-xs text-destructive">
              {parsed > max ? (mode === "in" && parsed <= walletBalance ? "That is more than your wallet balance (fee included)." : "That is more than the available balance.")
                : mode === "out" && parsed > 0 && parsed <= fee ? `The amount must be more than the ${usd(fee)} fee.` : "Enter a valid amount."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button className="h-11 w-full rounded-xl shadow-neon" disabled={!valid || busy} onClick={handleConfirm}>
            {busy ? "Working..." : `${mode === "in" ? "Add" : "Move"} $${amount || "0.00"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({ color, setColor }: { color: CardColor; setColor: (c: CardColor) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {(Object.keys(CARD_COLOR_PRESETS) as CardColor[]).map((key) => {
        const p = CARD_COLOR_PRESETS[key];
        return (
          <button key={key} type="button" onClick={() => setColor(key)} aria-label={p.name} style={{ background: p.gradient }}
            className={cn("grid h-11 w-11 place-items-center rounded-full ring-offset-2 ring-offset-background transition", color === key ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100")}>
            {color === key && <Check className="h-4 w-4 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}

function NewCardDialog({ open, onOpenChange, walletBalance, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; walletBalance: number; onCreated: (id: string) => void }) {
  const refresh = useRefreshAll();
  const session = useSession();
  const { data: config } = useConfig();
  const [step, setStep] = useState(0);
  const [color, setColor] = useState<CardColor>("mint");
  const [brand, setBrand] = useState<"VISA" | "MASTERCARD">("VISA");
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The card service needs a phone number and a full address. They are asked at sign up; if this account has none, ask here.
  const [contact, setContact] = useState({ phoneCode: "+509", phone: "", street: "", city: "", state: "", postal: "" });
  const [askContact, setAskContact] = useState(false);
  const setC = (k: keyof typeof contact) => (e: React.ChangeEvent<HTMLInputElement>) => setContact((v) => ({ ...v, [k]: e.target.value }));
  const contactOk = contact.phone.replace(/\D/g, "").length >= 7 && [contact.street, contact.city, contact.state, contact.postal].every((v) => v.trim().length > 1);

  useEffect(() => {
    if (!open) return;
    setStep(0); setError(null);
    const p = session?.profile;
    setContact({
      phoneCode: p?.phone_code || "+509", phone: p?.phone_number ?? "", street: p?.address_street ?? "", city: p?.address_city ?? "",
      state: p?.address_state ?? "", postal: p?.address_postal_code ?? "",
    });
    setAskContact(!(p?.phone_number && p?.address_street && p?.address_city && p?.address_state && p?.address_postal_code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsed = Number(amount);
  const feeOrNull = feeFor(config?.fees, "card_creation", parsed);
  const fee = feeOrNull ?? 0;
  const min = config?.minCardFundUsd ?? 1;
  const needsKyc = (config?.requireKycForCards ?? false) && session?.profile?.kyc_status !== "verified";
  const steps = [...(askContact ? ["details"] : []), "network", "prefund", "design"] as const;
  const current = steps[Math.min(step, steps.length - 1)]!;
  const amountOk = parsed >= min && feeOrNull !== null && parsed + fee <= walletBalance;
  const canNext = current === "details" ? contactOk : current === "prefund" ? amountOk : true;
  const last = step >= steps.length - 1;

  const handleConfirm = async () => {
    if (!amountOk || needsKyc || (askContact && !contactOk)) return;
    setBusy(true);
    setError(null);
    try {
      if (askContact) {
        if (!session) throw new Error("Please sign in again.");
        const { error: upErr } = await supabase.from("profiles").update({
          phone_code: contact.phoneCode.trim() || "+509", phone_number: contact.phone.replace(/\D/g, ""),
          address_street: contact.street.trim(), address_city: contact.city.trim(),
          address_state: contact.state.trim(), address_postal_code: contact.postal.trim(),
        }).eq("id", session.id);
        if (upErr) throw upErr;
        await refreshSession();
      }
      const res = await createCardFn({ data: { color, brand, amountUsd: parsed } });
      onCreated(res.cardId);
      status.success("Card requested", "Your card is being created");
      void refresh();
      setColor("mint"); setAmount("10"); setStep(0);
      onOpenChange(false);
    } catch (e) {
      const msg = errorMessage(e);
      status.close();
      setError(msg); // shown inside this dialog; the dialog stays open so nothing hides it
      toast.error(msg);
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<string, [string, string]> = {
    details: ["Your contact details", "The card service needs your phone number and address to issue your card."],
    network: ["Choose a network", "Pick the card network you want to use."],
    prefund: ["Prefund your card", "The prefund is the first amount loaded onto your card. It comes from your wallet and becomes the starting balance of the card. You can add more later."],
    design: ["Choose a design", "Pick the look of your card."],
  };
  const [title, desc] = titles[current]!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <p className="text-xs font-medium text-muted-foreground">{`Step ${Math.min(step, steps.length - 1) + 1} of ${steps.length}`}</p>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />)}
        </div>

        {needsKyc && (
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            You need to verify your identity before creating a card.{" "}
            <Link to="/kyc" onClick={() => onOpenChange(false)} className="font-medium text-primary hover:underline">Verify now</Link>
          </div>
        )}

        {error && (
          <div role="alert" ref={(el) => el?.scrollIntoView({ block: "nearest" })} className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <div className="space-y-4">
          {current === "details" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="nc-phone">Phone number</Label>
                <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                  <Input aria-label="Country code" className="h-11 rounded-xl text-center" value={contact.phoneCode} onChange={(e) => setContact((v) => ({ ...v, phoneCode: e.target.value.replace(/[^\d+]/g, "") }))} />
                  <Input id="nc-phone" type="tel" className="h-11 rounded-xl" value={contact.phone} onChange={setC("phone")} />
                </div>
              </div>
              <div className="space-y-2"><Label htmlFor="nc-street">Street address</Label><Input id="nc-street" className="h-11 rounded-xl" value={contact.street} onChange={setC("street")} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2"><Label htmlFor="nc-city">City</Label><Input id="nc-city" className="h-11 rounded-xl" value={contact.city} onChange={setC("city")} /></div>
                <div className="space-y-2"><Label htmlFor="nc-state">State</Label><Input id="nc-state" className="h-11 rounded-xl" value={contact.state} onChange={setC("state")} /></div>
                <div className="space-y-2"><Label htmlFor="nc-zip">Postal code</Label><Input id="nc-zip" className="h-11 rounded-xl" value={contact.postal} onChange={setC("postal")} /></div>
              </div>
            </div>
          )}

          {current === "network" && (
            <div className="grid grid-cols-2 gap-3">
              {(["VISA", "MASTERCARD"] as const).map((b) => (
                <button key={b} type="button" onClick={() => setBrand(b)} className={cn("rounded-xl border p-4 text-sm font-medium transition", brand === b ? "border-primary bg-primary/10" : "border-border hover:bg-secondary")}>
                  {b === "VISA" ? "Visa" : "Mastercard"}
                </button>
              ))}
            </div>
          )}

          {current === "prefund" && (
            <div className="space-y-2">
              <Label htmlFor="card-amount">Prefund amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input id="card-amount" inputMode="decimal" className="h-12 rounded-xl pl-7 text-lg" value={amount} onChange={(e) => setAmount(cleanAmount(e.target.value))} />
              </div>
              <p className="text-xs text-muted-foreground">
                {`Taken from your wallet (${usd(walletBalance)} available)${fee > 0 ? ` plus a ${usd(fee)} card creation fee` : ""}.`}
              </p>
              {parsed > 0 && feeOrNull !== null && <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium" role="status">{`Fee ${usd(fee)} · total taken from your wallet ${usd(parsed + fee)}`}</p>}
              {amount && parsed + fee > walletBalance && <p className="text-xs text-destructive">Not enough balance in your wallet.</p>}
              {amount && parsed < min && <p className="text-xs text-destructive">Minimum prefund is ${min}.</p>}
            </div>
          )}

          {current === "design" && (
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(CARD_COLOR_PRESETS) as CardColor[]).map((key) => {
                const pr = CARD_COLOR_PRESETS[key];
                return (
                  <button key={key} type="button" onClick={() => setColor(key)} aria-label={pr.name}
                    className={cn("relative aspect-[1.6/1] overflow-hidden rounded-xl p-3 text-left text-white ring-offset-2 ring-offset-background transition", color === key ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100")}
                    style={{ background: pr.gradient }}>
                    <span className="text-[10px] font-semibold uppercase tracking-widest">{pr.name}</span>
                    <span className="absolute bottom-2 left-3 font-mono text-[10px] text-white/80">•••• ••••</span>
                    {color === key && <Check className="absolute right-2 top-2 h-4 w-4 drop-shadow" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:flex-row">
          {step > 0 && <Button variant="outline" className="h-11 rounded-xl sm:flex-1" disabled={busy} onClick={() => setStep((n) => Math.max(0, n - 1))}>Back</Button>}
          {last ? (
            <Button className="h-11 rounded-xl shadow-neon sm:flex-1" disabled={busy || needsKyc || !amountOk} onClick={handleConfirm}>
              {busy ? "Creating..." : "Create card"}
            </Button>
          ) : (
            <Button className="h-11 rounded-xl shadow-neon sm:flex-1" disabled={!canNext || needsKyc} onClick={() => setStep((n) => n + 1)}>Next</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCardDialog({ open, onOpenChange, card }: { open: boolean; onOpenChange: (v: boolean) => void; card: KashoCard }) {
  const refresh = useRefreshAll();
  const [label, setLabel] = useState(card.label);
  const [color, setColor] = useState<CardColor>(card.color);
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateCardFn({ data: { cardId: card.id, label: label.trim() || card.label, color } });
      toast.success("Card updated");
      void refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    setBusy(true);
    try {
      status.processing("Closing your card...");
      const r = await terminateCardFn({ data: { cardId: card.id } });
      status.success("Card closed", r.refunded > 0 ? `${usd(r.refunded)} returned to your wallet.` : undefined);
      void refresh();
      setCloseOpen(false);
      onOpenChange(false);
    } catch (e) {
      status.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (v) { setLabel(card.label); setColor(card.color); } onOpenChange(v); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
            <DialogDescription>Rename this card or pick a new design.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-card-name">Card name</Label>
              <Input id="edit-card-name" maxLength={40} className="h-11 rounded-xl" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Card design</Label>
              <ColorPicker color={color} setColor={setColor} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <Button className="h-11 w-full rounded-xl shadow-neon" disabled={busy} onClick={handleSave}>Save changes</Button>
            <Button variant="outline" className="h-11 w-full rounded-xl text-destructive hover:text-destructive" disabled={busy} onClick={() => setCloseOpen(true)}>
              Close card permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Close this card?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Any money left on the card ({usd(card.balance)}) goes back to your wallet.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep card</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={busy}>Close card</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TerminateCardDialog({ open, onOpenChange, card }: { open: boolean; onOpenChange: (v: boolean) => void; card: KashoCard }) {
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState(false);

  const removing = card.status === "terminated";
  const handleTerminate = async () => {
    setBusy(true);
    onOpenChange(false);
    try {
      if (removing) {
        await removeCardFn({ data: { cardId: card.id } });
        toast.success("Card removed");
        void refresh();
        return;
      }
      status.processing("Terminating your card...");
      const r = await terminateCardFn({ data: { cardId: card.id } });
      status.success("Card terminated", r.refunded > 0 ? `${usd(r.refunded)} returned to your wallet.` : undefined);
      void refresh();
    } catch (e) {
      status.error(errorMessage(e));
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{removing ? "Remove this card?" : "Terminate this card?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {removing ? `${card.label} will disappear from your cards. Its history stays in your transactions.` : `${card.label} will be closed permanently and can no longer be used. This cannot be undone. Any money left on the card (${usd(card.balance)}) goes back to your wallet.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{removing ? "Cancel" : "Keep card"}</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleTerminate} disabled={busy}>{removing ? "Remove card" : "Terminate card"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

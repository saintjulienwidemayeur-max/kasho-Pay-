import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, ExternalLink, Loader2, Plus, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { TransactionList } from "./transactions-list";
import type { Transaction } from "./data";
import { MOBILE_MONEY_PROVIDERS, type MobileMoneyProvider } from "./provider-badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { greetingName, useSession } from "@/lib/session";
import { useConfig, useRefreshAll, useTransactions, useWalletState } from "@/lib/queries";
import { startDeposit, startWithdrawal, syncTransaction } from "@/lib/api";
import { feeFor } from "@/lib/fees";
import { errorMessage, usd } from "@/lib/format";
import { status } from "@/components/kasho/status-modal";
import { isCancelled, useStepUp } from "@/lib/stepup";
import { cn } from "@/lib/utils";

const QUICK_AMOUNTS = [5, 20, 50, 100];

export function DashboardPage() {
  const [selected, setSelected] = useState<Transaction | null>(null);
  const session = useSession();
  const firstName = greetingName(session?.name ?? "there");
  const { walletBalance } = useWalletState();
  const { items } = useTransactions();
  const { data: config } = useConfig();
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Real totals for the current month (pending money-out counts as spent, failed never counts).
  const { income, spent } = useMemo(() => {
    const now = new Date();
    let income = 0;
    let spent = 0;
    for (const t of items) {
      const d = new Date(t.createdAt);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear() || t.status === "Failed") continue;
      if (t.amount > 0 && t.status === "Completed") income += t.amount;
      if (t.amount < 0) spent += -t.amount + t.fee;
    }
    return { income, spent };
  }, [items]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back, {firstName}</p>
        <h1 className="mt-1 text-3xl font-semibold">Your wallet</h1>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Available balance{config?.sandbox ? " · test mode" : ""}</p>
            <p className="mt-2 text-4xl font-semibold sm:text-5xl">{usd(walletBalance)}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Protected account
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <ArrowDownToLine className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Income this month</p>
              <p className="mt-1 text-base font-semibold">{usd(income)}</p>
            </div>
            <div className="border-l border-border pl-4 sm:pl-6">
              <ArrowUpRight className="mb-2 h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Spent this month</p>
              <p className="mt-1 text-base font-semibold">{usd(spent)}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <Button className="h-11 rounded-xl shadow-neon" onClick={() => setAddOpen(true)}>
            <Plus /> Add money
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setWithdrawOpen(true)}>
            <Wallet /> Withdraw
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold">Transaction history</h2>
        <TransactionList items={items} selected={selected} onSelect={setSelected} />
      </section>

      <AddMoneyDialog open={addOpen} onOpenChange={setAddOpen} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} walletBalance={walletBalance} />
    </div>
  );
}

function ProviderPicker({ provider, setProvider }: { provider: MobileMoneyProvider; setProvider: (p: MobileMoneyProvider) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MOBILE_MONEY_PROVIDERS.map(({ id, name, Badge }) => (
        <button
          key={id}
          type="button"
          aria-pressed={provider === id}
          onClick={() => setProvider(id)}
          className={cn("flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", provider === id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary")}
        >
          <Badge className="h-9 w-9 shrink-0 rounded-lg" />
          <span className="text-sm font-medium">{name}</span>
        </button>
      ))}
    </div>
  );
}

function AmountField({ id, amount, setAmount }: { id: string; amount: string; setAmount: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input id={id} inputMode="decimal" autoComplete="off" placeholder="0.00" className="h-11 rounded-xl pl-7" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
    </div>
  );
}

function AddMoneyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const refresh = useRefreshAll();
  const { data: config } = useConfig();
  const [provider, setProvider] = useState<MobileMoneyProvider>("moncash");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<{ id: string; url: string | null; ussd: boolean } | null>(null);
  const settled = useRef(false);

  const parsed = Number(amount);
  const min = config?.minDepositUsd ?? 1;
  const max = config?.maxDepositUsd ?? null;
  const fee = feeFor(config?.fees, "wallet_deposit", parsed);
  const providerName = MOBILE_MONEY_PROVIDERS.find((p) => p.id === provider)!.name;
  const htg = config ? Math.ceil(parsed * config.htgPerUsd) : 0;
  const phoneBad = provider === "moncash" && phone.trim().length > 0 && phone.replace(/\D/g, "").length < 8;
  const valid = parsed >= min && (max === null || parsed <= max) && fee !== null && fee < parsed && (provider === "natcash" || !phoneBad);

  const reset = () => { setWaiting(null); setAmount(""); setPhone(""); settled.current = false; };

  // After the payment is started, ask the backend every few seconds for the real status.
  useEffect(() => {
    if (!waiting) return;
    settled.current = false;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const res = await syncTransaction({ data: { transactionId: waiting.id } });
        if (settled.current) return;
        if (res.status === "completed") {
          settled.current = true;
          status.success("Payment received", "Your wallet was credited.");
          void refresh();
          reset();
          onOpenChange(false);
        } else if (res.status === "failed") {
          settled.current = true;
          status.error("The payment did not go through.", "Payment failed");
          void refresh();
          reset();
        }
      } catch { /* keep polling */ }
      if (tries > 150) clearInterval(timer); // about 10 min, as the docs recommend
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting?.id]);

  const handleConfirm = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      status.processing("Starting your payment...");
      const res = await startDeposit({ data: { provider, amountUsd: parsed, phone: phone.trim() || undefined } });
      status.close();
      setWaiting({ id: res.transactionId, url: res.checkoutUrl, ussd: res.ussd });
      if (res.checkoutUrl) window.open(res.checkoutUrl, "_blank", "noopener");
      void refresh();
    } catch (e) {
      status.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !waiting) reset(); onOpenChange(v); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add money to wallet</DialogTitle>
          <DialogDescription>Fund your Kasho Pay wallet from MonCash or NatCash.</DialogDescription>
        </DialogHeader>

        {waiting ? (
          <div className="space-y-4 py-4 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Waiting for your payment</p>
            <p className="text-xs text-muted-foreground">
              {waiting.ussd ? `Confirm the ${providerName} prompt on your phone.` : `Complete the payment on the ${providerName} page.`} Your wallet is credited automatically once it is confirmed.
            </p>
            {waiting.url && (
              <Button asChild variant="outline" className="rounded-xl">
                <a href={waiting.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open payment page</a>
              </Button>
            )}
            <button className="block min-h-11 w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => { reset(); onOpenChange(false); }}>
              Close (the payment keeps being tracked in your history)
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <ProviderPicker provider={provider} setProvider={setProvider} />

              <div className="space-y-2">
                <Label htmlFor="mm-phone">{providerName} phone number{provider === "natcash" ? " (optional)" : ""}</Label>
                <Input id="mm-phone" inputMode="tel" autoComplete="tel" placeholder="+509 3xxx xxxx" className="h-11 rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={phoneBad} />
                {phoneBad && <p className="text-xs text-destructive">Enter a valid phone number</p>}
                <p className="text-xs text-muted-foreground">
                  {provider === "moncash" && phone.trim()
                    ? "You will get a MonCash prompt on this phone."
                    : `You will be sent to a secure ${providerName} page to pay.`}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mm-amount">Amount (USD)</Label>
                <AmountField id="mm-amount" amount={amount} setAmount={setAmount} />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((v) => (
                    <Button key={v} type="button" variant="outline" size="sm" className="h-11 min-w-14 rounded-full px-4 text-sm" onClick={() => setAmount(String(v))}>${v}</Button>
                  ))}
                </div>
                {parsed > 0 && config && (
                  <p className="text-xs text-muted-foreground">You pay about {htg.toLocaleString()} HTG (rate: {config.htgPerUsd} HTG per $1).</p>
                )}
                {parsed > 0 && fee !== null && (
                  <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium" role="status">{`Fee ${usd(fee)} · your wallet receives ${usd(Math.max(0, parsed - fee))}`}</p>
                )}
                {parsed > 0 && fee !== null && fee >= parsed && <p className="text-xs text-destructive">{`The amount must be more than the ${usd(fee)} fee.`}</p>}
                {parsed > 0 && config && fee === null && <p className="text-xs text-destructive">We cannot calculate the fee for this amount.</p>}
                {amount && parsed < min && <p className="text-xs text-destructive">Minimum deposit is ${min}.</p>}
                {amount && max !== null && parsed > max && <p className="text-xs text-destructive">Maximum deposit is ${max}.</p>}
              </div>
            </div>

            <DialogFooter>
              <Button className="h-11 w-full rounded-xl shadow-neon" disabled={!valid || busy} onClick={handleConfirm}>
                {busy ? "Starting..." : `Add $${amount || "0.00"} from ${providerName}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ open, onOpenChange, walletBalance }: { open: boolean; onOpenChange: (v: boolean) => void; walletBalance: number }) {
  const refresh = useRefreshAll();
  const stepUp = useStepUp();
  const { data: config } = useConfig();
  const [provider, setProvider] = useState<MobileMoneyProvider>("moncash");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = Number(amount);
  const feeOrNull = feeFor(config?.fees, "wallet_withdrawal", parsed);
  const fee = feeOrNull ?? 0;
  const total = parsed + fee;
  const min = config?.minWithdrawUsd ?? 1;
  const max = config?.maxWithdrawUsd ?? null;
  const valid = parsed >= min && (max === null || parsed <= max) && feeOrNull !== null && total <= walletBalance && phone.replace(/\D/g, "").length >= 8;
  const providerName = MOBILE_MONEY_PROVIDERS.find((p) => p.id === provider)!.name;

  const handleConfirm = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const confirmPassword = await stepUp.ask();
      status.processing("Sending your withdrawal...");
      await startWithdrawal({ data: { provider, amountUsd: parsed, phone, confirmPassword } });
      status.success("Withdrawal submitted", `${usd(parsed)} to ${providerName}. You will get a confirmation on your phone.`);
      void refresh();
      setAmount(""); setPhone("");
      onOpenChange(false);
    } catch (e) {
      if (!isCancelled(e)) status.error(errorMessage(e));
      else status.close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Withdraw from wallet</DialogTitle>
          <DialogDescription>Cash out from your Kasho Pay wallet to MonCash or NatCash.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ProviderPicker provider={provider} setProvider={setProvider} />

          <div className="space-y-2">
            <Label htmlFor="wd-phone">{providerName} phone number</Label>
            <Input id="wd-phone" inputMode="tel" autoComplete="tel" placeholder="+509 3xxx xxxx" className="h-11 rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={phone.trim().length > 0 && phone.replace(/\D/g, "").length < 8} />
            {phone.trim().length > 0 && phone.replace(/\D/g, "").length < 8 && <p className="text-xs text-destructive">Enter a valid phone number</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wd-amount">Amount (USD)</Label>
            <AmountField id="wd-amount" amount={amount} setAmount={setAmount} />
            <p className="text-xs text-muted-foreground">Wallet available · {usd(walletBalance)}</p>
            {parsed > 0 && feeOrNull !== null && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium" role="status">
                {`Fee ${usd(fee)} · total taken from your wallet ${usd(total)}${config ? ` · you receive about ${Math.floor(parsed * config.htgPerUsd).toLocaleString()} HTG` : ""}`}
              </p>
            )}
            {parsed > 0 && config && feeOrNull === null && <p className="text-xs text-destructive">We cannot calculate the fee for this amount.</p>}
            <p className="text-xs text-muted-foreground">You will be asked for your password to confirm. This cannot be undone.</p>
            {amount && total > walletBalance && <p className="text-xs text-destructive">That is more than your wallet balance (fee included).</p>}
            {amount && parsed > 0 && parsed < min && <p className="text-xs text-destructive">Minimum withdrawal is ${min}.</p>}
            {amount && max !== null && parsed > max && <p className="text-xs text-destructive">Maximum withdrawal is ${max}.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button className="h-11 w-full rounded-xl shadow-neon" disabled={!valid || busy} onClick={handleConfirm}>
            {busy ? "Sending..." : `Withdraw $${amount || "0.00"} to ${providerName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {stepUp.dialog}
    </>
  );
}

// Admin > Overview: the Freda Pay Issuing balances (Master Wallet, Gateway), profit and loss, and what customers hold.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { AlertTriangle, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { adminFredaFunds, adminOverview, type AdminOverview, type PnlLine } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading, OPERATION_LABELS, Pill, Section, Stat, gourdes, money, percent, signTone, toneClass, when } from "./shared";

const PERIODS = [{ days: 7, label: "7 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 365, label: "1 year" }] as const;

export function OverviewTab({ onOpenFees }: { onOpenFees: () => void }) {
  const [days, setDays] = useState<number>(30);
  const query = useQuery({ queryKey: ["admin", "overview", days], queryFn: () => adminOverview({ data: { days } }), staleTime: 20_000 });
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Period" className="inline-flex rounded-xl border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days} type="button" onClick={() => setDays(p.days)} aria-pressed={days === p.days}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", days === p.days ? "bg-primary text-primary-foreground shadow-neon" : "text-muted-foreground hover:text-foreground")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {query.isPending ? <Loading /> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : data && (
        <>
          <FredaFunds data={data} days={days} />
          <ProfitSummary data={data} onOpenFees={onOpenFees} />
          <DailyChart data={data} />
          <OperationsTable data={data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <FundsCheck data={data} />
            <Customers data={data} />
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Freda funds
function FredaFunds({ data, days }: { data: AdminOverview; days: number }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const f = data.freda;
  const m = f.master;
  const refresh = async () => {
    setBusy(true); setErr(null);
    try {
      const fresh = await adminFredaFunds();
      qc.setQueryData<AdminOverview>(["admin", "overview", days], (old) => (old ? { ...old, freda: fresh } : old));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Section
      title="Freda Pay Issuing: your money at the partner"
      description="Live balances read from Freda with your API key. The Master Wallet pays for card creations and card top-ups; the Gateway holds what customers paid by MonCash and NatCash."
      action={(
        <div className="flex items-center gap-2">
          {f.mode && <Pill tone={f.mode === "live" ? "good" : "warn"}>{f.mode === "live" ? "Live" : "Sandbox (test money)"}</Pill>}
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Update
          </Button>
        </div>
      )}
    >
      {!f.ok ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>{f.message ?? "Freda balances are not available right now."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {m?.low && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p><b>The Master Wallet is low.</b> Add money to it now, or card creations and card top-ups will be refused.</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              className="bg-primary/10 ring-1 ring-primary/30" label="Master Wallet (USD)" value={m ? money(m.balance) : "-"} tone={m?.low ? "bad" : "good"}
              sub={m ? `Spendable ${money(m.spendable)} · ${money(m.guarantee)} locked as guarantee` : "Not available"}
            />
            <Stat label="Money placed on cards" value={m ? money(m.reservedOnCards) : "-"} sub={m ? `${m.activeCards} active card${m.activeCards === 1 ? "" : "s"} at Freda` : "Not available"} />
            <Stat label="Gateway balance (HTG)" value={f.gateway?.htg != null ? gourdes(f.gateway.htg) : "-"} sub={f.gateway?.htg != null ? `About ${money(f.gateway.htg / data.funds.rate)} at ${data.funds.rate} HTG per $1` : "MonCash and NatCash payments"} />
            <Stat label="Gateway balance (USD)" value={f.gateway?.usd != null ? money(f.gateway.usd) : "-"} sub="Card payments received" />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> {`Updated ${when(f.fetchedAt)}`}</p>
          {err !== null && <ErrorBox error={err} />}
        </div>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ profit
function ProfitSummary({ data, onOpenFees }: { data: AdminOverview; onOpenFees: () => void }) {
  const t = data.pnl.totals;
  // Operations customers pay a fee for, and that cost us more than they paid.
  const COST_ONLY: PnlLine["operation"][] = ["master_wallet_funding", "card_purchase", "plans"];
  const losing = data.pnl.lines.filter((l) => l.count > 0 && l.profit < -0.004 && !COST_ONLY.includes(l.operation)).sort((a, b) => a.profit - b.profit);
  // Freda costs that no customer fee covers directly: they have to be paid for by the fees above.
  const costOnly = data.pnl.lines.filter((l) => (l.operation === "master_wallet_funding" || l.operation === "card_purchase") && l.partnerCost > 0.004);
  return (
    <Section title="Profit and loss" description={`From ${new Date(data.period.from).toLocaleDateString()} to today. Our fees are what customers paid. Freda's share is what Freda charged us (exact when Freda reported it, otherwise estimated from its price list).`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Our fees (revenue)" value={money(t.revenue)} sub="Paid by customers" />
        <Stat label="Freda's share" value={money(t.partnerCost)} sub="What the partner earns from our activity" tone="warn" />
        <Stat label="Net profit" value={money(t.profit)} tone={signTone(t.profit)} sub={t.profit < 0 ? "We are losing money" : "After Freda's share"} />
        <Stat label="Margin" value={percent(t.margin)} tone={t.margin === null ? "muted" : signTone(t.margin)} sub="Profit / our fees" />
      </div>
      {(losing.length > 0 || costOnly.length > 0 || data.truncated) && (
        <ul className="mt-4 space-y-2 text-sm">
          {losing.map((l) => (
            <li key={l.operation} className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>
                <b>{OPERATION_LABELS[l.operation]}</b>
                {` cost us ${money(-l.profit)} more than customers paid (${l.count} operation${l.count === 1 ? "" : "s"}).`}
              </span>
            </li>
          ))}
          {costOnly.map((l) => (
            <li key={l.operation} className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                {l.operation === "master_wallet_funding"
                  ? `Freda also kept ${money(l.partnerCost)} on the money added to the Master Wallet for cards.`
                  : `Freda also charged ${money(l.partnerCost)} for ${l.count} card purchase${l.count === 1 ? "" : "s"}.`}
                {" "}No customer fee pays for this directly: the card fees have to cover it.
              </span>
            </li>
          ))}
          {data.truncated && <li className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2">Only the first 50 000 rows of this period were counted. Choose a shorter period for exact figures.</li>}
        </ul>
      )}
      {losing.length > 0 && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onOpenFees}>See the fee analysis</Button>
      )}
    </Section>
  );
}

const chartConfig = {
  revenue: { label: "Our fees", color: "var(--chart-1)" },
  partnerCost: { label: "Freda's share", color: "var(--chart-4)" },
  profit: { label: "Profit", color: "var(--foreground)" },
} satisfies ChartConfig;

function DailyChart({ data }: { data: AdminOverview }) {
  const rows = data.pnl.daily.map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }) }));
  return (
    <Section title="Day by day" description="Fees collected, what Freda charged and the profit, per day (Haiti time). Monthly plan fees and the Master Wallet funding cost are in the totals but not in the daily bars.">
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No completed operations in this period yet.</p>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={52} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v)}`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="partnerCost" fill="var(--color-partnerCost)" radius={[4, 4, 0, 0]} />
            <Line dataKey="profit" type="monotone" stroke="var(--color-profit)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartContainer>
      )}
    </Section>
  );
}

function OperationsTable({ data }: { data: AdminOverview }) {
  const lines = data.pnl.lines.filter((l) => l.count > 0 || l.partnerCost > 0);
  const t = data.pnl.totals;
  const cell = "px-3 py-2.5 text-right tabular-nums";
  const row = (l: PnlLine) => (
    <tr key={l.operation} className="align-middle">
      <td className="px-3 py-2.5">
        <span className="font-medium">{OPERATION_LABELS[l.operation]}</span>
        {l.estimated > 0 && <span title="Partly estimated from Freda's price list: Freda did not report the exact fee for every operation." className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">est.</span>}
      </td>
      <td className={cell}>{l.operation === "master_wallet_funding" || l.operation === "plans" ? "-" : l.count}</td>
      <td className={cell}>{l.volume > 0 ? money(l.volume) : "-"}</td>
      <td className={cell}>{l.revenue > 0 ? money(l.revenue) : "-"}</td>
      <td className={cell}>{l.partnerCost > 0 ? money(l.partnerCost) : "-"}</td>
      <td className={cn(cell, "font-semibold", toneClass(signTone(l.profit)))}>{money(l.profit)}</td>
    </tr>
  );
  return (
    <Section title="By operation" description="One line per kind of operation. Master Wallet funding is the percentage Freda keeps on the money added to the Master Wallet for cards.">
      {lines.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Operation</th>
                <th className="px-3 py-2 text-right font-medium">Count</th>
                <th className="px-3 py-2 text-right font-medium">Volume</th>
                <th className="px-3 py-2 text-right font-medium">Our fees</th>
                <th className="px-3 py-2 text-right font-medium">Freda cost</th>
                <th className="px-3 py-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">{lines.map(row)}</tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-3">Total</td><td /><td />
                <td className={cell}>{money(t.revenue)}</td>
                <td className={cell}>{money(t.partnerCost)}</td>
                <td className={cn(cell, toneClass(signTone(t.profit)))}>{money(t.profit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ what we owe against what we hold
function FundsCheck({ data }: { data: AdminOverview }) {
  const { owedToUsers, heldAtFreda, coverage } = data.funds;
  const ok = coverage !== null && coverage >= 1;
  const width = coverage === null ? 0 : Math.min(100, Math.round(coverage * 100));
  return (
    <Section title="Do we hold enough?" description="Indicative. Customer wallets are money we owe; the Gateway at Freda is where their MonCash / NatCash payments arrive (HTG converted at our fixed rate).">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Owed to customers" value={money(owedToUsers)} sub="Sum of all wallets" />
          <Stat label="Held at Freda (Gateway)" value={heldAtFreda === null ? "-" : money(heldAtFreda)} sub="HTG converted + USD" />
        </div>
        {coverage === null ? (
          <p className="text-sm text-muted-foreground">{heldAtFreda === null ? "Freda balances are not available, so the check cannot run." : "No customer money to cover yet."}</p>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className={ok ? "text-primary" : "text-destructive"}>{ok ? "Covered" : `Short by ${money(owedToUsers - (heldAtFreda ?? 0))}`}</span>
              <span className="text-muted-foreground">{percent(coverage, 0)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full", ok ? "bg-primary" : "bg-destructive")} style={{ width: `${width}%` }} /></div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Card money is covered separately by the Master Wallet. {`Manual balance adjustments in this period: ${money(data.stats.adjustCredits)} added, ${money(data.stats.adjustDebits)} removed.`}</p>
      </div>
    </Section>
  );
}

function Customers({ data }: { data: AdminOverview }) {
  const s = data.stats;
  return (
    <Section title="Customers and activity">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Customers" value={s.usersTotal} sub={`${s.usersNew} new in this period`} />
        <Stat label="Identity verified" value={s.usersVerified} sub={s.usersKycPending ? `${s.usersKycPending} waiting for a decision` : "None waiting"} />
        <Stat label="Wallets with money" value={s.walletsFunded} sub={`${money(s.walletsTotal)} in total`} />
        <Stat label="Active cards" value={s.cardsActive} sub={`${s.cardsTotal} cards · ${money(s.cardsBalance)} on cards`} />
        <Stat label="Pending operations" value={s.txPending} tone={s.txPendingOld > 0 ? "warn" : "plain"} sub={s.txPendingOld > 0 ? `${s.txPendingOld} pending for over an hour` : "None stuck"} />
        <Stat label="Failed in this period" value={s.txFailed} sub={s.cardPurchases ? `${s.cardPurchases} card purchases counted` : "Card purchases are counted from webhooks"} />
      </div>
    </Section>
  );
}

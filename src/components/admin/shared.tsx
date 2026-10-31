// Small building blocks shared by the admin tabs.
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/format";
import type { FeeOperation, PnlOperation } from "@/lib/api";

/** "$1,234.56" / "-$5.00" (the French language switch turns it into "1 234,56 $" by itself). */
export function money(n: number, opts: { sign?: boolean } = {}): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 0) return `-$${abs}`;
  return opts.sign && v > 0 ? `+$${abs}` : `$${abs}`;
}
export const gourdes = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("en-US")} HTG`;
export const percent = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? "-" : `${(n * 100).toFixed(digits)}%`);
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");

export type Tone = "good" | "bad" | "warn" | "muted" | "plain";
export const toneClass = (t: Tone) =>
  t === "good" ? "text-primary" : t === "bad" ? "text-destructive" : t === "warn" ? "text-warning" : t === "muted" ? "text-muted-foreground" : "text-foreground";
export const signTone = (n: number): Tone => (n > 0.004 ? "good" : n < -0.004 ? "bad" : "plain");

export const OPERATION_LABELS: Record<PnlOperation, string> = {
  deposit: "Top-ups (MonCash / NatCash)", withdrawal: "Withdrawals (MonCash / NatCash)", card_creation: "Card creation", card_fund: "Card top-ups",
  card_withdraw: "Card withdrawals", card_closure: "Card closings", transfer: "Kasho transfers", master_wallet_funding: "Master Wallet funding cost",
  card_purchase: "Card purchases", plans: "Freda monthly plans",
};
export const FEE_OPERATION_LABELS: Record<FeeOperation, string> = {
  card_creation: "Card creation", wallet_deposit: "Wallet top-up", wallet_withdrawal: "Wallet withdrawal", card_fund: "Card top-up",
  card_withdraw: "Card withdrawal", transfer: "Kasho transfer",
};
export const KIND_LABELS: Record<string, string> = {
  deposit: "Top-up", withdrawal: "Withdrawal", card_creation: "Card creation", card_fund: "Card top-up", card_withdraw: "Card withdrawal / closing",
  transfer_out: "Transfer sent", transfer_in: "Transfer received", admin_credit: "Added by admin", admin_debit: "Removed by admin",
};

export function Section({ title, description, action, children, className }: { title: string; description?: string | undefined; action?: ReactNode; children: ReactNode; className?: string | undefined }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "plain", className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; className?: string | undefined }) {
  return (
    <div className={cn("rounded-xl border border-border bg-secondary/40 p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-2xl font-semibold tracking-tight", toneClass(tone))}>{value}</p>
      {sub !== undefined && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  const bg = tone === "good" ? "bg-primary/15 text-primary" : tone === "bad" ? "bg-destructive/15 text-destructive" : tone === "warn" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground";
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", bg)}>{children}</span>;
}

export const statusTone = (s: string): Tone => (s === "completed" || s === "verified" || s === "active" ? "good" : s === "failed" || s === "rejected" || s === "terminated" ? "bad" : s === "pending" || s === "disabled" ? "warn" : "muted");

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: (() => void) | undefined }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
      <p className="font-medium text-destructive">{errorMessage(error, "This could not be loaded.")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{`${(page - 1) * pageSize + 1}-${Math.min(total, page * pageSize)} of ${total}`}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span>{`Page ${page} of ${pages}`}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/** A table that scrolls sideways on small screens instead of squeezing its columns. */
export function Grid({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string | undefined }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className={cn("whitespace-nowrap px-3 py-2 font-medium", i > 0 && typeof h === "string" && /^(Count|Volume|Our fees|Freda cost|Profit|Balance|Amount|Fee|Cards)$/.test(h) && "text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

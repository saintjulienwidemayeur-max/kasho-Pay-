// Admin > Fees: what customers pay us, what Freda charges us, and the margin between the two.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  adminApplyPartnerPlan, adminDeleteFee, adminListFees, adminPartnerCosts, adminSaveFee, adminSavePartnerCost,
  type AdminFeeRule, type AdminRole, type FeeAnalysisRow, type FeeOperation, type GatewayPlan, type IssuingPlan, type PartnerRule,
} from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { isCancelled, useStepUp } from "@/lib/stepup";
import { cn } from "@/lib/utils";
import { Empty, ErrorBox, FEE_OPERATION_LABELS, Loading, Pill, Section, money, signTone, toneClass } from "./shared";

const OPS: FeeOperation[] = ["wallet_deposit", "wallet_withdrawal", "card_creation", "card_fund", "card_withdraw", "transfer"];
const ANALYSIS_NOTES: Partial<Record<FeeOperation, string>> = {
  card_creation: "Columns are the money put on the card at creation. Freda's cost includes its percentage for adding that money to the Master Wallet.",
  card_fund: "Columns are the amount added to the card. Freda's cost includes its percentage for adding that money to the Master Wallet.",
  transfer: "Between two Kasho Pay customers: nothing leaves Freda, so the fee is all profit.",
};

export function FeesTab({ role }: { role: AdminRole }) {
  const costs = useQuery({ queryKey: ["admin", "partner"], queryFn: adminPartnerCosts });
  const fees = useQuery({ queryKey: ["admin", "fees"], queryFn: adminListFees });
  return (
    <div className="space-y-6">
      {costs.isPending ? <Loading /> : costs.isError ? <ErrorBox error={costs.error} onRetry={() => void costs.refetch()} /> : (
        <Analysis rows={costs.data.analysis} />
      )}
      {fees.isPending ? <Loading /> : fees.isError ? <ErrorBox error={fees.error} onRetry={() => void fees.refetch()} /> : (
        <CustomerFees rules={fees.data.rules} tiered={fees.data.tiered} />
      )}
      {costs.data && <PartnerPrices data={costs.data} canEdit={role === "super"} />}
    </div>
  );
}

// ------------------------------------------------------------------ margin analysis
function Analysis({ rows }: { rows: FeeAnalysisRow[] }) {
  const priced = rows.filter((r) => r.margin !== null);
  const losing = priced.filter((r) => (r.margin ?? 0) < -0.004);
  const lossOps = [...new Set(losing.map((r) => FEE_OPERATION_LABELS[r.operation]))];
  return (
    <Section
      title="Margin analysis"
      description="For one operation of each size: what the customer pays us, what Freda charges us, and what is left. Red means we lose money on that operation."
    >
      <p className={cn("mb-4 rounded-xl border px-3 py-2 text-sm", losing.length ? "border-destructive/30 bg-destructive/10" : "border-primary/30 bg-primary/10")}>
        {losing.length
          ? <>
            {`We lose money in ${losing.length} of ${priced.length} cases. Raise those fees, or choose a cheaper Freda plan below.`}
            <span className="mt-1 block text-muted-foreground">Operations affected: {lossOps.map((o, i) => <span key={o}>{i > 0 ? ", " : ""}{o}</span>)}</span>
          </>
          : <>Every case below earns us money.</>}
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {OPS.map((op) => {
          const list = rows.filter((r) => r.operation === op);
          if (!list.length) return null;
          return (
            <div key={op} className="overflow-hidden rounded-xl border border-border">
              <div className="border-b border-border bg-secondary/40 px-4 py-2.5 text-sm font-medium">{FEE_OPERATION_LABELS[op]}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">{op === "card_creation" ? "Money on card" : "Amount"}</th>
                      {list.map((r) => <th key={r.amount} className="px-3 py-2 text-right font-medium">{`$${r.amount}`}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    <tr><td className="px-3 py-2 text-muted-foreground">We charge</td>{list.map((r) => <td key={r.amount} className="px-3 py-2 text-right">{r.ourFee === null ? "-" : money(r.ourFee)}</td>)}</tr>
                    <tr><td className="px-3 py-2 text-muted-foreground">Freda charges</td>{list.map((r) => <td key={r.amount} className="px-3 py-2 text-right">{money(r.partnerCost)}</td>)}</tr>
                    <tr className="font-semibold">
                      <td className="px-3 py-2">Margin</td>
                      {list.map((r) => <td key={r.amount} className={cn("px-3 py-2 text-right", r.margin === null ? "text-muted-foreground" : toneClass(signTone(r.margin)))}>{r.margin === null ? "-" : money(r.margin)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              {ANALYSIS_NOTES[op] && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{ANALYSIS_NOTES[op]}</p>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ customer fee rules
const describeFee = (r: AdminFeeRule) => (r.feeType === "percent" ? `${r.feeValue}%` : money(r.feeValue));
const describeBracket = (r: AdminFeeRule) => (r.minAmount === null || r.maxAmount === null ? "Any amount" : `${money(r.minAmount)} to ${money(r.maxAmount)}`);

function CustomerFees({ rules, tiered }: { rules: AdminFeeRule[]; tiered: FeeOperation[] }) {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  const [editing, setEditing] = useState<AdminFeeRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminFeeRule | null>(null);
  const del = useMutation({
    mutationFn: async (r: AdminFeeRule) => stepUp.ask((confirmPassword) => adminDeleteFee({ data: { id: r.id, confirmPassword } })),
    onSuccess: () => { toast.success("Fee removed"); void qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => { if (!isCancelled(e)) toast.error(errorMessage(e)); },
  });
  const sorted = [...rules].sort((a, b) => OPS.indexOf(a.operation) - OPS.indexOf(b.operation) || (a.minAmount ?? 0) - (b.minAmount ?? 0));
  return (
    <Section
      title="What customers pay (our fee schedule)"
      description="Changes apply to the next operation, right away. Your password is asked again for every change."
      action={<Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add a fee</Button>}
    >
      {sorted.length === 0 ? <Empty>No fee rules yet.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Operation</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 text-right font-medium">Fee</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-border">
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 font-medium">{FEE_OPERATION_LABELS[r.operation]}{r.label && <span className="ml-2 text-xs font-normal text-muted-foreground">{r.label}</span>}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{describeBracket(r)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{describeFee(r)}</td>
                  <td className="px-3 py-2.5">{r.active ? <Pill tone="good">Active</Pill> : <Pill>Off</Pill>}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" size="icon" aria-label="Edit fee" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete fee" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <FeeDialog rule={editing === "new" ? null : editing} tiered={tiered} onClose={() => setEditing(null)} />}
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this fee?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `${FEE_OPERATION_LABELS[deleting.operation]}, ${describeBracket(deleting)}, ${describeFee(deleting)}. Without a fee for an amount, customers cannot do that operation.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleting) del.mutate(deleting); setDeleting(null); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {stepUp.dialog}
    </Section>
  );
}

function FeeDialog({ rule, tiered, onClose }: { rule: AdminFeeRule | null; tiered: FeeOperation[]; onClose: () => void }) {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  const [operation, setOperation] = useState<FeeOperation>(rule?.operation ?? "wallet_deposit");
  const [label, setLabel] = useState(rule?.label ?? "");
  const [feeType, setFeeType] = useState<"flat" | "percent">(rule?.feeType ?? "flat");
  const [min, setMin] = useState(rule?.minAmount === null || rule?.minAmount === undefined ? "" : String(rule.minAmount));
  const [max, setMax] = useState(rule?.maxAmount === null || rule?.maxAmount === undefined ? "" : String(rule.maxAmount));
  const [value, setValue] = useState(rule ? String(rule.feeValue) : "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [busy, setBusy] = useState(false);
  const isTiered = tiered.includes(operation);
  const v = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(v) && v >= 0 && (!isTiered || (min.trim() !== "" && max.trim() !== "" && Number(max) >= Number(min)));

  const save = async () => {
    setBusy(true);
    try {
      await stepUp.ask((confirmPassword) => adminSaveFee({ data: {
        id: rule?.id, operation, label: label.trim(), feeType, minAmount: isTiered ? Number(min) : null, maxAmount: isTiered ? Number(max) : null,
        feeValue: v, active, confirmPassword,
      } }));
      toast.success("Fee saved");
      void qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit fee" : "Add a fee"}</DialogTitle>
          <DialogDescription>Top-ups and withdrawals have one fee per amount range. The other operations have a single fee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Operation</Label>
            <Select value={operation} onValueChange={(o) => setOperation(o as FeeOperation)} disabled={!!rule}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{OPS.map((o) => <SelectItem key={o} value={o}>{FEE_OPERATION_LABELS[o]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isTiered && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="fee-min">From ($)</Label><Input id="fee-min" inputMode="decimal" className="h-11 rounded-xl" value={min} onChange={(e) => setMin(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="fee-max">To ($)</Label><Input id="fee-max" inputMode="decimal" className="h-11 rounded-xl" value={max} onChange={(e) => setMax(e.target.value)} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={feeType} onValueChange={(t) => setFeeType(t as "flat" | "percent")}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="flat">Fixed amount ($)</SelectItem><SelectItem value="percent">Percentage (%)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="fee-value">{feeType === "flat" ? "Fee ($)" : "Fee (%)"}</Label><Input id="fee-value" inputMode="decimal" className="h-11 rounded-xl" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="fee-label">Note (optional)</Label><Input id="fee-label" maxLength={80} className="h-11 rounded-xl" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">Active<Switch checked={active} onCheckedChange={setActive} /></label>
        </div>
        <DialogFooter><Button className="w-full rounded-xl" disabled={!valid || busy} onClick={() => void save()}>Save fee</Button></DialogFooter>
      </DialogContent>
      {stepUp.dialog}
    </Dialog>
  );
}

// ------------------------------------------------------------------ what Freda charges
const GATEWAY_LABELS: Record<GatewayPlan, string> = { standard: "Standard (0 HTG / month)", pro: "Pro (1 000 HTG / month)", business: "Business (5 000 HTG / month)" };
const ISSUING_LABELS: Record<IssuingPlan, string> = { startup: "Startup ($0 / month)", pro: "Pro ($150 / month)", premium: "Premium ($500 / month)" };

function describeRule(r: PartnerRule): string {
  if (r.thresholdUsd !== null) return `${money(r.flatUsd)} up to ${money(r.thresholdUsd)}, then ${r.percent}%`;
  const parts: string[] = [];
  if (r.percent > 0) parts.push(`${r.percent}%`);
  if (r.flatUsd > 0) parts.push(money(r.flatUsd));
  if (r.flatHtg > 0) parts.push(`${r.flatHtg} HTG`);
  return parts.length ? parts.join(" + ") : "Free";
}

function PartnerPrices({ data, canEdit }: { data: { plans: { gateway: GatewayPlan; issuing: IssuingPlan }; options: { gateway: GatewayPlan[]; issuing: IssuingPlan[] }; rules: PartnerRule[]; monthlyPlanUsd: number }; canEdit: boolean }) {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  const [gateway, setGateway] = useState<GatewayPlan>(data.plans.gateway);
  const [issuing, setIssuing] = useState<IssuingPlan>(data.plans.issuing);
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState<PartnerRule | null>(null);
  const changed = gateway !== data.plans.gateway || issuing !== data.plans.issuing;

  const apply = async () => {
    setConfirm(false);
    try {
      await stepUp.ask((confirmPassword) => adminApplyPartnerPlan({ data: { gateway, issuing, confirmPassword } }));
      toast.success("Freda prices updated");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    }
  };

  return (
    <Section
      title="What Freda charges us"
      description="Freda's public price list for your plans. The profit report uses these prices whenever Freda did not report the exact fee itself. Check them against your contract and edit any line that differs."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label>Payment Gateway plan (MonCash / NatCash)</Label>
          <Select value={gateway} onValueChange={(v) => setGateway(v as GatewayPlan)} disabled={!canEdit}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{data.options.gateway.map((p) => <SelectItem key={p} value={p}>{GATEWAY_LABELS[p]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Card Issuing plan</Label>
          <Select value={issuing} onValueChange={(v) => setIssuing(v as IssuingPlan)} disabled={!canEdit}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{data.options.issuing.map((p) => <SelectItem key={p} value={p}>{ISSUING_LABELS[p]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {canEdit && <Button className="h-11 rounded-xl" disabled={!changed} onClick={() => setConfirm(true)}>Use these plans</Button>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{`Monthly plan prices: ${money(data.monthlyPlanUsd)} a month, counted in the profit report.`} {!canEdit && "Only a super administrator can change Freda's prices."}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Operation</th><th className="px-3 py-2 font-medium">Freda's price</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" />
          </tr></thead>
          <tbody className="divide-y divide-border">
            {data.rules.map((r) => (
              <tr key={r.operation}>
                <td className="px-3 py-2.5 font-medium">{r.label || r.operation}{r.note && <span className="block text-xs font-normal text-muted-foreground">{r.note}</span>}</td>
                <td className="px-3 py-2.5 tabular-nums">{describeRule(r)}</td>
                <td className="px-3 py-2.5">{r.active ? <Pill tone="good">Counted</Pill> : <Pill>Ignored</Pill>}</td>
                <td className="px-3 py-2.5 text-right">{canEdit && <Button variant="ghost" size="icon" aria-label={`Edit ${r.label}`} onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Freda's prices?</AlertDialogTitle>
            <AlertDialogDescription>{`Every line below is replaced with Freda's public prices for the ${gateway} Gateway plan and the ${issuing} Issuing plan. Lines you edited by hand are overwritten.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void apply()}>Replace prices</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing && <PartnerRuleDialog rule={editing} onClose={() => setEditing(null)} />}
      {stepUp.dialog}
    </Section>
  );
}

function PartnerRuleDialog({ rule, onClose }: { rule: PartnerRule; onClose: () => void }) {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  const [percent, setPercent] = useState(String(rule.percent));
  const [flatUsd, setFlatUsd] = useState(String(rule.flatUsd));
  const [flatHtg, setFlatHtg] = useState(String(rule.flatHtg));
  const [threshold, setThreshold] = useState(rule.thresholdUsd === null ? "" : String(rule.thresholdUsd));
  const [note, setNote] = useState(rule.note);
  const [active, setActive] = useState(rule.active);
  const [busy, setBusy] = useState(false);
  const nums = [percent, flatUsd, flatHtg].map(Number);
  const valid = nums.every((n) => Number.isFinite(n) && n >= 0) && Number(percent) <= 100 && (threshold.trim() === "" || (Number.isFinite(Number(threshold)) && Number(threshold) >= 0));

  const save = async () => {
    setBusy(true);
    try {
      await stepUp.ask((confirmPassword) => adminSavePartnerCost({ data: {
        operation: rule.operation, percent: Number(percent), flatUsd: Number(flatUsd), flatHtg: Number(flatHtg),
        thresholdUsd: threshold.trim() === "" ? null : Number(threshold), active, note: note.trim(), confirmPassword,
      } }));
      toast.success("Price saved");
      void qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{rule.label || rule.operation}</DialogTitle>
          <DialogDescription>
            Cost of one operation = the percentage of the amount + the fixed amounts. If you fill "Fixed price up to", the fixed price applies up to that amount and only the percentage above it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor="pc-pct">Percentage (%)</Label><Input id="pc-pct" inputMode="decimal" className="h-11 rounded-xl" value={percent} onChange={(e) => setPercent(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pc-usd">Fixed price ($)</Label><Input id="pc-usd" inputMode="decimal" className="h-11 rounded-xl" value={flatUsd} onChange={(e) => setFlatUsd(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pc-htg">Fixed price (HTG)</Label><Input id="pc-htg" inputMode="decimal" className="h-11 rounded-xl" value={flatHtg} onChange={(e) => setFlatHtg(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pc-th">Fixed price up to ($)</Label><Input id="pc-th" inputMode="decimal" placeholder="none" className="h-11 rounded-xl" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="pc-note">Note</Label><Input id="pc-note" maxLength={120} className="h-11 rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">Count this cost in the profit report<Switch checked={active} onCheckedChange={setActive} /></label>
        <DialogFooter><Button className="w-full rounded-xl" disabled={!valid || busy} onClick={() => void save()}>Save price</Button></DialogFooter>
      </DialogContent>
      {stepUp.dialog}
    </Dialog>
  );
}

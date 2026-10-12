import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, Clock3, Copy, Download, ImageDown, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { status } from "@/components/kasho/status-modal";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fileDisputeFn } from "@/lib/api";
import { useDisputes, useRefreshAll } from "@/lib/queries";
import { downloadBlob, makeSimplePdf } from "@/lib/pdf";
import { saveReceiptImage } from "@/lib/receipt-image";
import { errorMessage } from "@/lib/format";
import { DATE_GROUPS, type Transaction } from "./data";

const DISPUTE_REASONS = [
  "I don't recognize this transaction",
  "Wrong amount charged",
  "Charged more than once",
  "Item or service not received",
  "Other",
];

export function TransactionList({ items, selected, onSelect, compact = false }: { items: Transaction[]; selected: Transaction | null; onSelect: (item: Transaction | null) => void; compact?: boolean }) {
  const navigate = useNavigate();
  const disputes = useDisputes();
  const refresh = useRefreshAll();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState(DISPUTE_REASONS[0]!);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const download = (t: Transaction) => {
    const sign = t.amount < 0 ? "-" : "+";
    const blob = makeSimplePdf([
      "Kasho Pay Receipt",
      "",
      t.title,
      `Amount: ${sign}$${Math.abs(t.amount).toFixed(2)}`,
      `Fee: $${t.fee.toFixed(2)}`,
      `Reference: ${t.id}`,
      `Status: ${t.status}`,
      `Method: ${t.method}`,
      `Date: ${new Date(t.createdAt).toLocaleString()}`,
    ]);
    downloadBlob(blob, `${t.id}-receipt.pdf`);
    toast.success("Receipt downloaded");
  };

  const saveImage = async (t: Transaction) => {
    try {
      const r = await saveReceiptImage(t);
      if (r === "downloaded") toast.success("Image saved");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const groups = compact
    ? ([["Recent activity", items.slice(0, 4)]] as const)
    : DATE_GROUPS.map((d) => [d, items.filter((t) => t.date === d)] as const);

  const dispute = selected ? disputes[selected.id] : undefined;

  const submitDispute = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      status.processing("Sending your dispute...");
      const res = await fileDisputeFn({
        data: { transactionRef: selected.id, title: selected.title, amount: selected.amount, reason, note },
      });
      setDisputeOpen(false);
      setNote("");
      status.success("Dispute filed", res.reference);
      void refresh();
    } catch (e) {
      status.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-7">
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
        )}
        {groups.map(([date, rows]) => rows.length ? (
          <section key={date}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{date}</h3>
            </div>
            <div className="divide-y divide-border">
              {rows.map((t) => (
                <button key={t.dbId} onClick={() => onSelect(t)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5 text-left transition hover:opacity-80">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-xs font-bold">{t.initials}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{t.time}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">{t.category}</span>
                      {disputes[t.id] && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">Disputed</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", t.amount > 0 && "text-primary", t.status === "Failed" && "text-muted-foreground line-through")}>{t.amount > 0 ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}</p>
                    <p className={cn("mt-1 text-[11px]", t.status === "Pending" ? "text-warning" : t.status === "Failed" ? "text-destructive" : "text-muted-foreground")}>{t.status}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null)}
      </div>

      <Drawer open={!!selected} onOpenChange={(open) => !open && onSelect(null)}>
        <DrawerContent className="mx-auto max-h-[92vh] max-w-2xl overflow-y-auto border-border bg-panel">
          <DrawerHeader className="px-6">
            <DrawerTitle>Transaction details</DrawerTitle>
            <DrawerDescription>Full payment information and available actions.</DrawerDescription>
          </DrawerHeader>
          {selected && (
            <div className="px-6 pb-8">
              <div className="flex flex-col items-center border-b border-border py-5">
                <div className={cn("grid h-14 w-14 place-items-center rounded-full", selected.status === "Completed" ? "bg-primary text-primary-foreground" : selected.status === "Pending" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive")}>
                  {selected.status === "Completed" ? <Check /> : selected.status === "Pending" ? <Clock3 /> : <XCircle />}
                </div>
                <p className="mt-4 text-4xl font-semibold">{selected.amount > 0 ? "+" : "-"}${Math.abs(selected.amount).toFixed(2)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs">{selected.status}</span>
                  {dispute && <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs text-destructive">Disputed · {dispute.reference}</span>}
                </div>
              </div>

              <dl className="divide-y divide-border py-2 text-sm">
                {([["Reference", selected.id], ["Payment method", selected.method], ["Merchant / recipient", selected.title], ["Date & time", `${selected.date} · ${selected.time}`], ["Category", selected.category], ["Fee", `$${selected.fee.toFixed(2)}`]] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="flex items-center gap-2 text-right font-medium">
                      {v}
                      {k === "Reference" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Copy reference" onClick={() => { navigator.clipboard.writeText(v ?? ""); toast.success("Reference copied"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className={"grid grid-cols-2 gap-2"}>
                <Button onClick={() => void saveImage(selected)}><ImageDown />Save as image</Button>
                <Button variant="outline" onClick={() => download(selected)}><Download />Receipt PDF</Button>
                {selected.kind === "transfer_out" && selected.username && (
                  <Button variant="outline" onClick={() => { const u = selected.username!; onSelect(null); navigate({ to: "/transfer", search: { to: u } }); }}>
                    <RotateCcw />Send again
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                disabled={!!dispute}
                className="mt-2 w-full text-destructive hover:text-destructive disabled:text-muted-foreground"
                onClick={() => { setReason(DISPUTE_REASONS[0]!); setNote(""); setDisputeOpen(true); }}
              >
                <AlertTriangle /> {dispute ? "Dispute filed" : "Dispute this transaction"}
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Dispute transaction</DialogTitle>
            <DialogDescription>
              {selected && `We'll look into ${selected.title} · $${Math.abs(selected.amount).toFixed(2)}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPUTE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispute-note">Additional details (optional)</Label>
              <Textarea id="dispute-note" placeholder="Add anything that helps us investigate" className="rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button className="h-11 w-full rounded-xl shadow-neon" disabled={submitting} onClick={submitDispute}>
              {submitting ? "Submitting..." : "Submit dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

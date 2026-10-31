// Admin > Support (disputes and messages from customers) and Audit (what administrators did).
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListAudit, adminListSupport, type AdminRole, type FeeOperation, type PnlOperation } from "@/lib/api";
import { Empty, ErrorBox, FEE_OPERATION_LABELS, Loading, OPERATION_LABELS, Pager, Pill, Section, money, when } from "./shared";
import { UserSheet } from "./users";

export function SupportTab({ role }: { role: AdminRole }) {
  const query = useQuery({ queryKey: ["admin", "support"], queryFn: adminListSupport });
  const [user, setUser] = useState<string | null>(null);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  const { disputes, messages } = query.data;
  return (
    <div className="space-y-6">
      <Section title="Disputes" description="Customers who contested a transaction. Newest first.">
        {disputes.length === 0 ? <Empty>No dispute.</Empty> : (
          <ul className="divide-y divide-border">
            {disputes.map((d) => (
              <li key={d.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="font-medium">{d.title || d.transaction_ref} <span className="font-mono text-xs font-normal text-muted-foreground">{d.reference}</span></p>
                  <p className="text-muted-foreground">{d.reason}{d.note ? `: ${d.note}` : ""}</p>
                  <p className="text-xs text-muted-foreground"><button type="button" className="text-primary hover:underline" onClick={() => setUser(d.user_id)}>{d.customer || "Customer"}</button> · {when(d.created_at)} · {d.transaction_ref}</p>
                </div>
                <p className="font-semibold tabular-nums sm:text-right">{money(d.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Messages" description="Messages sent with the Help and support form.">
        {messages.length === 0 ? <Empty>No message.</Empty> : (
          <ul className="divide-y divide-border">
            {messages.map((m) => (
              <li key={m.id} className="py-3 text-sm">
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className="mt-1 text-xs text-muted-foreground"><button type="button" className="text-primary hover:underline" onClick={() => setUser(m.user_id)}>{m.customer || "Customer"}</button>{m.email ? ` · ${m.email}` : ""} · {when(m.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <UserSheet userId={user} role={role} onClose={() => setUser(null)} />
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  balance_credit: "Added money", balance_debit: "Removed money", user_suspended: "Suspended a customer", user_reactivated: "Reactivated a customer",
  fee_rule_saved: "Saved a customer fee", fee_rule_deleted: "Removed a customer fee", partner_cost_saved: "Edited a Freda price", partner_plan_applied: "Applied Freda plans",
};
function describeDetails(action: string, d: Record<string, unknown>): ReactNode {
  const v = (k: string) => d[k];
  const feeOp = (o: unknown) => FEE_OPERATION_LABELS[o as FeeOperation] ?? String(o ?? "");
  if (action === "balance_credit" || action === "balance_debit") {
    const note = String(v("note") ?? "").trim();
    return (
      <>
        {`${money(Number(v("amount")))} (${money(Number(v("balance_before")))} to ${money(Number(v("balance_after")))})`}
        {note && <span className="block">{note}</span>}
      </>
    );
  }
  if (action === "fee_rule_saved") return `${feeOp(v("operation"))}: ${v("feeType") === "percent" ? `${v("feeValue")}%` : money(Number(v("feeValue")))}`;
  if (action === "fee_rule_deleted") return feeOp(v("operation"));
  if (action === "partner_cost_saved") return `${OPERATION_LABELS[v("operation") as PnlOperation] ?? String(v("operation") ?? "")}: ${v("percent")}% + ${money(Number(v("flatUsd")))}`;
  if (action === "partner_plan_applied") return `Gateway ${String(v("gateway"))}, Issuing ${String(v("issuing"))}`;
  return "";
}

export function AuditTab() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", "audit", page], queryFn: () => adminListAudit({ data: { page, pageSize: 50 } }), placeholderData: (prev) => prev });
  return (
    <Section title="Audit log" description="Everything administrators did with money, customers and prices. Nobody can edit or delete these lines.">
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <Empty>Nothing yet.</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Administrator</th><th className="px-3 py-2 font-medium">Action</th><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Details</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {query.data.items.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{when(r.created_at)}</td>
                    <td className="px-3 py-2.5">{r.admin_email ?? "-"}<span className="block text-xs text-muted-foreground">{r.ip ?? ""}</span></td>
                    <td className="px-3 py-2.5"><Pill tone={r.action.startsWith("balance") || r.action === "user_suspended" ? "warn" : "muted"}>{ACTIONS[r.action] ?? r.action}</Pill></td>
                    <td className="px-3 py-2.5">{r.target ?? "-"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{describeDetails(r.action, r.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
    </Section>
  );
}

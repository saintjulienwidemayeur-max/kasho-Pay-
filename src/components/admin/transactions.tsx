// Admin > Transactions: every transaction of every customer, with filters.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListTransactions, type AdminRole } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Empty, ErrorBox, KIND_LABELS, Loading, Pager, Pill, Section, money, signTone, statusTone, toneClass } from "./shared";
import { UserSheet } from "./users";

const ALL = "all";
const KINDS = Object.keys(KIND_LABELS);

export function TransactionsTab({ role }: { role: AdminRole }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const query = useQuery({
    queryKey: ["admin", "transactions", search, kind, status, page],
    queryFn: () => adminListTransactions({ data: {
      q: search || undefined, kind: kind === ALL ? undefined : kind, status: status === ALL ? undefined : (status as "pending" | "completed" | "failed"), page, pageSize: 30,
    } }),
    placeholderData: (prev) => prev,
  });
  const data = query.data;

  return (
    <Section title="Transactions" description="Everything that moved through Kasho Pay. Click a customer to open their account.">
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search transactions" placeholder="Reference, title or Freda id" className="h-11 rounded-xl pl-9" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <Select value={kind} onValueChange={(v) => { setKind(v); setPage(1); }}>
          <SelectTrigger aria-label="Type" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All types</SelectItem>{KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger aria-label="Status" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Any status</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent>
        </Select>
      </div>
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : data && (
        data.items.length === 0 ? <Empty>No transaction matches.</Empty> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Operation</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 text-right font-medium">Fee</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Reference</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((t) => (
                    <tr key={t.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{new Date(t.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="px-3 py-2.5"><button type="button" className="font-medium text-primary hover:underline" onClick={() => setUser(t.userId)}>{t.customer || "Customer"}</button></td>
                      <td className="px-3 py-2.5"><span className="block">{KIND_LABELS[t.kind] ?? t.kind}</span><span className="block text-xs text-muted-foreground">{t.title}</span>{t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}</td>
                      <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", toneClass(signTone(t.amount)))}>{money(t.amount, { sign: true })}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{t.fee > 0 ? money(t.fee) : "-"}</td>
                      <td className="px-3 py-2.5"><Pill tone={statusTone(t.status)}>{t.status}</Pill></td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">{t.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )
      )}
      <UserSheet userId={user} role={role} onClose={() => setUser(null)} />
    </Section>
  );
}

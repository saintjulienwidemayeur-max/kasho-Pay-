import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TransactionList } from "@/components/kasho/transactions-list";
import type { Transaction } from "@/components/kasho/data";
import { useTransactions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transaction History | Kasho Pay" },
      { name: "description", content: "Search and review every Kasho Pay transaction." },
      { property: "og:title", content: "Transaction History | Kasho Pay" },
      { property: "og:description", content: "Search and review every Kasho Pay transaction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const filters = ["All", "Completed", "Pending", "Transfers", "Card"];

function TransactionsPage() {
  const { items, loading } = useTransactions();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const rows = useMemo(
    () =>
      items.filter((t) => {
        const needle = q.toLowerCase();
        const match = t.title.toLowerCase().includes(needle) || t.category.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle);
        const type =
          filter === "All" ||
          (filter === "Completed" && t.status === "Completed") ||
          (filter === "Pending" && t.status === "Pending") ||
          (filter === "Transfers" && t.category === "Transfer") ||
          (filter === "Card" && t.category === "Card");
        return match && type;
      }),
    [items, q, filter],
  );

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-muted-foreground">All movement</p>
        <h1 className="mt-1 text-3xl font-semibold">Transaction history</h1>
      </div>

      <div className="sticky top-20 z-20 -mx-5 space-y-3 bg-background/90 px-5 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <label className="relative block min-w-0">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payments" className="h-10 rounded-xl bg-card pl-10" />
        </label>
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className={cn("shrink-0 rounded-full", filter === f && "shadow-neon")}>
              {f}
            </Button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading...</p>
        ) : rows.length ? (
          <TransactionList items={rows} selected={selected} onSelect={setSelected} />
        ) : (
          <div className="py-16 text-center">
            <p className="font-medium">No matching transactions</p>
            <p className="mt-2 text-sm text-muted-foreground">Try a different search or filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// Administration: Freda balances, profit and fees, customers, transactions. Only for users listed in the backend `admins` table.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminStatus } from "@/lib/api";
import { AccountTab } from "@/components/admin/account";
import { FeesTab } from "@/components/admin/fees";
import { OverviewTab } from "@/components/admin/overview";
import { ErrorBox, Loading, Pill, Section } from "@/components/admin/shared";
import { AuditTab, SupportTab } from "@/components/admin/support";
import { TransactionsTab } from "@/components/admin/transactions";
import { UsersTab } from "@/components/admin/users";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration | Kasho Pay" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPage,
});

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "fees", label: "Fees" },
  { id: "users", label: "Customers" },
  { id: "transactions", label: "Transactions" },
  { id: "support", label: "Support" },
  { id: "audit", label: "Audit log" },
  { id: "account", label: "My account" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function AdminPage() {
  const status = useQuery({ queryKey: ["admin", "status"], queryFn: adminStatus, staleTime: 60_000, retry: false });
  const [tab, setTab] = useState<TabId>("overview");

  if (status.isPending) return <Loading />;
  if (status.isError) return <ErrorBox error={status.error} onRetry={() => void status.refetch()} />;
  const s = status.data;

  if (!s.isAdmin || !s.role) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Lock className="h-6 w-6" /></span>
        <h1 className="mt-4 text-xl font-semibold">Administrators only</h1>
        <p className="mt-2 text-sm text-muted-foreground">This area is reserved for Kasho Pay administrators.</p>
        <Button asChild className="mt-6"><Link to="/">Back to my account</Link></Button>
      </div>
    );
  }

  const role = s.role;
  // Without 2FA the backend refuses every admin tool: explain, and keep the account tab (password) reachable.
  if (!s.hasTotp) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Header role={role} />
        <Section title="Turn on two-factor authentication first">
          <div className="flex items-start gap-3 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p>The administration tools can move customer money, so they only open with 2FA. Set it up with an authenticator app, then come back here.</p>
              <Button asChild className="mt-4"><Link to="/security">Set up 2FA</Link></Button>
            </div>
          </div>
        </Section>
        <AccountTab status={s} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header role={role} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id} className="rounded-lg px-3 py-2">{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "overview" && <OverviewTab onOpenFees={() => setTab("fees")} />}
        {tab === "fees" && <FeesTab role={role} />}
        {tab === "users" && <UsersTab role={role} />}
        {tab === "transactions" && <TransactionsTab role={role} />}
        {tab === "support" && <SupportTab role={role} />}
        {tab === "audit" && <AuditTab />}
        {tab === "account" && <AccountTab status={s} />}
      </div>
    </div>
  );
}

function Header({ role }: { role: "super" | "admin" }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">Kasho Pay</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Administration</h1>
        <Pill tone="good">{role === "super" ? "Super administrator" : "Administrator"}</Pill>
      </div>
    </div>
  );
}

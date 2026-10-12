import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CreditCard, Home, Send, User, Bell, Search } from "lucide-react";
import { useEffect } from "react";
import { KashoWordmark } from "./brand";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { greetingName, initials, useSession } from "@/lib/session";
import { useRealtimeSync, useWalletState } from "@/lib/queries";
import { useMarkAllRead, useNotifications } from "@/lib/notifications-store";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/transfer", label: "Transfer", icon: Send },
  { to: "/card", label: "Card", icon: CreditCard },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const session = useSession();
  const name = session?.name ?? "there";
  const firstName = greetingName(name);
  const avatar = initials(session?.name ?? "Kasho User");
  const { walletBalance } = useWalletState();
  const notifications = useNotifications();
  const markAllRead = useMarkAllRead();
  const unread = notifications.filter((n) => !n.read).length;

  // Balance, transactions, cards and notifications refresh live when the backend changes them.
  useRealtimeSync();

  // Signed out elsewhere (or session expired): go back to the login page.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/welcome" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed -left-40 -top-40 z-0 h-96 w-96 rounded-full bg-primary/10 blur-[140px]" />

        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-panel/90 px-5 py-7 backdrop-blur-xl lg:flex">
          <KashoWordmark />
          <nav className="mt-12 space-y-2">
            {items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-primary text-primary-foreground shadow-neon hover:bg-primary hover:text-primary-foreground" }}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="mt-1 text-xl font-semibold">${walletBalance.toFixed(2)}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Protected account
            </p>
          </div>
        </aside>

        {pathname === "/" && (
        <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl lg:left-64">
          <div className="mx-auto grid h-24 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:px-8">
            <div className="flex min-w-0 flex-col gap-0.5 lg:hidden">
              <KashoWordmark compact />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="text-xs text-muted-foreground">Welcome back</p>
              <h1 className="truncate text-lg font-semibold">Hi {firstName}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="mr-1 hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-xs font-medium text-muted-foreground">Balance <span className="text-foreground">${walletBalance.toFixed(2)}</span></span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Search"><Search /></Button>
                </TooltipTrigger>
                <TooltipContent>Search</TooltipContent>
              </Tooltip>
              <Popover onOpenChange={(open) => open && unread > 0 && markAllRead()}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Button variant="ghost" size="icon" aria-label="Notifications"><Bell /></Button>
                    {unread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border border-background bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 rounded-2xl border-border bg-panel p-0">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">Notifications</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <div key={n.id} className="border-b border-border px-4 py-3 last:border-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-avatar text-xs font-bold text-background">
                {avatar}
              </Link>
            </div>
          </div>
        </header>
        )}

        <main className={`relative z-10 min-h-screen pb-28 lg:ml-64 lg:pb-10 ${pathname === "/" ? "pt-24" : "pt-0"}`}>
          <div key={pathname} className="page-enter mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:py-10">
            {children}
          </div>
        </main>

        <nav className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-4 rounded-2xl border border-border bg-panel/90 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-muted-foreground"
              activeProps={{ className: "bg-primary text-primary-foreground shadow-neon" }}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </TooltipProvider>
  );
}

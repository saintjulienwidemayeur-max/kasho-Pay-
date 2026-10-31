// Pathless layout route that gates every child under `src/routes/_authenticated/`
// behind a real Supabase session, and wraps them in the app shell.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/kasho/shell";
import { MfaPrompt } from "@/components/kasho/mfa-prompt";
import { useEffect } from "react";
import { registerServiceWorker, pushPermission, syncPushSubscription } from "@/lib/push";
import { useLang } from "@/lib/i18n";
import { getSession, loadSession } from "@/lib/session";

const SIGN_IN_ROUTE = "/welcome";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const session = getSession() ?? (await loadSession());
    if (!session) throw redirect({ to: SIGN_IN_ROUTE });
    return { user: session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const lang = useLang();
  useEffect(() => {
    // Production only, on https or localhost; never prompts for permission here.
    if (!import.meta.env.PROD || !window.isSecureContext) return;
    void registerServiceWorker().then((reg) => {
      if (reg && pushPermission() === "granted") void syncPushSubscription();
    });
  }, [lang]);
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <MfaPrompt />
    </>
  );
}

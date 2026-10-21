// Pathless layout route that gates every child under `src/routes/_authenticated/`
// behind a real Supabase session, and wraps them in the app shell.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/kasho/shell";
import { MfaPrompt } from "@/components/kasho/mfa-prompt";
import { getSession, loadSession } from "@/lib/session";

const SIGN_IN_ROUTE = "/welcome";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const session = getSession() ?? (await loadSession());
    if (!session) throw redirect({ to: SIGN_IN_ROUTE });
    return { user: session };
  },
  component: () => (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <MfaPrompt />
    </>
  ),
});

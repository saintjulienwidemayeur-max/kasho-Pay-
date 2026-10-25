import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { KashoWordmark } from "@/components/kasho/brand";
import { publicPageHead } from "@/lib/seo";

export const Route = createFileRoute("/welcome")({
  head: () => publicPageHead({
    title: "Kasho Pay | Portefeuille et cartes Visa Mastercard pour Haïti",
    description: "Rechargez avec MonCash et NatCash, envoyez de l'argent et créez une carte virtuelle Visa ou Mastercard en dollars. Simple, rapide, sécurisé.",
    path: "/welcome",
  }),
  component: WelcomePage,
});

function Actions() {
  return (
    <div className="w-full space-y-2.5">
      <Button asChild className="h-11 w-full rounded-xl text-sm font-semibold shadow-neon">
        <Link to="/signup">Create an account</Link>
      </Button>
      <Button asChild variant="outline" className="h-14 w-full rounded-2xl border-white/30 bg-white/5 text-base font-semibold text-white backdrop-blur hover:bg-white/10 hover:text-white lg:border-border lg:bg-transparent lg:text-foreground lg:hover:bg-secondary lg:hover:text-foreground">
        <Link to="/auth">Log in</Link>
      </Button>
    </div>
  );
}

function WelcomePage() {
  return (
    <div className="relative min-h-[100dvh] bg-[#04210f] lg:grid lg:grid-cols-2">
      {/* Image: full screen on phones, left half on desktop */}
      <div className="absolute inset-0 lg:relative lg:inset-auto">
        <img
          src="/brand/welcome-hero.webp"
          alt="Kasho Pay: your money, better days"
          className="h-full w-full object-cover object-top lg:object-center"
          fetchPriority="high"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#04210f] via-[#04210f]/70 to-transparent lg:hidden" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col justify-end px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 lg:min-h-0 lg:items-center lg:justify-center lg:bg-background lg:px-12 lg:pb-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 hidden lg:block"><KashoWordmark /></div>
          <h1 className="mb-2 hidden text-3xl font-semibold lg:block">Welcome to Kasho Pay</h1>
          <p className="mb-8 hidden text-sm text-muted-foreground lg:block">Save, spend, and grow your wealth, all in one simple place.</p>
          <Actions />
          <p className="mt-4 text-center text-xs text-white/60 lg:mt-6 lg:text-muted-foreground">Secure. Instant. Made for you.</p>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { KashoMark } from "./brand";

// Shared frame for log in, sign up and password reset.
// Phones: centered logo, then the form. Computers (lg and up): brand picture on the left, form on the right.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-[1fr_minmax(480px,560px)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-gradient-to-b from-[#03140b] via-[#052e18] to-[#04200f] p-14 lg:flex" aria-hidden="true">
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight text-foreground xl:text-5xl">Your wallet for Haiti</h2>
          <p className="mt-4 text-lg text-foreground/75">Top up with MonCash and NatCash, send money and create Visa or Mastercard virtual cards.</p>
        </div>
        <img
          src="/brand/auth-wallet.webp"
          alt=""
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] w-full object-cover object-top [mask-image:linear-gradient(to_bottom,transparent,black_30%)]"
        />
      </aside>
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 pb-10 pt-10 lg:px-14">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <div className="mb-8 flex flex-col items-center gap-2 lg:mb-10">
            <KashoMark className="h-28 w-28 sm:h-32 sm:w-32 lg:h-24 lg:w-24" />
            <span className="text-3xl font-bold text-foreground">Kasho Pay</span>
          </div>
          <div className="flex w-full flex-col items-center [&>*]:w-full">{children}</div>
          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Your data is encrypted and protected.
          </p>
        </div>
      </div>
    </div>
  );
}

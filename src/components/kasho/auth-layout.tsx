import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { KashoMark } from "./brand";

// Shared frame for log in, sign up and password reset: centered logo, then the form.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background px-6 pb-10 pt-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <KashoMark className="h-28 w-28 sm:h-32 sm:w-32" />
          <span className="text-3xl font-bold text-foreground">Kasho Pay</span>
        </div>
        <div className="flex w-full flex-col items-center [&>*]:w-full">{children}</div>
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Your data is encrypted and protected.
        </p>
      </div>
    </div>
  );
}

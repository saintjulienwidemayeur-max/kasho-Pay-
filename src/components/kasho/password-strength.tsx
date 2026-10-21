import { cn } from "@/lib/utils";

type Strength = "short" | "weak" | "ok" | "strong";

/** Simple hint, not a security gate: only length >= 8 is required. Character variety and length raise the level. */
function passwordStrength(pw: string): Strength {
  if (pw.length < 8) return "short";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12 && kinds >= 3) return "strong";
  if (kinds >= 3 || (pw.length >= 10 && kinds >= 2)) return "ok";
  return "weak";
}

const LEVEL = { short: 0, weak: 1, ok: 2, strong: 3 } as const;
const LABEL = { short: "Too short", weak: "Weak", ok: "OK", strong: "Strong" } as const;
const COLOR = { short: "bg-destructive", weak: "bg-destructive", ok: "bg-yellow-500", strong: "bg-primary" } as const;

export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  if (!password) return <p id={id} className="text-xs text-muted-foreground">Use at least 8 characters. Mix letters, numbers and symbols for a stronger password.</p>;
  const s = passwordStrength(password);
  return (
    <div id={id} role="status" aria-live="polite" className="space-y-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", LEVEL[s] >= i ? COLOR[s] : "bg-secondary")} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <span>Password strength:</span> <span className="font-medium text-foreground">{LABEL[s]}</span>
      </p>
    </div>
  );
}

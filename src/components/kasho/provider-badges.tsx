// Brand-colored monogram badges for Haiti's two mobile money providers.
// MonCash is Digicel's mobile wallet (brand red ~#ED1B2F). NatCash is
// Natcom's mobile wallet (brand orange ~#F7941D). These are simple
// monogram treatments in the correct brand colors, not the providers'
// official logo artwork — swap in the real SVG/PNG logo files here once
// you have them (e.g. from each provider's press/brand kit).
import { useState } from "react";

// Real logos: drop the official files in public/logos/ named moncash.png (or .svg) and natcash.png (or .svg).
// Until a file exists, the colored monogram below is shown instead.
function WithLogo({ file, label, Fallback, className }: { file: string; label: string; Fallback: (p: { className?: string }) => JSX.Element; className?: string }) {
  const sources = [`/logos/${file}.svg`, `/logos/${file}.png`, `/logos/${file}.webp`];
  const [i, setI] = useState(0);
  if (i >= sources.length) return <Fallback className={className} />;
  return (
    <img src={sources[i]} alt={label} className={`${className ?? ""} rounded-lg bg-white object-contain p-0.5`} onError={() => setI((n) => n + 1)} />
  );
}

function MonCashMonogram({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="MonCash">
      <rect width="40" height="40" rx="10" fill="#ED1B2F" />
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#ffffff">M</text>
    </svg>
  );
}

function NatCashMonogram({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="NatCash">
      <rect width="40" height="40" rx="10" fill="#F7941D" />
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#ffffff">N</text>
    </svg>
  );
}

export function MonCashBadge({ className = "h-9 w-9" }: { className?: string }) {
  return <WithLogo file="moncash" label="MonCash" Fallback={MonCashMonogram} className={className} />;
}
export function NatCashBadge({ className = "h-9 w-9" }: { className?: string }) {
  return <WithLogo file="natcash" label="NatCash" Fallback={NatCashMonogram} className={className} />;
}

export type MobileMoneyProvider = "moncash" | "natcash";

export const MOBILE_MONEY_PROVIDERS: { id: MobileMoneyProvider; name: string; Badge: typeof MonCashBadge }[] = [
  { id: "moncash", name: "MonCash", Badge: MonCashBadge },
  { id: "natcash", name: "NatCash", Badge: NatCashBadge },
];

// Card network marks drawn as inline SVG (no external files). Visa is a simplified wordmark, Mastercard the two circles.
export type CardBrand = "VISA" | "MASTERCARD";

export function VisaLogo({ className = "h-6 w-auto", color = "#1A1F71" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 22" className={className} role="img" aria-label="Visa">
      <text x="32" y="18" textAnchor="middle" fontSize="22" fontWeight="900" fontStyle="italic" letterSpacing="-0.5"
        fontFamily="Arial Black, Arial, Helvetica, sans-serif" fill={color}>VISA</text>
    </svg>
  );
}

export function MastercardLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} role="img" aria-label="Mastercard">
      <circle cx="15" cy="12" r="10" fill="#EB001B" />
      <circle cx="25" cy="12" r="10" fill="#F79E1B" />
      <path d="M20 4.3a10 10 0 0 1 0 15.4 10 10 0 0 1 0-15.4z" fill="#FF5F00" />
    </svg>
  );
}

/** Logo for a card brand; `onDark` switches Visa to white for use on a coloured card. */
export function CardBrandLogo({ brand, onDark = false, className }: { brand: string; onDark?: boolean; className?: string }) {
  if (String(brand).toUpperCase() === "MASTERCARD") return <MastercardLogo {...(className ? { className } : {})} />;
  return <VisaLogo {...(className ? { className } : {})} color={onDark ? "#FFFFFF" : "#1A1F71"} />;
}

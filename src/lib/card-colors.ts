import type { CardColor } from "./queries";

// Card text is always white (see the dark scrim overlay drawn under it in
// card.tsx), so a preset only needs two gradient stops — no separate "ink"
// color to keep in sync with the background, which was the source of the
// cardholder-name/expiry contrast bug.
export const CARD_COLOR_PRESETS: Record<CardColor, { name: string; gradient: string }> = {
  mint: { name: "Mint", gradient: "linear-gradient(135deg, #22c55e 0%, #0f766e 100%)" },
  sunset: { name: "Sunset", gradient: "linear-gradient(135deg, #fb7185 0%, #7c3aed 100%)" },
  ocean: { name: "Ocean", gradient: "linear-gradient(135deg, #38bdf8 0%, #1e1b4b 100%)" },
  gold: { name: "Gold", gradient: "linear-gradient(135deg, #f59e0b 0%, #7c2d12 100%)" },
  midnight: { name: "Midnight", gradient: "linear-gradient(135deg, #334155 0%, #000000 100%)" },
  forest: { name: "Forest", gradient: "linear-gradient(135deg, #16a34a 0%, #064e3b 100%)" },
  chrome: { name: "Chrome", gradient: "linear-gradient(135deg, #cbd5e1 0%, #475569 100%)" },
};

// Fee schedule shown in the app. The rules come from the backend (getPublicConfig -> fees, table fee_rules, editable by
// an admin). This mirrors backend src/fees.ts for previews only: the server recomputes every fee when money moves.
import { usd } from "@/lib/format";
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type FeeOperation = "card_creation" | "wallet_deposit" | "wallet_withdrawal" | "card_fund" | "card_withdraw" | "transfer";
export type FeeRule = {
  operation: FeeOperation;
  feeType: "flat" | "percent";
  minAmount: number | null;
  maxAmount: number | null;
  feeValue: number;
};

/**
 * The card service keeps a flat closing fee out of what is left on a card when it is closed (never more than what is
 * left). The amount comes from the backend (getPublicConfig -> cardClosureFeeUsd); 0.50 until the config is loaded.
 */
export const CARD_CLOSURE_FEE_FALLBACK_USD = 0.5;
export function cardClosingFee(balance: number, flat: number | undefined): number {
  const f = Number.isFinite(flat) && (flat as number) >= 0 ? (flat as number) : CARD_CLOSURE_FEE_FALLBACK_USD;
  return round2(Math.min(f, Math.max(Number(balance) || 0, 0)));
}

/** What the user is told before closing a card holding `balance`. */
export function closeCardNotice(balance: number, flat: number | undefined): string {
  const fee = cardClosingFee(balance, flat);
  if (balance > 0 && fee >= balance) return `Any money left on the card (${usd(balance)}) is kept by the card service as a closing fee, so nothing goes back to your wallet.`;
  if (fee > 0) return `Any money left on the card (${usd(balance)}) goes back to your wallet, minus a ${usd(fee)} closing fee.`;
  return `Any money left on the card (${usd(balance)}) goes back to your wallet.`;
}

/** The result line shown after a card was closed. `refunded` is what reached the wallet, `fee` the closing fee. */
export function closedCardResult(refunded: number, fee: number | undefined): string | undefined {
  if (refunded > 0) return fee && fee > 0 ? `${usd(refunded)} returned to your wallet after a ${usd(fee)} closing fee.` : `${usd(refunded)} returned to your wallet.`;
  return fee && fee > 0 ? `Nothing was left after the ${usd(fee)} closing fee.` : undefined;
}

/** Fee in USD for `amount`, or null when the schedule is not loaded or the amount is outside the brackets. */
export function feeFor(rules: FeeRule[] | undefined, op: FeeOperation, amount: number): number | null {
  if (!rules || !Number.isFinite(amount) || amount <= 0) return null;
  const list = rules.filter((r) => r.operation === op).sort((a, b) => (a.minAmount ?? 0) - (b.minAmount ?? 0));
  if (!list.length) return null;
  const tiers = list.filter((r) => r.minAmount !== null && r.maxAmount !== null);
  const a = round2(amount);
  const rule = tiers.length ? tiers.find((t) => a >= t.minAmount! && a <= t.maxAmount!) : list[0];
  if (!rule) return null;
  if (rule.feeType === "flat") return round2(rule.feeValue);
  return rule.feeValue > 0 ? Math.max(0.01, round2((amount * rule.feeValue) / 100)) : 0;
}

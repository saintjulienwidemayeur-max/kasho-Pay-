// Fee schedule shown in the app. The rules come from the backend (getPublicConfig -> fees, table fee_rules, editable by
// an admin). This mirrors backend src/fees.ts for previews only: the server recomputes every fee when money moves.
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type FeeOperation = "card_creation" | "wallet_deposit" | "wallet_withdrawal" | "card_fund" | "card_withdraw" | "transfer";
export type FeeRule = {
  operation: FeeOperation;
  feeType: "flat" | "percent";
  minAmount: number | null;
  maxAmount: number | null;
  feeValue: number;
};

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

/** Keeps only digits and one dot, with at most 2 decimals (money input). */
export function cleanAmount(v: string): string {
  const [whole = "", ...rest] = v.replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export const usd = (n: number) => `$${Number(n).toFixed(2)}`;

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const m = (e as { message?: string } | null)?.message;
  return m && !m.includes("fetch") ? m : fallback;
}

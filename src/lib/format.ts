export const usd = (n: number) => `$${Number(n).toFixed(2)}`;

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const m = (e as { message?: string } | null)?.message;
  return m && !m.includes("fetch") ? m : fallback;
}

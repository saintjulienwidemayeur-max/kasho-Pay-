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

/** Number with thousands separators in the UI language: 1,310 in English, 1 310 in French. */
export function fmtNum(n: number, lang: "en" | "fr" = "en"): string {
  return Number(n).toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
}

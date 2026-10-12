// Client for the Kasho Pay backend (separate project, see kasho-pay-backend).
// Every call sends the Supabase access token; the backend verifies it.
import { supabase } from "@/integrations/supabase/client";

// If the app is opened from another device on the same Wi-Fi (e.g. http://192.168.1.155:5173),
// "localhost" would point to that device, so use the same host as the page with the backend port.
function apiUrl(): string {
  const env = import.meta.env["VITE_API_URL"] as string | undefined;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const envIsLocal = !env || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env);
    if (envIsLocal && host !== "localhost" && host !== "127.0.0.1") return `${window.location.protocol}//${host}:4000`;
  }
  return (env ?? "http://localhost:4000").replace(/\/+$/, "");
}

async function call<T>(name: string, body: unknown = {}): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  let res: Response;
  // Never wait forever: a sleeping or unreachable server must end in a clear error, not an endless spinner.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    res = await fetch(`${apiUrl()}/api/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("The Kasho server took too long to answer. Please try again in a moment.");
    }
    throw new Error("Cannot reach the Kasho server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    if (res.status === 401) void supabase.auth.signOut();
    throw new Error(json?.error?.message ?? (json ? "Something went wrong. Please try again." : `The server did not answer correctly (HTTP ${res.status}). Please try again in a moment.`));
  }
  return json.data as T;
}

type Arg<T> = { data: T };
type CardColor = "mint" | "sunset" | "ocean" | "gold" | "midnight" | "forest" | "chrome";

export type PublicConfig = {
  htgPerUsd: number; withdrawFeePercent: number; cardCreationFeeUsd: number; minDepositUsd: number;
  minWithdrawUsd: number; minCardFundUsd: number; requireKycForCards: boolean; sandbox: boolean;
};
export type CardTx = { id: string; title: string; type: string; amount: number; status: string; createdAt: string };

export const getPublicConfig = () => call<PublicConfig>("getPublicConfig");
export const logActivity = (a: Arg<{ event: "Successful login" }>) => call<{ ok: boolean }>("logActivity", a.data);

export const createKycSession = () => call<{ url: string; reference: string }>("createKycSession", {});
export const syncKyc = () => call<{ status: "unverified" | "pending" | "verified" | "rejected" }>("syncKyc", {});

export const startDeposit = (a: Arg<{ provider: "moncash" | "natcash"; amountUsd: number; phone?: string | undefined }>) =>
  call<{ transactionId: string; checkoutUrl: string | null; amountHtg: number; ussd: boolean }>("startDeposit", a.data);
export const syncTransaction = (a: Arg<{ transactionId: string }>) =>
  call<{ status: "pending" | "completed" | "failed" }>("syncTransaction", a.data);
export const startWithdrawal = (a: Arg<{ provider: "moncash" | "natcash"; amountUsd: number; phone: string; confirmPassword: string }>) =>
  call<{ transactionId: string; status: "pending"; fee: number }>("startWithdrawal", a.data);

export const searchUsers = (a: Arg<{ q: string }>) => call<{ username: string; name: string; kashoId?: string; email?: string }[]>("searchUsers", a.data);
export const sendMoney = (a: Arg<{ username: string; amountUsd: number; note?: string | undefined }>) =>
  call<{ reference: string; recipient: string }>("sendMoney", a.data);

export type CardHolderInput = {
  firstName: string; lastName: string; email: string; dob: string; country: string; idNumber: string;
  phoneCode: string; phone: string; street: string; city: string; state: string; postalCode: string;
};
export const createHolderFn = (a: Arg<CardHolderInput>) =>
  call<{ holderId: string; linked: boolean; warning: string | null }>("createHolderFn", a.data);
export const createCardFn = (a: Arg<{ label?: string | undefined; color: CardColor; brand: "VISA" | "MASTERCARD"; amountUsd: number; holderId?: string | undefined; holder?: { idNumber?: string; phoneCode?: string; phone?: string; street?: string; city?: string; state?: string; postalCode?: string } | undefined }>) =>
  call<{ cardId: string; transactionId: string }>("createCardFn", a.data);
export const syncCardFn = (a: Arg<{ cardId: string }>) => call<{ status: string }>("syncCardFn", a.data);
export const fundCardFn = (a: Arg<{ cardId: string; amountUsd: number }>) => call<{ ok: boolean }>("fundCardFn", a.data);
export const withdrawCardFn = (a: Arg<{ cardId: string; amountUsd: number }>) => call<{ ok: boolean }>("withdrawCardFn", a.data);
export const freezeCardFn = (a: Arg<{ cardId: string; freeze: boolean }>) => call<{ status: string }>("freezeCardFn", a.data);
export const terminateCardFn = (a: Arg<{ cardId: string }>) => call<{ refunded: number }>("terminateCardFn", a.data);
export const updateCardFn = (a: Arg<{ cardId: string; label: string; color: CardColor }>) => call<{ ok: boolean }>("updateCardFn", a.data);
export const revealCardFn = (a: Arg<{ cardId: string; code: string }>) =>
  call<{ number: string; cvv: string; expiryMonth: string; expiryYear: string; holderName: string }>("revealCardFn", a.data);
export const cardTransactionsFn = (a: Arg<{ cardId: string }>) =>
  call<{ items: CardTx[]; monthSpend: number }>("cardTransactionsFn", a.data);

export const fileDisputeFn = (a: Arg<{ transactionRef: string; reason: string; note?: string | undefined; title?: string; amount?: number }>) =>
  call<{ reference: string }>("fileDisputeFn", a.data);
export const sendSupportMessage = (a: Arg<{ message: string }>) => call<{ ok: boolean }>("sendSupportMessage", a.data);

export const changePassword = (a: Arg<{ currentPassword: string; newPassword: string }>) => call<{ ok: boolean }>("changePassword", a.data);
export const getIdentity = () => call<{ idNumber: string }>("getIdentity", {});
export const changeEmail = (a: Arg<{ currentPassword: string; newEmail: string }>) => call<{ ok: boolean }>("changeEmail", a.data);

export const setCardCode = (a: Arg<{ currentPassword: string; code: string }>) =>
  call<{ ok: true }>("setCardCode", a.data);

export const removeCardFn = (a: Arg<{ cardId: string }>) => call<{ ok: true }>("removeCardFn", a.data);

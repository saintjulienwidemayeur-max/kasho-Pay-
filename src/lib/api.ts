// Client for the Kasho Pay backend (separate project, see kasho-pay-backend).
// Every call sends the Supabase access token; the backend verifies it.
import { supabase } from "@/integrations/supabase/client";
import type { FeeRule } from "@/lib/fees";
import { canPromptMfa, requestMfa } from "@/lib/mfa-gate";

/** Error from the Kasho backend. `code` is the machine-readable reason (MFA_REQUIRED, PASSWORD_INVALID...). */
export class ApiError extends Error {
  code: string | undefined;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
export const errorCode = (e: unknown): string | undefined => (e as { code?: string } | null)?.code;

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

async function call<T>(name: string, body: unknown = {}, retriedAfterMfa = false): Promise<T> {
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
    const code: string | undefined = typeof json?.error?.code === "string" ? json.error.code : undefined;
    // 2FA is on but this session has not passed it: ask for the authenticator code, then retry the request once.
    if (res.status === 403 && code === "MFA_REQUIRED" && !retriedAfterMfa && canPromptMfa()) {
      await requestMfa(); // throws Error("cancelled") when the user closes the prompt
      return call<T>(name, body, true);
    }
    if (res.status === 401) void supabase.auth.signOut();
    throw new ApiError(json?.error?.message ?? (json ? "Something went wrong. Please try again." : `The server did not answer correctly (HTTP ${res.status}). Please try again in a moment.`), res.status, code);
  }
  return json.data as T;
}

type Arg<T> = { data: T };
type CardColor = "mint" | "sunset" | "ocean" | "gold" | "midnight" | "forest" | "chrome";

export type PublicConfig = {
  htgPerUsd: number; fees: FeeRule[]; minDepositUsd: number; maxDepositUsd: number | null;
  minWithdrawUsd: number; maxWithdrawUsd: number | null; minCardFundUsd: number; minCardPrefundUsd: number; cardClosureFeeUsd?: number; requireKycForCards: boolean; sandbox: boolean;
  pushPublicKey: string | null;
};
export type CardTx = { id: string; title: string; type: string; amount: number; status: string; createdAt: string };

export const getPublicConfig = () => call<PublicConfig>("getPublicConfig");
export const savePushSubscription = (a: Arg<{ endpoint: string; keys: { p256dh: string; auth: string }; lang: "fr" | "en"; tz?: string | undefined }>) =>
  call<{ ok: true }>("savePushSubscription", a.data);
export const removePushSubscription = (a: Arg<{ endpoint: string }>) => call<{ ok: true }>("removePushSubscription", a.data);
export const sendTestPush = () => call<{ sent: number }>("sendTestPush", {});
export const logActivity = (a: Arg<{ event: "Successful login" }>) => call<{ ok: boolean }>("logActivity", a.data);

export const createKycSession = () => call<{ url: string; reference: string }>("createKycSession", {});
export const syncKyc = () => call<{ status: "unverified" | "pending" | "verified" | "rejected" }>("syncKyc", {});

export const startDeposit = (a: Arg<{ provider: "moncash" | "natcash"; amountUsd: number; phone?: string | undefined }>) =>
  call<{ transactionId: string; checkoutUrl: string | null; amountHtg: number; ussd: boolean; fee: number }>("startDeposit", a.data);
export const syncTransaction = (a: Arg<{ transactionId: string }>) =>
  call<{ status: "pending" | "completed" | "failed" }>("syncTransaction", a.data);
export const startWithdrawal = (a: Arg<{ provider: "moncash" | "natcash"; amountUsd: number; phone: string; confirmPassword: string }>) =>
  call<{ transactionId: string; status: "pending"; fee: number }>("startWithdrawal", a.data);

export const searchUsers = (a: Arg<{ q: string }>) => call<{ username: string; name: string; kashoId?: string; email?: string }[]>("searchUsers", a.data);
export const sendMoney = (a: Arg<{ username: string; amountUsd: number; note?: string | undefined; idempotencyKey?: string | undefined }>) =>
  call<{ reference: string; recipient: string; fee: number }>("sendMoney", a.data);

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
export const terminateCardFn = (a: Arg<{ cardId: string }>) => call<{ refunded: number; fee?: number }>("terminateCardFn", a.data);
export const updateCardFn = (a: Arg<{ cardId: string; label: string; color: CardColor }>) => call<{ ok: boolean }>("updateCardFn", a.data);
export const revealCardFn = (a: Arg<{ cardId: string; code: string }>) =>
  call<{ number: string; cvv: string; expiryMonth: string; expiryYear: string; holderName: string }>("revealCardFn", a.data);
export const cardTransactionsFn = (a: Arg<{ cardId: string }>) =>
  call<{ items: CardTx[]; monthSpend: number }>("cardTransactionsFn", a.data);

export const fileDisputeFn = (a: Arg<{ transactionRef: string; reason: string; note?: string | undefined; title?: string; amount?: number }>) =>
  call<{ reference: string }>("fileDisputeFn", a.data);
export const sendSupportMessage = (a: Arg<{ message: string }>) => call<{ ok: boolean }>("sendSupportMessage", a.data);

export const changePassword = (a: Arg<{ currentPassword: string; newPassword: string }>) => call<{ ok: boolean }>("changePassword", a.data);
// Needs the password (step-up): ask for it with useStepUp().ask() and pass it as confirmPassword.
export const getIdentity = (a: Arg<{ confirmPassword: string }>) => call<{ idNumber: string }>("getIdentity", a.data);
export const changeEmail = (a: Arg<{ currentPassword: string; newEmail: string }>) => call<{ ok: boolean }>("changeEmail", a.data);

export const setCardCode = (a: Arg<{ currentPassword: string; code: string }>) =>
  call<{ ok: true }>("setCardCode", a.data);

export const removeCardFn = (a: Arg<{ cardId: string }>) => call<{ ok: true }>("removeCardFn", a.data);

// ---------------------------------------------------------------- admin panel (see backend src/admin.ts)
export type AdminRole = "super" | "admin";
export type AdminStatus = { isAdmin: boolean; role: AdminRole | null; hasTotp: boolean; mfaOk: boolean; email: string };
export const adminStatus = () => call<AdminStatus>("adminStatus", {});

export type MasterWallet = { balance: number; guarantee: number; spendable: number; low: boolean; reservedOnCards: number; activeCards: number; mode: "live" | "sandbox" | null };
export type FredaSnapshot = {
  configured: boolean; mode: "live" | "sandbox" | null; ok: boolean; message?: string; fetchedAt: string;
  master: MasterWallet | null; gateway: { htg: number | null; usd: number | null } | null;
};
export type PnlOperation = "deposit" | "withdrawal" | "card_creation" | "card_fund" | "card_withdraw" | "card_closure" | "transfer" | "master_wallet_funding" | "card_purchase" | "plans";
export type PnlLine = { operation: PnlOperation; count: number; volume: number; revenue: number; partnerCost: number; profit: number; estimated: number };
export type Pnl = {
  lines: PnlLine[];
  totals: { revenue: number; partnerCost: number; profit: number; margin: number | null };
  daily: { date: string; revenue: number; partnerCost: number; profit: number }[];
};
export type GatewayPlan = "standard" | "pro" | "business";
export type IssuingPlan = "startup" | "pro" | "premium";
export type AdminOverview = {
  period: { from: string; to: string; days: number };
  freda: FredaSnapshot;
  stats: {
    usersTotal: number; usersNew: number; usersVerified: number; usersKycPending: number; walletsTotal: number; walletsFunded: number;
    cardsTotal: number; cardsActive: number; cardsBalance: number; txPending: number; txPendingOld: number; txFailed: number;
    adjustCredits: number; adjustDebits: number; cardPurchases: number; cardEventsSince: string | null;
  };
  pnl: Pnl;
  funds: { owedToUsers: number; heldAtFreda: number | null; coverage: number | null; rate: number };
  plans: { gateway: GatewayPlan; issuing: IssuingPlan };
  truncated: boolean;
};
export const adminOverview = (a: Arg<{ days: number }>) => call<AdminOverview>("adminOverview", a.data);
export const adminFredaFunds = () => call<FredaSnapshot>("adminFredaFunds", {});

export type AdminFeeRule = FeeRule & { id: string; label: string; active: boolean };
export type FeeOperation = FeeRule["operation"];
export const adminListFees = () => call<{ operations: FeeOperation[]; tiered: FeeOperation[]; rules: AdminFeeRule[] }>("adminListFees", {});
export type AdminFeeInput = {
  id?: string | undefined; operation: FeeOperation; label: string; feeType: "flat" | "percent"; minAmount: number | null; maxAmount: number | null;
  feeValue: number; active: boolean; confirmPassword: string;
};
export const adminSaveFee = (a: Arg<AdminFeeInput>) => call<AdminFeeRule>("adminSaveFee", a.data);
export const adminDeleteFee = (a: Arg<{ id: string; confirmPassword: string }>) => call<{ ok: true }>("adminDeleteFee", a.data);

export type PartnerOperation = "deposit" | "withdrawal" | "card_creation" | "card_fund" | "card_withdraw" | "card_closure" | "card_purchase" | "master_wallet_funding";
export type PartnerRule = { operation: PartnerOperation; label: string; percent: number; flatUsd: number; flatHtg: number; thresholdUsd: number | null; active: boolean; note: string };
export type FeeAnalysisRow = { operation: FeeOperation; amount: number; ourFee: number | null; partnerCost: number; margin: number | null };
export type AdminPartnerCosts = {
  plans: { gateway: GatewayPlan; issuing: IssuingPlan }; options: { gateway: GatewayPlan[]; issuing: IssuingPlan[] };
  rules: PartnerRule[]; rate: number; monthlyPlanUsd: number; analysis: FeeAnalysisRow[];
};
export const adminPartnerCosts = () => call<AdminPartnerCosts>("adminPartnerCosts", {});
export const adminSavePartnerCost = (a: Arg<Omit<PartnerRule, "label"> & { confirmPassword: string }>) => call<{ ok: true }>("adminSavePartnerCost", a.data);
export const adminApplyPartnerPlan = (a: Arg<{ gateway: GatewayPlan; issuing: IssuingPlan; confirmPassword: string }>) => call<{ ok: true }>("adminApplyPartnerPlan", a.data);

export type AdminUserRow = {
  id: string; email: string; name: string; username: string; kashoId: string | null; phone: string; kycStatus: string; balance: number; cards: number;
  createdAt: string; lastSignInAt: string | null; banned: boolean; adminRole: AdminRole | null;
};
export const adminListUsers = (a: Arg<{ q?: string | undefined; page: number; pageSize?: number | undefined }>) =>
  call<{ total: number; page: number; pageSize: number; users: AdminUserRow[] }>("adminListUsers", a.data);
export type AdminTx = { id: string; reference: string; kind: string; title: string; category: string; method: string; amount: number; fee: number; status: string; createdAt: string; note: string | null };
export type AdminUserDetail = {
  id: string; email: string; createdAt: string; lastSignInAt: string | null; banned: boolean; adminRole: AdminRole | null;
  profile: { name: string; username: string; kashoId: string | null; firstName: string; lastName: string; phone: string; country: string; kycStatus: string };
  balance: number;
  cards: { id: string; label: string; brand: string; last4: string; status: string; balance: number; createdAt: string }[];
  transactions: AdminTx[];
};
export const adminGetUser = (a: Arg<{ userId: string }>) => call<AdminUserDetail>("adminGetUser", a.data);
export const adminAdjustBalance = (a: Arg<{ userId: string; direction: "credit" | "debit"; amountUsd: number; note: string; confirmPassword: string }>) =>
  call<{ reference: string; balanceBefore: number; balanceAfter: number }>("adminAdjustBalance", a.data);
export const adminSetUserBlocked = (a: Arg<{ userId: string; blocked: boolean; confirmPassword: string }>) => call<{ blocked: boolean }>("adminSetUserBlocked", a.data);

export type AdminTxRow = AdminTx & { userId: string; customer: string; kashoId: string | null; providerRef: string | null };
export const adminListTransactions = (a: Arg<{ q?: string | undefined; kind?: string | undefined; status?: "pending" | "completed" | "failed" | undefined; userId?: string | undefined; page: number; pageSize?: number | undefined }>) =>
  call<{ total: number; page: number; pageSize: number; items: AdminTxRow[] }>("adminListTransactions", a.data);
export type AdminDispute = { id: string; user_id: string; transaction_ref: string; title: string; amount: number; reason: string; note: string; reference: string; created_at: string; customer: string };
export type AdminSupportMessage = { id: string; user_id: string; email: string | null; message: string; created_at: string; customer: string };
export const adminListSupport = () => call<{ disputes: AdminDispute[]; messages: AdminSupportMessage[] }>("adminListSupport", {});
export type AdminAuditRow = { id: string; admin_email: string | null; action: string; target_user: string | null; target: string | null; details: Record<string, unknown>; ip: string | null; created_at: string };
export const adminListAudit = (a: Arg<{ page: number; pageSize?: number | undefined }>) => call<{ total: number; page: number; pageSize: number; items: AdminAuditRow[] }>("adminListAudit", a.data);

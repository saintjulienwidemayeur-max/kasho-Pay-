import { useSession } from "@/lib/session";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type VerificationState = { status: VerificationStatus; reference?: string };

// Identity verification state comes from the user's profile (kyc_status is set by the server only).
export function useVerification(): VerificationState {
  const s = useSession();
  const p = s?.profile;
  return { status: p?.kyc_status ?? "unverified", ...(p?.kyc_reference ? { reference: p.kyc_reference } : {}) };
}

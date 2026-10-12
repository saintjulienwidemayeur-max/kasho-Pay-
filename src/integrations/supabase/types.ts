// Hand-maintained types for the Kasho Pay schema (see supabase/migrations).
// Regenerate with `supabase gen types typescript` if you prefer.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Tbl<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type ProfileRow = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  preferred_currency: string;
  notifications_enabled: boolean;
  first_name: string | null;
  last_name: string | null;
  phone_code: string;
  phone_number: string | null;
  date_of_birth: string | null;
  country: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  id_type: string | null;
  id_number: string | null;
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  kyc_reference: string | null;
  kasho_id: string | null;
  notification_prefs: { push: boolean; email: boolean; sms: boolean };
  freda_holder_id: string | null;
  freda_holder_mode: string | null;
  freda_holder_created: boolean;
  card_code_set: boolean;
  card_email: string | null;
  created_at: string;
  updated_at: string;
};

export type WalletRow = { user_id: string; balance: number; updated_at: string };

export type CardRow = {
  id: string;
  user_id: string;
  hidden: boolean;
  freda_card_id: string | null;
  reference: string;
  label: string;
  color: string;
  brand: string;
  status: "pending" | "active" | "disabled" | "failed" | "terminated";
  last4: string | null;
  expiry: string | null;
  balance: number;
  creation_tx_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  reference: string;
  kind: string;
  title: string;
  category: string;
  method: string;
  amount: number;
  fee: number;
  status: "pending" | "completed" | "failed";
  card_id: string | null;
  counterparty_id: string | null;
  provider: string | null;
  provider_ref: string | null;
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type DisputeRow = {
  id: string;
  user_id: string;
  transaction_ref: string;
  title: string;
  amount: number;
  reason: string;
  note: string;
  reference: string;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  user_id: string;
  event: string;
  detail: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type KycRow = {
  id: string;
  user_id: string;
  reference: string;
  status: "pending" | "verified" | "rejected";
  doc_type: string;
  document_path: string;
  selfie_path: string;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type CardHolderRow = {
  id: string;
  user_id: string;
  freda_holder_id: string | null;
  mode: string;
  email: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  country: string | null;
  status: string;
  created_at: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      profiles: Tbl<ProfileRow>;
      wallets: Tbl<WalletRow>;
      cards: Tbl<CardRow>;
      card_holders: Tbl<CardHolderRow>;
      transactions: Tbl<TransactionRow>;
      disputes: Tbl<DisputeRow>;
      notifications: Tbl<NotificationRow>;
      activity_log: Tbl<ActivityRow>;
      kyc_submissions: Tbl<KycRow>;
      support_messages: Tbl<{ id: string; user_id: string; email: string | null; message: string; created_at: string }>;
      webhook_events: Tbl<{ id: string; event: string; received_at: string }>;
    };
    Views: { [_ in never]: never };
    Functions: { [key: string]: { Args: any; Returns: any } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export const Constants = { public: { Enums: {} } } as const;

// Data layer: reads go straight to Supabase (protected by RLS, select-only),
// writes go through the backend API (see api.ts, the backend client).
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CardHolderRow, CardRow, DisputeRow } from "@/integrations/supabase/types";
import { toTransaction, type Transaction } from "@/components/kasho/data";
import { useSession } from "@/lib/session";

export type CardColor = "mint" | "sunset" | "ocean" | "gold" | "midnight" | "forest" | "chrome";
export type CardStatus = "pending" | "active" | "frozen" | "failed" | "terminated";

export type KashoCard = {
  id: string;
  label: string;
  last4: string;
  expiry: string;
  balance: number;
  status: CardStatus;
  color: CardColor;
  brand: string;
};

const COLORS: CardColor[] = ["mint", "sunset", "ocean", "gold", "midnight", "forest", "chrome"];

function toCard(r: CardRow): KashoCard {
  return {
    id: r.id,
    label: r.label,
    last4: r.last4 ?? "----",
    expiry: r.expiry ?? "--/--",
    balance: Number(r.balance),
    status: r.status === "disabled" ? "frozen" : r.status,
    color: COLORS.includes(r.color as CardColor) ? (r.color as CardColor) : "mint",
    brand: r.brand,
  };
}

export function useWalletState() {
  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("balance").maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
    },
    refetchInterval: 30_000,
  });
  const cards = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      let res = await supabase.from("cards").select("*").neq("status", "failed").eq("hidden", false).order("created_at");
      // If the "hidden" column has not been added to the database yet, still show the cards.
      if (res.error && /hidden/i.test(res.error.message)) {
        res = await supabase.from("cards").select("*").neq("status", "failed").order("created_at");
      }
      if (res.error) throw res.error;
      return (res.data ?? []).map((r) => toCard(r as CardRow));
    },
    refetchInterval: 30_000,
  });
  return {
    walletBalance: wallet.data ?? 0,
    cards: (cards.data ?? []) as KashoCard[],
    loading: wallet.isLoading || cards.isLoading,
  };
}

export function useTransactions() {
  const q = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []).map((r) => toTransaction(r as any));
    },
    refetchInterval: 30_000,
  });
  return { items: (q.data ?? []) as Transaction[], loading: q.isLoading };
}

export function useHolders() {
  const q = useQuery({
    queryKey: ["holders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("card_holders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CardHolderRow[];
    },
  });
  return { holders: q.data ?? [], loading: q.isLoading };
}

export function useDisputes() {
  const q = useQuery({
    queryKey: ["disputes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("disputes").select("*");
      if (error) throw error;
      const map: Record<string, DisputeRow> = {};
      for (const d of (data ?? []) as DisputeRow[]) map[d.transaction_ref] = d;
      return map;
    },
  });
  return q.data ?? {};
}

export function useRefreshAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["wallet", "cards", "transactions", "notifications", "disputes", "card-tx", "holders"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}

/** Live updates: any change to the user's own rows refreshes the screens instantly. */
export function useRealtimeSync() {
  const session = useSession();
  const refresh = useRefreshAll();
  const userId = session?.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`kasho-${userId}`);
    for (const table of ["wallets", "transactions", "cards", "notifications"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => void refresh());
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}

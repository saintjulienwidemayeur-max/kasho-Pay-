import { format, isSameMonth, isToday, isYesterday } from "date-fns";
import type { TransactionRow } from "@/integrations/supabase/types";

export type Transaction = {
  id: string; // public reference (KP-...)
  dbId: string;
  title: string;
  initials: string;
  amount: number; // signed USD, fee not included
  fee: number;
  time: string;
  date: "Today" | "Yesterday" | "This Month" | "Earlier";
  category: string;
  status: "Completed" | "Pending" | "Failed";
  method: string;
  cardId: string | null;
  kind: string;
  username: string | null;
  createdAt: string;
};

export const DATE_GROUPS = ["Today", "Yesterday", "This Month", "Earlier"] as const;

function initialsOf(title: string) {
  const parts = title.replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function toTransaction(r: TransactionRow): Transaction {
  const d = new Date(r.created_at);
  const date: Transaction["date"] = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : isSameMonth(d, new Date()) ? "This Month" : "Earlier";
  return {
    id: r.reference,
    dbId: r.id,
    title: r.title,
    initials: initialsOf(r.title),
    amount: Number(r.amount),
    fee: Number(r.fee),
    time: date === "Today" || date === "Yesterday" ? format(d, "hh:mm a") : format(d, "MMM d · hh:mm a"),
    date,
    category: r.category,
    status: r.status === "completed" ? "Completed" : r.status === "pending" ? "Pending" : "Failed",
    method: r.method,
    cardId: r.card_id,
    kind: r.kind,
    username: (r.meta?.["username"] as string | undefined) ?? null,
    createdAt: r.created_at,
  };
}

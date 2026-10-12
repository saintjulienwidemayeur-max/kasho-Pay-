import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { refreshSession } from "@/lib/session";

export type KashoNotification = {
  id: string;
  title: string;
  body: string;
  time: string; // ISO timestamp
  read: boolean;
};

export function useNotifications(): KashoNotification[] {
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []).map((n: any) => ({ id: n.id, title: n.title, body: n.body, time: n.created_at, read: n.read }));
    },
    refetchInterval: 30_000,
  });
  return q.data ?? [];
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  };
}

// --- Notification preferences (stored on the profile) ---
export type NotificationPrefs = { push: boolean; email: boolean; sms: boolean };
export const DEFAULT_PREFS: NotificationPrefs = { push: true, email: true, sms: false };

export async function saveNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  const { error } = await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", userId);
  if (error) throw error;
  await refreshSession();
}

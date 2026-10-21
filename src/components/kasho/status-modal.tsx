// Transaction status modal with 3 states: processing (spinner), success (animated green check), failed (animated red X).
// Use from anywhere: status.processing("Sending..."), status.success("Done", "details"), status.error("Failed", "reason").
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type State = { kind: "idle" } | { kind: "processing" | "success" | "error"; title: string; message?: string };

let state: State = { kind: "idle" };
const subs = new Set<() => void>();
const set = (s: State) => { state = s; subs.forEach((f) => f()); };

export const status = {
  processing: (title = "Processing...", message?: string) => set({ kind: "processing", title, ...(message ? { message } : {}) }),
  success: (title = "Success", message?: string) => set({ kind: "success", title, ...(message ? { message } : {}) }),
  // A cancelled action (user closed the 2FA / password prompt) is not an error: just close.
  error: (message = "Something went wrong. Please try again.", title = "Failed") => set(message === "cancelled" ? { kind: "idle" } : { kind: "error", title, message }),
  close: () => set({ kind: "idle" }),
};

const GREEN = "#00b45a";
const RED = "#ef4444";

function Icon({ kind }: { kind: "processing" | "success" | "error" }) {
  if (kind === "processing") {
    return (
      <div className="relative grid h-28 w-28 place-items-center">
        <span className="absolute inset-0 rounded-full border-[6px] border-muted" />
        <span className="status-spin absolute inset-0 rounded-full border-[6px] border-transparent border-t-primary" />
      </div>
    );
  }
  const ok = kind === "success";
  return (
    <svg viewBox="0 0 120 120" className={`h-28 w-28 ${ok ? "status-pop" : "status-pop status-shake"}`} style={{ filter: `drop-shadow(0 14px 18px ${ok ? "rgba(0,180,90,.35)" : "rgba(239,68,68,.35)"})` }} role="img" aria-label={ok ? "Success" : "Failed"}>
      <circle cx="60" cy="60" r="56" fill={ok ? GREEN : RED} />
      {ok ? (
        <path d="M36 62 L53 79 L86 44" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" className="status-draw" pathLength={1} />
      ) : (
        <>
          <path d="M42 42 L78 78" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" className="status-draw" pathLength={1} />
          <path d="M78 42 L42 78" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" className="status-draw status-draw-2" pathLength={1} />
        </>
      )}
    </svg>
  );
}

export function StatusModalHost() {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => void subs.delete(cb); }, () => state, () => state);
  const open = s.kind !== "idle";

  // A success closes by itself after a moment; a failure waits for the user.
  useEffect(() => {
    if (s.kind !== "success") return;
    const t = setTimeout(() => status.close(), 3200);
    return () => clearTimeout(t);
  }, [s]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && s.kind !== "processing") status.close(); }}>
      <DialogContent className="max-w-sm rounded-3xl text-center [&>button]:hidden" onInteractOutside={(e) => { if (s.kind === "processing") e.preventDefault(); }} onEscapeKeyDown={(e) => { if (s.kind === "processing") e.preventDefault(); }}>
        {s.kind !== "idle" && (
          <div className="flex flex-col items-center gap-4 py-4" aria-live="polite">
            <Icon kind={s.kind} />
            <DialogTitle className="text-xl font-semibold">{s.title}</DialogTitle>
            <DialogDescription className="max-w-xs text-sm leading-6">{s.message ?? (s.kind === "processing" ? "Please wait, do not close this page." : "")}</DialogDescription>
            {s.kind !== "processing" && (
              <Button className="mt-2 h-11 w-full rounded-xl" variant={s.kind === "error" ? "outline" : "default"} onClick={() => status.close()}>
                {s.kind === "success" ? "Done" : "Close"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

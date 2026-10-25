// Web Push client helpers. Everything is guarded for SSR and for browsers without support.
import { getPublicConfig, removePushSubscription, savePushSubscription } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { errorMessage } from "@/lib/format";

export type PushErrorCode = "denied" | "unsupported" | "dismissed" | "failed";
export class PushError extends Error {
  code: PushErrorCode;
  constructor(code: PushErrorCode, message: string) {
    super(message);
    this.name = "PushError";
    this.code = code;
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  try { return Notification.permission; } catch { return "unsupported"; }
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch { /* ignore */ }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports itself as a Mac with a touch screen.
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return true; // unknown: assume fine
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

let lastSent = "";

async function sendToBackend(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];
  if (!json.endpoint || !p256dh || !auth) throw new PushError("failed", "Invalid push subscription");
  const lang = getLang();
  let tz: string | undefined;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { /* ignore */ }
  await savePushSubscription({ data: { endpoint: json.endpoint, keys: { p256dh, auth }, lang, ...(tz ? { tz } : {}) } });
  lastSent = `${json.endpoint}|${lang}|${tz ?? ""}`;
}

async function subscribeWith(publicKey: string): Promise<PushSubscription> {
  const reg = (await registerServiceWorker()) ? await navigator.serviceWorker.ready : null;
  if (!reg) throw new PushError("unsupported", "Service worker unavailable");
  const key = urlBase64ToUint8Array(publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  return sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
}

/** Must be called from a user click (it prompts for permission). */
export async function enablePush(publicKey: string): Promise<PushSubscription> {
  if (!pushSupported()) throw new PushError("unsupported", "Notifications are not supported on this device");
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm === "denied") throw new PushError("denied", "Notifications are blocked for this site");
  if (perm !== "granted") throw new PushError("dismissed", "Notification permission was not granted");
  let sub: PushSubscription;
  try {
    sub = await subscribeWith(publicKey);
  } catch (e) {
    if (e instanceof PushError) throw e;
    throw new PushError("failed", e instanceof Error ? e.message : "Could not subscribe");
  }
  await sendToBackend(sub);
  return sub;
}

export async function disablePush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  lastSent = "";
  await removePushSubscription({ data: { endpoint } });
}

/** When permission is already granted: make sure the subscription exists and the backend knows it (and its language). */
export async function syncPushSubscription(): Promise<void> {
  if (pushPermission() !== "granted") return;
  try {
    const cfg = await getPublicConfig();
    if (!cfg.pushPublicKey) return;
    const sub = await subscribeWith(cfg.pushPublicKey);
    const lang = getLang();
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* ignore */ }
    if (lastSent === `${sub.endpoint}|${lang}|${tz}`) return;
    await sendToBackend(sub);
  } catch {
    /* best effort; retried on next app open */
  }
}

export function pushErrorMessage(e: unknown): string {
  if (e instanceof PushError) {
    if (e.code === "denied") return "Notifications are blocked. Allow them for Kasho Pay in your browser or phone settings, then try again.";
    if (e.code === "dismissed") return "Notifications were not turned on. You can try again any time.";
    if (e.code === "unsupported") return "This device does not support notifications.";
    return "Could not turn on notifications. Please try again.";
  }
  return errorMessage(e);
}

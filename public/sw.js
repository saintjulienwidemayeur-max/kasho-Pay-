/* Kasho Pay service worker: Web Push only. No fetch handler and no caching on purpose,
   so it can never interfere with the app, the API or authentication. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function safeUrl(raw) {
  try {
    if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
    const u = new URL(raw, self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search + u.hash : "/";
  } catch (e) {
    return "/";
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json() || {};
  } catch (e) {
    try { data = { body: event.data.text() }; } catch (e2) { data = {}; }
  }
  if (typeof data !== "object" || data === null) data = {};
  const title = typeof data.title === "string" && data.title ? data.title : "Kasho Pay";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/kasho-192.png",
    badge: "/icons/favicon-96.png",
    tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
    renotify: false,
    data: { url: safeUrl(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          const focused = "focus" in client ? await client.focus() : client;
          if (focused && "navigate" in focused) await focused.navigate(url);
          return;
        } catch (e) { /* try the next window or open a new one */ }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/* "pushsubscriptionchange" is intentionally not handled: a new subscription must be sent to the backend with the
   user's auth token, which the worker does not have. The app re-syncs the subscription (syncPushSubscription) on open. */

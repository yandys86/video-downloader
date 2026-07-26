/* Service Worker de tuvideodown.com — recibe Web Push y muestra notificación. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "tuvideodown", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "tuvideodown";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/shorts", job_id: data.job_id || null },
    tag: data.job_id || "tuvideodown",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/shorts";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsList) {
        try {
          const u = new URL(c.url);
          if (u.pathname.startsWith("/shorts")) {
            await c.focus();
            c.postMessage({ type: "navigate", url: target });
            return;
          }
        } catch {}
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});

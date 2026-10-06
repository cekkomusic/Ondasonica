/* Service worker di Ondasonica Manager: mostra i promemoria push e apre l'app al tocco. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch {
    p = { data: { body: event.data && event.data.text() } };
  }
  // Messaggi FCM: { data: {...}, notification: {...} }
  const d = Object.assign({}, p.notification || {}, p.data || {});
  const title = d.title || "OndaSonicA";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/logo.png",
      badge: "/icon.svg",
      tag: "ondasonica-promemoria",
      renotify: true,
      data: { url: d.url || "/calendario" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

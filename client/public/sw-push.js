// Service Worker para Push Notifications - GO Direction
// Este arquivo deve ficar em /public para ser registrado no escopo raiz

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "GO Direction",
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || "go-notification",
    data: payload.data || {},
    actions: payload.actions || [],
    vibrate: [200, 100, 200],
    requireInteraction: payload.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(payload.title || "GO Direction", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma janela aberta, focar nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Senão, abrir nova janela
      return clients.openWindow(url);
    })
  );
});

// Manter o SW ativo
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

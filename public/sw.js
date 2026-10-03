// Service worker de la app (personal y clientes).
// - Hace la app instalable.
// - NO guarda nada en caché: el monitoreo siempre muestra datos en vivo.
// - Recibe las notificaciones PUSH de alarmas (aunque la app esté cerrada).
// by Anthony Campos Medina
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<body style="background:#0b0f14;color:#e6edf3;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px">' +
        "<div><div style=\"font-size:42px\">📡</div><h2>Sin conexión a internet</h2><p style=\"color:#8b949e\">El monitoreo necesita internet para mostrar los eventos en vivo. Revisa tu conexión y vuelve a intentar.</p></div></body>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    )
  );
});

// ---- Notificación de alarma ----
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  const urgente = d.categoria === "alarma" || d.categoria === "prealarma";
  event.waitUntil(
    self.registration.showNotification(d.title || "Monitoreo Salvavidas", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      tag: "evento-" + Date.now(),
      requireInteraction: urgente, // la de alarma se queda hasta que la toquen
      vibrate: urgente ? [700, 250, 700, 250, 700, 250, 1500] : [300, 150, 300],
      data: { url: d.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.indexOf(url) >= 0 && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

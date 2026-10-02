// Service worker mínimo: lo necesita el navegador (y PWABuilder) para
// tratar la página como app instalable. NO guarda nada en caché a
// propósito: el monitoreo siempre tiene que mostrar datos en vivo y la
// app siempre la versión nueva que se suba a Vercel.
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

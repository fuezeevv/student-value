/* Only explicitly public projections. Never cache authenticated routes, APIs, OAuth or mutations. */
const VERSION = "sv-public-v1";
const allowed =
  /^\/browse\/(5130901-(40101|40102|40201|40202)|5130902-4020[1-4])(\/(courses|schedule|deadlines)(\/[^/]+)?)?$/;
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(VERSION).then((c) => c.add("/offline.html"))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("sv-public-") && name !== VERSION)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
async function status() {
  const c = await caches.open(VERSION);
  const keys = await c.keys();
  const dates = await Promise.all(
    keys.map(async (k) => (await c.match(k)).headers.get("x-sv-saved")),
  );
  const updated = dates.filter(Boolean).sort().at(-1) || null;
  for (const client of await self.clients.matchAll())
    client.postMessage({ type: "CACHE_STATUS", updated });
}
self.addEventListener("message", (e) => {
  if (e.data?.type === "STATUS") e.waitUntil(status());
  if (
    e.data?.type === "SAVE_PUBLIC" &&
    typeof e.data.path === "string" &&
    allowed.test(e.data.path)
  )
    e.waitUntil(
      (async () => {
        const c = await caches.open(VERSION),
          path = e.data.path,
          old = await c.match(path);
        if (
          old &&
          Date.now() - Date.parse(old.headers.get("x-sv-saved")) < 600000
        )
          return;
        try {
          const r = await fetch(path, {
            credentials: "omit",
            redirect: "error",
          });
          if (!r.ok) return;
          const html = await r.text(),
            headers = new Headers(r.headers);
          headers.set("x-sv-saved", new Date().toISOString());
          await c.put(path, new Response(html, { headers }));
          const assets = [
            ...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"<>]+)"/g),
          ].map((m) => m[1]);
          await Promise.all(
            [...new Set(assets)].slice(0, 60).map(async (url) => {
              if (await c.match(url)) return;
              try {
                const a = await fetch(url);
                if (a.ok) await c.put(url, a);
              } catch {}
            }),
          );
          await status();
        } catch {}
      })(),
    );
});
self.addEventListener("fetch", (e) => {
  const r = e.request,
    u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  const publicApi = [
    "/api/timetable",
    "/api/timetable/groups",
    "/api/timetable/teachers",
  ].includes(u.pathname);
  if (publicApi) {
    e.respondWith(
      (async () => {
        const c = await caches.open(VERSION);
        try {
          const response = await fetch(r, {
            credentials:
              publicApi || allowed.test(u.pathname) ? "omit" : "same-origin",
          });
          if (response.status >= 500) throw new Error("Upstream unavailable");
          if (response.ok) {
            const headers = new Headers(response.headers);
            headers.set("x-sv-saved", new Date().toISOString());
            await c.put(
              r,
              new Response(await response.clone().arrayBuffer(), { headers }),
            );
            const keys = (await c.keys()).filter((k) =>
              new URL(k.url).pathname.startsWith("/api/timetable"),
            );
            if (keys.length > 30) await c.delete(keys[0]);
            await status();
          }
          return response;
        } catch {
          const old = await c.match(r);
          if (!old)
            return new Response(
              JSON.stringify({ error: "Нет сохранённого расписания" }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          const body = await old.clone().json();
          if (body && typeof body === "object" && !Array.isArray(body))
            body.state = "STALE";
          return new Response(JSON.stringify(body), { headers: old.headers });
        }
      })(),
    );
    return;
  }
  if (
    r.mode === "navigate" &&
    (allowed.test(u.pathname) ||
      ["/", "/login", "/offline.html"].includes(u.pathname))
  ) {
    e.respondWith(
      (async () => {
        try {
          const response = await fetch(r, {
            credentials:
              publicApi || allowed.test(u.pathname) ? "omit" : "same-origin",
          });
          if (response.status >= 500) throw new Error("Upstream unavailable");
          if (response.ok && allowed.test(u.pathname)) {
            const headers = new Headers(response.headers);
            headers.set("x-sv-saved", new Date().toISOString());
            const copy = new Response(await response.clone().arrayBuffer(), {
              status: response.status,
              headers,
            });
            const c = await caches.open(VERSION);
            await c.put(r, copy);
            const keys = await c.keys();
            if (keys.length > 40)
              await c.delete(
                keys.find((k) => new URL(k.url).pathname !== "/offline.html"),
              );
            await status();
          }
          return response;
        } catch {
          return (
            (await caches.match(r)) || (await caches.match("/offline.html"))
          );
        }
      })(),
    );
  } else if (
    u.pathname.startsWith("/_next/static/") ||
    u.pathname === "/fonts/InterVariable.woff2" ||
    /^\/(icon.*\.png|apple-icon.png|theme-init.js)$/.test(u.pathname)
  ) {
    e.respondWith(
      (async () => {
        const old = await caches.match(r);
        if (old) return old;
        const response = await fetch(r, {
          credentials:
            publicApi || allowed.test(u.pathname) ? "omit" : "same-origin",
        });
        if (response.status >= 500) throw new Error("Upstream unavailable");
        if (response.ok) {
          const c = await caches.open(VERSION);
          await c.put(r, response.clone());
        }
        return response;
      })(),
    );
  }
});

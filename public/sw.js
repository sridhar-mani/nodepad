const CACHE_VERSION = "nodepad-v3"
const SYNC_TAG = "nodepad-workspace-sync"
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/icon.svg", "/nodepad.jpg", "/apple-icon.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  )
})

const AD_HOST_FRAGMENTS = [
  "googleads",
  "googlesyndication",
  "doubleclick",
  "adservice.google",
  "adsterra",
  "propellerads",
  "propellerclick",
  "infolinks",
]

function isAdNetworkUrl(url) {
  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()
  return AD_HOST_FRAGMENTS.some(
    (frag) => host.includes(frag) || (host.includes("google.com") && path.includes("pagead")),
  )
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept or cache ad network traffic — always hit the network.
  if (isAdNetworkUrl(url)) {
    event.respondWith(fetch(request))
    return
  }

  if (request.method !== "GET") return
  if (url.origin !== self.location.origin) return

  const isStatic = STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")
  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() => caches.match(request)),
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
  if (event.data?.type === "SHOW_NOTIFICATION" && event.data.payload) {
    const { title, body, tag, url } = event.data.payload
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: tag || "nodepad",
        icon: "/nodepad.jpg",
        badge: "/icon.svg",
        data: { url: url || "/" },
      }),
    )
  }
})

self.addEventListener("push", (event) => {
  let payload = { title: "nodepad", body: "You have an update", url: "/" }
  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = { ...payload, ...parsed }
    }
  } catch {
    if (event.data) payload.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/nodepad.jpg",
      badge: "/icon.svg",
      tag: payload.tag || "nodepad-push",
      data: { url: payload.url || "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
        for (const client of clients) {
          client.postMessage({ type: "BACKGROUND_SYNC" })
        }
        try {
          await fetch("/api/pwa-sync", { method: "GET", headers: { "x-nodepad-client": "sw" } })
        } catch {
          /* offline */
        }
      })(),
    )
  }
})

// Lichte service worker voor prodwilrijk — primair bedoeld om de wood-pagina's
// buiten (offline) bruikbaar te houden. Strategie:
//   - Static assets (_next/static, /icons, /manifest.json, /sw.js): cache-first.
//   - Navigatie naar /wood/picking en /wood/stock-count: network-first met
//     fallback naar de laatst gecachede versie.
//   - Alle /api/* requests: network-only. De client zet mutaties in een IndexedDB
//     outbox en synct zelf zodra er weer internet is.
//   - Overige requests: default (netwerk). Niet aan de IDE-cache beginnen.

const CACHE_VERSION = 'prodwilrijk-v1'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const OFFLINE_PAGES = ['/wood/picking', '/wood/stock-count']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      try {
        await cache.addAll(OFFLINE_PAGES)
      } catch (_) {
        // Pagina's die (nog) niet gecachet kunnen worden blokkeren de install niet
      }
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((n) => !n.startsWith(CACHE_VERSION))
          .map((n) => caches.delete(n))
      )
      await self.clients.claim()
    })()
  )
})

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // API requests raken we niet aan — de offline layer in React regelt dit.
  if (url.pathname.startsWith('/api/')) return

  // Static assets: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/sw.js'
  ) {
    event.respondWith(cacheFirst(req))
    return
  }

  // Offline-fähige pagina's: network-first, fallback op shell cache
  if (isNavigationRequest(req)) {
    event.respondWith(networkFirstWithFallback(req))
    return
  }
})

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (err) {
    return cached || Response.error()
  }
}

async function networkFirstWithFallback(req) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const res = await fetch(req)
    if (res.ok) {
      const url = new URL(req.url)
      if (OFFLINE_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(p + '?'))) {
        cache.put(req, res.clone())
      }
    }
    return res
  } catch (err) {
    const url = new URL(req.url)
    // Matching fallback voor dezelfde offline-pagina
    const match =
      (await cache.match(req)) ||
      (await cache.match(url.pathname)) ||
      (await cache.match('/wood/picking'))
    if (match) return match
    return new Response(
      '<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><h1>Offline</h1><p>Deze pagina is (nog) niet beschikbaar offline. Probeer opnieuw zodra je terug internet hebt.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' }, status: 200 }
    )
  }
}

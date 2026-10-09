// Bump on any change here: activation drops every cache from older versions.
const CACHE_VERSION = 'v5'
const STATIC_CACHE = `onova-static-${CACHE_VERSION}`
const ASSET_CACHE = `onova-assets-${CACHE_VERSION}`
/** Hashed build files kept at most; older entries go first. */
const MAX_ASSET_ENTRIES = 150

/**
 * Small files the app shell shows. Pages are not served from here (navigations
 * always go to the network) and bill data always comes from Convex.
 */
const PRECACHE_URLS = [
  '/manifest.json',
  '/favicon.ico',
  '/logo-96.webp',
  '/icon-192.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Vite's content-hashed output: a URL never changes its bytes. */
function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/')
}

/** Unhashed files from public/ (icons, manifest): may change under one URL. */
function isPublicStatic(pathname) {
  return (
    !pathname.slice(1).includes('/') &&
    /\.(png|ico|webp|svg|json)$/i.test(pathname) &&
    pathname !== '/og-image.png'
  )
}

function isCacheable(response) {
  return response.ok && response.type === 'basic'
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  // Keys come back in insertion order, so the oldest go first.
  await Promise.all(
    keys
      .slice(0, Math.max(0, keys.length - maxEntries))
      .map((key) => cache.delete(key)),
  )
}

async function cacheFirst(event) {
  const cached = await caches.match(event.request, { cacheName: ASSET_CACHE })
  if (cached) return cached
  const response = await fetch(event.request)
  if (isCacheable(response)) {
    const copy = response.clone()
    event.waitUntil(
      caches
        .open(ASSET_CACHE)
        .then((cache) => cache.put(event.request, copy))
        .then(() => trimCache(ASSET_CACHE, MAX_ASSET_ENTRIES)),
    )
  }
  return response
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(event.request)
  const network = fetch(event.request).then((response) => {
    if (isCacheable(response)) {
      return cache.put(event.request, response.clone()).then(() => response)
    }
    return response
  })
  if (cached) {
    event.waitUntil(network.catch(() => undefined))
    return cached
  }
  return network
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  // Analytics and Speed Insights scripts and beacons: never from a cache.
  if (url.pathname.startsWith('/_vercel/')) return

  if (isHashedAsset(url.pathname)) {
    event.respondWith(cacheFirst(event))
    return
  }
  if (isPublicStatic(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event))
  }
})

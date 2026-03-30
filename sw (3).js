// ═══════════════════════════════════════════════════
// DCC SERVICE WORKER
// Dominion City Church — Navasota, TX
// Handles: offline cache, push notifications, bg sync
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'dcc-v1';
const OFFLINE_URL = '/';

const PRECACHE = [
  '/',
  '/dominion-city-church-v2.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── INSTALL ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — network first, cache fallback ───────────
self.addEventListener('fetch', event => {
  // Skip non-GET and Supabase/Anthropic API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.url.includes('anthropic.com')) return;
  if (event.request.url.includes('fonts.googleapis.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match(OFFLINE_URL)))
  );
});

// ── PUSH NOTIFICATIONS ──────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Dominion City Church', body: 'You have a new notification.', icon: '/icons/icon-192.png', badge: '/icons/icon-72.png', tag: 'dcc-notification' };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-72.png',
      tag: data.tag || 'dcc-notification',
      data: data.url ? { url: data.url } : {},
      vibrate: [200, 100, 200],
      actions: data.actions || []
    })
  );
});

// ── NOTIFICATION CLICK ──────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── BACKGROUND SYNC ─────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'dcc-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Retry any queued offline actions (prayer submissions, connect cards)
  const cache = await caches.open('dcc-offline-queue');
  const requests = await cache.keys();
  for (const request of requests) {
    try {
      await fetch(request.clone());
      await cache.delete(request);
    } catch(e) {}
  }
}

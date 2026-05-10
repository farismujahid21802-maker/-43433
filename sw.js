// ================================================
// Service Worker – المسابقة البرمجية جامعة الجزيرة
// استراتيجية: Cache First مع تحديث في الخلفية
// ================================================

const CACHE_NAME = 'musabaqa-v1';

// الملفات التي تُخزَّن فور التثبيت
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ── التثبيت: تخزين الملفات الأساسية ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] تخزين الملفات الأساسية...');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => self.skipWaiting()) // تفعيل فوري دون انتظار
  );
});

// ── التفعيل: حذف الكاشات القديمة ─────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] حذف كاش قديم:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── الطلبات: Cache First مع Fallback للشبكة ──────
self.addEventListener('fetch', event => {
  // تجاهل الطلبات التي ليست GET
  if (event.request.method !== 'GET') return;

  // تجاهل طلبات chrome-extension وما شابه
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // إذا وُجدت في الكاش → أرجعها فوراً وحدّثها في الخلفية
      if (cachedResponse) {
        // تحديث صامت في الخلفية
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache =>
                cache.put(event.request, responseClone)
              );
            }
            return networkResponse;
          })
          .catch(() => { /* لا يوجد إنترنت – لا بأس */ });

        return cachedResponse; // أرجع الكاش فوراً
      }

      // إذا لم تكن في الكاش → جرّب الشبكة وخزّنها
      return fetch(event.request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200
              || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, responseClone)
          );
          return networkResponse;
        })
        .catch(() => {
          // لا كاش ولا شبكة → أرجع الصفحة الرئيسية (للتعامل مع التنقل)
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

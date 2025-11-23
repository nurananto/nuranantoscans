// Service Worker for Nurananto Scanlation v3.0
// ✅ Auto-version system enabled
// ✅ Fixed response clone error

const CACHE_NAME = 'nurananto-v8b89dde';  // ← Ubah ini
const STATIC_CACHE = 'static-v8b89dde';
const IMAGE_CACHE = 'images-v8b89dde';
const DYNAMIC_CACHE = 'dynamic-v8b89dde';

// Static assets (HTML, CSS, JS)
const STATIC_ASSETS = [
    './',
    './index.html',
    './info-manga.html',
    './reader.html',
    './style.css',
    './info-manga.css',
    './reader.css',
    './script.js',
    './info-manga.js',
    './reader.js',
    './manga-config.js',
    './assets/logo.png',
    './assets/Logo 2.png',
    './assets/star.png',
    './assets/mangadex-logo.png',
    './assets/book.png',
    './assets/trakteer-icon.png'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
    console.log('🔧 SW: Installing new version...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('📦 SW: Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('⚠️ Some assets failed:', err);
            });
        })
    );
    self.skipWaiting(); // Force activate immediately
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    console.log('✅ SW: Activated new version');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete all caches that don't match current version
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== STATIC_CACHE && 
                        cacheName !== IMAGE_CACHE && 
                        cacheName !== DYNAMIC_CACHE) {
                        console.log('🗑️ SW: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Take control immediately
});

// Fetch - smart caching strategy with fixed clone
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip cross-origin requests except GitHub raw content
    if (url.origin !== location.origin) {
        // Cache GitHub raw content (covers & manga.json)
        if (url.hostname === 'raw.githubusercontent.com') {
            event.respondWith(
                caches.open(IMAGE_CACHE).then(cache => {
                    return cache.match(request).then(cached => {
                        const fetchPromise = fetch(request).then(response => {
                            // ✅ FIX: Validate and clone properly
                            if (response && response.ok && response.status === 200) {
                                const responseToCache = response.clone();
                                cache.put(request, responseToCache).catch(err => {
                                    console.warn('Cache put failed:', err);
                                });
                            }
                            return response;
                        }).catch(err => {
                            console.warn('GitHub fetch failed:', err);
                            return cached || new Response('Network error', { 
                                status: 408,
                                statusText: 'Request Timeout'
                            });
                        });
                        return cached || fetchPromise;
                    });
                })
            );
            return;
        }
        
        // Don't cache other external requests
        event.respondWith(fetch(request));
        return;
    }
    
    // Cache strategy for local files
    if (url.pathname.startsWith('/covers/')) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(request).then(cached => {
                    const fetchPromise = fetch(request).then(response => {
                        // ✅ FIX: Clone before caching
                        if (response && response.ok && response.status === 200) {
                            cache.put(request, response.clone()).catch(err => {
                                console.warn('Cache put failed:', err);
                            });
                        }
                        return response;
                    }).catch(err => {
                        console.warn('Cover fetch failed:', err);
                        return cached;
                    });
                    return cached || fetchPromise;
                });
            })
        );
        return;
    }
    
    // Static assets: Cache first, fallback to network
    if (STATIC_ASSETS.some(asset => url.pathname.includes(asset.replace('./', '')))) {
        event.respondWith(
            caches.match(request).then(cached => {
                return cached || fetch(request).then(response => {
                    // ✅ FIX: Validate before cloning
                    if (response && response.ok && response.status === 200) {
                        caches.open(STATIC_CACHE).then(cache => {
                            cache.put(request, response.clone()).catch(err => {
                                console.warn('Cache put failed:', err);
                            });
                        });
                    }
                    return response;
                }).catch(err => {
                    console.warn('Static fetch failed:', err);
                    return cached;
                });
            })
        );
        return;
    }
    
    // Dynamic content: Network first, fallback to cache
    event.respondWith(
        fetch(request)
            .then(response => {
                // ✅ FIX: Validate and handle opaque responses
                if (response && response.ok && response.status === 200 && 
                    !url.pathname.includes('manga.json')) {
                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(request, response.clone()).catch(err => {
                            console.warn('Cache put failed:', err);
                        });
                    });
                }
                return response;
            })
            .catch(err => {
                console.warn('Dynamic fetch failed:', err);
                return caches.match(request).then(cached => {
                    return cached || caches.match('./index.html');
                });
            })
    );
});

// Message - manual cache control & update notification
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('🗑️ All caches cleared');
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => client.postMessage({ type: 'CACHE_CLEARED' }));
                });
            })
        );
    }
});

// Update notification for users
self.addEventListener('controllerchange', () => {
    console.log('🔄 New Service Worker took control');
});

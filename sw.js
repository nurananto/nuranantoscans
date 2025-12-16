// Service Worker for Nurananto Scanlation v3.3
// ✅ FULLY FIXED: Response clone error eliminated
// 📅 Last updated: 2025-12-16

// ✅ STABLE CACHE NAMES - only change for major breaking changes
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

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
    console.log('🔧 SW: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('📦 SW: Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('⚠️ Some assets failed:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    console.log('✅ SW: Activated');
    const currentCaches = [STATIC_CACHE, IMAGE_CACHE, DYNAMIC_CACHE];
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!currentCaches.includes(cacheName)) {
                        console.log('🗑️ SW: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// ✅ FULLY FIXED: Proper clone handling
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip cross-origin except GitHub
    if (url.origin !== location.origin) {
        // GitHub raw content (covers & manga.json)
        if (url.hostname === 'raw.githubusercontent.com') {
            event.respondWith(handleGitHubRequest(request));
            return;
        }
        
        // Other external - no caching
        return;
    }
    
    // Local cover images
    if (url.pathname.startsWith('/covers/')) {
        event.respondWith(handleImageRequest(request));
        return;
    }
    
    // Static assets
    if (STATIC_ASSETS.some(asset => url.pathname.includes(asset.replace('./', '')))) {
        event.respondWith(handleStaticRequest(request));
        return;
    }
    
    // Dynamic content
    event.respondWith(handleDynamicRequest(request, url));
});

// ✅ GitHub request handler - stale-while-revalidate
async function handleGitHubRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    
    // Return cached immediately, update in background
    if (cached) {
        // Update cache in background (don't await)
        fetch(request)
            .then(response => {
                if (response && response.ok) {
                    cache.put(request, response.clone());
                }
            })
            .catch(() => {});
        
        return cached;
    }
    
    // No cache - fetch fresh
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            // Clone IMMEDIATELY after fetch, before any other operation
            const clonedResponse = response.clone();
            cache.put(request, clonedResponse).catch(() => {});
        }
        return response;
    } catch (err) {
        console.warn('GitHub fetch failed:', err);
        return new Response('Network error', { 
            status: 408,
            statusText: 'Request Timeout'
        });
    }
}

// ✅ Image request handler - cache first
async function handleImageRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            // Clone immediately
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch (err) {
        console.warn('Image fetch failed:', err);
        // Return cached even if stale
        return cached || new Response('Image not found', { status: 404 });
    }
}

// ✅ Static request handler - cache first
async function handleStaticRequest(request) {
    const cached = await caches.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            // Clone immediately
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch (err) {
        console.warn('Static fetch failed:', err);
        return cached || new Response('Not found', { status: 404 });
    }
}

// ✅ Dynamic request handler - network first
async function handleDynamicRequest(request, url) {
    try {
        const response = await fetch(request);
        
        // Cache successful responses (except manga.json)
        if (response && response.ok && !url.pathname.includes('manga.json')) {
            const cache = await caches.open(DYNAMIC_CACHE);
            // Clone immediately
            cache.put(request, response.clone()).catch(() => {});
        }
        
        return response;
    } catch (err) {
        console.warn('Dynamic fetch failed:', err);
        
        // Fallback to cache
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        // Last resort - return index
        return caches.match('./index.html') || new Response('Offline', { status: 503 });
    }
}

// Message handler
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
                    clients.forEach(client => 
                        client.postMessage({ type: 'CACHE_CLEARED' })
                    );
                });
            })
        );
    }
});

self.addEventListener('controllerchange', () => {
    console.log('🔄 New SW active');
});
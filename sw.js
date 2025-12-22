// Service Worker for Nurananto Scanlation v4.0
// ✅ FULLY FIXED: CORS preflight & cache cleanup
// 📅 Last updated: 2025-12-19

// ✅ STABLE CACHE NAMES
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

// ✅ CRITICAL: Files that should NEVER be cached
const NEVER_CACHE = [
    'manga.json',
    'version.txt',
    'manifest.json',
    'daily-views.json'
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

// ✅ Helper: Check if URL should never be cached
function shouldNeverCache(url) {
    return NEVER_CACHE.some(pattern => url.includes(pattern));
}

// ✅ CRITICAL FIX: Bypass SW completely for certain requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // ✅ BYPASS SW completely for files that should never be cached
    if (shouldNeverCache(url.pathname)) {
        console.log('🚫 SW: Complete bypass for:', url.pathname);
        // Don't call event.respondWith() - let browser handle it directly
        return;
    }
    
    // Skip cross-origin except GitHub & CDN
    if (url.origin !== location.origin) {
        // ✅ GitHub raw content (covers & encrypted manifests ONLY)
        if (url.hostname === 'raw.githubusercontent.com') {
            // Double check - bypass if it's a never-cache file
            if (shouldNeverCache(url.pathname)) {
                return;
            }
            event.respondWith(handleGitHubRequest(request));
            return;
        }
        
        // ✅ CDN images (images.weserv.nl, cdn.nuranantoscans.my.id)
        if (url.hostname.includes('weserv.nl') || url.hostname.includes('cdn.nuranantoscans.my.id')) {
            event.respondWith(handleCDNRequest(request));
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

// ✅ GitHub request handler - network first with cache fallback
async function handleGitHubRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    
    try {
        // ✅ CRITICAL: Use simple fetch without intercepting CORS
        const response = await fetch(request, {
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (response && response.ok) {
            // Clone immediately after successful fetch
            const clonedResponse = response.clone();
            cache.put(request, clonedResponse).catch(() => {});
        }
        return response;
    } catch (err) {
        console.warn('⚠️ GitHub fetch failed, trying cache:', err.message);
        
        // Fallback to cache
        const cached = await cache.match(request);
        if (cached) {
            console.log('📦 Serving from cache:', request.url);
            return cached;
        }
        
        // No cache available
        return new Response('Network error', { 
            status: 408,
            statusText: 'Request Timeout'
        });
    }
}

// ✅ CDN request handler - stale-while-revalidate
async function handleCDNRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    
    // Return cached immediately if available
    if (cached) {
        // Update in background (don't await)
        fetch(request, {
            mode: 'cors',
            credentials: 'omit'
        })
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
        const response = await fetch(request, {
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (response && response.ok) {
            const clonedResponse = response.clone();
            cache.put(request, clonedResponse).catch(() => {});
        }
        return response;
    } catch (err) {
        console.warn('⚠️ CDN fetch failed:', err);
        return new Response('Image not found', { status: 404 });
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
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch (err) {
        console.warn('⚠️ Image fetch failed:', err);
        return cached || new Response('Image not found', { status: 404 });
    }
}

// ✅ Static request handler - cache first with network fallback
async function handleStaticRequest(request) {
    const cached = await caches.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch (err) {
        console.warn('⚠️ Static fetch failed:', err);
        return cached || new Response('Not found', { status: 404 });
    }
}

// ✅ Dynamic request handler - network first
async function handleDynamicRequest(request, url) {
    try {
        const response = await fetch(request);
        
        // Cache successful responses (except never-cache files)
        if (response && response.ok && !shouldNeverCache(url.pathname)) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone()).catch(() => {});
        }
        
        return response;
    } catch (err) {
        console.warn('⚠️ Dynamic fetch failed:', err);
        
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
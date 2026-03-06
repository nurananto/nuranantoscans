// Service Worker for Nurananto Scanlation v4.4
// ✅ FIX: v6 - Add in-flight request deduplication for R2 CDN
// 📅 Last updated: 2026-03-02

// ✅ STABLE CACHE NAMES
const CACHE_VERSION = 'v6'; // ✅ v6: R2 request deduplication + deferred thumbnails
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
    './assets/trakteer-icon.png',
    './assets/Webicon/favicon.ico',
    './assets/Webicon/favicon.svg',
    './assets/Webicon/favicon-96x96.png',
    './assets/Webicon/apple-touch-icon.png',
    './assets/Webicon/web-app-manifest-192x192.png',
    './assets/Webicon/web-app-manifest-512x512.png'
];

// ✅ UPDATED: Hanya manifest.json yang never cache
const NEVER_CACHE = [
    'manifest.json',  // Encrypted manifest MUST always fresh
    'version.txt'     // Version check
];

// ✅ NEW: Cache dengan TTL pendek (5-15 menit)
const SHORT_TTL_CACHE = [
    'manga.json',
    'daily-views.json'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
    console.log('🔧 SW: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('📦 SW: Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                // Silently ignore cache failures - some assets may not exist
                // This is normal during initial install
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

// ✅ FIXED: Check if URL should never be cached (works with full URLs)
function shouldNeverCache(url) {
    // Check both pathname and full URL
    return NEVER_CACHE.some(pattern => {
        return url.includes(pattern) || url.endsWith(pattern);
    });
}

// ✅ NEW: Check if URL should use short TTL cache
function shouldUseShortTTL(url) {
    return SHORT_TTL_CACHE.some(pattern => {
        return url.includes(pattern) || url.endsWith(pattern);
    });
}

// ✅ NEW: Check if cache is still fresh (5 minutes)
async function isCacheFresh(cachedResponse) {
    const cacheTime = cachedResponse.headers.get('sw-cache-time');
    if (!cacheTime) return false;
    
    const age = Date.now() - parseInt(cacheTime);
    const maxAge = 300000; // 5 minutes
    
    return age < maxAge;
}

// ✅ CRITICAL FIX: Bypass SW completely for certain requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // ✅ BYPASS SW completely for files that should never be cached
    if (shouldNeverCache(url.pathname) || shouldNeverCache(url.href)) {
        console.log('🚫 SW: Complete bypass for:', url.pathname || url.href);
        // Don't call event.respondWith() - let browser handle it directly
        return;
    }
    
    // Skip cross-origin except GitHub & CDN
    if (url.origin !== location.origin) {
        // ✅ GitHub raw content (covers & encrypted manifests ONLY)
        if (url.hostname === 'raw.githubusercontent.com') {
            // Double check - bypass if it's a never-cache file
            if (shouldNeverCache(url.pathname) || shouldNeverCache(url.href)) {
                console.log('🚫 SW: Bypass GitHub file:', url.pathname);
                return;
            }
            event.respondWith(handleGitHubRequest(request));
            return;
        }
        
        // ✅ R2 CDN cover images & manga images (cdn.nuranantoscans.my.id)
        if (url.hostname.includes('cdn.nuranantoscans.my.id')) {
            event.respondWith(handleR2CDNRequest(request));
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

// ✅ GitHub request handler - UPDATED with TTL cache
async function handleGitHubRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const url = new URL(request.url);
    
    // ✅ Check if this is short-TTL content
    const useShortTTL = shouldUseShortTTL(url.pathname) || shouldUseShortTTL(url.href);
    
    if (useShortTTL) {
        // Check cache freshness
        const cached = await cache.match(request);
        if (cached && await isCacheFresh(cached)) {
            console.log('📦 SW: Fresh cache HIT:', url.pathname);
            return cached;
        }
        
        console.log('⏰ SW: Cache expired or missing, fetching fresh');
    }
    
    try {
        const response = await fetch(request, {
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (response && response.ok) {
            // Clone and add timestamp header
            const clonedResponse = response.clone();
            const headers = new Headers(clonedResponse.headers);
            headers.set('sw-cache-time', Date.now().toString());
            
            const cachedResponse = new Response(clonedResponse.body, {
                status: clonedResponse.status,
                statusText: clonedResponse.statusText,
                headers: headers
            });
            
            cache.put(request, cachedResponse).catch(() => {});
        }
        return response;
    } catch (err) {
        // Silently fallback to cache if GitHub fetch fails
        
        // Fallback to cache (even if stale)
        const cached = await cache.match(request);
        if (cached) {
            console.log('📦 Serving STALE cache:', request.url);
            return cached;
        }
        
        return new Response('Network error', { 
            status: 408,
            statusText: 'Request Timeout'
        });
    }
}

// ✅ Weserv.nl handler - DEPRECATED (kept for backward compatibility)
// Cover images now served directly from R2 CDN as multi-resolution WebP
// weserv.nl URLs: ?url=xxx&w=500&q=90&output=webp
// Query params define the image variant, so they MUST be part of the cache key.
async function handleWeservRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request, {
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (response && response.ok) {
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch (err) {
        return new Response('Image not found', { status: 404 });
    }
}

// 🚀 OPTIMIZATION: In-flight request deduplication map
// Prevents duplicate concurrent fetches for the same normalized URL.
// When main image + thumbnail request the same URL simultaneously,
// only ONE fetch goes to the worker; the second waits for the first.
const r2InFlight = new Map();

// ✅ R2 CDN handler - CACHE FIRST with normalized key (strip token/expires)
// r2-proxy URLs: /Repo/ch/Image.webp?token=xxx&expires=yyy
// Token changes every navigation, but the image is the same.
// r2-proxy already validates token, so cached response is safe to reuse.
async function handleR2CDNRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const url = new URL(request.url);
    
    // 🚀 CRITICAL: Strip token/expires to normalize cache key
    // Without this, every new token causes a cache MISS for the same image,
    // resulting in ~2.4x over free tier worker invocation limit.
    const normalizedUrl = url.origin + url.pathname;
    const cacheKey = new Request(normalizedUrl, {
        method: 'GET',
        headers: { 'Accept': request.headers.get('Accept') || 'image/webp' }
    });
    
    const cached = await cache.match(cacheKey);
    if (cached) {
        return cached;
    }
    
    // 🚀 DEDUP: If a fetch for this URL is already in-flight, wait for it
    // instead of sending a duplicate request to the worker.
    if (r2InFlight.has(normalizedUrl)) {
        try {
            const response = await r2InFlight.get(normalizedUrl);
            return response.clone();
        } catch (err) {
            // If the in-flight request failed, fall through to fetch
        }
    }
    
    // Create the fetch promise and store it for deduplication
    const fetchPromise = (async () => {
        try {
            const response = await fetch(request, {
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (response && response.ok) {
                cache.put(cacheKey, response.clone()).catch(() => {});
            }
            return response;
        } catch (err) {
            return new Response('Image not found', { status: 404 });
        } finally {
            // Clean up in-flight entry after completion
            r2InFlight.delete(normalizedUrl);
        }
    })();
    
    r2InFlight.set(normalizedUrl, fetchPromise);
    
    try {
        const response = await fetchPromise;
        return response.clone();
    } catch (err) {
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
        // Silently return cached or 404
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
        // Silently return cached or 404
        return cached || new Response('Not found', { status: 404 });
    }
}

// ✅ Dynamic request handler - network first
async function handleDynamicRequest(request, url) {
    try {
        const response = await fetch(request);
        
        // Cache successful responses (except never-cache files)
        if (response && response.ok && !shouldNeverCache(url.pathname) && !shouldNeverCache(url.href)) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone()).catch(() => {});
        }
        
        return response;
    } catch (err) {
        // Silently fallback to cache
        
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
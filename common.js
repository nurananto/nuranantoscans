// ============================================
// COMMON.JS - SHARED UTILITIES
// ============================================
// Shared functions used across script.js, info-manga.js, and reader.js

// ============================================
// 🛡️ DEBUG MODE & LOGGING
// ============================================
const urlParams = new URLSearchParams(window.location.search);
const DEBUG_MODE = urlParams.get('debug') === 'true';
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PRODUCTION_MODE = !DEBUG_MODE && !isLocalhost;

const dLog = (...args) => { if (DEBUG_MODE) console.log(...args); };
const dWarn = (...args) => { if (DEBUG_MODE) console.warn(...args); };
const dInfo = (...args) => { if (DEBUG_MODE) console.info(...args); };

if (PRODUCTION_MODE) {
    const noop = () => {};
    window._originalLog = console.log;
    window._originalWarn = console.warn;
    window._originalInfo = console.info;
    console.log = noop;
    console.warn = noop;
    console.info = noop;
} else if (DEBUG_MODE) {
    dLog('🔧 Debug mode enabled');
}

// Filter weserv.nl errors (prevent redeclaration)
if (!window._weservErrorFiltered) {
    const originalError = console.error;
    console.error = function(...args) {
        if (args[0]?.includes?.('images.weserv.nl')) return;
        originalError.apply(console, args);
    };
    window._weservErrorFiltered = true;
}

// ============================================
// 📡 FETCH UTILITIES
// ============================================
async function fetchFreshJSON(url) {
    try {
        const urlObj = new URL(url);
        const isCrossOrigin = urlObj.origin !== window.location.origin;
        
        if (isCrossOrigin && urlObj.hostname.includes('githubusercontent.com')) {
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        }
        
        const cacheBuster = Date.now() + '_' + Math.random().toString(36).substring(7);
        const response = await fetch(url + '?t=' + cacheBuster, {
            method: 'GET',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('❌ fetchFreshJSON failed:', error);
        throw error;
    }
}

// ============================================
// 💾 CACHE UTILITIES
// ============================================
function getCachedData(key, maxAge = 300000, useSessionStorage = false) {
    const storage = useSessionStorage ? sessionStorage : localStorage;
    try {
        const cached = storage.getItem(key);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < maxAge) {
            dLog(`📦 Cache HIT: ${key} (${Math.floor(age/1000)}s old)`);
            return data;
        }
        
        dLog(`⏰ Cache EXPIRED: ${key}`);
        storage.removeItem(key);
        return null;
    } catch (error) {
        return null;
    }
}

function setCachedData(key, data, useSessionStorage = false) {
    const storage = useSessionStorage ? sessionStorage : localStorage;
    try {
        storage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (error) {
        dWarn('Cache write failed:', error);
    }
}

// ============================================
// 🖼️ CDN UTILITIES
// ============================================
function getResponsiveCDN(originalUrl) {
    // ✅ Skip CDN if URL is already from CDN or invalid
    if (!originalUrl || originalUrl.includes('images.weserv.nl') || originalUrl.startsWith('data:')) {
        return {
            small: originalUrl,
            medium: originalUrl,
            large: originalUrl,
            xlarge: originalUrl,
            original: originalUrl
        };
    }
    
    // ✅ FIX: Optimized sizes untuk prevent pixelation di tampilan kecil
    // Small: untuk mobile (2 kolom), Medium: untuk tablet, Large: untuk desktop, XLarge: untuk retina
    const sizes = { 
        small: 500,    // Increased dari 400 untuk better quality
        medium: 700,   // Increased dari 600 untuk better quality
        large: 900,    // Increased dari 800 untuk better quality
        xlarge: 1200   // New: untuk retina displays
    };
    
    // ✅ FIX: Properly encode the URL to prevent CORB errors
    const encodedUrl = encodeURIComponent(originalUrl);
    
    // ✅ FIX: Higher quality untuk ukuran kecil (q=90), standard untuk besar (q=85)
    const buildUrl = (width, quality = 85) => {
        // Higher quality untuk ukuran kecil untuk prevent pixelation
        const q = width <= 500 ? 90 : quality;
        return `https://images.weserv.nl/?url=${encodedUrl}&w=${width}&q=${q}&output=webp&fit=inside`;
    };
    
    return {
        small: buildUrl(sizes.small, 90),      // q=90 untuk better quality di mobile
        medium: buildUrl(sizes.medium, 88),    // q=88 untuk tablet
        large: buildUrl(sizes.large, 85),      // q=85 untuk desktop
        xlarge: buildUrl(sizes.xlarge, 85),    // q=85 untuk retina
        original: originalUrl
    };
}

/**
 * ✅ Safe image error handler - prevents infinite loop
 */
function createImageErrorHandler(originalUrl) {
    let errorCount = 0;
    const maxErrors = 1; // Only allow 1 error before fallback
    
    return function() {
        errorCount++;
        
        // Prevent infinite loop
        if (errorCount > maxErrors) {
            this.onerror = null; // Remove handler to prevent further calls
            return;
        }
        
        // Fallback to original URL
        if (this.src !== originalUrl) {
            dLog('🔄 [CDN] Fallback to original URL:', originalUrl);
            this.src = originalUrl;
            this.srcset = ''; // Remove srcset to prevent further CDN attempts
        } else {
            // Already using original, remove handler
            this.onerror = null;
        }
    };
}

// ============================================
// 👤 DONATUR STATUS UTILITIES
// ============================================
function isDonaturFromDOM() {
    try {
        const statusBox = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        
        if (statusBox && statusText) {
            const isDonatur = statusBox.classList.contains('donatur-setia') || 
                            statusText.textContent === 'DONATUR SETIA';
            if (isDonatur) {
                dLog('✅ Donatur status from DOM: true');
                return true;
            }
        }
        
        const stored = localStorage.getItem('userDonaturStatus');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                
                // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // ✅ Status sudah berakhir - invalidate cache
                        localStorage.setItem('userDonaturStatus', JSON.stringify({
                            isDonatur: false,
                            timestamp: Date.now()
                        }));
                        return false;
                    }
                }
                
                const cacheAge = Date.now() - (data.timestamp || 0);
                if (cacheAge < 300000) {
                    return data.isDonatur === true;
                }
            } catch (error) {
                return false;
            }
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

async function checkIsDonatur() {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    
    // ✅ VALIDATE CACHE FIRST - Check if cached status is expired
    const stored = localStorage.getItem('userDonaturStatus');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            
            // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
            if (data.isDonatur && data.expiresAt) {
                const now = new Date();
                const expiry = new Date(data.expiresAt);
                const isExpired = expiry <= now;
                
                if (isExpired) {
                    // ✅ Status sudah berakhir - invalidate cache immediately
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: false,
                        timestamp: Date.now()
                    }));
                    return false;
                }
            }
        } catch (error) {
            // Ignore parse error, continue to API check
        }
    }
    
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
    
    try {
        // ✅ Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_URL}/donatur/status`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.isDonatur) {
            // ✅ Cek apakah expiresAt sudah lewat
            const now = new Date();
            const expiry = data.expiresAt ? new Date(data.expiresAt) : null;
            const isExpired = expiry && expiry <= now;
            
            if (isExpired) {
                // Status sudah berakhir
                localStorage.setItem('userDonaturStatus', JSON.stringify({
                    isDonatur: false,
                    timestamp: Date.now()
                }));
                return false;
            }
            
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: true,
                expiresAt: data.expiresAt,
                timestamp: Date.now()
            }));
            return true;
        } else {
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: false,
                timestamp: Date.now()
            }));
            return false;
        }
    } catch (error) {
        // ✅ Handle network errors gracefully
        if (error.name === 'AbortError') {
            dWarn('Donatur status check timeout - using cached status');
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            dWarn('Network error - using cached donatur status from localStorage');
        } else {
            console.error('Donatur check error:', error);
        }
        
        // ✅ Fallback to localStorage if available, but validate expiresAt first
        const stored = localStorage.getItem('userDonaturStatus');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                
                // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // ✅ Status sudah berakhir - invalidate cache
                        localStorage.setItem('userDonaturStatus', JSON.stringify({
                            isDonatur: false,
                            timestamp: Date.now()
                        }));
                        return false;
                    }
                }
                
                const cacheAge = Date.now() - (data.timestamp || 0);
                if (cacheAge < 300000) {
                    return data.isDonatur === true;
                }
            } catch (error) {
                return false;
            }
        }
        return false;
    }
}

async function getUserDonaturStatus() {
    // ✅ VALIDATE CACHE FIRST - Check if cached status is expired
    // This ensures expired status is detected even before checking DOM or API
    const stored = localStorage.getItem('userDonaturStatus');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            
            // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
            if (data.isDonatur && data.expiresAt) {
                const now = new Date();
                const expiry = new Date(data.expiresAt);
                const isExpired = expiry <= now;
                
                if (isExpired) {
                    // ✅ Status sudah berakhir - invalidate cache immediately
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: false,
                        timestamp: Date.now()
                    }));
                    return false;
                }
            }
        } catch (error) {
            // Ignore parse error, continue to normal check
        }
    }
    
    const fromStorage = isDonaturFromDOM();
    if (fromStorage !== false) {
        return fromStorage;
    }
    return await checkIsDonatur();
}

/**
 * ✅ SECURITY: Verify donatur status with backend (NO CACHE)
 * Use this function for critical operations like accessing locked chapters
 * This ensures users cannot bypass security by manipulating localStorage
 */
async function verifyDonaturStatusStrict() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        // ✅ No token = definitely not donatur
        return false;
    }
    
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
    
    try {
        // ✅ Always verify with backend - no cache allowed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_URL}/donatur/status`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            // ✅ If API fails, deny access (fail-secure)
            dLog('⚠️ [SECURITY] API verification failed, denying access');
            return false;
        }
        
        const data = await response.json();
        
        if (data.success && data.isDonatur) {
            // ✅ Verify expiresAt hasn't passed
            const now = new Date();
            const expiry = data.expiresAt ? new Date(data.expiresAt) : null;
            const isExpired = expiry && expiry <= now;
            
            if (isExpired) {
                // ✅ Status expired - deny access
                dLog('⚠️ [SECURITY] Donatur status expired, denying access');
                return false;
            }
            
            // ✅ Valid donatur - update cache for UI purposes
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: true,
                expiresAt: data.expiresAt,
                timestamp: Date.now()
            }));
            
            return true;
        } else {
            // ✅ Not a donatur - deny access
            return false;
        }
    } catch (error) {
        // ✅ On any error (network, timeout, etc), deny access (fail-secure)
        dLog('⚠️ [SECURITY] Error verifying donatur status:', error);
        return false;
    }
}

// ============================================
// 📝 SESSION STORAGE HELPERS (for reader.js)
// ============================================
function isChapterValidated(repo, chapter) {
    try {
        const key = `validated_${repo}_${chapter}`;
        const stored = sessionStorage.getItem(key);
        if (!stored) return false;
        
        const { timestamp } = JSON.parse(stored);
        const age = Date.now() - timestamp;
        const oneHour = 60 * 60 * 1000;
        
        return age < oneHour;
    } catch (error) {
        return false;
    }
}

function saveValidatedChapter(repo, chapter) {
    try {
        const key = `validated_${repo}_${chapter}`;
        sessionStorage.setItem(key, JSON.stringify({
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('Failed to save validated chapter:', error);
    }
}

// ============================================
// 🖼️ GLOBAL IMAGE ERROR HANDLER (Prevent Infinite Loop)
// ============================================
(function() {
    // Track error counts per image to prevent infinite loops
    const errorCounts = new WeakMap();
    
    function handleImageError(img) {
        const originalUrl = img.getAttribute('data-original');
        if (!originalUrl) return;
        
        // Get or initialize error count
        let count = errorCounts.get(img) || 0;
        count++;
        errorCounts.set(img, count);
        
        // Prevent infinite loop - only allow 1 retry
        if (count > 1) {
            img.onerror = null; // Remove handler completely
            return;
        }
        
        // Only fallback if current src is not the original
        if (img.src !== originalUrl && !img.src.includes(originalUrl)) {
            dLog('🔄 [CDN] Image failed, fallback to original:', originalUrl);
            img.src = originalUrl;
            img.srcset = ''; // Remove srcset to prevent further CDN attempts
            img.removeAttribute('data-original'); // Remove attribute to prevent further handling
        } else {
            // Already using original, remove handler
            img.onerror = null;
        }
    }
    
    // Setup error handlers for existing images
    function setupImageErrorHandlers() {
        document.querySelectorAll('img[data-original]').forEach(img => {
            // Only add handler if not already added
            if (!img.hasAttribute('data-error-handled')) {
                img.setAttribute('data-error-handled', 'true');
                img.addEventListener('error', function() {
                    handleImageError(this);
                }, { once: false });
            }
        });
    }
    
    // Setup for images already in DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupImageErrorHandlers);
    } else {
        setupImageErrorHandlers();
    }
    
    // Watch for new images added dynamically
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    if (node.tagName === 'IMG' && node.hasAttribute('data-original')) {
                        if (!node.hasAttribute('data-error-handled')) {
                            node.setAttribute('data-error-handled', 'true');
                            node.addEventListener('error', function() {
                                handleImageError(this);
                            }, { once: false });
                        }
                    }
                    // Also check children
                    const imgs = node.querySelectorAll && node.querySelectorAll('img[data-original]');
                    if (imgs) {
                        imgs.forEach(img => {
                            if (!img.hasAttribute('data-error-handled')) {
                                img.setAttribute('data-error-handled', 'true');
                                img.addEventListener('error', function() {
                                    handleImageError(this);
                                }, { once: false });
                            }
                        });
                    }
                }
            });
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();

// ============================================
// MOBILE HAMBURGER MENU TOGGLE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const btnHeaderMenu = document.getElementById('btnHeaderMenu');
    const headerMenuDropdown = document.getElementById('headerMenuDropdown');
    const btnOpenLoginMobile = document.getElementById('btnOpenLoginMobile');
    
    if (!btnHeaderMenu || !headerMenuDropdown) return;
    
    // Toggle dropdown menu
    btnHeaderMenu.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        dLog('🖱️ [HAMBURGER] Button clicked');
        const isOpen = headerMenuDropdown.classList.contains('show');
        
        dLog('🖱️ [HAMBURGER] Current state:', isOpen ? 'open' : 'closed');
        
        if (isOpen) {
            headerMenuDropdown.classList.remove('show');
            btnHeaderMenu.setAttribute('aria-expanded', 'false');
            dLog('✅ [HAMBURGER] Dropdown closed');
        } else {
            headerMenuDropdown.classList.add('show');
            btnHeaderMenu.setAttribute('aria-expanded', 'true');
            dLog('✅ [HAMBURGER] Dropdown opened');
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (headerMenuDropdown && headerMenuDropdown.classList.contains('show')) {
            if (!headerMenuDropdown.contains(e.target) && e.target !== btnHeaderMenu) {
                headerMenuDropdown.classList.remove('show');
                btnHeaderMenu.setAttribute('aria-expanded', 'false');
            }
        }
    });
    
    // Close dropdown when clicking on menu item
    if (headerMenuDropdown) {
        headerMenuDropdown.addEventListener('click', (e) => {
            // Close dropdown after a short delay to allow navigation
            setTimeout(() => {
                headerMenuDropdown.classList.remove('show');
                btnHeaderMenu.setAttribute('aria-expanded', 'false');
            }, 100);
        });
    }
    
    // Handle mobile profile button click
    if (btnOpenLoginMobile) {
        btnOpenLoginMobile.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Close dropdown first
            headerMenuDropdown.classList.remove('show');
            btnHeaderMenu.setAttribute('aria-expanded', 'false');
            
            // Trigger the same action as desktop profile button
            const btnOpenLogin = document.getElementById('btnOpenLogin');
            if (btnOpenLogin) {
                btnOpenLogin.click();
            } else {
                // Fallback: open login modal directly
                const loginModal = document.getElementById('loginModal');
                if (loginModal) {
                    loginModal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                }
            }
        });
    }
    
    // Ensure hamburger menu is visible on mobile
    function ensureMobileMenuVisible() {
        if (window.innerWidth <= 767) {
            const toggleBtn = document.getElementById('btnHeaderMenu');
            const headerButtons = document.querySelector('.header-buttons');
            
            if (toggleBtn) {
                toggleBtn.style.display = 'flex';
                toggleBtn.style.visibility = 'visible';
                toggleBtn.style.opacity = '1';
                toggleBtn.style.background = 'transparent';
                dLog('✅ [HAMBURGER] Menu button made visible');
            }
            
            if (headerButtons) {
                headerButtons.style.display = 'none';
            }
        } else {
            const toggleBtn = document.getElementById('btnHeaderMenu');
            const headerButtons = document.querySelector('.header-buttons');
            
            if (toggleBtn) {
                toggleBtn.style.display = 'none';
            }
            
            if (headerButtons) {
                headerButtons.style.display = 'flex';
            }
        }
    }
    
    // Check on load and resize
    ensureMobileMenuVisible();
    window.addEventListener('resize', ensureMobileMenuVisible);
    
    // Also check after a short delay to ensure DOM is ready
    setTimeout(() => {
        ensureMobileMenuVisible();
    }, 100);
});


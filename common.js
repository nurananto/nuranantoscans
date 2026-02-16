// ============================================
// COMMON.JS - SHARED UTILITIES
// ============================================
// Shared functions used across script.js, info-manga.js, and reader.js

// ============================================
// 🛡️ DEBUG MODE & LOGGING
// ============================================
const urlParams = new URLSearchParams(window.location.search);
const DEBUG_MODE = false; // Set to true for debugging
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
    // Keep console.error active for production debugging
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
// 🍞 TOAST NOTIFICATION SYSTEM
// ============================================
window.showToast = function(message, type = 'info', duration = 3000) {
    // Create toast container if not exists
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

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

/**
 * 🆕 Get current user ID from localStorage
 * This helps prevent cross-account status caching issues
 */
function getCurrentUserId() {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        const user = JSON.parse(userStr);
        return user.uid || user.id || null;
    } catch (error) {
        return null;
    }
}

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
        
        // 🆕 Get current user ID to validate cache ownership
        const currentUserId = getCurrentUserId();
        
        const stored = localStorage.getItem('userDonaturStatus');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                
                // 🆕 VALIDATE USER ID - Check if cached status belongs to current user
                if (currentUserId && data.userId && data.userId !== currentUserId) {
                    dLog('⚠️ Cached status belongs to different user, invalidating');
                    localStorage.removeItem('userDonaturStatus');
                    return false;
                }
                
                // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // ✅ Status sudah berakhir - invalidate cache
                        localStorage.setItem('userDonaturStatus', JSON.stringify({
                            isDonatur: false,
                            userId: currentUserId,
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
    
    // 🆕 Get current user ID
    const currentUserId = getCurrentUserId();
    
    // ✅ VALIDATE CACHE FIRST - Check if cached status is expired
    const stored = localStorage.getItem('userDonaturStatus');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            
            // 🆕 VALIDATE USER ID - Check if cached status belongs to current user
            if (currentUserId && data.userId && data.userId !== currentUserId) {
                dLog('⚠️ Cached status belongs to different user, clearing cache');
                localStorage.removeItem('userDonaturStatus');
                // Continue to API check
            } else {
                // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // ✅ Status sudah berakhir - invalidate cache immediately
                        localStorage.setItem('userDonaturStatus', JSON.stringify({
                            isDonatur: false,
                            userId: currentUserId,
                            timestamp: Date.now()
                        }));
                        return false;
                    }
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
                    userId: currentUserId,
                    timestamp: Date.now()
                }));
                return false;
            }
            
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: true,
                userId: currentUserId,
                expiresAt: data.expiresAt,
                timestamp: Date.now()
            }));
            return true;
        } else {
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: false,
                userId: currentUserId,
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
        
        // ✅ Fallback to localStorage if available, but validate expiresAt and userId first
        const stored = localStorage.getItem('userDonaturStatus');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                
                // 🆕 VALIDATE USER ID - Check if cached status belongs to current user
                if (currentUserId && data.userId && data.userId !== currentUserId) {
                    dLog('⚠️ Cached status belongs to different user during error fallback, denying');
                    return false;
                }
                
                // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // ✅ Status sudah berakhir - invalidate cache
                        localStorage.setItem('userDonaturStatus', JSON.stringify({
                            isDonatur: false,
                            userId: currentUserId,
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
    // 🆕 Get current user ID
    const currentUserId = getCurrentUserId();
    
    // ✅ VALIDATE CACHE FIRST - Check if cached status is expired and belongs to current user
    // This ensures expired status is detected even before checking DOM or API
    const stored = localStorage.getItem('userDonaturStatus');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            
            // 🆕 VALIDATE USER ID - Check if cached status belongs to current user
            if (currentUserId && data.userId && data.userId !== currentUserId) {
                dLog('⚠️ Cached status belongs to different user in getUserDonaturStatus, clearing');
                localStorage.removeItem('userDonaturStatus');
                // Continue to normal check
            } else {
                // ✅ VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // ✅ Status sudah berakhir - invalidate cache immediately
                        localStorage.setItem('userDonaturStatus', JSON.stringify({
                            isDonatur: false,
                            userId: currentUserId,
                            timestamp: Date.now()
                        }));
                        return false;
                    }
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
    
    // 🆕 Get current user ID for cache validation
    const currentUserId = getCurrentUserId();
    
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
            
            // ✅ Valid donatur - update cache for UI purposes (with userId)
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: true,
                userId: currentUserId,
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

// ============================================
// 🔔 NOTIFICATION SYSTEM
// ============================================
const NOTIFICATION_API = 'https://manga-auth-worker.nuranantoadhien.workers.dev/notifications';

/**
 * Initialize notification system
 */
function initNotificationSystem() {
    dLog('🔔 [NOTIF] Initializing notification system...');
    const btnNotification = document.getElementById('btnNotification');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (!btnNotification || !notificationDropdown) {
        dWarn('⚠️ [NOTIF] Button atau dropdown tidak ditemukan');
        return;
    }
    
    // Toggle dropdown
    btnNotification.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = notificationDropdown.style.display === 'block';
        
        if (isVisible) {
            notificationDropdown.style.display = 'none';
        } else {
            notificationDropdown.style.display = 'block';
            loadNotifications();
        }
    });
    
    // Sync button handler
    const btnSync = document.getElementById('btnSyncNotifications');
    if (btnSync) {
        btnSync.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.style.opacity = '0.5';
            
            try {
                const authToken = localStorage.getItem('authToken');
                if (!authToken) {
                    showToast('Anda harus login terlebih dahulu', 'warning');
                    return;
                }
                
                // Check which tab is active
                const updatesTab = document.querySelector('[data-tab="updates"]');
                const isUpdateTabActive = updatesTab?.classList.contains('active');
                
                if (isUpdateTabActive) {
                    // ✅ Refresh Update Tab - Clear cache dan reload
                    localStorage.removeItem('notif_updates_cache');
                    localStorage.removeItem('notif_updates_cache_time');
                    await loadUpdateNotifications();
                    
                    // Show success message
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '✅';
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                    }, 1000);
                } else {
                    // ✅ Sync Comments - Original functionality
                    // Clear comments cache before syncing
                    localStorage.removeItem('notif_comments_cache');
                    localStorage.removeItem('notif_comments_cache_time');
                    
                    const response = await fetch(`${NOTIFICATION_API}/reprocess-mentions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        if (typeof showToast === 'function') {
                            showToast(data.message, 'success');
                        }
                        loadNotifications();
                        updateNotificationBadge();
                    } else {
                        if (typeof showToast === 'function') {
                            showToast(data.error, 'error');
                        }
                    }
                }
            } catch (error) {
                console.error('[NOTIF SYNC] Error:', error);
                if (typeof showToast === 'function') {
                    showToast('Terjadi kesalahan saat refresh', 'error');
                }
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
    }
    
    // ✅ Notification Tabs Handler
    const notificationTabs = document.querySelectorAll('.notification-tab');
    notificationTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetTab = tab.dataset.tab;
            
            // Update active tab
            notificationTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            const commentsContent = document.getElementById('notificationComments');
            const updatesContent = document.getElementById('notificationUpdates');
            
            if (targetTab === 'comments') {
                commentsContent.style.display = 'block';
                commentsContent.classList.add('active');
                updatesContent.style.display = 'none';
                updatesContent.classList.remove('active');
                loadNotifications();
            } else if (targetTab === 'updates') {
                commentsContent.style.display = 'none';
                commentsContent.classList.remove('active');
                updatesContent.style.display = 'block';
                updatesContent.classList.add('active');
                loadUpdateNotifications();
                
                // ✅ Hide notification badge when viewing updates
                const badge = document.getElementById('notificationBadge');
                if (badge) {
                    badge.style.display = 'none';
                }
            }
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && e.target !== btnNotification) {
            notificationDropdown.style.display = 'none';
        }
    });
    
    // Load initial notification count
    dLog('🔔 [NOTIF] Loading initial badge...');
    updateNotificationBadge();
    
    // Poll for new notifications every 30 seconds
    setInterval(() => {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
            dLog('🔔 [NOTIF] Polling for updates...');
            updateNotificationBadge();
        }
    }, 30000);
}

/**
 * Load notifications (for Comments tab)
 */
async function loadNotifications() {
    dLog('🔔 [NOTIF] loadNotifications() called');
    const content = document.getElementById('notificationComments');
    if (!content) {
        dWarn('⚠️ [NOTIF] notificationComments element not found');
        return;
    }
    
    const token = localStorage.getItem('authToken');
    dLog('🔔 [NOTIF] Auth token exists:', !!token);
    
    if (!token) {
        // Show login required state
        content.innerHTML = `
            <div class="notification-login-required">
                <p>Silahkan login untuk melihat notifikasimu.</p>
                <small>Untuk melihat dan mengelola notifikasi, silahkan login ke akunmu.</small>
                <div class="notification-login-buttons">
                    <button class="notification-login-btn primary" onclick="document.getElementById('btnOpenLogin').click(); document.getElementById('notificationDropdown').style.display='none';">
                        Login / Register
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    // Show loading
    content.innerHTML = `
        <div class="notification-empty">
            <div class="spinner" style="width: 40px; height: 40px; margin: 20px auto;"></div>
            <p>Loading notifications...</p>
        </div>
    `;
    
    try {
        // ✅ Check cache first (5 minutes cache - comment notifications update frequently)
        const cacheKey = 'notif_comments_cache';
        const cacheTimeKey = 'notif_comments_cache_time';
        const cacheTime = localStorage.getItem(cacheTimeKey);
        const now = Date.now();
        
        // Cache 5 menit (300000 ms) - Comment notifications bisa sering update
        if (cacheTime && (now - parseInt(cacheTime)) < 5 * 60 * 1000) {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                dLog('🔔 [NOTIF] Using cached comments data');
                content.innerHTML = cachedData;
                return;
            }
        }
        
        dLog('🔔 [NOTIF] Fetching notifications from:', NOTIFICATION_API);
        // Add timestamp to URL to prevent caching
        const cacheBuster = `?_=${Date.now()}`;
        const response = await fetch(NOTIFICATION_API + cacheBuster, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });
        
        dLog('🔔 [NOTIF] Response status:', response.status);
        
        if (!response.ok) {
            // Handle 404 gracefully - API endpoint might not be available yet
            if (response.status === 404) {
                content.innerHTML = `
                    <div class="notification-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p>Tidak ada komentar</p>
                    </div>
                `;
                return;
            }
            throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        dLog('🔔 [NOTIF] API response data:', data);
        const notifications = data.notifications || [];
        dLog('🔔 [NOTIF] Notifications count:', notifications.length);
        
        if (notifications.length === 0) {
            content.innerHTML = `
                <div class="notification-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p>Tidak ada komentar</p>
                </div>
            `;
            // ✅ Save to cache even for empty state
            localStorage.setItem('notif_comments_cache', content.innerHTML);
            localStorage.setItem('notif_comments_cache_time', Date.now().toString());
            return;
        }
        
        // Render notifications
        const renderedHTML = notifications.map(notif => {
            const timeAgo = getTimeAgo(notif.created_at);
            const unreadClass = notif.is_read ? '' : 'unread';
            
            // Parse comment_url untuk mendapatkan mangaId, chapterId, commentId
            let mangaId = '';
            let chapterId = '';
            let commentId = '';
            
            if (notif.comment_url) {
                // Format bisa: reader.html?manga=X&chapter=Y#comment-Z atau info-manga.html?repo=X#comment-Z
                const urlParts = notif.comment_url.split('?');
                if (urlParts.length > 1) {
                    const params = new URLSearchParams(urlParts[1].split('#')[0]);
                    mangaId = params.get('manga') || params.get('repo') || params.get('id') || '';
                    chapterId = params.get('chapter') || '';
                }
                const hashParts = notif.comment_url.split('#comment-');
                if (hashParts.length > 1) {
                    commentId = hashParts[1];
                }
            }
            
            return `
                <div class="notification-item ${unreadClass}" data-notification-id="${notif.id}">
                    <div class="notification-item-content" onclick="handleNotificationClick('${notif.id}', '${mangaId}', '${chapterId}', '${commentId}')">
                        <div class="notification-item-header">
                            <p class="notification-item-manga">Komentar Baru</p>
                            <span class="notification-item-time">${timeAgo}</span>
                        </div>
                        <p class="notification-item-text">
                            ${escapeHtml(notif.content)}
                        </p>
                    </div>
                    <button class="notification-delete-btn" onclick="event.stopPropagation(); deleteNotification('${notif.id}')" title="Hapus notifikasi">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
        
        // ✅ Set rendered HTML to content
        content.innerHTML = renderedHTML;
        
        // ✅ Save to cache
        localStorage.setItem('notif_comments_cache', renderedHTML);
        localStorage.setItem('notif_comments_cache_time', Date.now().toString());
        
    } catch (error) {
        console.error('❌ [NOTIF] Error loading notifications:', error);
        // Show user-friendly error message without console logging
        content.innerHTML = `
            <div class="notification-empty">
                <p>Failed to load notifications</p>
                <small>Please try again later</small>
            </div>
        `;
    }
}

/**
 * Update notification badge
 */
async function updateNotificationBadge() {
    dLog('🔔 [NOTIF] updateNotificationBadge() called');
    const badge = document.getElementById('notificationBadge');
    if (!badge) {
        dWarn('⚠️ [NOTIF] Badge element not found');
        return;
    }
    
    const authToken = localStorage.getItem('authToken');
    dLog('🔔 [NOTIF] Auth token exists:', !!authToken);
    if (!authToken) {
        badge.style.display = 'none';
        return;
    }
    
    try {
        dLog('🔔 [NOTIF] Fetching unread count from:', NOTIFICATION_API + '/unread-count');
        const response = await fetch(NOTIFICATION_API + '/unread-count', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        dLog('🔔 [NOTIF] Response status:', response.status);
        
        if (!response.ok) {
            dWarn('⚠️ [NOTIF] Failed to fetch unread count');
            badge.style.display = 'none';
            return;
        }
        
        const data = await response.json();
        dLog('🔔 [NOTIF] Unread count data:', data);
        const unreadCount = data.unreadCount || 0;
        dLog('🔔 [NOTIF] Unread count:', unreadCount);
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'block';
            dLog('✅ [NOTIF] Badge displayed with count:', unreadCount);
        } else {
            badge.style.display = 'none';
            dLog('ℹ️ [NOTIF] No unread notifications, badge hidden');
        }
        
    } catch (error) {
        console.error('❌ [NOTIF] Error fetching unread count:', error);
        // Silently hide badge on error (API might not be available)
        badge.style.display = 'none';
    }
}

/**
 * Delete notification (dengan Optimistic Update)
 */
async function deleteNotification(notificationId) {
    console.log('🗑️ [NOTIF] Deleting notification:', notificationId);
    
    // ✅ OPTIMISTIC UPDATE: Hapus dari DOM dulu (immediate feedback)
    const notificationItem = document.querySelector(`[data-notification-id="${notificationId}"]`);
    if (notificationItem) {
        notificationItem.style.opacity = '0.5';
        notificationItem.style.pointerEvents = 'none';
        console.log('✨ [NOTIF] Optimistic: Item faded out');
    }
    
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.warn('⚠️ [NOTIF] No auth token for delete');
            // Restore item jika gagal
            if (notificationItem) {
                notificationItem.style.opacity = '1';
                notificationItem.style.pointerEvents = 'auto';
            }
            return;
        }
        
        const response = await fetch(`https://manga-auth-worker.nuranantoadhien.workers.dev/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok || response.status === 404) {
            // 200-299: sukses, 404: sudah terhapus sebelumnya
            if (response.status === 404) {
                console.log('ℹ️ [NOTIF] Notification already deleted from D1');
            } else {
                console.log('✅ [NOTIF] Notification deleted successfully');
            }
            
            // ✅ Optimistic: Hapus dari DOM dulu (immediate feedback)
            if (notificationItem) {
                notificationItem.remove();
                console.log('✨ [NOTIF] Item removed from DOM (optimistic)');
            }
            
            // ✅ Delay 1500ms untuk kasih waktu D1 propagate delete
            console.log('⏳ [NOTIF] Waiting for D1 to sync...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // ✅ Reload dari server untuk sync dengan D1
            console.log('🔄 [NOTIF] Reloading from server to sync...');
            await loadNotifications();
            await updateNotificationBadge();
        } else {
            console.error('❌ [NOTIF] Failed to delete notification:', response.status);
            // Restore item jika gagal
            if (notificationItem) {
                notificationItem.style.opacity = '1';
                notificationItem.style.pointerEvents = 'auto';
            }
        }
    } catch (error) {
        console.error('❌ [NOTIF] Error deleting notification:', error);
        // Restore item jika error
        if (notificationItem) {
            notificationItem.style.opacity = '1';
            notificationItem.style.pointerEvents = 'auto';
        }
    }
}

/**
 * Handle notification click
 */
async function handleNotificationClick(notificationId, mangaId, chapterId, commentId) {
    const token = localStorage.getItem('authToken');
    
    // Mark as read
    if (token) {
        try {
            await fetch(`https://manga-auth-worker.nuranantoadhien.workers.dev/notifications/mark-read/${notificationId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    // Navigate to the comment
    if (chapterId) {
        // Jika ada chapter, buka di reader
        window.location.href = `reader.html?manga=${mangaId}&chapter=${chapterId}#comment-${commentId}`;
    } else {
        // Jika tidak ada chapter, buka di info-manga
        window.location.href = `info-manga.html?repo=${mangaId}#comment-${commentId}`;
    }
}

/**
 * Get time ago string
 */
function getTimeAgo(timestamp) {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) {
        return new Date(timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } else if (days > 0) {
        return `${days} hari lalu`;
    } else if (hours > 0) {
        return `${hours} jam lalu`;
    } else if (minutes > 0) {
        return `${minutes} menit lalu`;
    } else {
        return 'Baru saja';
    }
}

/**
 * Load Update Notifications (for Updates tab)
 */
async function loadUpdateNotifications() {
    dLog('🔔 [UPDATE] loadUpdateNotifications() called');
    const content = document.getElementById('notificationUpdates');
    if (!content) {
        dWarn('⚠️ [UPDATE] notificationUpdates element not found');
        return;
    }
    
    const token = localStorage.getItem('authToken');
    dLog('🔔 [UPDATE] Auth token exists:', !!token);
    
    if (!token) {
        // Show login required state
        content.innerHTML = `
            <div class="notification-login-required">
                <p>Silahkan login untuk melihat update.</p>
                <small>Untuk melihat update akun, silahkan login ke akunmu.</small>
                <div class="notification-login-buttons">
                    <button class="notification-login-btn primary" onclick="document.getElementById('btnOpenLogin').click(); document.getElementById('notificationDropdown').style.display='none';">
                        Login / Register
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    // Show loading
    content.innerHTML = `
        <div class="notification-empty">
            <div class="spinner" style="width: 40px; height: 40px; margin: 20px auto;"></div>
            <p>Loading updates...</p>
        </div>
    `;
    
    try {
        // Check cache first (1 hour cache - status jarang berubah)
        const cacheKey = 'notif_updates_cache';
        const cacheTimeKey = 'notif_updates_cache_time';
        const cacheTime = localStorage.getItem(cacheTimeKey);
        const now = Date.now();
        
        // Cache 1 jam (3600000 ms) - Status donatur/webhook jarang berubah
        if (cacheTime && (now - parseInt(cacheTime)) < 60 * 60 * 1000) {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                dLog('🔔 [UPDATE] Using cached data');
                content.innerHTML = cachedData;
                return;
            }
        }
        
        // Fetch donatur status data
        const profileResponse = await fetch('https://manga-auth-worker.nuranantoadhien.workers.dev/donatur/status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });
        
        if (!profileResponse.ok) {
            throw new Error('Failed to fetch donatur status');
        }
        
        const profileData = await profileResponse.json();
        const updates = [];
        
        // Check if user has donator status
        if (profileData.isDonatur) {
            const expiresAt = new Date(profileData.expiresAt);
            const now = new Date();
            const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            // Check if expired
            if (daysLeft < 0) {
                updates.push({
                    type: 'warning',
                    title: '❌ Status Donatur Sudah Berakhir',
                    description: `Status Donatur Setia Anda telah berakhir pada ${expiresAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}. Silahkan perpanjang untuk mengakses chapter terkunci.`,
                    time: 'Berakhir',
                    icon: 'warning'
                });
            } else {
                // Active donatur status notification
                updates.push({
                    type: 'info',
                    title: 'Status Donatur Aktif',
                    description: `Status Donatur Setia Anda aktif hingga ${expiresAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                    time: 'Aktif',
                    icon: 'info'
                });
                
                // Warning if expires in 1 day
                if (daysLeft === 1) {
                    updates.push({
                        type: 'warning',
                        title: '⚠️ Status Donatur Akan Berakhir',
                        description: 'Status Donatur Setia Anda akan berakhir besok. Jangan lupa untuk perpanjang agar tetap dapat mengakses chapter terkunci.',
                        time: 'H-1',
                        icon: 'warning'
                    });
                }
            }
        }
        
        // Check for webhook connection (if available in profile data)
        if (profileData.webhookConnected || profileData.lastWebhookUpdate) {
            const webhookTime = profileData.lastWebhookUpdate ? getTimeAgo(profileData.lastWebhookUpdate) : 'Terhubung';
            updates.push({
                type: 'success',
                title: '✅ Webhook Trakteer Terhubung',
                description: 'Akun Anda terhubung dengan webhook Trakteer. Donasi akan otomatis terdeteksi dan status akan diupdate secara real-time.',
                time: webhookTime,
                icon: 'success'
            });
        }
        
        // Render updates
        let htmlContent;
        if (updates.length === 0) {
            htmlContent = `
                <div class="notification-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <p>Tidak ada update</p>
                    <small>Update akan muncul di sini</small>
                </div>
            `;
        } else {
            htmlContent = updates.map(update => {
                const iconSVG = getUpdateIconSVG(update.icon);
                return `
                    <div class="update-item">
                        <div class="update-item-header">
                            <div class="update-item-icon ${update.icon}">
                                ${iconSVG}
                            </div>
                            <span class="update-item-title">${update.title}</span>
                        </div>
                        <p class="update-item-description">${update.description}</p>
                        <span class="update-item-time">${update.time}</span>
                    </div>
                `;
            }).join('');
        }
        
        content.innerHTML = htmlContent;
        
        // Save to cache
        localStorage.setItem(cacheKey, htmlContent);
        localStorage.setItem(cacheTimeKey, Date.now().toString());
        
    } catch (error) {
        console.error('❌ [UPDATE] Error loading updates:', error);
        content.innerHTML = `
            <div class="notification-empty">
                <p>Failed to load updates</p>
                <small>Please try again later</small>
            </div>
        `;
    }
}

/**
 * Get update icon SVG based on type
 */
function getUpdateIconSVG(type) {
    switch(type) {
        case 'success':
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            `;
        case 'info':
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
            `;
        case 'warning':
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            `;
        default:
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
            `;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationSystem);
} else {
    initNotificationSystem();
}
// Update badge when user logs in/out
window.addEventListener('storage', (e) => {
    if (e.key === 'authToken') {
        updateNotificationBadge();
    }
});

// Export functions for use in other scripts
window.updateNotificationBadge = updateNotificationBadge;
window.loadNotifications = loadNotifications;
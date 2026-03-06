// ============================================
// COMMON.JS - SHARED UTILITIES
// ============================================
// Shared functions used across script.js, info-manga.js, and reader.js

// ============================================
// ðŸ›¡ï¸ DEBUG MODE & LOGGING
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
    // Keep console.error active for production debugging
} else if (DEBUG_MODE) {
    dLog('ðŸ”§ Debug mode enabled');
}

// Filter console errors for cover images (prevent redeclaration)
if (!window._coverErrorFiltered) {
    const originalError = console.error;
    console.error = function(...args) {
        // Filter cover image 404 errors during resolution fallback
        if (args[0]?.includes?.('cover') && args[0]?.includes?.('404')) return;
        originalError.apply(console, args);
    };
    window._coverErrorFiltered = true;
}

// ============================================
// ðŸ›¡ï¸ SECURITY UTILITIES
// ============================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Sanitize HTML by removing dangerous tags and attributes
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
    if (typeof html !== 'string') return '';
    
    // Remove script tags
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers (onclick, onerror, etc.)
    html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
    html = html.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove javascript: protocol
    html = html.replace(/javascript:/gi, '');
    
    // Remove data: protocol (except for images with safe mime types)
    html = html.replace(/data:(?!image\/(png|jpg|jpeg|gif|webp|svg\+xml))/gi, '');
    
    return html;
}

/**
 * Validate repository parameter
 * @param {string} repo - Repository name to validate
 * @returns {boolean} True if valid
 */
function validateRepoParam(repo) {
    if (!repo || typeof repo !== 'string') return false;
    // Only allow alphanumeric, hyphen, underscore
    return /^[a-zA-Z0-9\-_]+$/.test(repo) && repo.length <= 100;
}

/**
 * Validate chapter parameter
 * @param {string} chapter - Chapter to validate
 * @returns {boolean} True if valid
 */
function validateChapterParam(chapter) {
    if (!chapter || typeof chapter !== 'string') return false;
    // Allow numbers with optional decimal point
    return /^[0-9]+(\.[0-9]+)?$/.test(chapter) && chapter.length <= 20;
}

/**
 * Create element with safe text content
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content
 * @param {string} className - CSS class name
 * @returns {HTMLElement} Created element
 */
function createSafeElement(tag, text = '', className = '') {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
}

/**
 * Safely set innerHTML with sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content
 */
function safeSetInnerHTML(element, html) {
    if (!element) return;
    element.innerHTML = sanitizeHTML(html);
}

// ============================================
// ðŸ” SECURE TOKEN MANAGEMENT (FREE TIER OPTIMIZED)
// ============================================

/**
 * Token configuration
 */
const TOKEN_CONFIG = {
    EXPIRY_DAYS: 7,
    STORAGE_KEY: 'authToken',
    EXPIRY_KEY: 'authTokenExpiry',
    USER_KEY: 'user'
};

/**
 * Save token with automatic expiry
 * @param {string} token - Auth token to save
 * @param {number} expiryDays - Days until expiry (default: 7)
 */
function saveAuthToken(token, expiryDays = TOKEN_CONFIG.EXPIRY_DAYS) {
    if (!token) return false;
    
    try {
        // Calculate expiry timestamp
        const expiryTime = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
        
        // Save token and expiry
        localStorage.setItem(TOKEN_CONFIG.STORAGE_KEY, token);
        localStorage.setItem(TOKEN_CONFIG.EXPIRY_KEY, expiryTime.toString());
        
        dLog('ðŸ” Token saved with expiry:', new Date(expiryTime).toLocaleString());
        return true;
    } catch (e) {
        console.error('Failed to save token:', e);
        return false;
    }
}

/**
 * Get token if valid (not expired)
 * @returns {string|null} Token if valid, null if expired or not found
 */
function getAuthToken() {
    try {
        const token = localStorage.getItem(TOKEN_CONFIG.STORAGE_KEY);
        const expiryStr = localStorage.getItem(TOKEN_CONFIG.EXPIRY_KEY);
        
        if (!token) {
            dLog('ðŸ” No token found');
            return null;
        }
        
        // Check expiry
        if (expiryStr) {
            const expiry = parseInt(expiryStr);
            if (Date.now() > expiry) {
                dLog('ðŸ” Token expired, clearing...');
                clearAuthToken();
                return null;
            }
        } else {
            // No expiry set, assume old token - set expiry now
            dLog('ðŸ” Legacy token found, setting expiry...');
            saveAuthToken(token);
        }
        
        return token;
    } catch (e) {
        console.error('Failed to get token:', e);
        return null;
    }
}

/**
 * Check if token is valid (exists and not expired)
 * @returns {boolean} True if token is valid
 */
function isTokenValid() {
    return getAuthToken() !== null;
}

/**
 * Clear all auth data
 */
function clearAuthToken() {
    try {
        localStorage.removeItem(TOKEN_CONFIG.STORAGE_KEY);
        localStorage.removeItem(TOKEN_CONFIG.EXPIRY_KEY);
        localStorage.removeItem(TOKEN_CONFIG.USER_KEY);
        localStorage.removeItem('userDonaturStatus');
        dLog('ðŸ” Auth data cleared');
        return true;
    } catch (e) {
        console.error('Failed to clear token:', e);
        return false;
    }
}

/**
 * Get token expiry time
 * @returns {Date|null} Expiry date or null
 */
function getTokenExpiry() {
    try {
        const expiryStr = localStorage.getItem(TOKEN_CONFIG.EXPIRY_KEY);
        if (!expiryStr) return null;
        return new Date(parseInt(expiryStr));
    } catch (e) {
        return null;
    }
}

/**
 * Refresh token expiry (extend by another 7 days)
 */
function refreshTokenExpiry() {
    const token = localStorage.getItem(TOKEN_CONFIG.STORAGE_KEY);
    if (token) {
        return saveAuthToken(token);
    }
    return false;
}

/**
 * âœ… Auto-check token expiry on page load
 */
(function autoCheckTokenExpiry() {
    // Check immediately
    const token = getAuthToken();
    if (!token && localStorage.getItem(TOKEN_CONFIG.STORAGE_KEY)) {
        // Token exists but expired
        dLog('ðŸ” Token expired on page load, logging out...');
        clearAuthToken();
        
        // Trigger logout UI updates if function exists
        if (typeof updateUIAfterLogout === 'function') {
            updateUIAfterLogout();
        }
    }
    
    // Check periodically (every 5 minutes)
    setInterval(() => {
        const token = getAuthToken();
        if (!token && localStorage.getItem(TOKEN_CONFIG.STORAGE_KEY)) {
            dLog('ðŸ” Token expired during session, logging out...');
            clearAuthToken();
            
            // Show notification
            if (typeof showToast === 'function') {
                showToast('Session expired. Please login again.', 'warning', 5000);
            }
            
            // Trigger logout
            if (typeof updateUIAfterLogout === 'function') {
                updateUIAfterLogout();
            }
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
})();

// ============================================
// ðŸž TOAST NOTIFICATION SYSTEM
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
        success: 'âœ…',
        error: 'âŒ',
        warning: 'âš ï¸',
        info: 'â„¹ï¸'
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
// ðŸ“¡ FETCH UTILITIES
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
        console.error('âŒ fetchFreshJSON failed:', error);
        throw error;
    }
}

// ============================================
// ðŸ’¾ CACHE UTILITIES
// ============================================
function getCachedData(key, maxAge = 300000, useSessionStorage = false) {
    const storage = useSessionStorage ? sessionStorage : localStorage;
    try {
        const cached = storage.getItem(key);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < maxAge) {
            dLog(`ðŸ“¦ Cache HIT: ${key} (${Math.floor(age/1000)}s old)`);
            return data;
        }
        
        dLog(`â° Cache EXPIRED: ${key}`);
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
// ðŸ–¼ï¸ CDN UTILITIES
// ============================================
function getResponsiveCDN(originalUrl) {
    // Skip if URL is invalid or already a data URI
    if (!originalUrl || originalUrl.startsWith('data:')) {
        return {
            small: originalUrl,
            medium: originalUrl,
            large: originalUrl,
            xlarge: originalUrl,
            original: originalUrl
        };
    }
    
    // Derive responsive URLs by replacing .webp with -sm/-md/-lg.webp
    // R2 stores 3 variants: ...-sm.webp (320px), ...-md.webp (480px), ...-lg.webp (640px)
    const base = originalUrl.replace(/\.webp$/i, '');
    
    return {
        small: base + '-sm.webp',     // 320px - mobile
        medium: base + '-md.webp',    // 480px - tablet
        large: base + '-lg.webp',     // 640px - desktop/retina
        xlarge: base + '-lg.webp',    // Map xlarge to lg (same file)
        original: originalUrl         // Base URL (fallback)
    };
}

/**
 * âœ… Safe image error handler - prevents infinite loop
 */
function createImageErrorHandler(originalUrl, placeholder = null) {
    let errorCount = 0;
    const maxErrors = placeholder ? 2 : 1; // Allow 2 errors if placeholder provided
    
    return function() {
        errorCount++;
        
        // Prevent infinite loop
        if (errorCount > maxErrors) {
            this.onerror = null; // Remove handler to prevent further calls
            return;
        }
        
        // First fallback: Try original URL
        if (this.src !== originalUrl && errorCount === 1) {
            dLog('ðŸ”„ [IMAGE] Fallback to original URL:', originalUrl);
            this.src = originalUrl;
            this.srcset = ''; // Remove srcset to prevent further CDN attempts
        } 
        // Second fallback: Try placeholder (if provided)
        else if (placeholder && this.src !== placeholder && errorCount === 2) {
            dLog('ðŸ”„ [IMAGE] Fallback to placeholder:', placeholder);
            this.src = placeholder;
            this.srcset = ''; // Clear srcset
        } 
        // No more fallbacks
        else {
            this.onerror = null;
        }
    };
}

// ============================================
// ðŸ‘¤ DONATUR STATUS UTILITIES
// ============================================

/**
 * ðŸ†• Get current user ID from localStorage
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
                dLog('âœ… Donatur status from DOM: true');
                return true;
            }
        }
        
        // ðŸ†• Get current user ID to validate cache ownership
        const currentUserId = getCurrentUserId();
        
        const stored = localStorage.getItem('userDonaturStatus');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                
                // ðŸ†• VALIDATE USER ID - Check if cached status belongs to current user
                if (currentUserId && data.userId && data.userId !== currentUserId) {
                    dLog('âš ï¸ Cached status belongs to different user, invalidating');
                    localStorage.removeItem('userDonaturStatus');
                    return false;
                }
                
                // âœ… VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // âœ… Status sudah berakhir - invalidate cache
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
    
    // ðŸ†• Get current user ID
    const currentUserId = getCurrentUserId();
    
    // âœ… VALIDATE CACHE FIRST - Check if cached status is expired
    const stored = localStorage.getItem('userDonaturStatus');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            
            // ðŸ†• VALIDATE USER ID - Check if cached status belongs to current user
            if (currentUserId && data.userId && data.userId !== currentUserId) {
                dLog('âš ï¸ Cached status belongs to different user, clearing cache');
                localStorage.removeItem('userDonaturStatus');
                // Continue to API check
            } else {
                // âœ… VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // âœ… Status sudah berakhir - invalidate cache immediately
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
        // âœ… Add timeout to fetch request
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
            // âœ… Cek apakah expiresAt sudah lewat
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
        // âœ… Handle network errors gracefully
        if (error.name === 'AbortError') {
            dWarn('Donatur status check timeout - using cached status');
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            dWarn('Network error - using cached donatur status from localStorage');
        } else {
            console.error('Donatur check error:', error);
        }
        
        // âœ… Fallback to localStorage if available, but validate expiresAt and userId first
        const stored = localStorage.getItem('userDonaturStatus');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                
                // ðŸ†• VALIDATE USER ID - Check if cached status belongs to current user
                if (currentUserId && data.userId && data.userId !== currentUserId) {
                    dLog('âš ï¸ Cached status belongs to different user during error fallback, denying');
                    return false;
                }
                
                // âœ… VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // âœ… Status sudah berakhir - invalidate cache
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
    // ðŸ†• Get current user ID
    const currentUserId = getCurrentUserId();
    
    // âœ… VALIDATE CACHE FIRST - Check if cached status is expired and belongs to current user
    // This ensures expired status is detected even before checking DOM or API
    const stored = localStorage.getItem('userDonaturStatus');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            
            // ðŸ†• VALIDATE USER ID - Check if cached status belongs to current user
            if (currentUserId && data.userId && data.userId !== currentUserId) {
                dLog('âš ï¸ Cached status belongs to different user in getUserDonaturStatus, clearing');
                localStorage.removeItem('userDonaturStatus');
                // Continue to normal check
            } else {
                // âœ… VALIDATE EXPIRED STATUS - Check if expiresAt has passed
                if (data.isDonatur && data.expiresAt) {
                    const now = new Date();
                    const expiry = new Date(data.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // âœ… Status sudah berakhir - invalidate cache immediately
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
 * âœ… SECURITY: Verify donatur status with backend (NO CACHE)
 * Use this function for critical operations like accessing locked chapters
 * This ensures users cannot bypass security by manipulating localStorage
 */
async function verifyDonaturStatusStrict() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        // âœ… No token = definitely not donatur
        return false;
    }
    
    // ðŸ†• Get current user ID for cache validation
    const currentUserId = getCurrentUserId();
    
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
    
    try {
        // âœ… Always verify with backend - no cache allowed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_URL}/donatur/status`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            // âœ… If API fails, deny access (fail-secure)
            dLog('âš ï¸ [SECURITY] API verification failed, denying access');
            return false;
        }
        
        const data = await response.json();
        
        if (data.success && data.isDonatur) {
            // âœ… Verify expiresAt hasn't passed
            const now = new Date();
            const expiry = data.expiresAt ? new Date(data.expiresAt) : null;
            const isExpired = expiry && expiry <= now;
            
            if (isExpired) {
                // âœ… Status expired - deny access
                dLog('âš ï¸ [SECURITY] Donatur status expired, denying access');
                return false;
            }
            
            // âœ… Valid donatur - update cache for UI purposes (with userId)
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: true,
                userId: currentUserId,
                expiresAt: data.expiresAt,
                timestamp: Date.now()
            }));
            
            return true;
        } else {
            // âœ… Not a donatur - deny access
            return false;
        }
    } catch (error) {
        // âœ… On any error (network, timeout, etc), deny access (fail-secure)
        dLog('âš ï¸ [SECURITY] Error verifying donatur status:', error);
        return false;
    }
}

// ============================================
// ðŸ“ SESSION STORAGE HELPERS (for reader.js)
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
// ðŸ–¼ï¸ GLOBAL IMAGE ERROR HANDLER (Prevent Infinite Loop)
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
            dLog('ðŸ”„ [CDN] Image failed, fallback to original:', originalUrl);
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
        
        dLog('ðŸ–±ï¸ [HAMBURGER] Button clicked');
        const isOpen = headerMenuDropdown.classList.contains('show');
        
        dLog('ðŸ–±ï¸ [HAMBURGER] Current state:', isOpen ? 'open' : 'closed');
        
        if (isOpen) {
            headerMenuDropdown.classList.remove('show');
            btnHeaderMenu.setAttribute('aria-expanded', 'false');
            dLog('âœ… [HAMBURGER] Dropdown closed');
        } else {
            headerMenuDropdown.classList.add('show');
            btnHeaderMenu.setAttribute('aria-expanded', 'true');
            dLog('âœ… [HAMBURGER] Dropdown opened');
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
                dLog('âœ… [HAMBURGER] Menu button made visible');
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


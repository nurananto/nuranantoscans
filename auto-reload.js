/**
 * AUTO-RELOAD SYSTEM untuk Mobile & WebView
 * ✅ ENHANCED: Aggressive cache clearing on version change
 * Version: 3.0
 */
(function() {
    'use strict';
    
    const CHECK_INTERVAL = 15 * 1000; // Check every 15 seconds
    const VERSION_KEY = 'site_version';
    const VERSION_URL = 'version.txt';
    
    // Get stored version
    let currentVersion = localStorage.getItem(VERSION_KEY);
    
    /**
     * ✅ AGGRESSIVE CACHE CLEAR - Force reload all resources
     */
    async function aggressiveCacheClear() {
        console.log('🔥 Starting aggressive cache clear...');
        
        // 1. Unregister ALL Service Workers
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                    console.log('🗑️ SW unregistered:', reg.scope);
                }
            } catch (err) {
                console.warn('⚠️ SW unregister failed:', err);
            }
        }
        
        // 2. Clear ALL caches
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    await caches.delete(name);
                    console.log('🗑️ Cache deleted:', name);
                }
            } catch (err) {
                console.warn('⚠️ Cache delete failed:', err);
            }
        }
        
        // 3. Clear localStorage (except version & auth data)
        try {
            // ✅ Preserve auth & session keys during update
            const PRESERVE_KEYS = [
                VERSION_KEY,        // site version
                'authToken',        // login token
                'authTokenExpiry',  // token expiry
                'user',             // user data
                'userDonaturStatus',// donatur status
                '_st'               // Turnstile session token
            ];
            
            const preserved = {};
            PRESERVE_KEYS.forEach(key => {
                const val = localStorage.getItem(key);
                if (val !== null) preserved[key] = val;
            });
            
            localStorage.clear();
            
            Object.entries(preserved).forEach(([key, val]) => {
                localStorage.setItem(key, val);
            });
            
            console.log('🗑️ localStorage cleared (auth preserved)');
        } catch (err) {
            console.warn('⚠️ localStorage clear failed:', err);
        }
        
        // 4. Clear sessionStorage (no auth data stored here)
        try {
            sessionStorage.clear();
            console.log('🗑️ sessionStorage cleared');
        } catch (err) {
            console.warn('⚠️ sessionStorage clear failed:', err);
        }
        
        console.log('✅ Aggressive cache clear completed');
    }
    
    /**
     * Check for updates
     */
    async function checkUpdate() {
        try {
            // ✅ Ultra-aggressive cache bypass
            const cacheBuster = Date.now() + '_' + Math.random().toString(36).substring(7);
            const response = await fetch(VERSION_URL + '?v=' + cacheBuster, {
                method: 'GET',
                cache: 'no-store',
                headers: { 
                    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (!response.ok) {
                console.warn('⚠️ Version check failed:', response.status);
                return;
            }
            
            const newVersion = (await response.text()).trim();
            
            // First load - save version
            if (!currentVersion) {
                localStorage.setItem(VERSION_KEY, newVersion);
                currentVersion = newVersion;
                console.log('✅ Initial version saved:', newVersion);
                return;
            }
            
            // Version changed - RELOAD!
            if (newVersion !== currentVersion) {
                console.log('🔄 New version detected!');
                console.log('   Old:', currentVersion);
                console.log('   New:', newVersion);
                
                // Update stored version FIRST (before reload)
                localStorage.setItem(VERSION_KEY, newVersion);
                
                // ✅ CRITICAL: Aggressive cache clear
                await aggressiveCacheClear();
                
                // Show loading message
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.95);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 999999;
                    color: white;
                    font-family: system-ui, -apple-system, sans-serif;
                `;
                overlay.innerHTML = `
                    <div style="text-align: center;">
                        <div style="width: 50px; height: 50px; border: 4px solid #333; border-top-color: #1877f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                        <p style="font-size: 18px; font-weight: 600;">Updating to v${newVersion}...</p>
                        <p style="font-size: 14px; color: #888; margin-top: 10px;">Clearing cache & reloading</p>
                    </div>
                    <style>
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    </style>
                `;
                document.body.appendChild(overlay);
                
                // ✅ Force hard reload after cache clear
                console.log('⏳ Reloading in 1 second...');
                setTimeout(() => {
                    // Use location.reload(true) for hard reload (deprecated but works)
                    window.location.reload(true);
                    
                    // Fallback: if still not reloaded after 500ms, use href
                    setTimeout(() => {
                        window.location.href = window.location.href + '?v=' + newVersion;
                    }, 500);
                }, 1000);
            } else {
                console.log('✅ Version up to date:', currentVersion);
            }
            
        } catch (err) {
            console.warn('⚠️ Update check failed:', err);
        }
    }
    
    // Check on page load
    console.log('🚀 Auto-reload initialized');
    checkUpdate();
    
    // Check every 15 seconds
    setInterval(checkUpdate, CHECK_INTERVAL);
    
    // Check when user returns to app (mobile)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('👁️ Page visible - checking update...');
            checkUpdate();
        }
    });
    
    // Check when page focused (desktop)
    window.addEventListener('focus', () => {
        console.log('🎯 Page focused - checking update...');
        checkUpdate();
    });
    
    console.log('✅ Auto-reload ready (check every 15 seconds)');
    
})();
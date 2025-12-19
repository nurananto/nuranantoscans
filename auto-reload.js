/**
 * AUTO-RELOAD SYSTEM untuk Mobile & WebView
 * Bypass Service Worker limitations
 * Version: 2.0
 */
(function() {
    'use strict';
    
    const CHECK_INTERVAL = 15 * 1000; // ✅ Check setiap 15 detik (lebih cepat!)
    const VERSION_KEY = 'site_version';
    const VERSION_URL = 'version.txt';
    
    // Get stored version
    let currentVersion = localStorage.getItem(VERSION_KEY);
    
    /**
     * Check for updates
     */
    async function checkUpdate() {
        try {
           // ✅ Aggressive cache bypass
const cacheBuster = Date.now() + '_' + Math.random().toString(36).substring(7);
const response = await fetch(VERSION_URL + '?v=' + cacheBuster, {
    method: 'GET',
    cache: 'no-store',
    headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
});
            
            if (!response.ok) {
                console.warn('⚠️ Version check failed:', response.status);
                return;
            }
            
            const newVersion = (await response.text()).trim();
            
            // First load - simpan version
            if (!currentVersion) {
                localStorage.setItem(VERSION_KEY, newVersion);
                currentVersion = newVersion;
                console.log('✅ Initial version saved:', newVersion);
                return;
            }
            
            // Version berubah - RELOAD!
            if (newVersion !== currentVersion) {
                console.log('🔄 New version detected!');
                console.log('   Old:', currentVersion);
                console.log('   New:', newVersion);
                
                // Update stored version
                localStorage.setItem(VERSION_KEY, newVersion);
                
                // Unregister Service Worker
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(reg => {
                            reg.unregister();
                            console.log('🗑️ SW unregistered');
                        });
                    });
                }
                
                // Clear all cache
                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => {
                            caches.delete(name);
                            console.log('🗑️ Cache deleted:', name);
                        });
                    });
                }
                
                // Force reload setelah 500ms
                console.log('⏳ Reloading in 500ms...');
                setTimeout(() => {
                    window.location.reload(true);
                }, 500);
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
    
    // Check setiap 15 detik
    setInterval(checkUpdate, CHECK_INTERVAL);
    
    // Check saat user kembali ke app (mobile)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('👁️ Page visible - checking update...');
            checkUpdate();
        }
    });
    
    // Check saat page focus (desktop)
    window.addEventListener('focus', () => {
        console.log('🎯 Page focused - checking update...');
        checkUpdate();
    });
    
    console.log('✅ Auto-reload ready (check every 15 seconds)'); // ✅ BENAR!
    
})();

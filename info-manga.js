// ============================================
// INFO-MANGA.JS
// ============================================
// Note: Uses common.js for shared utilities (DEBUG_MODE, fetchFreshJSON, cache functions, etc.)

async function showLockedChapterModal(chapterNumber = null, chapterFolder = null) {
    dLog('🔒 showLockedChapterModal called with chapter:', chapterNumber);
    
    const mangaType = mangaData?.manga?.type || 'manga';
    
    if (!chapterFolder && chapterNumber) {
        chapterFolder = chapterNumber;
        if (typeof chapterNumber === 'string' && chapterNumber.toLowerCase().startsWith('chapter ')) {
            chapterFolder = chapterNumber.replace(/^chapter\s+/i, '');
        }
    }
    
    const isDonatur = isDonaturFromDOM() || await checkIsDonatur();
    
    if (isDonatur) {
        dLog('✅ Donatur SETIA - Opening chapter directly');
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        // ✅ Security: Validate parameters before redirect
        if (repoParam && chapterFolder && validateRepoParam(repoParam) && validateChapterParam(chapterFolder)) {
            window.location.href = `reader.html?repo=${encodeURIComponent(repoParam)}&chapter=${encodeURIComponent(chapterFolder)}`;
        }
        return;
    }
    
    dLog('🔒 PEMBACA SETIA - Showing upgrade modal');
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) {
        upgradeModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * MODIFY EXISTING trackLockedChapterView function
 * Update to pass chapter data correctly
 */
async function trackLockedChapterView(chapter) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        
        if (!repoParam) {
            console.error('❌ Repo parameter not found');
            openTrakteer();
            return;
        }
        
        dLog('🔒 Locked chapter clicked:', chapter.folder);
        
        const githubRepo = window.currentGithubRepo || repoParam;
        
        // Track view
        incrementPendingChapterViews(githubRepo, chapter.folder).catch(err => {
            console.error('⚠️ Failed to track locked chapter view:', err);
        });
        
        // Show appropriate modal based on type
        const chapterTitle = chapter.title || chapter.folder;
        const chapterFolder = chapter.folder;  // ← TAMBAH INI
        showLockedChapterModal(chapterTitle, chapterFolder);  // ← FIX INI
        
    } catch (error) {
        console.error('❌ Error tracking locked chapter:', error);
        openTrakteer();
    }
}

/**
 * SESSION STORAGE HELPER - 1 HOUR EXPIRY
 * Tambahkan di reader.js dan info-manga.js (setelah constants)
 */

// ============================================
// SESSION STORAGE WITH EXPIRY
// ============================================

const SESSION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Save validated chapter to session storage with expiry
 */
function saveValidatedChapter(repoName, chapter) {
    const key = `validated_${repoName}_${chapter}`;
    const data = {
        validated: true,
        expiry: Date.now() + SESSION_DURATION
    };
    sessionStorage.setItem(key, JSON.stringify(data));
    dLog(`💾 Saved session for ${chapter} (expires in 1 hour)`);
}

/**
 * Check if chapter is already validated (and not expired)
 */
function isChapterValidated(repoName, chapter) {
    const key = `validated_${repoName}_${chapter}`;
    const stored = sessionStorage.getItem(key);
    
    if (!stored) {
        return false;
    }
    
    try {
        const data = JSON.parse(stored);
        const now = Date.now();
        
        // Check if expired
        if (now > data.expiry) {
            dLog(`⏰ Session expired for ${chapter}`);
            sessionStorage.removeItem(key);
            return false;
        }
        
        const remainingMs = data.expiry - now;
        const remainingMin = Math.floor(remainingMs / 60000);
        dLog(`✅ Session valid for ${chapter} (${remainingMin} min remaining)`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error parsing session data:', error);
        sessionStorage.removeItem(key);
        return false;
    }
}

/**
 * Clear validation session for a chapter
 */
function clearValidatedChapter(repoName, chapter) {
    const key = `validated_${repoName}_${chapter}`;
    sessionStorage.removeItem(key);
    dLog(`🗑️  Cleared session for ${chapter}`);
}

// ============================================
// EARLY COVER PRELOAD - Optimized Version
// ============================================

(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const repoId = urlParams.get('repo');
    
    if (repoId && typeof MANGA_REPOS !== 'undefined' && MANGA_REPOS[repoId]) {
        const mangaConfig = MANGA_REPOS[repoId];
        const mangaJsonUrl = typeof mangaConfig === 'string' ? mangaConfig : mangaConfig.url;
        
        // ✅ Use immediate preload (no delay)
        fetch(mangaJsonUrl + '?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                if (data.manga && data.manga.cover) {
                    const cdnUrls = getResponsiveCDN(data.manga.cover);
                    
                    const preloadLink = document.createElement('link');
                    preloadLink.rel = 'preload';
                    preloadLink.as = 'image';
                    preloadLink.href = cdnUrls.medium;
                    preloadLink.fetchpriority = 'high';
                    
                    // ✅ Add responsive preload
                    preloadLink.imagesrcset = `
                        ${cdnUrls.small} 400w,
                        ${cdnUrls.medium} 600w,
                        ${cdnUrls.large} 800w
                    `.trim();
                    preloadLink.imagesizes = '(max-width: 768px) 100vw, 320px';
                    
                    // ✅ CRITICAL: Add onload handler to mark as used
                    preloadLink.onload = () => {
                        dLog('✅ Cover preloaded successfully');
                        // Mark as used to prevent warning
                        preloadLink.dataset.loaded = 'true';
                    };
                    
                    document.head.appendChild(preloadLink);
                    
                    dLog('🚀 Cover preload initiated');
                }
            })
            .catch(err => dWarn('⚠️ Preload failed:', err));
    }
})();


// ============================================
// WIB TIMEZONE HELPER (GMT+7)
// ============================================

function getWIBTimestamp() {
    const date = new Date();
    const wibStr = date.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
    return wibStr + '+07:00';
}

function convertToWIB(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    const wibStr = date.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
    return wibStr + '+07:00';
}

// Link Trakteer untuk chapter terkunci
const TRAKTEER_LINK = 'https://trakteer.id/NuranantoScanlation';

// ✅ Helper function untuk check status donatur
async function checkIsDonatur() {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    
    try {
        const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
        const response = await fetch(`${API_URL}/donatur/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        return data.success && data.isDonatur === true;
    } catch (error) {
        console.error('Error checking donatur status:', error);
        return false;
    }
}

// ✅ Helper function untuk check status dari DOM (faster, no API call)
// ✅ Juga cek localStorage sebagai fallback jika DOM belum siap
function isDonaturFromDOM() {
    const statusText = document.getElementById('statusText');
    
    // ✅ Cek DOM terlebih dahulu
    if (statusText && statusText.textContent === 'DONATUR SETIA') {
        return true;
    }
    
    // ✅ Fallback: cek localStorage jika DOM belum siap (untuk menghindari flash gembok terkunci)
    try {
        const stored = localStorage.getItem('userDonaturStatus');
        if (stored) {
            const data = JSON.parse(stored);
            // ✅ Cache valid for 5 minutes
            const cacheAge = Date.now() - data.timestamp;
            if (cacheAge < 300000) { // 5 minutes
                return data.isDonatur === true;
            }
        }
    } catch (error) {
        // Ignore error
    }
    
    return false;
}

async function showLockedChapterModal(chapterNumber = null, chapterFolder = null) {
    dLog('🔒 showLockedChapterModal called with chapter:', chapterNumber);
    
    // Check manga type
    const mangaType = mangaData?.manga?.type || 'manga';
    
    // ✅ PERTAHANKAN EXTRACTION LOGIC (untuk backward compatibility)
    // Extract chapter folder from chapterNumber (might be "Chapter 7.3" or "7.3")
    if (!chapterFolder && chapterNumber) {
        chapterFolder = chapterNumber;
        if (typeof chapterNumber === 'string' && chapterNumber.toLowerCase().startsWith('chapter ')) {
            chapterFolder = chapterNumber.replace(/^chapter\s+/i, '');
        }
    }
    
    // ✅ CEK APAKAH USER SUDAH LOGIN
    const token = localStorage.getItem('authToken');
    const isLoggedIn = !!token;
    
    if (!isLoggedIn) {
        // ✅ USER BELUM LOGIN - Tampilkan modal login required
        dLog('🔒 User belum login - Showing login required modal');
        const loginRequiredModal = document.getElementById('loginRequiredModal');
        if (loginRequiredModal) {
            loginRequiredModal.style.display = 'flex';
            
            // Conditional: Hide trakteer button for webtoon type
            const btnTrakteerPost = document.getElementById('btnTrakteerPost');
            if (btnTrakteerPost) {
                if (mangaType === 'webtoon') {
                    btnTrakteerPost.style.display = 'none';
                } else {
                    btnTrakteerPost.style.display = 'block';
                }
            }
        }
        return;
    }
    
    // ✅ SECURITY: Always verify with backend for locked chapters (NO CACHE)
    // Use verifyDonaturStatusStrict from common.js for security
    let isDonatur = false;
    try {
        // Try to use strict verification from common.js if available
        if (typeof verifyDonaturStatusStrict === 'function') {
            isDonatur = await verifyDonaturStatusStrict();
        } else {
            // Fallback: verify with API (no cache)
            if (token) {
                const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
                const response = await fetch(`${API_URL}/donatur/status`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.isDonatur && data.expiresAt) {
                        const now = new Date();
                        const expiry = new Date(data.expiresAt);
                        isDonatur = expiry > now;
                    }
                }
            }
        }
    } catch (error) {
        dLog('⚠️ [SECURITY] Error verifying donatur status:', error);
        isDonatur = false; // Fail-secure: deny access on error
    }
    
    if (isDonatur) {
        // ✅ DONATUR SETIA - Langsung buka chapter tanpa modal
        dLog('✅ Donatur SETIA - Opening chapter directly');
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        // ✅ Security: Validate parameters before redirect
        if (repoParam && chapterFolder && validateRepoParam(repoParam) && validateChapterParam(chapterFolder)) {
            window.location.href = `reader.html?repo=${encodeURIComponent(repoParam)}&chapter=${encodeURIComponent(chapterFolder)}`;
        }
        return;
    }
    
    // ✅ PEMBACA SETIA (sudah login tapi bukan donatur) - Show upgrade modal
    dLog('🔒 PEMBACA SETIA - Showing upgrade modal');
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) {
        upgradeModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Google Apps Script URL untuk view counter
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyItVREQwjL-hAwkeWxy1fj-0lggMbNnzOGta8XAOqT6tWzyxwOFvue8uthYoq-nQYBow/exec';

let mangaData = null;

// Load data saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    // ✅ Check donatur status first (jika ada token) untuk memastikan status tersedia sebelum render chapter
    // ✅ Note: checkDonaturStatus akan di-define di DOMContentLoaded yang lain, jadi kita cek dulu
    const token = localStorage.getItem('authToken');
    if (token) {
        // ✅ Wait a bit untuk memastikan checkDonaturStatus sudah ter-define
        // ✅ Atau langsung cek dari localStorage sebagai fallback
        const stored = localStorage.getItem('userDonaturStatus');
        if (!stored && window.checkDonaturStatus) {
            try {
                await window.checkDonaturStatus();
            } catch (error) {
                console.error('Error checking donatur status:', error);
            }
        }
    }
    
    await loadMangaFromRepo();
    
    // Track page view
    trackPageView();
});

/**
 * Get manga.json URL from URL parameter
 */
function getMangaJsonUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const repoParam = urlParams.get('repo');
    
    // ✅ Security: Validate repo parameter
    if (!repoParam || !validateRepoParam(repoParam)) {
        console.error('❌ Parameter "repo" tidak ditemukan atau tidak valid di URL');
        alert('Error: Parameter repo tidak ditemukan atau tidak valid.\n\nContoh: info-manga.html?repo=10nenburi');
        return null;
    }
    
    const mangaConfig = MANGA_REPOS[repoParam];
    
    if (!mangaConfig) {
        console.error(`❌ Repo "${escapeHTML(repoParam)}" tidak ditemukan di mapping`);
        alert(`Error: Repo "${escapeHTML(repoParam)}" tidak terdaftar.\n\nRepo tersedia: ${Object.keys(MANGA_REPOS).join(', ')}`);
        return null;
    }
    
    dLog(`📚 Loading manga: ${repoParam}`);
    
    // ✅ Set early title from MANGA_LIST if available
    dLog('🔍 [TITLE DEBUG] Checking MANGA_LIST...');
    dLog('🔍 [TITLE DEBUG] MANGA_LIST defined?', typeof MANGA_LIST !== 'undefined');
    
    if (typeof MANGA_LIST !== 'undefined') {
        dLog('🔍 [TITLE DEBUG] MANGA_LIST length:', MANGA_LIST.length);
        dLog('🔍 [TITLE DEBUG] Looking for repo:', repoParam);
        
        // ✅ Try to find by id first (URL param usually uses id), then by repo field
        const mangaInfo = MANGA_LIST.find(m => m.id === repoParam || m.repo === repoParam);
        dLog('🔍 [TITLE DEBUG] Found manga info?', mangaInfo);
        
        if (mangaInfo && mangaInfo.title) {
            dLog('🔍 [TITLE DEBUG] Setting title to:', mangaInfo.title);
            document.title = `${mangaInfo.title} - Info`;
            dLog('✅ [TITLE DEBUG] Title updated! Current title:', document.title);
            dLog(`✅ Early title set: ${mangaInfo.title}`);
        } else {
            dWarn('⚠️ [TITLE DEBUG] No manga info or title found!');
        }
    } else {
        console.error('❌ [TITLE DEBUG] MANGA_LIST is undefined!');
    }
    
    // Support both old format (string) and new format (object)
    if (typeof mangaConfig === 'string') {
        return mangaConfig;
    } else {
        // Store githubRepo for later use
        window.currentGithubRepo = mangaConfig.githubRepo;
        return mangaConfig.url;
    }
}

async function loadMangaFromRepo() {
    dLog('🚀 [TITLE DEBUG] loadMangaFromRepo() started');
    try {
        const mangaJsonUrl = getMangaJsonUrl();
        dLog('🔍 [TITLE DEBUG] mangaJsonUrl:', mangaJsonUrl);
        if (!mangaJsonUrl) {
            console.error('❌ [TITLE DEBUG] No manga JSON URL!');
            return;
        }
        
        // ✅ GET REPO PARAM untuk cache key
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        
        // ✅ CHECK CACHE FIRST (5 minutes TTL)
        if (repoParam) {
            const cacheKey = `manga_full_${repoParam}`;
            const cached = getCachedData(cacheKey, 300000); // 5 min
            
            if (cached) {
                mangaData = cached;
                dLog('✅ Manga data loaded from cache');
                
                // Display immediately from cache
                displayMangaInfo();
                displayChapters();
                setupReadFirstButton();
                
                // Update title
                document.title = `${mangaData.manga.title} - Info`;
                
                // Fetch rating (async, non-blocking)
                fetchMangaDexRating();
                
                // Track page view
                trackPageView();
                
                return;
            }
        }
        
        // ✅ CACHE MISS - Fetch fresh
        dLog('📡 Fetching fresh manga data...');
        mangaData = await fetchFreshJSON(mangaJsonUrl);
        
        dLog('📦 Raw manga data:', mangaData);
        
        // ✅ SAVE TO CACHE
        if (repoParam) {
            setCachedData(`manga_full_${repoParam}`, mangaData);
            dLog(`💾 Cached manga data: manga_full_${repoParam}`);
        }
        
        // Display manga info
        displayMangaInfo();
        
        // Display chapters
        displayChapters();
        
        // Setup "Baca dari Awal" button
        setupReadFirstButton();
        
        // Fetch MangaDex rating
        fetchMangaDexRating();
        
        // Update page title
        document.title = `${mangaData.manga.title} - Info`;
        
        dLog('✅ Manga data loaded from repo (WIB timezone)');
        
    } catch (error) {
        console.error('❌ Error loading manga data:', error);
        
        // ✅ FALLBACK: Try stale cache
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        
        if (repoParam) {
            const staleCache = getCachedData(`manga_full_${repoParam}`, Infinity);
            if (staleCache) {
                dWarn('⚠️ Using stale cache due to error');
                mangaData = staleCache;
                displayMangaInfo();
                displayChapters();
                setupReadFirstButton();
                document.title = `${mangaData.manga.title} - Info`;
                return;
            }
        }
        
        alert('Gagal memuat data manga dari repository. Cek console untuk detail.');
    }
}

/**
 * Update status badge (Ongoing/Hiatus/Tamat)
 */
function updateStatusBadge(elementId, status) {
    const badge = document.getElementById(elementId);
    if (!badge) return;
    
    const normalizedStatus = (status || 'ongoing').toLowerCase();
    
    // Remove all status classes
    badge.classList.remove('ongoing', 'hiatus', 'tamat');
    
    // Add appropriate class and text
    if (normalizedStatus.includes('hiatus')) {
        badge.classList.add('hiatus');
        badge.textContent = 'HIATUS';
    } else if (normalizedStatus.includes('tamat') || normalizedStatus.includes('completed')) {
        badge.classList.add('tamat');
        badge.textContent = 'TAMAT';
    } else {
        badge.classList.add('ongoing');
        badge.textContent = 'ONGOING';
    }
}

/**
 * Update last update info based on latest chapter
 */
function updateLastUpdate(elementId, chapters) {
    dLog('🕐 updateLastUpdate called with:', { elementId, chapters });
    
    const element = document.getElementById(elementId);
    if (!element || !chapters) {
        dWarn('⚠️ Element or chapters missing:', { element: !!element, chapters: !!chapters });
        if (element) element.textContent = 'Last Update: -';
        return;
    }
    
    try {
        // Convert chapters object to array
        const chaptersArray = Object.values(chapters);
        dLog('📦 Chapters array:', chaptersArray);
        
        if (chaptersArray.length === 0) {
            dWarn('⚠️ No chapters found');
            element.textContent = 'Last Update: -';
            return;
        }
        
        // Sort chapters to get the latest one
        chaptersArray.sort((a, b) => {
            const getSort = (folder) => {
                const parts = folder.split('.');
                const int = parseInt(parts[0]) || 0;
                const dec = parts[1] ? parseInt(parts[1]) : 0;
                return int + (dec / 1000);
            };
            return getSort(b.folder) - getSort(a.folder);
        });
        
        dLog('📋 Sorted chapters:', chaptersArray.slice(0, 3));
        
        // Get latest chapter (first after sorting)
        const latestChapter = chaptersArray[0];
        dLog('🔝 Latest chapter:', latestChapter);
        
        if (latestChapter.uploadDate) {
            dLog('✅ uploadDate found:', latestChapter.uploadDate);
            
            // Parse ISO date and format to "DD MMM YYYY"
            const date = new Date(latestChapter.uploadDate);
            const day = date.getDate();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[date.getMonth()];
            const year = date.getFullYear();
            
            const formattedDate = `${day} ${month} ${year}`;
            dLog('📅 Formatted date:', formattedDate);
            
            element.textContent = `Last Update: ${formattedDate}`;
        } else if (latestChapter.date) {
            dLog('✅ date property found:', latestChapter.date);
            element.textContent = `Last Update: ${latestChapter.date}`;
        } else {
            dWarn('⚠️ No date or uploadDate property found in latest chapter');
            element.textContent = 'Last Update: -';
        }
    } catch (error) {
        console.error('❌ Error updating last update:', error);
        element.textContent = 'Last Update: -';
    }
}

/**
 * Display informasi manga
 */
function displayMangaInfo() {
    const manga = mangaData.manga;
    
    // Update Status Badge & Last Update - Desktop
    updateStatusBadge('statusBadgeInfo', manga.status);
    updateLastUpdate('lastUpdateText', mangaData.chapters);
    
    // Update Status Badge & Last Update - Mobile
    updateStatusBadge('statusBadgeInfoMobile', manga.status);
    updateLastUpdate('lastUpdateTextMobile', mangaData.chapters);
    
    // Update Status Badge & Last Update - Desktop Old (title-section-desktop)
    updateStatusBadge('statusBadgeDesktop', manga.status);
    updateLastUpdate('lastUpdateDesktop', mangaData.chapters);
    
    // Update Title - Desktop
    dLog('🔍 [TITLE DEBUG] displayMangaInfo() called');
    const mainTitle = document.getElementById('mainTitle');
    const subtitle = document.getElementById('subtitle');
    
    dLog('🔍 [TITLE DEBUG] mainTitle element:', mainTitle);
    dLog('🔍 [TITLE DEBUG] Current mainTitle text:', mainTitle?.textContent);
    dLog('🔍 [TITLE DEBUG] Setting mainTitle to:', manga.title);
    
    mainTitle.textContent = manga.title;
    subtitle.textContent = manga.alternativeTitle || '';
    
    dLog('✅ [TITLE DEBUG] mainTitle updated! New text:', mainTitle.textContent);
    
    // Add class untuk judul panjang
    adjustTitleSize(mainTitle, manga.title);
    adjustTitleSize(subtitle, manga.alternativeTitle, true);
    
    // ✅ Update Cover dengan responsive CDN
    const coverImg = document.getElementById('mangaCover');
    const cdnUrls = getResponsiveCDN(manga.cover);
    
    // Set srcset untuk responsive loading
    coverImg.srcset = `
        ${cdnUrls.small} 400w,
        ${cdnUrls.medium} 600w,
        ${cdnUrls.large} 800w
    `.trim();
    
    // Sizes: mobile full width, desktop 320px
    coverImg.sizes = '(max-width: 768px) 100vw, 320px';
    
    // Default src (medium size)
    coverImg.src = cdnUrls.medium;
    
    // ✅ Set data-original for error handling
    coverImg.setAttribute('data-original', manga.cover);
    
    dLog('✅ Cover loaded with CDN optimization');
    
    // Update Author & Artist (Main Container - Hero Info)
    const authorDesktop = document.getElementById('authorNameDesktop');
    const artistDesktop = document.getElementById('artistNameDesktop');
    if (authorDesktop) authorDesktop.textContent = manga.author;
    if (artistDesktop) artistDesktop.textContent = manga.artist;
    
    // Populate Information Container
    populateInformationContainer(manga, mangaData.chapters);
}

/**
 * Adjust title size based on length
 */
function adjustTitleSize(element, text, isSubtitle = false) {
    if (!element || !text) return;
    
    const length = text.length;
    
    if (isSubtitle) {
        // Subtitle threshold
        if (length > 80) {
            element.classList.add('long-subtitle');
        }
    } else {
        // Main title threshold
        if (length > 50) {
            element.classList.add('long-title');
        }
    }
}



/**
 * Populate Information Container (About & Chapters tabs)
 */
function populateInformationContainer(manga, chapters) {
    // Total Chapters
    const chaptersArray = Object.entries(chapters || {}).map(([folder, chapter]) => ({
        folder,
        ...chapter
    }));
    
    const totalChaptersEl = document.getElementById('totalChapters');
    let isOneshot = false;
    
    if (totalChaptersEl) {
        // Check if it's a oneshot
        if (chaptersArray.length === 1) {
            const chapterFolder = chaptersArray[0].folder.toString().toLowerCase();
            if (chapterFolder.includes('oneshot') || chapterFolder.includes('one-shot') || chapterFolder === '0') {
                totalChaptersEl.textContent = 'Oneshot';
                isOneshot = true;
            } else {
                totalChaptersEl.textContent = `${chaptersArray.length} Chapters`;
            }
        } else {
            totalChaptersEl.textContent = `${chaptersArray.length} Chapters`;
        }
    }
    
    // Update status badge to TAMAT if it's a oneshot
    if (isOneshot) {
        updateStatusBadge('statusBadgeInfo', 'TAMAT');
    }
    
    // Jumlah Pembaca
    const totalViewerEl = document.getElementById('totalViewer');
    if (totalViewerEl) {
        const views = manga.views || 0;
        // Display full number with thousand separator and "Pembaca" text
        totalViewerEl.textContent = `${views.toLocaleString('id-ID')} Pembaca`;
    }
    
    // Genre Tags Info
    const genreListInfo = document.getElementById('genreListInfo');
    if (genreListInfo) {
        genreListInfo.innerHTML = '';
        
        if (!manga.genre || manga.genre.length === 0) {
            genreListInfo.innerHTML = '<span class="genre-tag">Unknown</span>';
        } else {
            manga.genre.forEach(genre => {
                const tag = document.createElement('span');
                tag.className = 'genre-tag';
                tag.textContent = genre;
                genreListInfo.appendChild(tag);
            });
        }
    }
    
    // Sinopsis
    const synopsisInfo = document.getElementById('synopsisInfo');
    if (synopsisInfo) {
        synopsisInfo.textContent = manga.description || 'No description available.';
    }
    
    // External Links Buttons
    setupInformationButtons(manga.links);
    
    // Chapters List in Chapters Tab
    populateChapterListInfo(chaptersArray);
    
    // Setup Tab Switching
    setupTabSwitching();
}

/**
 * Setup buttons in Information Container
 */
function setupInformationButtons(links) {
    const btnMangadexInfo = document.getElementById('btnMangadexInfo');
    const btnRawInfo = document.getElementById('btnRawInfo');
    
    // Check if Mangadex link exists
    const hasMangadexLink = links && links.mangadex;
    
    if (btnMangadexInfo) {
        if (!hasMangadexLink) {
            // Hide Mangadex button if no link
            btnMangadexInfo.classList.add('hidden');
            btnMangadexInfo.style.display = 'none';
        } else {
            // Show and setup click handler
            btnMangadexInfo.classList.remove('hidden');
            btnMangadexInfo.style.display = 'flex';
            btnMangadexInfo.onclick = () => {
                window.open(links.mangadex, '_blank');
            };
        }
    }
    
    if (btnRawInfo) {
        btnRawInfo.onclick = () => {
            if (links && links.raw) {
                window.open(links.raw, '_blank');
            } else {
                showToast('Link Source Web tidak tersedia', 'warning');
            }
        };
    }
}

/**
 * Populate chapter list in Chapters tab
 */
function populateChapterListInfo(chapters) {
    const chapterListInfo = document.getElementById('chapterListInfo');
    if (!chapterListInfo) return;
    
    chapterListInfo.innerHTML = '';
    
    if (!chapters || chapters.length === 0) {
        chapterListInfo.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px 0;">No chapters available</p>';
        return;
    }
    
    // Sort chapters by folder number (descending - newest first)
    chapters.sort((a, b) => {
        const getSort = (folder) => parseFloat(folder.toString().replace(/[^\d.]/g, ''));
        return getSort(b.folder) - getSort(a.folder);
    });
    
    // Mark last chapter for hiatus badge
    if (chapters.length > 0) {
        chapters[0].isLastChapter = true;
    }
    
    // Render all chapters using existing createChapterElement function
    chapters.forEach((chapter, index) => {
        const chapterElement = createChapterElement(chapter, chapters);
        chapterListInfo.appendChild(chapterElement);
    });
}

/**
 * Setup tab switching functionality
 */
function setupTabSwitching() {
    const aboutTab = document.getElementById('about-tab');
    const chaptersTab = document.getElementById('chapters-tab');
    const aboutPanel = document.getElementById('about-panel');
    const chaptersPanel = document.getElementById('chapters-panel');
    
    if (!aboutTab || !chaptersTab || !aboutPanel || !chaptersPanel) return;
    
    aboutTab.addEventListener('click', () => {
        // Switch tabs
        aboutTab.classList.add('active');
        chaptersTab.classList.remove('active');
        
        // Switch panels
        aboutPanel.classList.add('active');
        chaptersPanel.classList.remove('active');
        
        // Update ARIA
        aboutTab.setAttribute('aria-selected', 'true');
        chaptersTab.setAttribute('aria-selected', 'false');
    });
    
    chaptersTab.addEventListener('click', () => {
        // Switch tabs
        chaptersTab.classList.add('active');
        aboutTab.classList.remove('active');
        
        // Switch panels
        chaptersPanel.classList.add('active');
        aboutPanel.classList.remove('active');
        
        // Update ARIA
        chaptersTab.setAttribute('aria-selected', 'true');
        aboutTab.setAttribute('aria-selected', 'false');
    });
}

/**
 * Get relative time or full date
 */
function getRelativeTime(uploadDateStr) {
    if (!uploadDateStr) return '';
    
    const uploadDate = new Date(uploadDateStr);
    const now = new Date();
    
    if (isNaN(uploadDate.getTime())) {
        return '';
    }
    
    const diffMs = now - uploadDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 24) {
        if (diffHours < 1) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffMins <= 1 ? 'Baru saja' : `${diffMins} menit yang lalu`;
        }
        return `${diffHours} jam yang lalu`;
    }
    
    if (diffDays === 1) return '1 hari yang lalu';
    if (diffDays === 2) return '2 hari yang lalu';
    if (diffDays === 3) return '3 hari yang lalu';
    
    return uploadDate.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
    });
}

/**
 * Check if chapter was uploaded within 2 days
 */
function isRecentlyUploaded(uploadDateStr) {
    if (!uploadDateStr) return false;
    
    const uploadDate = new Date(uploadDateStr);
    const now = new Date();
    
    if (isNaN(uploadDate.getTime())) {
        return false;
    }
    
    const diffDays = (now - uploadDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 2;
}

/**
 * Display chapters - FINAL VERSION (REPLACE LINE 770-803)
 * ⚠️ HAPUS fungsi displayChapters() yang PERTAMA (line 770-803)
 * ⚠️ KEEP HANYA fungsi ini
 */
function displayChapters() {
    const chapterList = document.getElementById('chapterListInfo');
    
    if (!chapterList) {
        console.error('❌ Chapter list container not found');
        return;
    }
    
    chapterList.innerHTML = '';
    
    const chaptersArray = Object.values(mangaData.chapters);
    
chaptersArray.sort((a, b) => {
    const getSort = (folder) => {
        const parts = folder.split('.');
        const int = parseInt(parts[0]) || 0;
        const dec = parts[1] ? parseInt(parts[1]) : 0;
        return int + (dec / 1000);
    };
    return getSort(b.folder) - getSort(a.folder);
});
    
    // ✅ MARK LAST CHAPTER (SETELAH SORTING)
    if (chaptersArray.length > 0) {
        chaptersArray[0].isLastChapter = true;
    }
    
    const initialLimit = getInitialChapterLimit();
    
    // ✅ RENDER CHAPTERS - PASS chaptersArray as 2nd parameter
    chaptersArray.forEach((chapter, index) => {
        const chapterElement = createChapterElement(chapter, chaptersArray);
        
        if (index >= initialLimit) {
            chapterElement.classList.add('chapter-hidden');
        }
        
        chapterList.appendChild(chapterElement);
    });
    
    if (chaptersArray.length > initialLimit) {
        const showMoreBtn = createShowMoreButton(chaptersArray.length - initialLimit);
        chapterList.appendChild(showMoreBtn);
    }
    
    dLog(`✅ Loaded ${chaptersArray.length} chapters`);
}

/**
 * Create chapter element - FINAL VERSION (REPLACE LINE 846-920)
 * ⚠️ PASTIKAN fungsi ini TERIMA 2 PARAMETER: (chapter, allChapters)
 */
function createChapterElement(chapter, allChapters) {
    const div = document.createElement('div');
    div.className = 'chapter-item';
    
    // ✅ CHECK USER STATUS - Jika DONATUR SETIA, treat locked chapter as unlocked
    const isDonatur = isDonaturFromDOM();
    const isActuallyLocked = chapter.locked && !isDonatur;
    
    if (isActuallyLocked) {
        div.classList.add('chapter-locked');
        div.onclick = () => trackLockedChapterView(chapter);
    } else {
        div.onclick = () => openChapter(chapter);
    }
    
    // ✅ Icon: 🔒 untuk locked (PEMBACA SETIA), 🔓 untuk unlocked (DONATUR SETIA), atau kosong jika tidak locked
    const lockIcon = isActuallyLocked ? '🔒 ' : (chapter.locked && isDonatur ? '🔓 ' : '');
    const uploadDate = getRelativeTime(chapter.uploadDate);
    const isRecent = isRecentlyUploaded(chapter.uploadDate);
    
    // ✅ CEK END CHAPTER
    const isEndChapter = mangaData.manga.status === 'END' && 
                         mangaData.manga.endChapter && 
                         (
                           (typeof mangaData.manga.endChapter === 'string' && 
                            chapter.folder.toLowerCase() === mangaData.manga.endChapter.toLowerCase()) ||
                           parseFloat(chapter.folder) === parseFloat(mangaData.manga.endChapter) ||
                           String(chapter.folder) === String(mangaData.manga.endChapter)
                         );

    // ✅ CEK HIATUS CHAPTER (menggunakan isLastChapter flag)
    const isHiatusChapter = mangaData.manga.status === 'HIATUS' && 
                            chapter.isLastChapter === true;

    // ✅ BUILD BADGES
    const endBadge = isEndChapter ? '<span class="chapter-end-badge">END</span>' : '';
    const hiatusBadge = isHiatusChapter ? '<span class="chapter-hiatus-badge-modal">HIATUS</span>' : '';
    const updatedBadge = isRecent ? '<span class="chapter-updated-badge">UPDATED</span>' : '';

    const badges = (endBadge || hiatusBadge || updatedBadge) 
        ? `<div class="badge-container">${endBadge}${hiatusBadge}${updatedBadge}</div>` 
        : '';
    
// ✅ FIX XSS: Use createElement + textContent untuk data dinamis (lebih aman)
    const chapterInfoDiv = document.createElement('div');
    chapterInfoDiv.className = 'chapter-info';
    
    const titleRowDiv = document.createElement('div');
    titleRowDiv.className = 'chapter-title-row';
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'chapter-title-text';
    
    // ✅ FIX BADGE POSITION: Lock icon FIRST, title MIDDLE, badges AFTER
    // 1. Lock icon (if exists)
    if (lockIcon) {
        const lockSpan = document.createElement('span');
        lockSpan.innerHTML = lockIcon;
        titleSpan.appendChild(lockSpan);
    }
    
    // 2. Chapter title (main content)
    const titleText = document.createElement('span');
    titleText.textContent = chapter.title || chapter.folder; // ✅ XSS Protection
    titleSpan.appendChild(titleText);
    
    // 3. Badges AFTER title (END, HIATUS, UPDATED)
    if (badges) {
        const badgeSpan = document.createElement('span');
        badgeSpan.innerHTML = ' ' + badges; // Add space before badges
        titleSpan.appendChild(badgeSpan);
    }
    
    titleRowDiv.appendChild(titleSpan);
    chapterInfoDiv.appendChild(titleRowDiv);
    
    // ✅ uploadDate: textContent untuk XSS protection
    if (uploadDate) {
        const uploadDateDiv = document.createElement('div');
        uploadDateDiv.className = 'chapter-upload-date';
        uploadDateDiv.textContent = uploadDate; // ✅ XSS Protection: textContent untuk data dinamis
        chapterInfoDiv.appendChild(uploadDateDiv);
    }
    
    // ✅ STATS: Comment Count, Views (Rating dihilangkan)
    const statsDiv = document.createElement('div');
    statsDiv.className = 'chapter-stats';
    
    // Rating dihilangkan - tidak ada rating untuk chapter
    // const ratingSpan = document.createElement('span');
    // statsDiv.appendChild(ratingSpan);
    
    // Comment Count (will be loaded async)
    const commentSpan = document.createElement('span');
    commentSpan.className = 'chapter-stat-item chapter-comments';
    commentSpan.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #888;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="comment-value">-</span>
    `;
    statsDiv.appendChild(commentSpan);
    
    // Views
    const viewsSpan = document.createElement('span');
    viewsSpan.className = 'chapter-stat-item chapter-views';
    viewsSpan.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #888;">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
        <span class="view-value">${chapter.views || 0}</span>
    `;
    statsDiv.appendChild(viewsSpan);
    
    div.appendChild(chapterInfoDiv);
    div.appendChild(statsDiv);
    
    // Load comment count asynchronously (rating sudah dihapus)
    loadChapterStats(chapter, commentSpan);
    
    return div;
}

/**
 * Load chapter comment count from API
 */
async function loadChapterStats(chapter, commentEl) {
    // Try to get mangaId from multiple sources
    let mangaId = mangaData?.manga?.id;
    
    // Fallback: get from URL parameter
    if (!mangaId) {
        const urlParams = new URLSearchParams(window.location.search);
        mangaId = urlParams.get('repo')?.toLowerCase();
    }
    
    dLog('[CHAPTER-STATS] Loading stats for chapter:', chapter.folder, 'mangaId:', mangaId);
    
    if (!mangaId) {
        dWarn('[CHAPTER-STATS] mangaId not found, skipping stats load');
        return;
    }
    
    const chapterId = `${mangaId}-${chapter.folder}`;
    dLog('[CHAPTER-STATS] chapterId:', chapterId);
    
    try {
        // Fetch comments only (rating dihilangkan)
        // Use full chapterId format: mangaId-folder (same as reader)
        const fullChapterId = `${mangaId}-${chapter.folder}`;
        const commentsRes = await fetch(
            `https://manga-auth-worker.nuranantoadhien.workers.dev/comments?mangaId=${mangaId}&chapterId=${fullChapterId}`
        );
        
        const commentsData = await commentsRes.json();
        
        dLog(`[CHAPTER-STATS] ${chapter.folder}:`, { comments: commentsData });
        
        // Update comment count - always show including 0
        const commentValue = commentEl.querySelector('.comment-value');
        if (commentValue) {
            if (commentsData.success) {
                commentValue.textContent = commentsData.total || 0;
            } else {
                commentValue.textContent = '0'; // Default if API fails
            }
        }
    } catch (error) {
        console.error('[CHAPTER-STATS] Error loading stats for', chapter.folder, ':', error);
        // Set default on error
        const commentValue = commentEl.querySelector('.comment-value');
        if (commentValue) commentValue.textContent = '0';
    }
}

/**
 * Open Trakteer link
 */
function openTrakteer() {
    window.open(TRAKTEER_LINK, '_blank');
}

/**
 * Track locked chapter view
 */
async function trackLockedChapterView(chapter) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        
        if (!repoParam) {
            console.error('❌ Repo parameter not found');
            openTrakteer();
            return;
        }
        
        dLog('🔒 Locked chapter clicked:', chapter.folder);
        
        const githubRepo = window.currentGithubRepo || repoParam;
        
        incrementPendingChapterViews(githubRepo, chapter.folder).catch(err => {
            console.error('⚠️ Failed to track locked chapter view:', err);
        });
        
        const chapterTitle = chapter.title || chapter.folder;
        const chapterFolder = chapter.folder;  // ← TAMBAH INI
        showLockedChapterModal(chapterTitle, chapterFolder);  // ← PASS 2 PARAMETER
        
    } catch (error) {
        console.error('❌ Error tracking locked chapter:', error);
        openTrakteer();
    }
}

/**
 * Increment pending chapter views
 */
async function incrementPendingChapterViews(repo, chapter) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({ 
                repo: repo,
                chapter: chapter,
                type: 'chapter',
                timestamp: getWIBTimestamp()
            }),
            mode: 'no-cors'
        });
        
        dLog('✅ Chapter view increment request sent');
        
    } catch (error) {
        console.error('❌ Error incrementing chapter views:', error);
        throw error;
    }
}

/**
 * Open chapter
 */
function openChapter(chapter) {
    const urlParams = new URLSearchParams(window.location.search);
    const repoParam = urlParams.get('repo');
    
    if (!repoParam) {
        console.error('❌ Repo parameter not found');
        alert('Error: Parameter repo tidak ditemukan.');
        return;
    }
    
    dLog('📖 Opening chapter:', chapter.folder);
    window.location.href = `reader.html?repo=${repoParam}&chapter=${chapter.folder}`;
}

/**
 * Get initial chapter limit
 */
function getInitialChapterLimit() {
    return 5;
}

/**
 * Create show more button
 */
function createShowMoreButton(hiddenCount) {
    const btn = document.createElement('button');
    btn.className = 'btn-show-more';
    btn.innerHTML = `Show More (${hiddenCount} chapters)`;
    
    btn.onclick = () => {
        const hiddenChapters = document.querySelectorAll('.chapter-hidden');
        hiddenChapters.forEach(ch => {
            ch.classList.remove('chapter-hidden');
            ch.classList.add('chapter-show');
        });
        btn.remove();
    };
    
    return btn;
}





/**
 * Track page view
 */
async function trackPageView() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        
        if (!repoParam) {
            dLog('⚠️ No repo parameter, skipping view tracking');
            return;
        }
        
        const viewKey = `viewed_${repoParam}`;
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (hasViewed) {
            dLog('📊 Already counted in this session');
            return;
        }
        
        const githubRepo = window.currentGithubRepo || repoParam;
        await incrementPendingViews(githubRepo);
        
        sessionStorage.setItem(viewKey, 'true');
        dLog('✅ View tracked successfully');
        
    } catch (error) {
        console.error('❌ Error tracking view:', error);
    }
}

/**
 * Increment pending views
 */
async function incrementPendingViews(repo) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({ 
                repo: repo,
                type: 'page',
                timestamp: getWIBTimestamp()
            }),
            mode: 'no-cors'
        });
        
        dLog('✅ View increment request sent');
        
    } catch (error) {
        console.error('❌ Error incrementing views:', error);
    }
}

function initProtection() {
    if (DEBUG_MODE) {
        dLog('🔓 Debug mode enabled - protection disabled');
        return;
    }
    
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    document.addEventListener('keydown', (e) => {
        if (
            e.keyCode === 123 ||
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
            (e.ctrlKey && e.shiftKey && e.keyCode === 74) ||
            (e.ctrlKey && e.keyCode === 85) ||
            (e.ctrlKey && e.keyCode === 83)
        ) {
            e.preventDefault();
            return false;
        }
    });

    document.addEventListener('selectstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });

    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });

    document.addEventListener('copy', (e) => {
        e.preventDefault();
        return false;
    });
    
    dLog('🔒 Protection enabled');
}

initProtection();

async function fetchMangaDexRating() {
    try {
        const mangadexUrl = mangaData.manga.links?.mangadex;
        
        if (!mangadexUrl) {
            dLog('⚠️ MangaDex URL tidak tersedia');
            return;
        }
        
        const mangaIdMatch = mangadexUrl.match(/\/title\/([a-f0-9-]+)/);
        
        if (!mangaIdMatch) {
            console.error('❌ Tidak bisa extract MangaDex ID dari URL');
            return;
        }
        
        const mangaId = mangaIdMatch[1];
        
        // ✅ Check cache (48 hours)
        const cachedRating = localStorage.getItem(`rating_${mangaId}`);
        const cachedTime = localStorage.getItem(`rating_time_${mangaId}`);
        
        if (cachedRating && cachedTime) {
            const cacheAge = Date.now() - parseInt(cachedTime);
            const cacheAgeHours = Math.floor(cacheAge / 3600000);
            const CACHE_DURATION = 48 * 3600000;
            
            if (cacheAge < CACHE_DURATION) {
                dLog(`📦 MangaDex rating from cache: ${cachedRating} (${cacheAgeHours}h old)`);
                
                // Elements removed - rating now handled by InfoMangaRatingComments
                // document.getElementById('ratingScore')?.textContent = cachedRating;
                // document.getElementById('ratingScoreMobile')?.textContent = cachedRating;
                
                return;
            } else {
                dLog(`⏰ Rating cache expired (${cacheAgeHours}h old), fetching fresh...`);
            }
        }
        
        dLog(`📊 Fetching fresh rating for manga ID: ${mangaId}`);
        
        const apiUrl = `https://script.google.com/macros/s/AKfycbwZ0-VeyloQxjvh-h65G0wtfAzxVq6VYzU5Bz9n1Rl0T4GAkGu9X7HmGh_3_0cJhCS1iA/exec?action=getRating&mangaId=${mangaId}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.rating) {
            const roundedRating = data.rating.toFixed(1);
            
            localStorage.setItem(`rating_${mangaId}`, roundedRating);
            localStorage.setItem(`rating_time_${mangaId}`, Date.now());
            
            // Elements removed - rating now handled by InfoMangaRatingComments
            // document.getElementById('ratingScore')?.textContent = roundedRating;
            // document.getElementById('ratingScoreMobile')?.textContent = roundedRating;
            
            dLog(`⭐ Rating MangaDex: ${roundedRating}/10`);
        } else {
            throw new Error('No rating data');
        }
        
    } catch (error) {
        console.error('❌ Error fetching MangaDex rating:', error);
        
        const mangaIdMatch = mangaData.manga.links?.mangadex?.match(/\/title\/([a-f0-9-]+)/);
        if (mangaIdMatch) {
            const cachedRating = localStorage.getItem(`rating_${mangaIdMatch[1]}`);
            if (cachedRating) {
                dLog(`📦 Using old cache: ${cachedRating}`);
                // Elements removed - rating now handled by InfoMangaRatingComments
                // document.getElementById('ratingScore')?.textContent = cachedRating;
                // document.getElementById('ratingScoreMobile')?.textContent = cachedRating;
                return;
            }
        }
        
        // Elements removed - rating now handled by InfoMangaRatingComments
        // document.getElementById('ratingScore')?.textContent = '-';
        // document.getElementById('ratingScoreMobile')?.textContent = '-';
    }
}

/**
 * Setup Read First button
 */
function setupReadFirstButton() {
    const btnStartReading = document.getElementById('btnStartReading');
    
    if (!btnStartReading) {
        dWarn('⚠️ Start Reading button not found');
        return;
    }
    
    dLog('🔵 Button element found:', btnStartReading);
    
    function getFirstUnlockedChapter() {
        if (!mangaData || !mangaData.chapters) {
            console.error('❌ Manga data not loaded');
            return null;
        }
        
        const chaptersArray = Object.values(mangaData.chapters);
        
        chaptersArray.sort((a, b) => {
            const getSort = (folder) => {
                const parts = folder.split('.');
                const int = parseInt(parts[0]) || 0;
                const dec = parts[1] ? parseInt(parts[1]) : 0;
                return int + (dec / 1000);
            };
            return getSort(a.folder) - getSort(b.folder);  // ascending (awal duluan)
        });
        
        const firstUnlocked = chaptersArray.find(ch => !ch.locked);
        
        if (!firstUnlocked) {
            dWarn('⚠️ All chapters are locked');
            return null;
        }
        
        return firstUnlocked;
    }
    
    function handleReadFirstClick(e) {
        dLog('🖱️ Button clicked!', e);
        
        const firstChapter = getFirstUnlockedChapter();
        
        if (!firstChapter) {
            dLog('⚠️ No unlocked chapters found');
            showToast('Tidak ada chapter yang tersedia. Semua chapter terkunci.', 'warning', 4000);
            openTrakteer();
            return;
        }
        
        dLog('🎬 Opening first chapter:', firstChapter.folder);
        openChapter(firstChapter);
    }
    
    // Add click listener
    btnStartReading.addEventListener('click', handleReadFirstClick);
    
    // Test if button is clickable
    dLog('🔍 Button styles:', window.getComputedStyle(btnStartReading).pointerEvents);
    dLog('🔍 Button disabled:', btnStartReading.disabled);
    
    dLog('✅ Start Reading button initialized with event listener');
}

// ============================================
// UPGRADE & CODE MODAL HANDLERS (GLOBAL)
// ============================================

// Close login required modal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnCloseLoginRequired') {
        const loginRequiredModal = document.getElementById('loginRequiredModal');
        if (loginRequiredModal) loginRequiredModal.style.display = 'none';
    }
});

// Login button from login required modal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnLoginFromRequired') {
        const loginRequiredModal = document.getElementById('loginRequiredModal');
        const loginModal = document.getElementById('loginModal');
        if (loginRequiredModal) loginRequiredModal.style.display = 'none';
        if (loginModal) {
            loginModal.style.display = 'flex';
            // Switch to login tab
            const tabLogin = document.getElementById('tabLogin');
            if (tabLogin) tabLogin.click();
        }
    }
});

// Close upgrade modal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnCloseUpgrade') {
        const upgradeModal = document.getElementById('upgradeModal');
        if (upgradeModal) {
            upgradeModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
});

// Donasi button - dengan auto-refresh setelah kembali dari Trakteer
// ✅ Store previous handler to prevent memory leak
let trakteerFocusHandler = null;

document.addEventListener('click', (e) => {
    if (e.target.id === 'btnDonasi' || e.target.closest('#btnDonasi')) {
        // Open Trakteer in new tab
        window.open('https://trakteer.id/NuranantoScanlation', '_blank');
        
        // ✅ Remove previous handler if exists (prevent multiple listeners)
        if (trakteerFocusHandler) {
            window.removeEventListener('focus', trakteerFocusHandler);
        }
        
        // ✅ Auto-refresh status when window regains focus (user returns from Trakteer)
        trakteerFocusHandler = () => {
            dLog('🔄 [TRAKTEER] Window focused - checking donatur status...');
            if (window.checkDonaturStatus) {
                // Update immediately without delay
                window.checkDonaturStatus().catch(err => {
                    dWarn('Status check after Trakteer failed:', err);
                });
            }
            // Remove listener after first check
            window.removeEventListener('focus', trakteerFocusHandler);
            trakteerFocusHandler = null; // Clear reference
        };
        window.addEventListener('focus', trakteerFocusHandler);
    }
});

// Panduan button
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnPanduan') {
        const upgradeModal = document.getElementById('upgradeModal');
        const panduanModal = document.getElementById('panduanModal');
        
        if (upgradeModal) upgradeModal.style.display = 'none';
        if (panduanModal) panduanModal.style.display = 'flex';
    }
});

// Back to Upgrade button
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnBackToUpgrade') {
        const upgradeModal = document.getElementById('upgradeModal');
        const panduanModal = document.getElementById('panduanModal');
        
        if (panduanModal) panduanModal.style.display = 'none';
        if (upgradeModal) {
            upgradeModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
});

// Close upgrade modal on overlay click
document.addEventListener('click', (e) => {
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal && e.target === upgradeModal) {
        upgradeModal.style.display = 'none';
        document.body.style.overflow = '';
    }
});

// VIP Code button
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnVIPCode') {
        const upgradeModal = document.getElementById('upgradeModal');
        const codeModal = document.getElementById('codeModal');
        const inputVIPCode = document.getElementById('inputVIPCode');
        const btnPaste = document.getElementById('btnPasteCode');
        const btnRedeem = document.getElementById('btnRedeemCode');
        const errorEl = document.getElementById('codeError');
        
        if (upgradeModal) {
            upgradeModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (codeModal) {
            // Reset state
            inputVIPCode.value = '';
            errorEl.textContent = '';
            
            codeModal.style.display = 'flex';
            
            // ✅ Setup input listener untuk toggle button saat value berubah
            setupVIPCodeInputToggle();
            // ✅ Set state awal (input kosong = tampilkan Paste button)
            toggleVIPCodeButton();
        }
    }
});

// ✅ Function untuk toggle button berdasarkan value input (bisa dipanggil langsung)
function toggleVIPCodeButton() {
    const inputEl = document.getElementById('inputVIPCode');
    const btnPaste = document.getElementById('btnPasteCode');
    const btnRedeem = document.getElementById('btnRedeemCode');
    
    if (!inputEl || !btnPaste || !btnRedeem) return;
    
    const hasValue = inputEl.value.trim().length > 0;
    
    if (hasValue) {
        // Ada kode -> tampilkan Redeem, sembunyikan Paste
        btnPaste.style.display = 'none';
        btnRedeem.style.display = 'flex';
        inputEl.readOnly = false; // ✅ Biarkan user bisa edit/hapus
    } else {
        // Kosong -> tampilkan Paste, sembunyikan Redeem
        btnPaste.style.display = 'flex';
        btnRedeem.style.display = 'none';
        inputEl.readOnly = true;
    }
}

// ✅ Function untuk setup input listener
function setupVIPCodeInputToggle() {
    const inputEl = document.getElementById('inputVIPCode');
    
    if (!inputEl) return;
    
    // ✅ Hapus listener lama jika ada
    if (inputEl._toggleHandler) {
        inputEl.removeEventListener('input', inputEl._toggleHandler);
    }
    
    // ✅ Buat handler function yang memanggil toggleVIPCodeButton
    inputEl._toggleHandler = function() {
        toggleVIPCodeButton();
    };
    
    // Tambahkan listener baru
    inputEl.addEventListener('input', inputEl._toggleHandler);
}

// ✅ PASTE CODE Button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'btnPasteCode' || e.target.closest('#btnPasteCode')) {
        dLog('📋 [PASTE-BTN] Paste button clicked');
        
        const inputEl = document.getElementById('inputVIPCode');
        const btnPaste = document.getElementById('btnPasteCode');
        const btnRedeem = document.getElementById('btnRedeemCode');
        const errorEl = document.getElementById('codeError');
        
        try {
            // Read from clipboard
            const text = await navigator.clipboard.readText();
            dLog('📋 [PASTE-BTN] Clipboard text:', text);
            dLog('📋 [PASTE-BTN] Text length:', text.length);
            
            if (text && text.trim().length > 0) {
                inputEl.value = text.trim();
                // ✅ Toggle button secara manual (karena set value programmatically tidak selalu trigger input event)
                toggleVIPCodeButton();
                errorEl.textContent = '';
                dLog('✅ [PASTE-BTN] Code pasted successfully');
            } else {
                errorEl.textContent = 'Clipboard kosong';
                console.error('❌ [PASTE-BTN] Empty clipboard');
            }
        } catch (error) {
            console.error('❌ [PASTE-BTN] Error:', error);
            errorEl.textContent = 'Gagal membaca clipboard. Paste manual (Ctrl+V)';
            
            // Allow manual paste
            inputEl.readOnly = false;
            inputEl.focus();
            // ✅ Toggle button akan otomatis ter-handle oleh input listener ketika user paste manual
            // ✅ Juga panggil toggle sekarang untuk memastikan state benar
            toggleVIPCodeButton();
        }
    }
});

// ✅ REDEEM CODE - Submit VIP Code
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'formVIPCode') {
        e.preventDefault();
        dLog('🎫 [VIP-CODE] Form submitted');
        
        const inputEl = document.getElementById('inputVIPCode');
        const code = inputEl.value.trim();
        const errorEl = document.getElementById('codeError');
        const token = localStorage.getItem('authToken');
        const btnRedeem = document.getElementById('btnRedeemCode');
        
        dLog('📝 [VIP-CODE] Code:', code);
        dLog('📝 [VIP-CODE] Code length:', code.length);
        
        if (!token) {
            console.error('❌ [VIP-CODE] No token found');
            errorEl.textContent = 'Please login first';
            return;
        }
        
        if (!code) {
            console.error('❌ [VIP-CODE] Empty code');
            errorEl.textContent = 'Kode tidak boleh kosong';
            return;
        }
        
        // Disable button during request
        btnRedeem.disabled = true;
        btnRedeem.textContent = '⏳ PROCESSING...';
        
        try {
            dLog('🌐 [VIP-CODE] Sending request...');
            
            const response = await fetch('https://manga-auth-worker.nuranantoadhien.workers.dev/donatur/redeem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });
            
            dLog('📥 [VIP-CODE] Response status:', response.status);
            
            // ✅ FIX: Check response status before parsing JSON
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ [VIP-CODE] Failed to parse response:', parseError);
                errorEl.textContent = response.status === 404 ? 'Endpoint tidak ditemukan. Silakan refresh halaman.' : 'Terjadi kesalahan saat memproses response';
                return;
            }
            
            dLog('📥 [VIP-CODE] Response data:', data);
            
            // ✅ FIX: Handle both success response and error response properly
            if (!response.ok) {
                // Response status bukan 200-299
                const errorMessage = data.error || data.message || `Error ${response.status}: ${response.statusText}`;
                console.error('❌ [VIP-CODE] Failed:', errorMessage);
                errorEl.textContent = errorMessage;
                return;
            }
            
            if (data.success) {
                dLog('✅ [VIP-CODE] Success!');
                
                // ✅ CRITICAL: Update localStorage IMMEDIATELY with new status (before any async operations)
                // This prevents visual delay/flash
                if (data.expiresAt) {
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: true,
                        userId: getCurrentUserId(),
                        expiresAt: data.expiresAt,
                        timestamp: Date.now()
                    }));
                }
                
                // ✅ Update DOM IMMEDIATELY (synchronously) - no delay
                const statusBox = document.getElementById('statusBadge');
                const statusText = document.getElementById('statusText');
                const btnUpgrade = document.getElementById('btnUpgrade');
                const countdownBox = document.getElementById('countdownBox');
                const countdownText = document.getElementById('countdownText');
                
                if (statusBox) statusBox.className = 'status-box donatur-setia';
                if (statusText) statusText.textContent = 'DONATUR SETIA';
                if (btnUpgrade) btnUpgrade.style.display = 'none';
                
                // Show countdown immediately
                if (data.expiresAt && countdownBox && countdownText) {
                    try {
                        countdownBox.style.display = 'block';
                        // Update countdown text immediately
                        updateCountdown(data.expiresAt, countdownText);
                        // Start countdown interval
                        if (window.countdownInterval) {
                            clearInterval(window.countdownInterval);
                        }
                        window.countdownInterval = setInterval(() => {
                            if (validateAndUpdateExpiredStatus()) {
                                // Status expired, clear interval
                                if (window.countdownInterval) {
                                    clearInterval(window.countdownInterval);
                                    window.countdownInterval = null;
                                }
                                return;
                            }
                            // ✅ Safety check: ensure elements still exist
                            const currentCountdownText = document.getElementById('countdownText');
                            if (currentCountdownText) {
                                updateCountdown(data.expiresAt, currentCountdownText);
                            } else {
                                // Element removed, clear interval
                                if (window.countdownInterval) {
                                    clearInterval(window.countdownInterval);
                                    window.countdownInterval = null;
                                }
                            }
                        }, 1000);
                    } catch (countdownError) {
                        console.error('Error setting up countdown:', countdownError);
                        // Fallback: hide countdown if error
                        if (countdownBox) countdownBox.style.display = 'none';
                    }
                }
                
                // ✅ Refresh chapter list immediately to update locked/unlocked icons
                if (typeof displayChapters === 'function') {
                    displayChapters();
                }
                
                showToast(data.message, 'success', 4000);
                
                const codeModal = document.getElementById('codeModal');
                if (codeModal) codeModal.style.display = 'none';
                
                // ✅ Then refresh from API in background (for consistency)
                if (window.checkDonaturStatus) {
                    // Don't await - let it run in background
                    window.checkDonaturStatus().catch(err => {
                        dWarn('Background status check failed:', err);
                    });
                }
                
                // Reset
                inputEl.value = '';
                errorEl.textContent = '';
            } else {
                console.error('❌ [VIP-CODE] Failed:', data.error);
                errorEl.textContent = data.error || 'Terjadi kesalahan';
            }
        } catch (error) {
            console.error('❌ [VIP-CODE] Error:', error);
            errorEl.textContent = error.message || 'Terjadi kesalahan koneksi';
        } finally {
            // Re-enable button
            btnRedeem.disabled = false;
            btnRedeem.textContent = '⚡ REDEEM CODE';
        }
    }
});

// Back from code modal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnBackFromCode') {
        const upgradeModal = document.getElementById('upgradeModal');
        const codeModal = document.getElementById('codeModal');
        if (codeModal) codeModal.style.display = 'none';
        if (upgradeModal) {
            upgradeModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
});

// Close code modal on overlay click
document.addEventListener('click', (e) => {
    const codeModal = document.getElementById('codeModal');
    if (e.target === codeModal) {
        codeModal.style.display = 'none';
    }
});

/**
 * LOGIN MODAL - FULL DEBUG VERSION
 * Replace SELURUH bagian login modal di script.js DAN info-manga.js
 */
document.addEventListener('DOMContentLoaded', () => {
    dLog('🎬 [INIT] ========================================');
    dLog('🎬 [INIT] Login modal initialization started');
    dLog('🎬 [INIT] ========================================');
    
    const btnOpen = document.getElementById('btnOpenLogin');
    const modal = document.getElementById('loginModal');
    const profileModal = document.getElementById('profileModal');
    
    dLog('🔍 [CHECK] ========================================');
    dLog('🔍 [CHECK] Checking DOM elements...');
    dLog('🔍 [CHECK] btnOpenLogin:', btnOpen);
    dLog('🔍 [CHECK] loginModal:', modal);
    dLog('🔍 [CHECK] profileModal:', profileModal);
    dLog('🔍 [CHECK] ========================================');
    
    if (!btnOpen || !modal || !profileModal) {
        console.error('❌ [ERROR] ========================================');
        console.error('❌ [ERROR] Required elements missing!');
        console.error('❌ [ERROR] btnOpen:', !!btnOpen);
        console.error('❌ [ERROR] modal:', !!modal);
        console.error('❌ [ERROR] profileModal:', !!profileModal);
        console.error('❌ [ERROR] ========================================');
        return;
    }

    // Check if autoLogin parameter is present (from reader page)
    const urlParams = new URLSearchParams(window.location.search);
    const autoLogin = urlParams.get('autoLogin');
    if (autoLogin === 'true') {
        dLog('🔓 [AUTO-LOGIN] autoLogin parameter detected, opening login modal');
        // Wait a bit for all DOM elements to be ready
        setTimeout(() => {
            const isLoggedIn = !!localStorage.getItem('authToken');
            if (!isLoggedIn) {
                dLog('🔓 [AUTO-LOGIN] User not logged in, triggering login modal');
                btnOpen.click();
                // Remove autoLogin parameter from URL to avoid reopening on refresh
                const newUrl = new URL(window.location);
                newUrl.searchParams.delete('autoLogin');
                window.history.replaceState({}, '', newUrl);
            } else {
                dLog('🔓 [AUTO-LOGIN] User already logged in, skipping modal');
            }
        }, 300);
    }

    // ✅ Function to update profile button text
    function updateProfileButtonText() {
        const storedUser = localStorage.getItem('user');
        const isLoggedIn = !!storedUser;
        
        // Update desktop button
        const desktopButtonText = btnOpen.querySelector('.button-text');
        if (desktopButtonText) {
            desktopButtonText.textContent = isLoggedIn ? 'Profile' : 'Login';
        }
        
        // Update mobile button
        const btnOpenMobile = document.getElementById('btnOpenLoginMobile');
        if (btnOpenMobile) {
            const mobileButtonText = btnOpenMobile.querySelector('span');
            if (mobileButtonText) {
                mobileButtonText.textContent = isLoggedIn ? 'Profile' : 'Login';
            }
        }
        
        dLog('🔄 [UPDATE] Profile button updated:', isLoggedIn ? 'Profile' : 'Login');
    }
    
    // ✅ Make function globally accessible
    window.updateProfileButtonText = updateProfileButtonText;

    // ✅ STEP 1: Check localStorage on page load and update button
    dLog('📦 [STORAGE] ========================================');
    dLog('📦 [STORAGE] Checking localStorage...');
    const storedUser = localStorage.getItem('user');
    updateProfileButtonText();
    const storedToken = localStorage.getItem('authToken');
    
    dLog('📦 [STORAGE] Raw user data:', storedUser);
    dLog('📦 [STORAGE] Has token:', !!storedToken);
    
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            dLog('📦 [STORAGE] Parsed user:', parsedUser);
        } catch (e) {
            console.error('❌ [STORAGE] JSON parse error:', e);
        }
    }
    dLog('📦 [STORAGE] ========================================');

    // ✅ STEP 2: Profile button click handler
    dLog('🔧 [SETUP] Adding click handler to profile button...');
    btnOpen.addEventListener('click', async (e) => {
        // ✅ Prevent multiple clicks
        if (btnOpen.disabled) {
            dLog('⚠️ [CLICK] Button already processing, ignoring...');
            return;
        }
        
        try {
            dLog('🖱️ [CLICK] ========================================');
            dLog('🖱️ [CLICK] Profile button clicked!');
            dLog('🖱️ [CLICK] Time:', new Date().toISOString());
            
            // ✅ Temporarily disable button to prevent double-click
            btnOpen.disabled = true;
            
            const currentUser = localStorage.getItem('user');
            dLog('👤 [USER] Raw user data:', currentUser);
            
            if (currentUser) {
                try {
                    const parsedUser = JSON.parse(currentUser);
                    dLog('👤 [USER] Parsed user:', parsedUser);
                    dLog('➡️ [ACTION] Opening profile modal...');
                    
                    // ✅ Ensure modal elements exist before calling
                    const profileModal = document.getElementById('profileModal');
                    if (!profileModal) {
                        console.error('❌ [ERROR] Profile modal not found, showing login modal instead');
                        modal.style.display = 'flex';
                        document.body.style.overflow = 'hidden';
                        return;
                    }
                    
                    // 🔥 Check status BEFORE showing modal to ensure fresh data
                    dLog('🔍 [CLICK] Refreshing donatur status before showing modal...');
                    await checkDonaturStatus();
                    dLog('✅ [CLICK] Status refreshed');
                    
                    await showProfileModal(parsedUser);
                } catch (e) {
                    console.error('❌ [USER] Parse error:', e);
                    dLog('➡️ [ACTION] Opening login modal (parse error)');
                    modal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                }
            } else {
                dLog('👤 [USER] No user found');
                dLog('➡️ [ACTION] Opening login modal');
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
            dLog('🖱️ [CLICK] ========================================');
        } catch (error) {
            console.error('❌ [CLICK] Unexpected error:', error);
            // ✅ Fallback: Always show login modal if something goes wrong
            try {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } catch (fallbackError) {
                console.error('❌ [CLICK] Fallback error:', fallbackError);
            }
        } finally {
            // ✅ Re-enable button after a short delay
            setTimeout(() => {
                btnOpen.disabled = false;
            }, 300);
        }
    });
    dLog('🔧 [SETUP] Click handler added!');

    // ✅ STEP 3: Login modal overlay click
    dLog('🔧 [SETUP] Adding click handler to login modal...');
    modal.addEventListener('click', (e) => {
        dLog('🖱️ [LOGIN-CLICK] ========================================');
        dLog('🖱️ [LOGIN-CLICK] Login modal clicked');
        dLog('🖱️ [LOGIN-CLICK] Target:', e.target);
        dLog('🖱️ [LOGIN-CLICK] Target ID:', e.target.id);
        dLog('🖱️ [LOGIN-CLICK] Target tagName:', e.target.tagName);
        
        if (e.target.id === 'loginModal') {
            dLog('✅ [OVERLAY] Overlay clicked - closing');
            modal.style.display = 'none';
            document.body.style.overflow = '';
            dLog('✅ [OVERLAY] Login modal closed');
        } else {
            dLog('⚠️ [OVERLAY] Content clicked - ignoring');
        }
        dLog('🖱️ [LOGIN-CLICK] ========================================');
    });
    
    // ✅ STEP 4: Login Required modal overlay click
    const loginRequiredModal = document.getElementById('loginRequiredModal');
    if (loginRequiredModal) {
        loginRequiredModal.addEventListener('click', (e) => {
            if (e.target.id === 'loginRequiredModal') {
                loginRequiredModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }
    dLog('🔧 [SETUP] Login modal click handler added!');
    
    // ✅ Monitor profile modal untuk trigger re-check saat ditutup
    if (profileModal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isHidden = profileModal.style.display === 'none';
                    if (isHidden) {
                        // Profile modal ditutup, trigger re-check untuk comment section
                        dLog('🔄 [PROFILE-MODAL] Modal closed, triggering refresh');
                        setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('profileModalClosed'));
                        }, 100);
                    }
                }
            });
        });
        
        observer.observe(profileModal, {
            attributes: true,
            attributeFilter: ['style']
        });
        dLog('👁️ [PROFILE-MODAL] MutationObserver attached');
    }

    // ✅ STEP 4: Show Profile Modal Function
    async function showProfileModal(user) {
        try {
            dLog('🎭 [PROFILE] ========================================');
            dLog('🎭 [PROFILE] showProfileModal called');
            dLog('🎭 [PROFILE] User object:', user);
            dLog('🎭 [PROFILE] User username:', user?.username);
            dLog('🎭 [PROFILE] Time:', new Date().toISOString());
            
            const loginModal = document.getElementById('loginModal');
            let profileModal = document.getElementById('profileModal');
            
            // ✅ Validate elements exist
            if (!profileModal) {
                console.error('❌ [PROFILE] Profile modal not found!');
                // Fallback to login modal
                if (loginModal) {
                    loginModal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                }
                return;
            }
            
            dLog('📍 [PROFILE] Elements:');
            dLog('📍 [PROFILE] - loginModal:', loginModal);
            dLog('📍 [PROFILE] - profileModal:', profileModal);
            
            // Close login modal
            dLog('❌ [PROFILE] Closing login modal...');
            if (loginModal) loginModal.style.display = 'none';
            dLog('❌ [PROFILE] Login modal closed');
            
            // ✅ CRITICAL: Show modal FIRST (before any async operations) to prevent delay
            // This ensures the profile button doesn't show old state
            profileModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            dLog('✅ [PROFILE] Modal shown IMMEDIATELY (before clone/update)');
            
            // Clone profile modal to remove old listeners
            dLog('🔄 [PROFILE] Cloning profile modal...');
            const newProfileModal = profileModal.cloneNode(true);
            dLog('🔄 [PROFILE] Profile modal cloned');
            
            dLog('🔄 [PROFILE] Replacing in DOM...');
            profileModal.parentNode.replaceChild(newProfileModal, profileModal);
            profileModal = newProfileModal;
            // ✅ Ensure modal stays visible after clone
            profileModal.style.display = 'flex';
            dLog('🔄 [PROFILE] Profile modal replaced and kept visible');
            
            // Update username
            dLog('📝 [PROFILE] Updating username...');
            const usernameEl = profileModal.querySelector('#profileUsername');
            dLog('📝 [PROFILE] Username element:', usernameEl);
            
            if (usernameEl && user && user.username) {
                usernameEl.textContent = user.username;
                dLog('✅ [PROFILE] Username updated to:', user.username);
            } else {
                console.error('❌ [PROFILE] Username element not found or user data invalid!');
            }
            
            // 🔥 NOTE: Status checking is now handled BEFORE showProfileModal is called
            // No need to call checkDonaturStatus here to avoid double-call race condition
            // The status is already fresh from the login handler or caller
            
            // ✅ Setelah status ready, pastikan content opacity 1
            const profileContent = profileModal.querySelector('.profile-content');
            if (profileContent) {
                profileContent.style.removeProperty('opacity');
                profileContent.style.opacity = '1';
            }
            
            // ✅ CRITICAL: Profile modal overlay click
            dLog('🔧 [PROFILE] Adding overlay click handler...');
            profileModal.addEventListener('click', (e) => {
            dLog('🖱️ [PROFILE-CLICK] ========================================');
            dLog('🖱️ [PROFILE-CLICK] Profile modal clicked!');
            dLog('🖱️ [PROFILE-CLICK] Event target:', e.target);
            dLog('🖱️ [PROFILE-CLICK] Event target ID:', e.target.id);
            dLog('🖱️ [PROFILE-CLICK] Event target class:', e.target.className);
            dLog('🖱️ [PROFILE-CLICK] Event target tagName:', e.target.tagName);
            dLog('🖱️ [PROFILE-CLICK] profileModal:', profileModal);
            dLog('🖱️ [PROFILE-CLICK] Target === profileModal?', e.target === profileModal);
            dLog('🖱️ [PROFILE-CLICK] Target ID === "profileModal"?', e.target.id === 'profileModal');
            
            if (e.target === profileModal) {
                dLog('✅ [PROFILE-CLOSE] ===== OVERLAY CLICKED =====');
                dLog('✅ [PROFILE-CLOSE] Closing profile modal...');
                profileModal.style.display = 'none';
                dLog('✅ [PROFILE-CLOSE] Profile modal display:', profileModal.style.display);
                document.body.style.overflow = '';
                // Clear countdown interval when modal closes
                if (window.countdownInterval) {
                    clearInterval(window.countdownInterval);
                    window.countdownInterval = null;
                }
                dLog('✅ [PROFILE-CLOSE] Body overflow reset');
                dLog('✅ [PROFILE-CLOSE] DONE - NO LOGIN MODAL OPENED!');
                dLog('✅ [PROFILE-CLOSE] ===========================');
            } else {
                dLog('⚠️ [PROFILE-CLICK] Not overlay - ignoring click');
                dLog('⚠️ [PROFILE-CLICK] Clicked element:', e.target);
            }
            dLog('🖱️ [PROFILE-CLICK] ========================================');
        });
        dLog('🔧 [PROFILE] Overlay click handler added!');
        
        // Logout button
        const btnLogout = profileModal.querySelector('#btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                dLog('🚪 [LOGOUT] Logout button clicked!');
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                localStorage.removeItem('userDonaturStatus'); // 🔥 Clear donatur status cache
                
                // 🔥 FORCE UPDATE DOM TO PEMBACA SETIA immediately
                const statusBox = document.getElementById('statusBadge');
                const statusText = document.getElementById('statusText');
                const btnUpgrade = document.getElementById('btnUpgrade');
                const countdownBox = document.getElementById('countdownBox');
                
                if (statusBox) statusBox.className = 'status-box pembaca-setia';
                if (statusText) statusText.textContent = 'PEMBACA SETIA';
                if (btnUpgrade) btnUpgrade.style.display = 'block';
                if (countdownBox) countdownBox.style.display = 'none';
                
                dLog('📢 [LOGOUT] DOM status updated to PEMBACA SETIA');
                
                // 🔥 Reset profile photo and username to default (prevent cross-account data sticking)
                const profileAvatar = document.querySelector('.profile-avatar');
                const profileUsername = document.getElementById('profileUsername');
                
                if (profileAvatar) {
                    profileAvatar.src = 'assets/Logo 2.png';
                    dLog('🖼️ [LOGOUT] Profile avatar reset to default');
                }
                if (profileUsername) {
                    profileUsername.textContent = 'Username';
                    dLog('📝 [LOGOUT] Profile username reset to default');
                }
                
                // ✅ Dispatch custom event untuk notify rating/comments section
                window.dispatchEvent(new CustomEvent('userLoggedOut'));
                dLog('📢 [LOGOUT] Dispatched userLoggedOut event');
                
                // ✅ Update profile button text
                if (window.updateProfileButtonText) {
                    window.updateProfileButtonText();
                }
                
                // Clear countdown interval on logout
                if (window.countdownInterval) {
                    clearInterval(window.countdownInterval);
                    window.countdownInterval = null;
                }
                
                profileModal.style.display = 'none';
                loginModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                
                // Reset login button state
                const loginForm = document.querySelector('#panelLogin form');
                if (loginForm) {
                    const loginButton = loginForm.querySelector('button[type="submit"]');
                    if (loginButton) {
                        loginButton.disabled = false;
                        loginButton.textContent = 'Login';
                    }
                }
                
                // Show success message in login modal
                setTimeout(() => {
                    showFormMessage('loginMessage', '✅ Berhasil logout', 'success', 3000);
                }, 100);
            });
        }
        
        // ✅ Upgrade button handler
        const btnUpgrade = profileModal.querySelector('#btnUpgrade');
        const upgradeModal = document.getElementById('upgradeModal');
        
        if (btnUpgrade && upgradeModal) {
            btnUpgrade.addEventListener('click', () => {
                dLog('💎 [UPGRADE] Upgrade button clicked');
                profileModal.style.display = 'none';
                upgradeModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            });
        }

        // ✅ Load profile data from database (IMPORTANT: Load fresh data first!)
        if (typeof window.loadProfileData === 'function') {
            dLog('🔄 [PROFILE] Loading profile data from database...');
            window.loadProfileData();
            dLog('✅ [PROFILE] Profile data load initiated');
        } else {
            dLog('⚠️ [PROFILE] loadProfileData not found');
        }

        // ✅ Check edit eligibility (check rate limits)
        if (typeof window.checkEditEligibility === 'function') {
            dLog('🔍 [PROFILE] Checking edit eligibility...');
            window.checkEditEligibility();
            dLog('✅ [PROFILE] Edit eligibility check initiated');
        } else {
            dLog('⚠️ [PROFILE] checkEditEligibility not found');
        }

        // ✅ Initialize Edit Profile functionality (after modal clone)
        if (window.initEditProfile) {
            dLog('🔧 [PROFILE] Initializing edit profile...');
            dLog('🔍 [PROFILE] Checking imageCompression library...');
            dLog('   - typeof imageCompression:', typeof imageCompression);
            
            // Wait for imageCompression library to load
            if (typeof imageCompression !== 'undefined') {
                dLog('✅ [PROFILE] imageCompression available');
                window.initEditProfile();
                dLog('✅ [PROFILE] Edit profile initialized');
            } else {
                dLog('⚠️ [PROFILE] imageCompression not loaded yet, waiting...');
                let retryCount = 0;
                const maxRetries = 30; // 30 retries x 500ms = 15 seconds
                const checkInterval = setInterval(() => {
                    retryCount++;
                    dLog(`🔄 [PROFILE] Retry ${retryCount}/${maxRetries} - checking imageCompression...`);
                    
                    if (typeof imageCompression !== 'undefined') {
                        dLog('✅ [PROFILE] imageCompression now available!');
                        clearInterval(checkInterval);
                        window.initEditProfile();
                        dLog('✅ [PROFILE] Edit profile initialized (delayed)');
                    } else if (retryCount >= maxRetries) {
                        console.error(`❌ [PROFILE] imageCompression failed to load after ${maxRetries} retries (${maxRetries * 0.5}s)`);
                        console.error('❌ [PROFILE] Please check console for CDN loader errors');
                        console.error('💡 [PROFILE] Try refreshing the page or check your internet connection');
                        clearInterval(checkInterval);
                    }
                }, 500);
            }
        } else {
            dLog('⚠️ [PROFILE] initEditProfile not found');
        }
        
        dLog('🎭 [PROFILE] ========================================');
        } catch (error) {
            console.error('❌ [PROFILE] Error in showProfileModal:', error);
            // ✅ Fallback: Show login modal if profile modal fails
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        }
    }

    // 🆕 Helper function to get current user ID
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

    // ✅ STEP 5: Check DONATUR Status
    // ✅ Export function untuk digunakan di tempat lain
    window.checkDonaturStatus = async function checkDonaturStatus() {
        // ✅ VALIDATE CACHE FIRST - Check if cached status is expired
        validateAndUpdateExpiredStatus();
        
        const token = localStorage.getItem('authToken');
        const currentUserId = getCurrentUserId();
        
        // 🆕 VALIDATE USER ID - Clear cache if it belongs to a different user
        const cachedStatus = localStorage.getItem('userDonaturStatus');
        if (cachedStatus && currentUserId) {
            try {
                const parsed = JSON.parse(cachedStatus);
                if (parsed.userId && parsed.userId !== currentUserId) {
                    dLog('⚠️ [CACHE] Cached status belongs to different user, clearing');
                    localStorage.removeItem('userDonaturStatus');
                }
            } catch (e) {
                // Invalid cache, remove it
                localStorage.removeItem('userDonaturStatus');
            }
        }
        if (!token) {
            // ✅ Jika tidak ada token, set status sebagai PEMBACA SETIA di localStorage
            const statusBox = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const btnUpgrade = document.getElementById('btnUpgrade');
            const countdownBox = document.getElementById('countdownBox');
            
            if (statusBox && statusText) {
                statusBox.className = 'status-box pembaca-setia';
                statusText.textContent = 'PEMBACA SETIA';
            }
            if (btnUpgrade) btnUpgrade.style.display = 'block';
            if (countdownBox) countdownBox.style.display = 'none';
            
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: false,
                userId: currentUserId,
                timestamp: Date.now()
            }));
            return;
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
            
            const statusBox = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const btnUpgrade = document.getElementById('btnUpgrade');
            const countdownBox = document.getElementById('countdownBox');
            const countdownText = document.getElementById('countdownText');
            
            if (data.success && data.isDonatur) {
                // ✅ Cek apakah expiresAt sudah lewat
                const now = new Date();
                const expiry = data.expiresAt ? new Date(data.expiresAt) : null;
                const isExpired = expiry && expiry <= now;
                
                if (isExpired) {
                    // ✅ Status sudah berakhir - kembalikan ke PEMBACA SETIA
                    if (statusBox) statusBox.className = 'status-box pembaca-setia';
                    if (statusText) statusText.textContent = 'PEMBACA SETIA';
                    
                    if (btnUpgrade) btnUpgrade.style.display = 'block';
                    
                    // Sembunyikan countdown box
                    if (countdownBox) countdownBox.style.display = 'none';
                    if (window.countdownInterval) {
                        clearInterval(window.countdownInterval);
                        window.countdownInterval = null;
                    }
                    
                    // ✅ Store status in localStorage FIRST (sebelum update DOM) untuk menghindari flash
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: false,
                        userId: currentUserId,
                        timestamp: Date.now()
                    }));
                } else {
                    // ✅ DONATUR AKTIF - LANGSUNG UPDATE (TANPA FADE)
                    if (statusBox) statusBox.className = 'status-box donatur-setia';
                    if (statusText) statusText.textContent = 'DONATUR SETIA';
                    
                    if (btnUpgrade) btnUpgrade.style.display = 'none';
                    
                    // ✅ Tampilkan countdown jika ada expiresAt
                    if (data.expiresAt && countdownBox && countdownText) {
                        countdownBox.style.display = 'block';
                        updateCountdown(data.expiresAt, countdownText);
                        // Update countdown setiap detik
                        if (window.countdownInterval) {
                            clearInterval(window.countdownInterval);
                        }
                        window.countdownInterval = setInterval(() => {
                            // ✅ Validate expired status every time countdown updates
                            if (validateAndUpdateExpiredStatus()) {
                                // Status expired, stop countdown
                                return;
                            }
                            updateCountdown(data.expiresAt, countdownText);
                        }, 1000);
                    } else if (countdownBox) {
                        countdownBox.style.display = 'none';
                    }
                    
                    // ✅ Store status in localStorage FIRST (sebelum update DOM) untuk menghindari flash
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: true,
                        userId: currentUserId,
                        expiresAt: data.expiresAt,
                        timestamp: Date.now()
                    }));
                }
                
            } else {
                // ❌ NON-DONATUR - LANGSUNG UPDATE (TANPA FADE)
                if (statusBox) statusBox.className = 'status-box pembaca-setia';
                if (statusText) statusText.textContent = 'PEMBACA SETIA';
                
                if (btnUpgrade) btnUpgrade.style.display = 'block';
                
                // ✅ Sembunyikan countdown untuk non-donatur
                if (countdownBox) countdownBox.style.display = 'none';
                if (window.countdownInterval) {
                    clearInterval(window.countdownInterval);
                    window.countdownInterval = null;
                }
                
                // ✅ Store status in localStorage FIRST (sebelum update DOM) untuk menghindari flash
                localStorage.setItem('userDonaturStatus', JSON.stringify({
                    isDonatur: false,
                    userId: currentUserId,
                    timestamp: Date.now()
                }));
            }
            
            // ✅ Refresh chapter list setelah status berubah untuk update icon locked/unlocked
            if (typeof displayChapters === 'function') {
                displayChapters();
            }
        } catch (error) {
            // ✅ Handle network errors gracefully - use localStorage as fallback
            if (error.name === 'AbortError') {
                dWarn('Donatur status check timeout - using cached status');
            } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                dWarn('Network error - using cached donatur status from localStorage');
            } else {
                console.error('Donatur check error:', error);
            }
            
            // ✅ Fallback to localStorage if available
            try {
                const cachedStatus = localStorage.getItem('userDonaturStatus');
                if (cachedStatus) {
                    const parsed = JSON.parse(cachedStatus);
                    const statusBox = document.getElementById('statusBadge');
                    const statusText = document.getElementById('statusText');
                    const btnUpgrade = document.getElementById('btnUpgrade');
                    const countdownBox = document.getElementById('countdownBox');
                    const countdownText = document.getElementById('countdownText');
                    
                    if (parsed.isDonatur && parsed.expiresAt) {
                        // ✅ Cek apakah expiresAt sudah lewat
                        const now = new Date();
                        const expiry = new Date(parsed.expiresAt);
                        const isExpired = expiry <= now;
                        
                        if (isExpired) {
                            // Status sudah berakhir
                            if (statusBox) statusBox.className = 'status-box pembaca-setia';
                            if (statusText) statusText.textContent = 'PEMBACA SETIA';
                            if (btnUpgrade) btnUpgrade.style.display = 'block';
                            if (countdownBox) countdownBox.style.display = 'none';
                            if (window.countdownInterval) {
                                clearInterval(window.countdownInterval);
                                window.countdownInterval = null;
                            }
                        } else {
                            // Status masih aktif
                            if (statusBox) statusBox.className = 'status-box donatur-setia';
                            if (statusText) statusText.textContent = 'DONATUR SETIA';
                            if (btnUpgrade) btnUpgrade.style.display = 'none';
                            if (countdownBox && countdownText) {
                                countdownBox.style.display = 'block';
                                updateCountdown(parsed.expiresAt, countdownText);
                                if (window.countdownInterval) {
                                    clearInterval(window.countdownInterval);
                                }
                                window.countdownInterval = setInterval(() => {
                                    // ✅ Validate expired status every time countdown updates
                                    if (validateAndUpdateExpiredStatus()) {
                                        // Status expired, stop countdown
                                        return;
                                    }
                                    updateCountdown(parsed.expiresAt, countdownText);
                                }, 1000);
                            }
                        }
                    } else {
                        // Non-donatur
                        if (statusBox) statusBox.className = 'status-box pembaca-setia';
                        if (statusText) statusText.textContent = 'PEMBACA SETIA';
                        if (btnUpgrade) btnUpgrade.style.display = 'block';
                        if (countdownBox) countdownBox.style.display = 'none';
                        if (window.countdownInterval) {
                            clearInterval(window.countdownInterval);
                            window.countdownInterval = null;
                        }
                    }
                } else {
                    // No cached status - default to PEMBACA SETIA
                    const statusBox = document.getElementById('statusBadge');
                    const statusText = document.getElementById('statusText');
                    const btnUpgrade = document.getElementById('btnUpgrade');
                    const countdownBox = document.getElementById('countdownBox');
                    
                    if (statusBox && statusText) {
                        statusBox.className = 'status-box pembaca-setia';
                        statusText.textContent = 'PEMBACA SETIA';
                    }
                    if (btnUpgrade) btnUpgrade.style.display = 'block';
                    if (countdownBox) countdownBox.style.display = 'none';
                    
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: false,
                        userId: getCurrentUserId(),
                        timestamp: Date.now()
                    }));
                }
            } catch (fallbackError) {
                console.error('Fallback error:', fallbackError);
            }
        }
    };
    
    // ✅ Function to validate and update expired status
    function validateAndUpdateExpiredStatus() {
        const cachedStatus = localStorage.getItem('userDonaturStatus');
        if (!cachedStatus) return false;
        
        try {
            const parsed = JSON.parse(cachedStatus);
            
            // ✅ Cek jika status donatur dan ada expiresAt
            if (parsed.isDonatur && parsed.expiresAt) {
                const now = new Date();
                const expiry = new Date(parsed.expiresAt);
                const isExpired = expiry <= now;
                
                if (isExpired) {
                    // ✅ Status sudah berakhir - update cache dan DOM
                    const statusBox = document.getElementById('statusBadge');
                    const statusText = document.getElementById('statusText');
                    const btnUpgrade = document.getElementById('btnUpgrade');
                    const countdownBox = document.getElementById('countdownBox');
                    
                    // Update DOM
                    if (statusBox) statusBox.className = 'status-box pembaca-setia';
                    if (statusText) statusText.textContent = 'PEMBACA SETIA';
                    if (btnUpgrade) btnUpgrade.style.display = 'block';
                    if (countdownBox) countdownBox.style.display = 'none';
                    
                    // Clear interval
                    if (window.countdownInterval) {
                        clearInterval(window.countdownInterval);
                        window.countdownInterval = null;
                    }
                    
                    // ✅ Update localStorage - INVALIDATE CACHE
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: false,
                        userId: getCurrentUserId(),
                        timestamp: Date.now()
                    }));
                    
                    return true; // Status was expired and updated
                }
            }
        } catch (error) {
            console.error('Error validating cached status:', error);
        }
        
        return false; // Status is still valid or not donatur
    }

    // ✅ Function to update countdown timer
    function updateCountdown(expiresAt, countdownTextElement) {
        if (!expiresAt || !countdownTextElement) return;
        
        try {
            const now = new Date();
            const expiry = new Date(expiresAt);
            
            // ✅ Validate date
            if (isNaN(expiry.getTime())) {
                console.error('Invalid expiresAt date:', expiresAt);
                return;
            }
            
            const diff = expiry - now;
        
        if (diff <= 0) {
            // ✅ Status sudah berakhir - kembalikan ke PEMBACA SETIA
            const statusBox = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const btnUpgrade = document.getElementById('btnUpgrade');
            const countdownBox = document.getElementById('countdownBox');
            
            // Update status ke PEMBACA SETIA
            if (statusBox) statusBox.className = 'status-box pembaca-setia';
            if (statusText) statusText.textContent = 'PEMBACA SETIA';
            
            // Tampilkan tombol upgrade
            if (btnUpgrade) btnUpgrade.style.display = 'block';
            
            // Sembunyikan countdown box
            if (countdownBox) countdownBox.style.display = 'none';
            
            // Clear interval
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
            
            // Update localStorage
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: false,
                userId: getCurrentUserId(),
                timestamp: Date.now()
            }));
            
            return;
        }
        
        // Format tanggal Indonesia
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
            hour12: false
        };
        
            const formattedDate = expiry.toLocaleDateString('id-ID', options);
            const timeStr = formattedDate.split('pukul')[1]?.trim() || '';
            const dateStr = formattedDate.split('pukul')[0].trim();
            
            countdownTextElement.textContent = `Hingga ${dateStr}, pukul ${timeStr} WIB`;
        } catch (error) {
            console.error('Error updating countdown:', error);
            // Hide countdown on error
            const countdownBox = document.getElementById('countdownBox');
            if (countdownBox) countdownBox.style.display = 'none';
        }
    }
    
    // ✅ Also define locally for backward compatibility
    const checkDonaturStatus = window.checkDonaturStatus;

// ============================================
// ✅ READING HISTORY FUNCTIONS
// ============================================
let historyCache = null;
let historyCacheTime = 0;
const HISTORY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * ✅ Fetch reading history from API with limit
 */
async function fetchReadingHistory(limit = 3, skipCache = false) {
  const now = Date.now();
  
  // ✅ Cache per limit (3 vs all)
  const cacheKey = `history_${limit}`;
  
  // Return cached data if fresh (unless skipCache is true)
  if (!skipCache && historyCache?.[cacheKey] && (now - historyCacheTime) < HISTORY_CACHE_DURATION) {
    dLog(`📦 [HISTORY] Using cached data (limit=${limit})`);
    return historyCache[cacheKey];
  }
  
  const token = localStorage.getItem('authToken');
  if (!token) return { history: [], total: 0, showing: 0 };
  
  const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
  
  try {
    dLog(`🌐 [HISTORY] Fetching from API (limit=${limit}, skipCache=${skipCache})...`);
    // Add timestamp to prevent browser cache
    const response = await fetch(`${API_URL}/reading/history?limit=${limit}&_t=${now}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Initialize cache object if needed
      if (!historyCache) historyCache = {};
      
      historyCache[cacheKey] = data;
      historyCacheTime = now;
      dLog('✅ [HISTORY] Fetched:', data.showing, 'of', data.total, 'items');
      return data;
    }
    
    return { history: [], total: 0, showing: 0 };
  } catch (error) {
    console.error('[HISTORY] Fetch error:', error);
    return { history: [], total: 0, showing: 0 };
  }
}

/**
 * ✅ Format relative time
 */
function formatRelativeTime(isoString) {
  if (!isoString) return 'Tidak diketahui';
  
  // ✅ Parse waktu dari database
  let date;
  
  if (isoString.includes('T') && (isoString.includes('Z') || isoString.includes('+'))) {
    // ISO format dengan timezone (dari backend yang sudah diperbaiki)
    date = new Date(isoString);
  } else if (isoString.includes('T')) {
    // ISO format tanpa timezone - assume UTC
    date = new Date(isoString + 'Z');
  } else if (isoString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    // SQLite datetime format (YYYY-MM-DD HH:MM:SS) - assume UTC
    // Convert to ISO format first
    const isoFormat = isoString.replace(' ', 'T') + 'Z';
    date = new Date(isoFormat);
  } else {
    // Try parsing as-is
    date = new Date(isoString);
  }
  
  // ✅ Validate date
  if (isNaN(date.getTime())) {
    dWarn('Invalid date format:', isoString);
    return 'Tidak diketahui';
  }
  
  const now = new Date();
  const diffMs = now - date;
  
  // ✅ Handle negative difference (future time) - should not happen but just in case
  if (diffMs < 0) {
    return 'Baru saja';
  }
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  
  // ✅ Format tanggal dengan timezone lokal Indonesia
  return date.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
}

/**
 * ✅ Get manga cover from manga-config.js
 */
function getMangaCover(mangaId) {
  // ✅ Try to get from MANGA_REPOS (from manga-config.js)
  if (typeof MANGA_REPOS !== 'undefined' && MANGA_REPOS[mangaId]) {
    const mangaConfig = MANGA_REPOS[mangaId];
    // If it's an object with cover property, use it
    if (typeof mangaConfig === 'object' && mangaConfig.cover) {
      return mangaConfig.cover;
    }
  }
  
  // ✅ Try to get from mangaList (from manga-config.js) - fallback
  if (typeof mangaList !== 'undefined' && mangaList) {
    const manga = mangaList.find(m => m.id === mangaId);
    if (manga) return manga.cover;
  }
  
  // ✅ Fallback to logo
  return 'assets/Logo 2.png';
}

/**
 * ✅ Render history list
 */
function renderHistoryList(history) {
  const listEl = document.getElementById('historyList');
  
  if (!history || history.length === 0) {
    return;
  }
  
  listEl.innerHTML = history.map(item => {
    const cover = getMangaCover(item.manga_id);
    const chapterNum = item.chapter_id.replace(/^ch\.?/i, '');
    const timeAgo = formatRelativeTime(item.read_at);
    
    // ✅ Security: Escape all dynamic data
    const safeMangaId = escapeHTML(item.manga_id);
    const safeChapterId = escapeHTML(item.chapter_id);
    const safeMangaTitle = escapeHTML(item.manga_title);
    const safeCover = escapeHTML(cover);
    const safeChapterNum = escapeHTML(chapterNum);
    const safeTimeAgo = escapeHTML(timeAgo);
    
    return `
      <div class="history-card" 
           data-manga-id="${safeMangaId}" 
           data-chapter="${safeChapterId}"
           tabindex="0"
           role="button">
        <img src="${safeCover}" 
             alt="${safeMangaTitle} cover" 
             class="history-cover"
             loading="lazy"
             data-original="${safeCover}"
             onerror="this.onerror=null; this.src='assets/Logo 2.png';">
        <div class="history-info">
          <div class="history-manga-title">${safeMangaTitle}</div>
          <div class="history-chapter">Chapter ${safeChapterNum}</div>
          <div class="history-time">${safeTimeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  listEl.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const mangaId = card.getAttribute('data-manga-id');
      const chapterId = card.getAttribute('data-chapter');
      // ✅ Security: Validate parameters before redirect
      if (validateRepoParam(mangaId) && validateChapterParam(chapterId)) {
        window.location.href = `reader.html?repo=${encodeURIComponent(mangaId)}&chapter=${encodeURIComponent(chapterId)}`;
      }
    });
    
    // Keyboard support
    card.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

/**
 * ✅ Show history modal with expand/collapse toggle
 */
let currentHistoryLimit = 3; // Track current state

async function showHistoryModal(expandAll = false) {
  dLog('📖 [HISTORY] Opening modal...', expandAll ? '(expand all)' : '(show 3)');
  
  const historyModal = document.getElementById('historyModal');
  const historyLoading = document.getElementById('historyLoading');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const historyTitle = historyModal.querySelector('.history-title');
  const btnCloseHistory = document.getElementById('btnCloseHistory');
  
  // ✅ Determine limit
  const limit = expandAll ? 0 : 3; // 0 = fetch all
  currentHistoryLimit = limit;
  
  dLog('🔢 [HISTORY] Using limit:', limit);
  
  // Show modal with loading
  historyModal.style.display = 'flex';
  historyLoading.style.display = 'block';
  historyList.style.display = 'none';
  historyEmpty.style.display = 'none';
  
  // ✅ Lock body scroll when modal is open
  document.body.style.overflow = 'hidden';
  
  // Fetch history (skip cache when toggling)
  const data = await fetchReadingHistory(limit, true);
  const { history, total, showing } = data;
  
  // Hide loading
  historyLoading.style.display = 'none';
  
  if (history.length === 0) {
    historyEmpty.style.display = 'block';
    if (historyTitle) {
      historyTitle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        History Baca
      `;
    }
  } else {
    historyList.style.display = 'flex';
    renderHistoryList(history);
    
    // ✅ Update title with count
    if (historyTitle) {
      historyTitle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        History Baca (${showing}${total > showing ? `/${total}` : ''})
      `;
    }
    
    // ✅ Add/Update toggle button
    let btnToggle = historyModal.querySelector('#btnToggleHistory');
    
    if (!btnToggle && btnCloseHistory) {
      btnToggle = document.createElement('button');
      btnToggle.id = 'btnToggleHistory';
      btnToggle.className = 'btn-toggle-history';
      btnCloseHistory.parentNode.insertBefore(btnToggle, btnCloseHistory);
    }
    
    // ✅ Update button text based on state
    if (total > 3 && btnToggle) {
      btnToggle.style.display = 'block';
      
      if (expandAll) {
        // Show "collapse" button
        btnToggle.innerHTML = `TAMPILKAN 3 TERAKHIR`;
        btnToggle.onclick = () => showHistoryModal(false);
      } else {
        // Show "expand" button
        btnToggle.innerHTML = `TAMPILKAN SEMUA (${total})`;
        btnToggle.onclick = () => showHistoryModal(true);
      }
    } else {
      // Hide toggle if total <= 3
      if (btnToggle) btnToggle.style.display = 'none';
    }
  }
}

/**
 * ✅ History button click handler
 */
document.addEventListener('click', (e) => {
  if (e.target.id === 'btnHistory' || e.target.closest('#btnHistory')) {
    dLog('🖱️ [HISTORY] Button clicked');
    
    const profileModal = document.getElementById('profileModal');
    if (profileModal) profileModal.style.display = 'none';
    
    showHistoryModal(false); // Start with 3 items
  }
});

/**
 * ✅ Close history modal helper function
 */
function closeHistoryModal() {
  const historyModal = document.getElementById('historyModal');
  if (historyModal) {
    historyModal.style.display = 'none';
    // ✅ Restore body scroll when modal is closed
    document.body.style.overflow = '';
    dLog('✅ [HISTORY] Modal closed, scroll restored');
  }
}

/**
 * ✅ Close history modal
 */
document.addEventListener('click', (e) => {
  const historyModal = document.getElementById('historyModal');
  
  // Close on overlay click
  if (e.target.id === 'historyModal') {
    closeHistoryModal();
  }
  
  // Close on button click
  if (e.target.id === 'btnCloseHistory') {
    closeHistoryModal();
  }
});

// ✅ Close history modal on Escape key
document.addEventListener('keydown', (e) => {
  const historyModal = document.getElementById('historyModal');
  if (historyModal && historyModal.style.display === 'flex' && e.key === 'Escape') {
    closeHistoryModal();
  }
});

// ✅ Don't auto-show profile modal - only show when user clicks profile button
dLog('ℹ️ [INIT] Profile modal ready - waiting for user click');

    // ✅ STEP 6: Check donatur status immediately on page load (without waiting for profile button click)
    // ✅ Validate cache first
    validateAndUpdateExpiredStatus();
    dLog('🔍 [INIT] Checking donatur status on page load...');
    checkDonaturStatus().then(() => {
        dLog('✅ [INIT] Donatur status checked, chapter list will reflect correct lock icons');
    });
    
    // ✅ Set up periodic validation (every 10 seconds) to check for expired status
    setInterval(() => {
        validateAndUpdateExpiredStatus();
    }, 10000); // Check every 10 seconds
    
    // ✅ Validate when page becomes visible (user switches back to tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            dLog('👁️ [VISIBILITY] Page visible - validating expired status and refreshing');
            // ✅ Update expired status immediately
            validateAndUpdateExpiredStatus();
            // ✅ Refresh status from API immediately (no delay) if user is logged in
            const token = localStorage.getItem('authToken');
            if (token && window.checkDonaturStatus) {
                window.checkDonaturStatus().catch(err => {
                    dWarn('Status check on visibility change failed:', err);
                });
            }
        }
    });
    
    // ✅ Validate when window gains focus (user clicks back to browser)
    window.addEventListener('focus', () => {
        dLog('🎯 [FOCUS] Window focused - validating expired status and refreshing');
        // ✅ Update expired status immediately
        validateAndUpdateExpiredStatus();
        // ✅ Refresh status from API immediately (no delay) if user is logged in
        const token = localStorage.getItem('authToken');
        if (token && window.checkDonaturStatus) {
            window.checkDonaturStatus().catch(err => {
                dWarn('Status check on focus failed:', err);
            });
        }
    });

    // ✅ STEP 7: Login/Register forms
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';

    dLog('🔧 [SETUP] Adding form handlers...');

    // 🆕 PASSWORD STRENGTH CHECKER
    // Requirement: Minimum 8 characters + 2 out of 4 criteria (uppercase, lowercase, number, special)
    function checkPasswordStrength(password) {
        const strength = {
            score: 0,
            criteriaScore: 0, // Score for the 4 criteria (not including length)
            level: 'weak',
            message: '',
            hints: [],
            meetsMinLength: false
        };
        
        // Check minimum length (mandatory)
        if (password.length >= 8) {
            strength.meetsMinLength = true;
        } else {
            strength.hints.push('⚠️ Minimal 8 karakter (WAJIB)');
        }
        
        // Check 4 criteria
        if (/[A-Z]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan huruf besar (A-Z)');
        }
        
        if (/[a-z]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan huruf kecil (a-z)');
        }
        
        if (/[0-9]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan angka (0-9)');
        }
        
        if (/[^A-Za-z0-9]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan karakter spesial (!@#$%^&*)');
        }
        
        // Calculate total score for display (0-100%)
        // Length (20%) + each criteria (20% each) = 100%
        strength.score = (strength.meetsMinLength ? 1 : 0) + strength.criteriaScore;
        
        // Determine level
        // Strong: min length + all 4 criteria (score 5)
        // Medium: min length + 2-3 criteria (score 3-4)
        // Weak: anything else
        if (strength.meetsMinLength && strength.criteriaScore >= 4) {
            strength.level = 'strong';
            strength.message = 'Password kuat 💪';
        } else if (strength.meetsMinLength && strength.criteriaScore >= 2) {
            strength.level = 'medium';
            strength.message = `Password cukup kuat (${strength.criteriaScore}/4 kriteria)`;
        } else {
            strength.level = 'weak';
            strength.message = 'Password lemah ⚠️';
        }
        
        if (DEBUG_MODE) {
            dLog('🔐 [PASSWORD] Length OK:', strength.meetsMinLength, '| Criteria:', strength.criteriaScore, '/4 | Level:', strength.level);
        }
        
        return strength;
    }

    // 🆕 ATTACH PASSWORD STRENGTH CHECKER TO REGISTER PASSWORD INPUT
    const registerPasswordInput = document.getElementById('registerPassword');
    const strengthIndicator = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const strengthHints = document.getElementById('strengthHints');
    const registerButton = document.querySelector('#panelRegister button[type="submit"]');

    if (DEBUG_MODE) {
        dLog('🔐 [REGISTER] Elements found:');
        dLog('  - registerPasswordInput:', !!registerPasswordInput);
        dLog('  - strengthIndicator:', !!strengthIndicator);
        dLog('  - strengthFill:', !!strengthFill);
        dLog('  - strengthText:', !!strengthText);
        dLog('  - strengthHints:', !!strengthHints);
        dLog('  - registerButton:', !!registerButton);
    }

    if (registerPasswordInput && strengthIndicator && strengthFill && strengthText && strengthHints && registerButton) {
        // Initially disable button
        registerButton.disabled = true;
        registerButton.style.opacity = '0.5';
        registerButton.style.cursor = 'not-allowed';
        registerButton.title = 'Password harus: min 8 karakter + 2 dari 4 kriteria';

        // 🆕 Shared function to update button state
        let currentPasswordMatch = false;

        function updateButtonState() {
            const password = registerPasswordInput.value;
            const confirmPassword = document.getElementById('registerConfirm')?.value || '';
            const strength = checkPasswordStrength(password);
            const isPasswordValid = strength.meetsMinLength && strength.criteriaScore >= 2;
            const isMatch = confirmPassword.length === 0 || password === confirmPassword;
            const shouldEnable = isPasswordValid && (confirmPassword.length === 0 || (isMatch && confirmPassword.length > 0));

            currentPasswordMatch = isMatch;

            if (shouldEnable && confirmPassword.length > 0 && isMatch) {
                registerButton.disabled = false;
                registerButton.style.opacity = '1';
                registerButton.style.cursor = 'pointer';
                registerButton.title = 'Klik untuk register';
                if (DEBUG_MODE) dLog('✅ [BUTTON] Enabled');
            } else {
                registerButton.disabled = true;
                registerButton.style.opacity = '0.5';
                registerButton.style.cursor = 'not-allowed';
                if (!isPasswordValid) {
                    if (!strength.meetsMinLength) {
                        registerButton.title = 'Password harus minimal 8 karakter';
                    } else {
                        registerButton.title = `Password perlu ${2 - strength.criteriaScore} kriteria lagi (2 dari 4)`;
                    }
                } else if (confirmPassword.length > 0 && !isMatch) {
                    registerButton.title = 'Password tidak cocok dengan Confirm Password';
                } else {
                    registerButton.title = 'Password harus: min 8 karakter + 2 dari 4 kriteria';
                }
                if (DEBUG_MODE) dLog('❌ [BUTTON] Disabled -', registerButton.title);
            }
        }

        registerPasswordInput.addEventListener('input', (e) => {
            const password = e.target.value;
            
            if (password.length === 0) {
                strengthIndicator.style.display = 'none';
                registerButton.disabled = true;
                registerButton.style.opacity = '0.5';
                registerButton.style.cursor = 'not-allowed';
                registerButton.title = 'Password harus: min 8 karakter + 2 dari 4 kriteria';
                return;
            }
            
            strengthIndicator.style.display = 'block';
            const strength = checkPasswordStrength(password);
            
            // Update bar (score 0-5, each worth 20%)
            strengthFill.style.width = (strength.score * 20) + '%';
            strengthFill.className = 'strength-fill ' + strength.level;
            
            if (DEBUG_MODE) {
                dLog('🎨 [INDICATOR] Width:', (strength.score * 20) + '%', '| Class:', 'strength-fill ' + strength.level);
            }
            
            // Update text
            strengthText.textContent = strength.message;
            strengthText.className = 'strength-text ' + strength.level;
            
            // Update hints
            strengthHints.innerHTML = strength.hints
                .map(hint => `<li>${hint}</li>`)
                .join('');
            
            // Update button state
            updateButtonState();
        });

        // Make updateButtonState available globally within this scope
        window._updateRegisterButtonState = updateButtonState;
    } else {
        console.error('❌ [REGISTER] Missing password strength elements!');
        if (!registerPasswordInput) console.error('  - Missing: registerPasswordInput');
        if (!strengthIndicator) console.error('  - Missing: strengthIndicator');
        if (!strengthFill) console.error('  - Missing: strengthFill');
        if (!strengthText) console.error('  - Missing: strengthText');
        if (!strengthHints) console.error('  - Missing: strengthHints');
        if (!registerButton) console.error('  - Missing: registerButton');
    }

    // 🆕 PASSWORD MATCH CHECKER FOR CONFIRM PASSWORD
    const registerConfirmInput = document.getElementById('registerConfirm');
    const passwordMatch = document.getElementById('passwordMatch');

    // 🆕 FORM MESSAGE HELPER FUNCTIONS
    function showFormMessage(elementId, message, type = 'info', duration = 0) {
        const messageEl = document.getElementById(elementId);
        if (!messageEl) {
            console.error(`❌ Message element #${elementId} not found`);
            return;
        }

        messageEl.textContent = message;
        messageEl.className = `form-message ${type}`;
        messageEl.style.display = 'block';

        if (DEBUG_MODE) {
            dLog(`📣 [MESSAGE] Showing ${type} message in #${elementId}:`, message);
        }

        // Auto-hide after duration (if specified)
        if (duration > 0) {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, duration);
        }
    }

    function hideFormMessage(elementId) {
        const messageEl = document.getElementById(elementId);
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    // 🆕 RESET REGISTER FORM FUNCTION
    function resetRegisterForm() {
        if (DEBUG_MODE) dLog('🔄 [RESET] Resetting register form indicators');
        
        // Reset password strength indicator
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');
        const strengthHints = document.getElementById('strengthHints');
        const strengthIndicator = document.getElementById('passwordStrength');
        
        if (strengthFill) {
            strengthFill.style.width = '0%';
            strengthFill.className = 'strength-fill';
        }
        if (strengthText) {
            strengthText.textContent = '';
        }
        if (strengthHints) {
            strengthHints.innerHTML = '';
        }
        if (strengthIndicator) {
            strengthIndicator.style.display = 'none';
        }
        
        // Reset password match indicator
        const passwordMatch = document.getElementById('passwordMatch');
        if (passwordMatch) {
            passwordMatch.style.display = 'none';
            passwordMatch.innerHTML = '';
        }
        
        // Reset register button
        const registerButton = document.querySelector('#panelRegister button[type="submit"]');
        if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = 'Register';
        }
        
        // Hide register message
        hideFormMessage('registerMessage');
        
        if (DEBUG_MODE) dLog('✅ [RESET] Register form reset complete');
    }

    if (DEBUG_MODE) {
        dLog('🔐 [PASSWORD MATCH] Elements found:');
        dLog('  - registerConfirmInput:', !!registerConfirmInput);
        dLog('  - passwordMatch:', !!passwordMatch);
    }

    if (registerPasswordInput && registerConfirmInput && passwordMatch && registerButton) {
        function checkPasswordMatch() {
            const password = registerPasswordInput.value;
            const confirmPassword = registerConfirmInput.value;

            // Jangan tampilkan apapun jika confirm password kosong
            if (confirmPassword.length === 0) {
                passwordMatch.style.display = 'none';
                // Call updateButtonState if available
                if (window._updateRegisterButtonState) {
                    window._updateRegisterButtonState();
                }
                return;
            }

            passwordMatch.style.display = 'block';

            const isMatch = password === confirmPassword;

            if (isMatch) {
                passwordMatch.innerHTML = '<span class="match-success">✓ Password cocok</span>';
                passwordMatch.className = 'password-match success';
                if (DEBUG_MODE) dLog('✅ [PASSWORD MATCH] Passwords match');
            } else {
                passwordMatch.innerHTML = '<span class="match-error">✗ Password tidak cocok</span>';
                passwordMatch.className = 'password-match error';
                if (DEBUG_MODE) dLog('❌ [PASSWORD MATCH] Passwords do not match');
            }

            // Call updateButtonState if available
            if (window._updateRegisterButtonState) {
                window._updateRegisterButtonState();
            }
        }

        // Check on both password and confirm password input
        registerPasswordInput.addEventListener('input', checkPasswordMatch);
        registerConfirmInput.addEventListener('input', checkPasswordMatch);
    } else {
        if (DEBUG_MODE) {
            console.error('❌ [PASSWORD MATCH] Missing elements!');
            if (!registerPasswordInput) console.error('  - Missing: registerPasswordInput');
            if (!registerConfirmInput) console.error('  - Missing: registerConfirmInput');
            if (!passwordMatch) console.error('  - Missing: passwordMatch');
            if (!registerButton) console.error('  - Missing: registerButton');
        }
    }

    document.querySelector('#panelLogin form').addEventListener('submit', async (e) => {
        e.preventDefault();
        dLog('🔐 [LOGIN] ========================================');
        dLog('🔐 [LOGIN] Form submitted');
        dLog('🔐 [LOGIN] Time:', new Date().toISOString());
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (DEBUG_MODE) dLog('🔐 [LOGIN] Email:', email);
        
        // Clear previous messages
        hideFormMessage('loginMessage');
        
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = '⏳ Logging in...';
        
        try {
            dLog('🌐 [LOGIN] Sending request to:', `${API_URL}/auth/login`);
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            dLog('📥 [LOGIN] Response status:', response.status);
            const data = await response.json();
            dLog('📥 [LOGIN] Response data:', data);
            
            if (data.success) {
                dLog('✅ [LOGIN] Login successful!');
                dLog('💾 [LOGIN] Saving to localStorage...');
                
                // 🔥 CRITICAL: Clear donatur status BEFORE setting new auth token
                // This prevents stuck status when switching accounts in the SAME tab
                localStorage.removeItem('userDonaturStatus');
                dLog('🧹 [LOGIN] Cleared old donatur status cache before login');
                
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                dLog('💾 [LOGIN] Saved');
                
                // Show success message
                showFormMessage('loginMessage', '✅ Login berhasil! Redirecting...', 'success', 2000);
                
                // ✅ Update profile button text
                if (window.updateProfileButtonText) {
                    window.updateProfileButtonText();
                }
                
                // ✅ Update notification badge
                if (window.updateNotificationBadge) {
                    window.updateNotificationBadge();
                }
                
                // 🔥 FORCE REFRESH STATUS immediately after login (before showing modal)
                // This ensures fresh status without needing page reload
                dLog('🔍 [LOGIN] Force refreshing donatur status...');
                
                // Close modals first
                const loginModal = document.getElementById('loginModal');
                const loginRequiredModal = document.getElementById('loginRequiredModal');
                if (loginModal) {
                    loginModal.style.display = 'none';
                    loginModal.style.visibility = 'hidden';
                }
                if (loginRequiredModal) {
                    loginRequiredModal.style.display = 'none';
                    loginRequiredModal.style.visibility = 'hidden';
                }
                document.body.style.overflow = '';
                
                // Dispatch login event
                window.dispatchEvent(new CustomEvent('userLoggedIn', {
                    detail: { user: data.user, token: data.token }
                }));
                dLog('📢 [LOGIN] Dispatched userLoggedIn event');
                
                // Force refresh status then show modal
                checkDonaturStatus().then(() => {
                    dLog('✅ [LOGIN] Status refreshed, showing profile modal...');
                    setTimeout(() => {
                        showProfileModal(data.user);
                    }, 300);
                }).catch(err => {
                    dLog('⚠️ [LOGIN] Status refresh error:', err);
                    // Show modal anyway even if status check fails
                    setTimeout(() => {
                        showProfileModal(data.user);
                    }, 300);
                });
            } else {
                console.error('❌ [LOGIN] Login failed:', data.error);
                showFormMessage('loginMessage', '❌ ' + (data.error || 'Login gagal'), 'error');
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        } catch (error) {
            console.error('❌ [LOGIN] Error:', error);
            console.error('❌ [LOGIN] Error stack:', error.stack);
            showFormMessage('loginMessage', '❌ Terjadi kesalahan: ' + error.message, 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        dLog('🔐 [LOGIN] ========================================');
    });

    document.querySelector('#panelRegister form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // ✅ Prevent double submission
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton.disabled) {
        dLog('⚠️ [REGISTER] Already submitting, ignoring...');
        return;
    }
    
    dLog('📝 [REGISTER] ========================================');
    dLog('📝 [REGISTER] Form submitted');
    dLog('📝 [REGISTER] Time:', new Date().toISOString());
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    
    if (DEBUG_MODE) dLog('📝 [REGISTER] Email:', email);
    dLog('📝 [REGISTER] Password length:', password.length);
    
    // Clear previous messages
    hideFormMessage('registerMessage');
    
    if (password !== confirm) {
        console.error('❌ [REGISTER] Password mismatch');
        showFormMessage('registerMessage', '❌ Password tidak cocok!', 'error');
        return;
    }
    
    if (password.length < 8) {
        console.error('❌ [REGISTER] Password too short');
        showFormMessage('registerMessage', '❌ Password minimal 8 karakter', 'error');
        return;
    }
    
    // 🆕 Validate password strength (minimum: 8 chars + 2/4 criteria)
    const strength = checkPasswordStrength(password);
    if (!strength.meetsMinLength || strength.criteriaScore < 2) {
        console.error('❌ [REGISTER] Password too weak');
        showFormMessage('registerMessage', '❌ Password terlalu lemah! Harus minimal 8 karakter + 2 dari 4 kriteria (huruf besar, huruf kecil, angka, karakter spesial).', 'error');
        return;
    }
    
    if (DEBUG_MODE) {
        dLog('✅ [REGISTER] Password valid:', strength.meetsMinLength, 'length +', strength.criteriaScore, '/4 criteria');
    }
    
    // ✅ Disable button dan show loading state
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '⏳ Registering...';
    
    try {
        dLog('🌐 [REGISTER] Sending request to:', `${API_URL}/auth/register`);
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        dLog('📥 [REGISTER] Response status:', response.status);
        
        // ✅ Parse JSON response
        const data = await response.json();
        dLog('📥 [REGISTER] Response data:', data);
        
        // ✅ Check response status dan success flag
        if (response.ok && data.success) {
            dLog('✅ [REGISTER] Registration successful!');
            dLog('✅ [REGISTER] Message:', data.message);
            if (DEBUG_MODE) dLog('✅ [REGISTER] User email:', data.email);
            
            // Show success message with email verification info
            showFormMessage('registerMessage', '✅ Registrasi berhasil! Silakan cek kotak masuk dan folder spam email yang sudah didaftarkan untuk verifikasi.', 'success');
            
            // Clear form after 3 seconds then close modal
            setTimeout(() => {
                e.target.reset();
                resetRegisterForm();
                
                // Close modal
                dLog('🚪 [REGISTER] Closing modal...');
                document.getElementById('loginModal').style.display = 'none';
                document.body.style.overflow = '';
                dLog('✅ [REGISTER] Modal closed');
            }, 5000); // Give user 5 seconds to read the message
        } else {
            // ✅ Handle error response (misalnya 409 Conflict - user sudah terdaftar)
            const errorMessage = data.error || data.message || 'Registration failed';
            console.error('❌ [REGISTER] Registration failed:', errorMessage);
            showFormMessage('registerMessage', '❌ ' + errorMessage, 'error');
        }
    } catch (error) {
        console.error('❌ [REGISTER] Error:', error);
        console.error('❌ [REGISTER] Error stack:', error.stack);
        showFormMessage('registerMessage', '❌ Terjadi kesalahan: ' + error.message, 'error');
    } finally {
        // ✅ Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
    dLog('📝 [REGISTER] ========================================');
});

    dLog('🔧 [SETUP] Form handlers added');

    // Password toggle
    dLog('🔧 [SETUP] Adding password toggle handlers...');
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            dLog('👁️ [PASSWORD] Toggled to:', type);
            
            const svg = btn.querySelector('svg');
            if (type === 'text') {
                svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
            } else {
                svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            }
        });
    });
    dLog('🔧 [SETUP] Password toggle handlers added');

    // Tab switching
    dLog('🔧 [SETUP] Adding tab switching handlers...');
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            dLog('📑 [TAB] Switched to:', tab.id);
            
            document.querySelectorAll('.login-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            
            const panelId = tab.id.replace('tab', 'panel');
            document.getElementById(panelId)?.classList.add('active');
            
            // Reset register form when switching to register tab
            if (tab.id === 'tabRegister') {
                resetRegisterForm();
            }
        });
    });
    dLog('🔧 [SETUP] Tab switching handlers added');

    // ✅ Handle Forgot Password Form
    dLog('🔧 [SETUP] Adding forgot password handler...');
    document.getElementById('formForgotPassword').addEventListener('submit', async (e) => {
        e.preventDefault();
        dLog('🔑 [FORGOT] Form submitted');
        
        const email = document.getElementById('forgotEmail').value.trim();
        const errorEl = document.getElementById('forgotError');
        const btnSubmit = document.getElementById('btnSendReset');
        
        if (!email) {
            errorEl.textContent = 'Email wajib diisi';
            return;
        }
        
        // Disable button
        const originalText = btnSubmit.textContent;
        btnSubmit.disabled = true;
        btnSubmit.textContent = '⏳ Mengirim...';
        errorEl.textContent = '';
        
        try {
            dLog('🌐 [FORGOT] Sending request to:', `${API_URL}/auth/request-reset`);
            const response = await fetch(`${API_URL}/auth/request-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            dLog('📥 [FORGOT] Response status:', response.status);
            const data = await response.json();
            dLog('📥 [FORGOT] Response data:', data);
            
            if (data.success) {
                showFormMessage('forgotMessage', '✅ Link untuk reset password sudah dikirimkan silahkan cek kotak masuk atau kotak spam', 'success');
                document.getElementById('forgotEmail').value = '';
                
                // Switch to login tab after 5 seconds
                setTimeout(() => {
                    document.getElementById('tabLogin').click();
                    hideFormMessage('forgotMessage');
                }, 5000);
            } else {
                errorEl.textContent = data.error || 'Terjadi kesalahan';
            }
        } catch (error) {
            console.error('❌ [FORGOT] Error:', error);
            errorEl.textContent = 'Terjadi kesalahan koneksi';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    });
    dLog('🔧 [SETUP] Forgot password handler added');

    dLog('✅ [INIT] ========================================');
    dLog('✅ [INIT] Login modal fully initialized!');
    dLog('✅ [INIT] ========================================');
});

// ============================================
// HAMBURGER MENU HANDLER (INFO-MANGA SPECIFIC)
// ============================================
// Ensure hamburger menu works even if common.js handler fails
function initHamburgerMenu() {
    dLog('🍔 [HAMBURGER] ========================================');
    dLog('🍔 [HAMBURGER] Initializing hamburger menu handler...');
    dLog('🍔 [HAMBURGER] Document ready state:', document.readyState);
    dLog('🍔 [HAMBURGER] Window width:', window.innerWidth);
    
    const btnHeaderMenu = document.getElementById('btnHeaderMenu');
    const headerMenuDropdown = document.getElementById('headerMenuDropdown');
    const nav = document.querySelector('nav');
    
    dLog('🍔 [HAMBURGER] Button element:', btnHeaderMenu);
    dLog('🍔 [HAMBURGER] Dropdown element:', headerMenuDropdown);
    dLog('🍔 [HAMBURGER] Nav element:', nav);
    
    if (!btnHeaderMenu) {
        console.error('❌ [HAMBURGER] Button not found!');
        console.error('❌ [HAMBURGER] Searching for button with ID: btnHeaderMenu');
        dLog('❌ [HAMBURGER] All buttons:', document.querySelectorAll('button'));
        dWarn('⚠️ [HAMBURGER] Retrying in 200ms...');
        setTimeout(initHamburgerMenu, 200);
        return;
    }
    
    if (!headerMenuDropdown) {
        console.error('❌ [HAMBURGER] Dropdown not found!');
        console.error('❌ [HAMBURGER] Searching for dropdown with ID: headerMenuDropdown');
        dLog('❌ [HAMBURGER] All divs with class header-menu-dropdown:', document.querySelectorAll('.header-menu-dropdown'));
        dWarn('⚠️ [HAMBURGER] Retrying in 200ms...');
        setTimeout(initHamburgerMenu, 200);
        return;
    }
    
    dLog('✅ [HAMBURGER] Elements found!');
    dLog('✅ [HAMBURGER] Button styles:', {
        display: window.getComputedStyle(btnHeaderMenu).display,
        visibility: window.getComputedStyle(btnHeaderMenu).visibility,
        opacity: window.getComputedStyle(btnHeaderMenu).opacity,
        pointerEvents: window.getComputedStyle(btnHeaderMenu).pointerEvents,
        zIndex: window.getComputedStyle(btnHeaderMenu).zIndex
    });
    dLog('✅ [HAMBURGER] Dropdown styles:', {
        display: window.getComputedStyle(headerMenuDropdown).display,
        visibility: window.getComputedStyle(headerMenuDropdown).visibility,
        opacity: window.getComputedStyle(headerMenuDropdown).opacity,
        position: window.getComputedStyle(headerMenuDropdown).position,
        zIndex: window.getComputedStyle(headerMenuDropdown).zIndex
    });
    
    // Check if button is visible
    const rect = btnHeaderMenu.getBoundingClientRect();
    dLog('✅ [HAMBURGER] Button position:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0
    });
    
    // Check if button already has handler (prevent multiple initialization)
    if (btnHeaderMenu.dataset.handlerAttached === 'true') {
        dLog('⚠️ [HAMBURGER] Handler already attached, skipping...');
        return true;
    }
    
    // Mark as attached
    btnHeaderMenu.dataset.handlerAttached = 'true';
    
    // Use button directly instead of cloning (to avoid breaking references)
    const newBtn = btnHeaderMenu;
    dLog('✅ [HAMBURGER] Using existing button');
    
    // Attach click handler
    dLog('🔧 [HAMBURGER] Attaching click handler...');
    newBtn.addEventListener('click', function(e) {
        dLog('🖱️ [HAMBURGER] ========================================');
        dLog('🖱️ [HAMBURGER] CLICK EVENT TRIGGERED!');
        dLog('🖱️ [HAMBURGER] Event:', e);
        dLog('🖱️ [HAMBURGER] Target:', e.target);
        dLog('🖱️ [HAMBURGER] Current target:', e.currentTarget);
        dLog('🖱️ [HAMBURGER] Time:', new Date().toISOString());
        
        e.preventDefault();
        e.stopPropagation();
        
        const dropdown = document.getElementById('headerMenuDropdown');
        if (!dropdown) {
            console.error('❌ [HAMBURGER] Dropdown not found in click handler!');
            return;
        }
        
        const isOpen = dropdown.classList.contains('show');
        dLog('🖱️ [HAMBURGER] Current dropdown state:', isOpen ? 'OPEN' : 'CLOSED');
        dLog('🖱️ [HAMBURGER] Dropdown classes:', dropdown.className);
        
        if (isOpen) {
            dLog('🔄 [HAMBURGER] Closing dropdown...');
            dropdown.classList.remove('show');
            // Remove inline styles saat close
            dropdown.style.display = '';
            dropdown.style.visibility = '';
            dropdown.style.opacity = '';
            newBtn.setAttribute('aria-expanded', 'false');
            dLog('✅ [HAMBURGER] Dropdown closed');
            dLog('✅ [HAMBURGER] Dropdown classes after close:', dropdown.className);
            dLog('✅ [HAMBURGER] Computed styles after close:', {
                display: window.getComputedStyle(dropdown).display,
                visibility: window.getComputedStyle(dropdown).visibility,
                opacity: window.getComputedStyle(dropdown).opacity
            });
        } else {
            dLog('🔄 [HAMBURGER] Opening dropdown...');
            dropdown.classList.add('show');
            // Get button position
            const btnRect = newBtn.getBoundingClientRect();
            dLog('📊 [HAMBURGER] Button position:', btnRect);
            
            // Calculate position
            const topPos = btnRect.bottom + 8;
            const rightPos = window.innerWidth - btnRect.right;
            dLog('📊 [HAMBURGER] Calculated positions:', { top: topPos, right: rightPos });
            
            // Force show dengan inline style sebagai fallback
            dropdown.style.display = 'flex';
            dropdown.style.visibility = 'visible';
            dropdown.style.opacity = '1';
            dropdown.style.position = 'fixed';
            dropdown.style.zIndex = '10001';
            dropdown.style.flexDirection = 'column';
            dropdown.style.top = topPos + 'px';
            dropdown.style.right = rightPos + 'px';
            dropdown.style.minWidth = '200px';
            newBtn.setAttribute('aria-expanded', 'true');
            dLog('✅ [HAMBURGER] Dropdown opened');
            dLog('✅ [HAMBURGER] Dropdown classes after open:', dropdown.className);
            
            // Check visibility after a short delay
            setTimeout(() => {
                const rect = dropdown.getBoundingClientRect();
                dLog('📊 [HAMBURGER] Dropdown bounding rect:', rect);
                dLog('📊 [HAMBURGER] Is visible?', 
                    rect.top >= 0 && rect.top < window.innerHeight && 
                    rect.left >= 0 && rect.left < window.innerWidth &&
                    rect.width > 0 && rect.height > 0
                );
            }, 10);
        }
        dLog('🖱️ [HAMBURGER] ========================================');
    }, true); // Use capture phase
    
    newBtn.dataset.clickHandlerAttached = 'true';
    dLog('✅ [HAMBURGER] Direct click handler attached');
    
    // Also use event delegation as backup (only attach once globally)
    if (!window.hamburgerDelegationHandlerAttached) {
        dLog('🔧 [HAMBURGER] Attaching event delegation handler...');
        const delegationHandler = function(e) {
        // Check if clicked element is the button or inside the button
        const clickedBtn = e.target.id === 'btnHeaderMenu' ? e.target : e.target.closest('#btnHeaderMenu');
        
        if (clickedBtn) {
            dLog('🖱️ [HAMBURGER-DELEGATION] Click detected via delegation');
            dLog('🖱️ [HAMBURGER-DELEGATION] Target:', e.target);
            dLog('🖱️ [HAMBURGER-DELEGATION] Closest button:', clickedBtn);
            
            e.preventDefault();
            e.stopPropagation();
            
            const dropdown = document.getElementById('headerMenuDropdown');
            if (dropdown) {
                const isOpen = dropdown.classList.contains('show');
                dLog('🖱️ [HAMBURGER-DELEGATION] Current state:', isOpen ? 'open' : 'closed');
                
                if (isOpen) {
                    dropdown.classList.remove('show');
                    // Remove inline styles saat close
                    dropdown.style.display = '';
                    dropdown.style.visibility = '';
                    dropdown.style.opacity = '';
                    dropdown.style.position = '';
                    dropdown.style.top = '';
                    dropdown.style.right = '';
                    dropdown.style.minWidth = '';
                    dLog('✅ [HAMBURGER-DELEGATION] Closed');
                    dLog('📊 [HAMBURGER-DELEGATION] Dropdown classes after close:', dropdown.className);
                    dLog('📊 [HAMBURGER-DELEGATION] Computed styles after close:', {
                        display: window.getComputedStyle(dropdown).display,
                        visibility: window.getComputedStyle(dropdown).visibility,
                        opacity: window.getComputedStyle(dropdown).opacity
                    });
                } else {
                    dropdown.classList.add('show');
                    // Get button position dari clickedBtn (bukan dari variable btnHeaderMenu yang sudah di-clone)
                    const btnRect = clickedBtn.getBoundingClientRect();
                    dLog('📊 [HAMBURGER-DELEGATION] Button position:', btnRect);
                    dLog('📊 [HAMBURGER-DELEGATION] Window width:', window.innerWidth);
                    
                    // Calculate position
                    const topPos = btnRect.bottom + 8;
                    const rightPos = window.innerWidth - btnRect.right;
                    
                    dLog('📊 [HAMBURGER-DELEGATION] Calculated positions:', {
                        top: topPos,
                        right: rightPos
                    });
                    
                    // Force show dengan inline style sebagai fallback
                    dropdown.style.display = 'flex';
                    dropdown.style.visibility = 'visible';
                    dropdown.style.opacity = '1';
                    dropdown.style.position = 'fixed'; // Use fixed instead of absolute
                    dropdown.style.zIndex = '10001';
                    dropdown.style.flexDirection = 'column';
                    dropdown.style.top = topPos + 'px';
                    dropdown.style.right = rightPos + 'px';
                    dropdown.style.minWidth = '200px';
                    
                    // Check parent positioning
                    const nav = dropdown.closest('nav');
                    const header = dropdown.closest('header');
                    dLog('✅ [HAMBURGER-DELEGATION] Opened');
                    dLog('📊 [HAMBURGER-DELEGATION] Dropdown classes after open:', dropdown.className);
                    dLog('📊 [HAMBURGER-DELEGATION] Parent nav:', nav);
                    dLog('📊 [HAMBURGER-DELEGATION] Parent header:', header);
                    if (nav) {
                        dLog('📊 [HAMBURGER-DELEGATION] Nav styles:', {
                            position: window.getComputedStyle(nav).position,
                            zIndex: window.getComputedStyle(nav).zIndex
                        });
                        dLog('📊 [HAMBURGER-DELEGATION] Nav bounding rect:', nav.getBoundingClientRect());
                    }
                    dLog('📊 [HAMBURGER-DELEGATION] Inline styles set:', {
                        display: dropdown.style.display,
                        visibility: dropdown.style.visibility,
                        opacity: dropdown.style.opacity,
                        top: dropdown.style.top,
                        right: dropdown.style.right
                    });
                    dLog('📊 [HAMBURGER-DELEGATION] Computed styles after open:', {
                        display: window.getComputedStyle(dropdown).display,
                        visibility: window.getComputedStyle(dropdown).visibility,
                        opacity: window.getComputedStyle(dropdown).opacity,
                        position: window.getComputedStyle(dropdown).position,
                        zIndex: window.getComputedStyle(dropdown).zIndex,
                        top: window.getComputedStyle(dropdown).top,
                        right: window.getComputedStyle(dropdown).right
                    });
                    // Wait a bit then check computed styles
                    setTimeout(() => {
                        const rect = dropdown.getBoundingClientRect();
                        dLog('📊 [HAMBURGER-DELEGATION] Dropdown bounding rect:', rect);
                        dLog('📊 [HAMBURGER-DELEGATION] Viewport:', {
                            width: window.innerWidth,
                            height: window.innerHeight
                        });
                        dLog('📊 [HAMBURGER-DELEGATION] Is visible?', 
                            rect.top >= 0 && rect.top < window.innerHeight && 
                            rect.left >= 0 && rect.left < window.innerWidth &&
                            rect.width > 0 && rect.height > 0
                        );
                    }, 10);
                }
            } else {
                console.error('❌ [HAMBURGER-DELEGATION] Dropdown not found!');
            }
        }
        };
        
        document.addEventListener('click', delegationHandler, true);
        window.hamburgerDelegationHandlerAttached = true;
        dLog('✅ [HAMBURGER] Event delegation handler attached');
    } else {
        dLog('⚠️ [HAMBURGER] Event delegation handler already attached, skipping...');
    }
    
    dLog('✅ [HAMBURGER] Handler initialization complete');
    dLog('🍔 [HAMBURGER] ========================================');
    
    // Return true to indicate success
    return true;
}

// Flag to prevent multiple initialization
let hamburgerMenuInitialized = false;

// Hamburger menu removed - no longer needed
// Initialize on DOM ready
// dLog('🚀 [HAMBURGER] Script loaded, checking ready state...');
// if (document.readyState === 'loading') {
//     dLog('⏳ [HAMBURGER] Document still loading, waiting for DOMContentLoaded...');
//     document.addEventListener('DOMContentLoaded', () => {
//         dLog('📄 [HAMBURGER] DOMContentLoaded fired');
//         if (!hamburgerMenuInitialized) {
//             hamburgerMenuInitialized = initHamburgerMenu();
//         }
//     });
// } else {
//     dLog('✅ [HAMBURGER] Document already ready, initializing immediately');
//     if (!hamburgerMenuInitialized) {
//         hamburgerMenuInitialized = initHamburgerMenu();
//     }
// }

// Single delayed initialization as backup (only if not already initialized)
// setTimeout(() => {
//     if (!hamburgerMenuInitialized) {
//         dLog('⏰ [HAMBURGER] Delayed initialization (500ms) - backup');
//         hamburgerMenuInitialized = initHamburgerMenu();
//     }
// }, 500);

// ============================================
// RATING & COMMENTS HANDLER FOR INFO-MANGA
// ============================================

class InfoMangaRatingComments {
    constructor() {
        this.mangaId = null;
        this.isLoggedIn = false;
        this.selectedRating = 0;
        this.API_BASE = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
    }

    async init(mangaId) {
        this.mangaId = mangaId;
        // console.log('🚀 ============================================');
        // console.log('🚀 [INIT] InfoMangaRatingComments initializing...');
        // console.log('🚀 [INIT] MangaId:', mangaId);
        dLog('[INFO-RATING] Initializing for manga:', mangaId);
        
        // Setup event listeners FIRST
        this.setupEventListeners();
        // console.log('✅ [INIT] Event listeners setup complete');
        
        // Check login status
        // console.log('🔐 [INIT] Checking login status...');
        await this.checkLoginStatus();
        // console.log('🔐 [INIT] Login status check complete. isLoggedIn:', this.isLoggedIn);
        
        // Load comment input avatar if logged in
        if (this.isLoggedIn) {
            // console.log('🖼️ [INIT] User is logged in, loading comment input avatar...');
            await this.loadCommentInputAvatar();
            // console.log('✅ [INIT] Avatar load attempt complete');
        } else {
            // console.log('⚠️ [INIT] User NOT logged in, skipping avatar load');
        }
        
        // Load data
        // console.log('📊 [INIT] Loading manga rating and comments...');
        await this.loadMangaRating();
        await this.loadComments();
        // console.log('✅ [INIT] Data load complete');
        // console.log('🚀 [INIT] Initialization complete!');
        // console.log('🚀 ============================================');
        
        // Listen for login/logout events via storage
        window.addEventListener('storage', (e) => {
            if (e.key === 'authToken') {
                // console.log('🔄 [STORAGE] Auth token changed, re-checking login status');
                dLog('[INFO-RATING] Auth token changed, re-checking login status');
                this.checkLoginStatus();
            }
        });
        
        // Listen for window focus (user might login in another tab or modal)
        window.addEventListener('focus', () => {
            dLog('[INFO-RATING] Window focused, re-checking login status');
            this.checkLoginStatus();
            // ✅ Reload avatar saat focus (mungkin user update profile di tab lain)
            if (this.isLoggedIn) {
                this.loadCommentInputAvatar();
            }
        });
        
        // Listen for custom login event (if exists)
        window.addEventListener('userLoggedIn', () => {
            dLog('[INFO-RATING] User logged in event received');
            this.checkLoginStatus();
            this.loadMangaRating();
            this.loadComments();
        });
        
        window.addEventListener('userLoggedOut', () => {
            dLog('[INFO-RATING] User logged out event received');
            this.checkLoginStatus();
        });
        
        // Listen for profile modal closed (re-check status after user interaction)
        window.addEventListener('profileModalClosed', () => {
            dLog('[INFO-RATING] Profile modal closed, re-checking status');
            this.checkLoginStatus();
            this.loadMangaRating();
            this.loadComments();
            // ✅ Force reload avatar setelah profile modal closed
            if (this.isLoggedIn) {
                // console.log('🔄 [AVATAR-INPUT] Reloading avatar after profile modal closed...');
                setTimeout(() => this.loadCommentInputAvatar(), 200);
            }
        });
    }

    async checkLoginStatus() {
        const token = localStorage.getItem('authToken');
        // console.log('🔐 ============================================');
        // console.log('🔐 [LOGIN-CHECK] Checking login status...');
        // console.log('🔐 [LOGIN-CHECK] Token exists:', !!token);
        // if (token) {
        //     console.log('🔐 [LOGIN-CHECK] Token preview:', token.substring(0, 20) + '...');
        // }
        dLog('[INFO-RATING] Checking login status, token exists:', !!token);
        
        if (!token) {
            this.isLoggedIn = false;
            // console.log('❌ [LOGIN-CHECK] No token found');
            this.showLoginButton();
            dLog('[INFO-RATING] No token, showing login button');
            // console.log('🔐 ============================================');
            return;
        }

        try {
            // console.log('🌐 [LOGIN-CHECK] Fetching donatur status...');
            const response = await fetch(`${this.API_BASE}/donatur/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // console.log('🌐 [LOGIN-CHECK] Response status:', response.status);
            dLog('[INFO-RATING] Status check response:', response.status);

            if (response.ok) {
                const data = await response.json();
                this.isLoggedIn = true;
                // console.log('✅ [LOGIN-CHECK] Login successful!');
                // console.log('✅ [LOGIN-CHECK] User data:', data);
                // ✅ FIX: Jangan tampilkan rating input di sini
                // Biarkan loadMangaRating() yang menentukan apakah rating input ditampilkan
                // this.showRatingInput(); // REMOVED
                // console.log('🖼️ [LOGIN-CHECK] Calling showCommentInput()...');
                await this.showCommentInput();  // ✅ Added await
                // console.log('✅ [LOGIN-CHECK] showCommentInput() complete');
                dLog('[INFO-RATING] User is logged in, showing comment input only');
            } else {
                this.isLoggedIn = false;
                // console.log('❌ [LOGIN-CHECK] Token invalid (status not ok)');
                this.showLoginButton();
                dLog('[INFO-RATING] Token invalid, showing login button');
            }
        } catch (error) {
            console.error('❌ [LOGIN-CHECK] Error during login check:', error);
            console.error('[INFO-RATING] Login check error:', error);
            this.isLoggedIn = false;
            this.showLoginButton();
        }
        // console.log('🔐 [LOGIN-CHECK] Final isLoggedIn value:', this.isLoggedIn);
        // console.log('🔐 ============================================');
    }

    showLoginButton() {
        const btnLogin = document.getElementById('btnLoginComment');
        const inputSection = document.getElementById('commentInputSection');
        const ratingInput = document.getElementById('mangaRatingInput');
        
        if (btnLogin) {
            btnLogin.style.display = 'flex';
            dLog('[INFO-RATING] Login button shown');
        }
        if (inputSection) inputSection.style.display = 'none';
        if (ratingInput) ratingInput.style.display = 'none';
    }

    showRatingInput() {
        const ratingInput = document.getElementById('mangaRatingInput');
        if (ratingInput) {
            ratingInput.style.display = 'block';
            dLog('[INFO-RATING] Rating input shown');
        }
    }

    async showCommentInput() {
        // console.log('💬 ============================================');
        // console.log('💬 [SHOW-INPUT] showCommentInput() called');
        
        const btnLogin = document.getElementById('btnLoginComment');
        const inputSection = document.getElementById('commentInputSection');
        
        // console.log('💬 [SHOW-INPUT] btnLogin element:', btnLogin);
        // console.log('💬 [SHOW-INPUT] inputSection element:', inputSection);
        
        if (btnLogin) {
            btnLogin.style.display = 'none';
            // console.log('✅ [SHOW-INPUT] Login button hidden');
            dLog('[INFO-RATING] Login button hidden');
        } else {
            dWarn('⚠️ [SHOW-INPUT] btnLogin element not found!');
        }
        
        if (inputSection) {
            inputSection.style.display = 'block';
            // console.log('✅ [SHOW-INPUT] Comment input section shown');
            dLog('[INFO-RATING] Comment input shown');
        } else {
            dWarn('⚠️ [SHOW-INPUT] inputSection element not found!');
        }

        // Load and set user avatar for comment input
        // console.log('🖼️ [SHOW-INPUT] Calling loadCommentInputAvatar()...');
        await this.loadCommentInputAvatar();
        // console.log('✅ [SHOW-INPUT] loadCommentInputAvatar() complete');
        
        // ✅ Force reload setelah 500ms untuk ensure avatar terupdate
        // console.log('🔄 [SHOW-INPUT] Setting up force reload in 500ms...');
        setTimeout(() => {
            // console.log('🔄 [AVATAR-INPUT] Force reload after 500ms...');
            this.loadCommentInputAvatar();
        }, 500);
        
        // console.log('💬 [SHOW-INPUT] showCommentInput() complete');
        // console.log('💬 ============================================');
    }

    async loadCommentInputAvatar() {
        // console.log('🖼️ ============================================');
        // console.log('🖼️ [AVATAR-INPUT] loadCommentInputAvatar() called');
        
        const avatarEl = document.getElementById('commentInputAvatar');
        // console.log('🖼️ [AVATAR-INPUT] Avatar element:', avatarEl);
        // console.log('🖼️ [AVATAR-INPUT] Element exists:', !!avatarEl);
        
        if (!avatarEl) {
            dWarn('⚠️ [AVATAR-INPUT] Element commentInputAvatar not found!');
            // console.warn('⚠️ [AVATAR-INPUT] Retrying in 100ms...');
            // Retry after short delay if element not ready
            setTimeout(() => this.loadCommentInputAvatar(), 100);
            // console.log('🖼️ ============================================');
            return;
        }

        const token = localStorage.getItem('authToken');
        // console.log('🖼️ [AVATAR-INPUT] Token exists:', !!token);
        
        if (!token) {
            // console.log('⚠️ [AVATAR-INPUT] No token, using default avatar');
            avatarEl.src = 'assets/Logo 2.png';
            // console.log('🖼️ [AVATAR-INPUT] Avatar set to: assets/Logo 2.png');
            // console.log('🖼️ ============================================');
            return;
        }

        try {
            // console.log('🌐 [AVATAR-INPUT] Fetching avatar from profile-worker...');
            // console.log('🌐 [AVATAR-INPUT] API URL: https://profile-worker.nuranantoadhien.workers.dev/profile/me');
            
            const response = await fetch('https://profile-worker.nuranantoadhien.workers.dev/profile/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                cache: 'no-store'  // ✅ Disable cache untuk always get fresh data
            });

            // console.log('🌐 [AVATAR-INPUT] Response status:', response.status);
            // console.log('🌐 [AVATAR-INPUT] Response ok:', response.ok);

            if (response.ok) {
                const data = await response.json();
                // console.log('📦 [AVATAR-INPUT] Profile API response:', data);
                
                // ✅ FIX: Profile worker uses camelCase (avatarUrl), manga-auth-worker uses snake_case (avatar_url)
                const avatarUrl = data.profile?.avatarUrl || data.profile?.avatar_url || data.avatar_url || data.avatarUrl;
                
                // console.log('📦 [AVATAR-INPUT] Profile object:', data.profile);
                // console.log('📦 [AVATAR-INPUT] Avatar URL from API:', avatarUrl);
                // console.log('📦 [AVATAR-INPUT] Avatar URL type:', typeof avatarUrl);
                // console.log('📦 [AVATAR-INPUT] Avatar URL length:', avatarUrl ? avatarUrl.length : 0);
                
                if (avatarUrl) {
                    // Add cache busting to force reload
                    const finalUrl = avatarUrl.includes('?') 
                        ? `${avatarUrl}&t=${Date.now()}` 
                        : `${avatarUrl}?t=${Date.now()}`;
                    
                    // console.log('✅ [AVATAR-INPUT] Final URL with cache busting:', finalUrl);
                    // console.log('✅ [AVATAR-INPUT] Setting avatar src...');
                    avatarEl.src = finalUrl;
                    // console.log('✅ [AVATAR-INPUT] Avatar src set successfully!');
                    // console.log('✅ [AVATAR-INPUT] Current img.src value:', avatarEl.src);
                    
                    avatarEl.onerror = () => {
                        console.error('❌ [AVATAR-INPUT] Failed to load image from:', finalUrl);
                        console.error('❌ [AVATAR-INPUT] Falling back to default');
                        avatarEl.src = 'assets/Logo 2.png';
                    };
                } else {
                    // console.log('⚠️ [AVATAR-INPUT] No avatar_url in response, using default');
                    avatarEl.src = 'assets/Logo 2.png';
                }
            } else {
                console.error('❌ [AVATAR-INPUT] Profile API failed with status:', response.status);
                const errorText = await response.text();
                console.error('❌ [AVATAR-INPUT] Error response:', errorText);
                avatarEl.src = 'assets/Logo 2.png';
            }
        } catch (error) {
            console.error('❌ [AVATAR-INPUT] Avatar load error:', error);
            console.error('❌ [AVATAR-INPUT] Error stack:', error.stack);
            avatarEl.src = 'assets/Logo 2.png';
        }
        
        // console.log('🖼️ [AVATAR-INPUT] loadCommentInputAvatar() complete');
        // console.log('🖼️ ============================================');
    }

    async loadMangaRating() {
        if (!this.mangaId) return;

        try {
            const token = localStorage.getItem('authToken');
            const headers = {};
            
            // Include token if logged in so backend can return userRating
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            // Force fresh data with cache-busting timestamp
            const response = await fetch(
                `${this.API_BASE}/ratings/manga/${this.mangaId}?_t=${Date.now()}`,
                { headers }
            );
            const data = await response.json();

            dLog('[INFO-RATING] Raw API response:', data);
            dLog('[INFO-RATING] bayesianAverage:', data.bayesianAverage);
            dLog('[INFO-RATING] totalRatings:', data.totalRatings);
            dLog('[INFO-RATING] userRating:', data.userRating);

            if (data.success) {
                // Backend returns: bayesianAverage, totalRatings, userRating
                const ratingData = {
                    averageRating: data.bayesianAverage || 8.0,
                    totalRatings: data.totalRatings || 0,
                    userRating: data.userRating // null jika belum rating, number jika sudah
                };
                dLog('[INFO-RATING] Parsed rating data:', ratingData);
                this.displayMangaRating(ratingData);
                
                // ✅ FIX: Show or hide rating input based on userRating and login status
                const ratingInput = document.getElementById('mangaRatingInput');
                if (ratingInput) {
                    if (this.isLoggedIn && data.userRating === null) {
                        // User logged in and hasn't rated yet - show input
                        ratingInput.style.display = 'block';
                        dLog('[INFO-RATING] Rating input shown - user not rated yet');
                    } else {
                        // User already rated or not logged in - hide input
                        ratingInput.style.display = 'none';
                        if (data.userRating !== null) {
                            dLog('[INFO-RATING] Rating input hidden - user already rated:', data.userRating);
                        } else {
                            dLog('[INFO-RATING] Rating input hidden - user not logged in');
                        }
                    }
                }
            } else {
                this.displayMangaRating({ averageRating: 8.0, totalRatings: 0, userRating: null });
            }
        } catch (error) {
            console.error('[INFO-RATING] Load error:', error);
            this.displayMangaRating({ averageRating: 8.0, totalRatings: 0 });
        }
    }

    displayMangaRating(rating) {
        const scoreEl = document.getElementById('mangaRatingScore');
        const countEl = document.getElementById('mangaRatingCount');

        const score = rating.averageRating || 8.0;
        const count = rating.totalRatings || 0;

        dLog('[INFO-RATING] Displaying rating:', score, 'Count:', count);
        dLog('[INFO-RATING] Rating object:', rating);

        if (scoreEl) {
            scoreEl.textContent = score.toFixed(1);
            dLog('[INFO-RATING] Score element updated to:', score.toFixed(1));
        } else {
            console.error('[INFO-RATING] mangaRatingScore element not found');
        }
        
        if (countEl) {
            countEl.textContent = count;
            dLog('[INFO-RATING] Count element updated to:', count);
        } else {
            console.error('[INFO-RATING] mangaRatingCount element not found');
        }
    }

    async loadComments() {
        if (!this.mangaId) return;

        try {
            const response = await fetch(
                `${this.API_BASE}/comments?mangaId=${this.mangaId}&limit=50&offset=0&_t=${Date.now()}`
            );
            const data = await response.json();

            dLog('[INFO-COMMENTS] Loaded:', data);
            // console.log('🖼️ [COMMENTS-DEBUG] First comment avatar_url:', data.comments?.[0]?.avatar_url);

            if (data.success && data.comments && data.comments.length > 0) {
                this.displayComments(data.comments);
            } else {
                this.showNoComments();
            }
        } catch (error) {
            console.error('[INFO-COMMENTS] Load error:', error);
            this.showNoComments();
        }
    }

    displayComments(comments) {
        const listEl = document.getElementById('commentsList');
        if (!listEl) return;

        // Separate parent comments and replies
        const parentComments = comments.filter(c => !c.parent_id);
        const replies = comments.filter(c => c.parent_id);
        
        // Create a map of parent ID to replies
        const repliesMap = {};
        replies.forEach(reply => {
            if (!repliesMap[reply.parent_id]) {
                repliesMap[reply.parent_id] = [];
            }
            repliesMap[reply.parent_id].push(reply);
        });
        
        // Sort replies by created_at ASC (oldest first) for each parent
        Object.keys(repliesMap).forEach(parentId => {
            repliesMap[parentId].sort((a, b) => 
                new Date(a.created_at) - new Date(b.created_at)
            );
        });
        
        // Render parent comments with their replies
        let html = '';
        parentComments.forEach(parent => {
            // Render parent comment
            html += this.renderComment(parent, false);
            
            // Render replies (indented)
            const parentReplies = repliesMap[parent.id] || [];
            parentReplies.forEach(reply => {
                html += this.renderComment(reply, true);
            });
        });
        
        listEl.innerHTML = html;
    }

    renderComment(comment, isReply = false) {
        const token = localStorage.getItem('authToken');
        const isOwner = this.isLoggedIn && comment.user_id === this.getUserIdFromToken(token);
        const canEdit = isOwner && !comment.is_edited; // Only show edit button if not edited yet
        
        // Debug logging
        dLog('[COMMENT-RENDER] Comment ID:', comment.id);
        dLog('[COMMENT-RENDER] isLoggedIn:', this.isLoggedIn);
        dLog('[COMMENT-RENDER] comment.user_id:', comment.user_id);
        dLog('[COMMENT-RENDER] token userId:', this.getUserIdFromToken(token));
        dLog('[COMMENT-RENDER] isOwner:', isOwner);
        dLog('[COMMENT-RENDER] is_edited:', comment.is_edited);
        dLog('[COMMENT-RENDER] canEdit:', canEdit);
        dLog('[COMMENT-RENDER] isReply:', isReply);
        dLog('[COMMENT-RENDER] parent_id:', comment.parent_id);
        
        const date = new Date(comment.created_at);
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Add cache busting for avatar
        const baseAvatarUrl = comment.avatar_url || 'assets/Logo 2.png';
        const avatarUrl = baseAvatarUrl.includes('?') ? `${baseAvatarUrl}&t=${Date.now()}` : `${baseAvatarUrl}?t=${Date.now()}`;
        
        if (!comment.avatar_url) {
            dWarn('⚠️ [COMMENT-AVATAR] No avatar_url in comment data - manga-auth-worker needs deployment');
        }
        
        // Add CSS class and data attributes for threading
        const commentClass = isReply ? 'comment-item comment-reply' : 'comment-item';
        const parentIdAttr = comment.parent_id ? `data-parent-id="${comment.parent_id}"` : '';

        return `
            <div class="${commentClass}" data-id="${comment.id}" ${parentIdAttr}>
                <div class="comment-top-box">
                    <img class="comment-avatar" src="${avatarUrl}" alt="${comment.username}" onerror="this.src='assets/Logo 2.png'" />
                    <div class="comment-header">
                        <span class="comment-user">@${comment.username}</span>
                        <span class="comment-date">${formattedDate}</span>
                    </div>
                </div>
                <div class="comment-bottom-box">
                    <div class="comment-content">${this.escapeHtml(comment.content)}</div>
                    <div class="comment-actions">
                        ${this.isLoggedIn ? `
                        <button class="btn-reply-comment" data-username="${comment.username}">
                            <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 10H7a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a2 2 0 0 0 -2 -2h-2"></path>
                                <path d="M12 3v9"></path>
                                <path d="M9 9l3 -3l3 3"></path>
                            </svg>
                            Reply
                        </button>` : ''}
                        ${canEdit ? `
                        <button class="btn-edit-comment" data-id="${comment.id}">
                            <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                        </button>` : ''}
                        ${isOwner ? `
                        <button class="btn-delete-comment" data-id="${comment.id}">
                            <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Hapus
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    showNoComments() {
        const listEl = document.getElementById('commentsList');
        if (!listEl) return;

        listEl.innerHTML = `
            <div class="comment-placeholder">
                <p>Belum ada komentar. Jadilah yang pertama!</p>
            </div>
        `;
    }

    getUserIdFromToken(token) {
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.userId;
        } catch {
            return null;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupEventListeners() {
        // Login button - trigger existing login modal
        const btnLogin = document.getElementById('btnLoginComment');
        if (btnLogin) {
            btnLogin.addEventListener('click', () => {
                dLog('[INFO-RATING] Login button clicked');
                const btnOpenLogin = document.getElementById('btnOpenLogin');
                if (btnOpenLogin) {
                    dLog('[INFO-RATING] Triggering header login button');
                    btnOpenLogin.click();
                } else {
                    console.error('[INFO-RATING] Header login button not found');
                }
            });
            dLog('[INFO-RATING] Login button event listener attached');
        } else {
            console.error('[INFO-RATING] btnLoginComment not found');
        }

        // Rating stars
        const stars = document.querySelectorAll('.star-input-compact');
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                this.selectedRating = index + 1;
                this.highlightStars(this.selectedRating);
            });
        });

        // Submit rating
        const btnSubmitRating = document.getElementById('btnSubmitMangaRating');
        if (btnSubmitRating) {
            btnSubmitRating.addEventListener('click', () => this.submitRating());
        }

        // Comment textarea char count
        const textarea = document.getElementById('commentTextarea');
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                const charCount = document.getElementById('commentCharCount');
                if (charCount) charCount.textContent = e.target.value.length;
            });
        }

        // Submit comment
        const btnSubmitComment = document.getElementById('btnSubmitComment');
        if (btnSubmitComment) {
            btnSubmitComment.addEventListener('click', () => this.submitComment());
        }

        // Reply, Edit & Delete (event delegation)
        const commentsList = document.getElementById('commentsList');
        dLog('[SETUP] commentsList element:', commentsList);
        if (commentsList) {
            dLog('[SETUP] Adding click event listener to commentsList');
            commentsList.addEventListener('click', (e) => {
                dLog('[CLICK] Click detected on:', e.target);
                dLog('[CLICK] Target classList:', e.target.classList);
                dLog('[CLICK] Target tagName:', e.target.tagName);
                
                // Use closest() to handle clicks on SVG/text inside buttons
                const replyBtn = e.target.closest('.btn-reply-comment');
                const editBtn = e.target.closest('.btn-edit-comment');
                const deleteBtn = e.target.closest('.btn-delete-comment');
                
                dLog('[CLICK] Found replyBtn:', replyBtn);
                dLog('[CLICK] Found editBtn:', editBtn);
                dLog('[CLICK] Found deleteBtn:', deleteBtn);
                
                if (replyBtn) {
                    const username = replyBtn.dataset.username;
                    const commentElement = replyBtn.closest('.comment-item');
                    const commentId = commentElement?.dataset?.id;
                    dLog('[REPLY-BTN] Clicked reply for:', username);
                    dLog('[REPLY-BTN] Comment element found:', commentElement);
                    dLog('[REPLY-BTN] Comment element ID:', commentId);
                    if (commentId) {
                        dLog('[REPLY-BTN] Calling replyToComment()...');
                        this.replyToComment(username, commentId);
                    }
                } else if (editBtn) {
                    const commentId = editBtn.dataset.id;
                    dLog('[EDIT-BTN] Clicked edit for comment ID:', commentId);
                    dLog('[EDIT-BTN] Calling editComment()...');
                    this.editComment(commentId);
                } else if (deleteBtn) {
                    const commentId = deleteBtn.dataset.id;
                    dLog('[DELETE-BTN] Clicked delete for comment ID:', commentId);
                    dLog('[DELETE-BTN] Calling deleteComment()...');
                    this.deleteComment(commentId);
                }
            });
            dLog('[SETUP] Event listener added successfully');
        } else {
            console.error('[SETUP] commentsList element NOT FOUND!');
        }
    }

    highlightStars(count) {
        const stars = document.querySelectorAll('.star-input-compact');
        stars.forEach((star, index) => {
            if (index < count) {
                star.textContent = '★';
                star.classList.add('active');
            } else {
                star.textContent = '☆';
                star.classList.remove('active');
            }
        });
    }

    async submitRating() {
        if (!this.isLoggedIn) {
            showToast('Silakan login terlebih dahulu', 'warning');
            return;
        }

        if (this.selectedRating === 0) {
            showToast('Pilih rating 1-10 terlebih dahulu', 'warning');
            return;
        }

        const token = localStorage.getItem('authToken');
        const btnSubmit = document.getElementById('btnSubmitMangaRating');
        
        // Show submitting state
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Mengirim...';
        }
        
        try {
            const response = await fetch(`${this.API_BASE}/ratings/manga`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    mangaId: this.mangaId,
                    rating: this.selectedRating
                })
            });

            const data = await response.json();
            if (data.success) {
                // Show success state
                if (btnSubmit) {
                    btnSubmit.classList.add('success');
                    btnSubmit.textContent = '✅ Rating Berhasil Dikirim!';
                }
                
                this.selectedRating = 0;
                this.highlightStars(0);
                
                // Immediately hide rating input
                const ratingInput = document.getElementById('mangaRatingInput');
                if (ratingInput) {
                    ratingInput.style.display = 'none';
                    dLog('[INFO-RATING] Rating input hidden immediately after submit');
                }
                
                // Wait 1 second to show success, then reload rating data
                setTimeout(async () => {
                    await this.loadMangaRating();
                    dLog('[INFO-RATING] Rating submitted and refreshed');
                }, 1000);
            } else {
                showToast(data.error || 'Gagal mengirim rating', 'error');
                
                // Reset button on error
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Kirim Rating';
                }
            }
        } catch (error) {
            console.error('[INFO-RATING] Submit error:', error);
            showToast('Terjadi kesalahan saat mengirim rating', 'error');
            
            // Reset button on error
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Kirim Rating';
            }
        }
    }

    async submitComment() {
        if (!this.isLoggedIn) {
            showToast('Silakan login terlebih dahulu', 'warning');
            return;
        }

        const textarea = document.getElementById('commentTextarea');
        const content = textarea.value.trim();

        if (!content) {
            showToast('Komentar tidak boleh kosong', 'warning');
            return;
        }

        const token = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${this.API_BASE}/comments/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    mangaId: this.mangaId,
                    content: content
                })
            });

            const data = await response.json();
            if (data.success) {
                textarea.value = '';
                document.getElementById('commentCharCount').textContent = '0';
                showToast('Komentar berhasil dikirim!', 'success');
                await this.loadComments();
            } else {
                showToast(data.error || 'Gagal mengirim komentar', 'error');
            }
        } catch (error) {
            console.error('[INFO-COMMENTS] Submit error:', error);
            showToast('Terjadi kesalahan saat mengirim komentar', 'error');
        }
    }

    // Helper: Cleanup any active reply/edit/delete actions
    cleanupActiveActions() {
        // Remove all reply boxes
        document.querySelectorAll('.comment-reply-box').forEach(box => box.remove());
        
        // Remove all delete confirmation boxes
        document.querySelectorAll('.comment-delete-confirm').forEach(box => box.remove());
        
        // Restore all edit wrappers to original content
        document.querySelectorAll('.comment-edit-wrapper').forEach(wrapper => {
            const content = wrapper.querySelector('.comment-textarea').value;
            const contentEl = document.createElement('div');
            contentEl.className = 'comment-content';
            contentEl.textContent = content;
            wrapper.replaceWith(contentEl);
        });
    }

    async replyToComment(username, commentId) {
        // Cleanup any active actions first (ensure only 1 action at a time)
        this.cleanupActiveActions();
        
        // Find the comment element
        const targetComment = document.querySelector(`.comment-item[data-id="${commentId}"]`);
        if (!targetComment) {
            console.error('[REPLY] Target comment element not found!');
            return;
        }
        
        // Get parent comment ID for threading
        // If replying to a reply, use the original parent_id, not the reply's id
        // This ensures all replies stay at same level (1-level threading)
        const parentIdAttr = targetComment.dataset.parentId;
        const parentId = parentIdAttr && parentIdAttr !== 'null' ? parentIdAttr : commentId;
        
        dLog('[REPLY-FUNC] Parent ID for reply:', parentId);
        
        // Get user avatar - try to get from existing comment input avatar first
        let userAvatarUrl = 'assets/Logo 2.png';
        const existingAvatar = document.getElementById('commentInputAvatar');
        
        if (existingAvatar && existingAvatar.src && !existingAvatar.src.includes('Logo 2.png')) {
            // Use the avatar from comment input if it's already loaded
            userAvatarUrl = existingAvatar.src;
        } else {
            // Otherwise fetch from API
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const response = await fetch('https://profile-worker.nuranantoadhien.workers.dev/profile/me', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        cache: 'no-store'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const avatarUrl = data.profile?.avatarUrl || data.profile?.avatar_url || data.avatar_url || data.avatarUrl;
                        
                        if (avatarUrl) {
                            userAvatarUrl = avatarUrl.includes('?') 
                                ? `${avatarUrl}&t=${Date.now()}` 
                                : `${avatarUrl}?t=${Date.now()}`;
                        }
                    }
                } catch (error) {
                    console.error('[REPLY-AVATAR] Failed to load user avatar:', error);
                }
            }
        }
        
        // Create reply box
        const replyBox = document.createElement('div');
        replyBox.className = 'comment-reply-box';
        replyBox.innerHTML = `
            <div class="reply-box-header">
                <span class="reply-to-label">Membalas @${username}</span>
            </div>
            <div class="comment-input-wrapper">
                <img class="comment-avatar" src="${userAvatarUrl}" alt="Avatar" onerror="this.src='assets/Logo 2.png'" />
                <div class="comment-input-content">
                    <textarea 
                        class="comment-textarea reply-textarea" 
                        placeholder="Tulis balasan Anda... (max 500 karakter)"
                        maxlength="500">@${username} </textarea>
                    <div class="comment-input-footer">
                        <span class="comment-char-count">
                            <span class="reply-char-count">${username.length + 2}</span>/500
                        </span>
                        <div class="reply-actions">
                            <button class="btn-send-reply" data-username="${username}">
                                <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                                Kirim
                            </button>
                            <button class="btn-cancel-reply">
                                <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after the target comment
        dLog('[REPLY-INSERT] About to insert reply box');
        dLog('[REPLY-INSERT] Target comment before insert:', targetComment);
        dLog('[REPLY-INSERT] Next sibling before insert:', targetComment.nextElementSibling);
        
        targetComment.insertAdjacentElement('afterend', replyBox);
        
        dLog('[REPLY-INSERT] Reply box inserted');
        dLog('[REPLY-INSERT] Next sibling after insert:', targetComment.nextElementSibling);
        dLog('[REPLY-INSERT] Reply box parent:', replyBox.parentElement);
        dLog('[REPLY-INSERT] Reply box classList:', replyBox.classList);
        
        // Focus on textarea and set cursor at end
        const textarea = replyBox.querySelector('.reply-textarea');
        textarea.focus();
        // Move cursor to end after @username mention
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        
        // Character count
        const charCountEl = replyBox.querySelector('.reply-char-count');
        textarea.addEventListener('input', (e) => {
            charCountEl.textContent = e.target.value.length;
        });
        
        // Send reply button
        const btnSend = replyBox.querySelector('.btn-send-reply');
        btnSend.addEventListener('click', async () => {
            const content = textarea.value.trim();
            if (!content || content === `@${username}`) {
                showToast('Balasan tidak boleh kosong', 'warning');
                return;
            }
            
            // Ensure @username mention is at the start
            const finalContent = content.startsWith(`@${username}`) ? content : `@${username} ${content}`;
            
            const token = localStorage.getItem('authToken');
            try {
                const response = await fetch(`${this.API_BASE}/comments/add`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        mangaId: this.mangaId,
                        content: finalContent,
                        parentId: parentId
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    showToast('Balasan berhasil dikirim!', 'success');
                    replyBox.remove();
                    await this.loadComments();
                } else {
                    showToast(data.error || 'Gagal mengirim balasan', 'error');
                }
            } catch (error) {
                console.error('[INFO-COMMENTS] Reply error:', error);
                showToast('Terjadi kesalahan saat mengirim balasan', 'error');
            }
        });
        
        // Cancel button
        const btnCancel = replyBox.querySelector('.btn-cancel-reply');
        btnCancel.addEventListener('click', () => {
            replyBox.remove();
            // Show action buttons again
            if (actionsEl) {
                actionsEl.style.display = 'flex';
            }
        });
        
        // Scroll into view
        replyBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async editComment(commentId) {
        // Cleanup any active actions first (ensure only 1 action at a time)
        this.cleanupActiveActions();
        
        // Find the comment element
        const commentEl = document.querySelector(`.comment-item[data-id="${commentId}"]`);
        if (!commentEl) {
            console.error('[EDIT] Comment element not found!');
            return;
        }

        // Get current comment content
        const contentEl = commentEl.querySelector('.comment-content');
        const currentContent = contentEl.textContent.trim();

        // Create edit wrapper with simplified structure (no avatar needed)
        const editWrapper = document.createElement('div');
        editWrapper.className = 'comment-edit-wrapper';
        editWrapper.innerHTML = `
            <textarea 
                class="comment-textarea" 
                maxlength="500">${currentContent}</textarea>
            <div class="comment-input-footer">
                <span class="comment-char-count">
                    <span class="edit-char-count">${currentContent.length}</span>/500
                </span>
                <div class="reply-actions">
                    <button class="btn-save-edit" data-id="${commentId}">
                        <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Simpan
                    </button>
                    <button class="btn-cancel-edit">
                        <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Batal
                    </button>
                </div>
            </div>
        `;

        // Replace content with edit wrapper
        contentEl.replaceWith(editWrapper);
        
        const editArea = editWrapper.querySelector('.comment-textarea');
        editArea.focus();
        
        // Character count update
        const charCountEl = editWrapper.querySelector('.edit-char-count');
        editArea.addEventListener('input', (e) => {
            charCountEl.textContent = e.target.value.length;
        });

        // Save button handler
        const btnSave = editWrapper.querySelector('.btn-save-edit');
        btnSave.addEventListener('click', async () => {
            const newContent = editArea.value.trim();
            if (!newContent) {
                showToast('Komentar tidak boleh kosong', 'warning');
                return;
            }

            const token = localStorage.getItem('authToken');
            try {
                const response = await fetch(`${this.API_BASE}/comments/${commentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ content: newContent })
                });

                const data = await response.json();
                if (data.success) {
                    showToast('Komentar berhasil diupdate', 'success');
                    await this.loadComments();
                } else {
                    showToast(data.error || 'Gagal mengupdate komentar', 'error');
                }
            } catch (error) {
                console.error('[INFO-COMMENTS] Edit error:', error);
                showToast('Terjadi kesalahan saat mengupdate komentar', 'error');
            }
        });

        // Cancel button handler
        const btnCancel = editWrapper.querySelector('.btn-cancel-edit');
        btnCancel.addEventListener('click', () => {
            const newContentEl = document.createElement('div');
            newContentEl.className = 'comment-content';
            newContentEl.textContent = currentContent;
            editWrapper.replaceWith(newContentEl);
        });
    }

    async deleteComment(commentId) {
        // Cleanup any active actions first (ensure only 1 action at a time)
        this.cleanupActiveActions();
        
        // Find the comment element
        const commentEl = document.querySelector(`.comment-item[data-id="${commentId}"]`);
        if (!commentEl) {
            console.error('[DELETE] Comment element not found!');
            return;
        }
        
        // Create delete confirmation box
        const confirmBox = document.createElement('div');
        confirmBox.className = 'comment-delete-confirm';
        confirmBox.innerHTML = `
            <div class="delete-confirm-content">
                <svg class="delete-warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span class="delete-confirm-text">Yakin ingin menghapus komentar ini?</span>
            </div>
            <div class="delete-confirm-actions">
                <button class="btn-confirm-delete" data-id="${commentId}">
                    <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Hapus
                </button>
                <button class="btn-cancel-delete">
                    <svg class="comment-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Batal
                </button>
            </div>
        `;
        
        // Insert after comment content
        const contentEl = commentEl.querySelector('.comment-content');
        if (contentEl) {
            contentEl.after(confirmBox);
        }
        
        // Confirm delete button
        const btnConfirm = confirmBox.querySelector('.btn-confirm-delete');
        btnConfirm.addEventListener('click', async () => {
            const token = localStorage.getItem('authToken');
            try {
                const response = await fetch(`${this.API_BASE}/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                if (data.success) {
                    showToast(data.message || 'Komentar berhasil dihapus', 'success');
                    await this.loadComments();
                } else {
                    showToast(data.error || 'Gagal menghapus komentar', 'error');
                }
            } catch (error) {
                console.error('[INFO-COMMENTS] Delete error:', error);
                showToast('Terjadi kesalahan saat menghapus komentar', 'error');
            }
        });
        
        // Cancel delete button
        const btnCancel = confirmBox.querySelector('.btn-cancel-delete');
        btnCancel.addEventListener('click', () => {
            confirmBox.remove();
        });
        
        // Scroll into view
        confirmBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Initialize rating & comments on DOMContentLoaded
window.infoMangaRatingComments = null;

document.addEventListener('DOMContentLoaded', () => {
    // Get repo param from URL
    const urlParams = new URLSearchParams(window.location.search);
    const repoParam = urlParams.get('repo');
    
    if (repoParam) {
        dLog('[INFO-RATING] Initializing with repo:', repoParam);
        window.infoMangaRatingComments = new InfoMangaRatingComments();
        window.infoMangaRatingComments.init(repoParam);
    } else {
        dWarn('[INFO-RATING] No repo parameter found');
    }
    
    // ✅ Initialize notification tabs (same as index.html)
    initializeNotificationTabs();
});

/**
 * Initialize notification tabs (Komentar & Update)
 */
function initializeNotificationTabs() {
    const tabs = document.querySelectorAll('.notification-tab');
    
    if (tabs.length === 0) {
        return; // No tabs found, skip
    }
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show/hide content sections
            const commentsSection = document.getElementById('notificationComments');
            const updatesSection = document.getElementById('notificationUpdates');
            
            if (targetTab === 'comments') {
                // Show comments, hide updates
                if (commentsSection) {
                    commentsSection.style.display = 'block';
                    commentsSection.classList.add('active');
                }
                if (updatesSection) {
                    updatesSection.style.display = 'none';
                    updatesSection.classList.remove('active');
                }
                
                // Load comments notifications (handled by common.js)
                if (window.loadNotifications && typeof window.loadNotifications === 'function') {
                    window.loadNotifications();
                }
            } else if (targetTab === 'updates') {
                // Show updates, hide comments
                if (commentsSection) {
                    commentsSection.style.display = 'none';
                    commentsSection.classList.remove('active');
                }
                if (updatesSection) {
                    updatesSection.style.display = 'block';
                    updatesSection.classList.add('active');
                }
                
                // Load update notifications (handled by common.js)
                if (window.loadUpdateNotifications && typeof window.loadUpdateNotifications === 'function') {
                    window.loadUpdateNotifications();
                }
            }
        });
    });
}

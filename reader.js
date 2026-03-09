/**
 * READER.JS - MANIFEST-BASED WITH DECRYPTION
 * Reads encrypted manifest.json and decrypts page URLs
 */

dLog('🚀 Reader.js loading...');

// ============================================
// GLOBAL ERROR HANDLER FOR DEBUGGING
// ============================================
window.addEventListener('error', function(event) {
    console.error('❌ Global Error:', event.error);
    console.error('Stack:', event.error?.stack);
    console.error('Message:', event.message);
    console.error('Filename:', event.filename);
    console.error('Line:', event.lineno, 'Column:', event.colno);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ Unhandled Promise Rejection:', event.reason);
    console.error('Promise:', event.promise);
});

dLog('✅ Error handlers registered');

// ============================================
// 🔒 SESSION TOKEN + TURNSTILE (anti-bot)
// Turnstile hanya 1x per 2 jam, sisanya pakai session token (instant)
// ============================================
const TURNSTILE_SITE_KEY = '0x4AAAAAAClGo7oYQZ9NW9J1';
let turnstileWidgetId = null;

// Session token: stored in localStorage, survives tab close
function getSessionToken() {
    try {
        const token = localStorage.getItem('_st');
        if (!token) return null;
        // Quick client-side expiry check (server will re-verify)
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        const expires = parseInt(parts[1]);
        if (isNaN(expires) || expires < Math.floor(Date.now() / 1000) + 60) return null; // 60s buffer
        return token;
    } catch (e) { return null; }
}

function saveSessionToken(token) {
    try { if (token) localStorage.setItem('_st', token); } catch (e) {}
}

// Wait for Turnstile API to load
function waitForTurnstile(timeout = 5000) {
    return new Promise((resolve) => {
        if (window.turnstile) { resolve(true); return; }
        const start = Date.now();
        const interval = setInterval(() => {
            if (window.turnstile) { clearInterval(interval); resolve(true); }
            else if (Date.now() - start > timeout) { clearInterval(interval); resolve(false); }
        }, 100);
    });
}

// Get a fresh Turnstile token (only called when session expired)
function getTurnstileToken() {
    return new Promise(async (resolve, reject) => {
        try {
            const ready = await waitForTurnstile();
            if (!ready) { reject(new Error('Turnstile not loaded')); return; }
            
            if (turnstileWidgetId !== null) {
                try { turnstile.remove(turnstileWidgetId); } catch(e) {}
                turnstileWidgetId = null;
            }
            
            const container = document.getElementById('turnstile-container');
            if (!container) { reject(new Error('Turnstile container not found')); return; }
            
            turnstileWidgetId = turnstile.render(container, {
                sitekey: TURNSTILE_SITE_KEY,
                size: 'compact',
                callback: (token) => resolve(token),
                'error-callback': () => reject(new Error('Turnstile challenge failed')),
                'expired-callback': () => reject(new Error('Turnstile token expired')),
                'timeout-callback': () => reject(new Error('Turnstile timeout'))
            });
        } catch (e) {
            reject(e);
        }
    });
}

// ============================================
// CHECK DEPENDENCIES
// ============================================
dLog('🔍 Checking dependencies...');
dLog('  - DEBUG_MODE:', typeof DEBUG_MODE !== 'undefined' ? DEBUG_MODE : 'UNDEFINED');
dLog('  - MANGA_LIST:', typeof MANGA_LIST !== 'undefined' ? `Array(${MANGA_LIST.length})` : 'UNDEFINED');
dLog('  - MANGA_REPOS:', typeof MANGA_REPOS !== 'undefined' ? `Object(${Object.keys(MANGA_REPOS).length} keys)` : 'UNDEFINED');
dLog('  - fetchFreshJSON:', typeof fetchFreshJSON !== 'undefined' ? 'DEFINED' : 'UNDEFINED');
dLog('  - getCachedData:', typeof getCachedData !== 'undefined' ? 'DEFINED' : 'UNDEFINED');

// ============================================
// DECRYPTION MODULE
// ============================================

const ENCRYPTION_ALGORITHM = 'AES-CBC';

/**
 * ✅ Force fresh fetch - no cache
 */
/**
 * ✅ FIXED: No custom headers to avoid CORS preflight
 */
// ============================================
// 🛡️ SMART LOGGING - PRODUCTION MODE
// ============================================
// Note: Uses common.js for shared utilities (DEBUG_MODE, fetchFreshJSON, cache functions, etc.)
// For reader.js, use getCachedData(key, maxAge, true) to use sessionStorage
    
// All helper functions (saveValidatedChapter, checkIsDonatur, getUserDonaturStatus) are now in common.js

async function showLockedChapterModal(chapterNumber = null, chapterFolder = null) {
    // ✅ SECURITY: Always verify with backend for locked chapters (NO CACHE)
    const isDonatur = await verifyDonaturStatusStrict();
    
    if (isDonatur) {
        // ✅ DONATUR SETIA - Langsung buka chapter tanpa modal (untuk semua type: manga & webtoon)
    if (DEBUG_MODE) dLog('✅ Donatur SETIA - Opening chapter directly');
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        // ✅ Security: Validate parameters before redirect
        if (repoParam && chapterFolder && validateRepoParam(repoParam) && validateChapterParam(chapterFolder)) {
            window.location.href = `reader.html?repo=${encodeURIComponent(repoParam)}&chapter=${encodeURIComponent(chapterFolder)}`;
        }
        return;
    }
    
    // ✅ PEMBACA SETIA - Show modal untuk kembali ke info page (untuk semua type: manga & webtoon)
    if (DEBUG_MODE) dLog('🔒 PEMBACA SETIA - Showing modal to go back to info page');
    
    const loginRequiredModal = document.getElementById('loginRequiredModal');
    if (!loginRequiredModal) {
    if (DEBUG_MODE) console.error('❌ loginRequiredModal element not found!');
        return;
    }
    
    loginRequiredModal.style.display = 'flex';
    loginRequiredModal.classList.add('active');
    
    // Conditional: Hide trakteer button for webtoon type
    const mangaType = mangaData?.manga?.type || 'manga';
    const btnTrakteerPost = document.getElementById('btnTrakteerPost');
    if (btnTrakteerPost) {
        if (mangaType === 'webtoon') {
            btnTrakteerPost.style.display = 'none';
        } else {
            btnTrakteerPost.style.display = 'block';
        }
    }
    
    if (DEBUG_MODE) dLog('🔒 Chapter Terkunci modal shown');
    
    const btnBackToInfo = document.getElementById('btnBackToInfoFromModal');
    const btnClose = document.getElementById('btnCloseLoginRequired');
    
    const closeModal = () => {
        loginRequiredModal.classList.remove('active');
        setTimeout(() => {
            loginRequiredModal.style.display = 'none';
        }, 300);
    };
    
    if (btnBackToInfo) {
        btnBackToInfo.onclick = () => {
            closeModal();
            // Navigate back to info page
            const urlParams = new URLSearchParams(window.location.search);
            const repoParam = urlParams.get('repo');
            if (repoParam) {
                window.location.href = `info-manga.html?repo=${repoParam}`;
            }
        };
    }
    
    if (btnClose) {
        btnClose.onclick = closeModal;
    }
    
    loginRequiredModal.onclick = (e) => {
        if (e.target === loginRequiredModal) {
            closeModal();
        }
    };
}

// isChapterValidated() and saveValidatedChapter() are now in common.js

/**
 * Clear validation session for a chapter
 * Note: This function is kept for backward compatibility but delegates to common.js
 */
function clearValidatedChapter(repoName, chapter) {
    const key = `validated_${repoName}_${chapter}`;
    sessionStorage.removeItem(key);
    if (DEBUG_MODE) dLog(`🗑️  Cleared session for ${chapter}`);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function padNumber(num, length) {
    return String(num).padStart(length, '0');
}

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

// ============================================
// MANGA_REPOS sudah di-export dari manga-config.js
// ============================================

const TRAKTEER_LINK = 'https://trakteer.id/NuranantoScanlation';
const VIEW_COUNTER_URL = 'https://manga-view-counter.nuranantoadhien.workers.dev';

// ============================================
// SMART END CHAPTER LOGIC
// ============================================

function predictNextChapter(allChapters, currentChapterFolder) {
    const currentIndex = allChapters.findIndex(ch => ch.folder === currentChapterFolder);
    
    const recentChapters = [];
    for (let i = currentIndex; i < Math.min(currentIndex + 4, allChapters.length); i++) {
        if (allChapters[i]) {
            recentChapters.push(allChapters[i].folder);
        }
    }
    
    const parseChapter = (folder) => {
        const match = folder.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
    };
    
    const numbers = recentChapters.map(parseChapter).filter(n => n !== null);
    
    if (numbers.length === 0) return null;
    
    if (numbers.length === 1) {
        const current = numbers[0];
        return Math.floor(current) === current ? current + 1 : (parseFloat(current) + 0.1).toFixed(1);
    }
    
    const current = numbers[0];
    const previous = numbers[1];
    const lastDiff = Math.abs(current - previous);
    
    if (lastDiff <= 0.5) {
        const next = current + lastDiff;
        return lastDiff < 1 ? next.toFixed(1) : Math.round(next);
    }
    
    const currentInt = Math.floor(current);
    const currentDec = parseFloat((current - currentInt).toFixed(1));
    
    if (currentDec > 0) {
        const nextDec = parseFloat((currentDec + 0.1).toFixed(1));
        return nextDec < 1 ? parseFloat((currentInt + nextDec).toFixed(1)) : currentInt + 1;
    } else {
        return currentInt + 1;
    }
}

function isOneshotChapter(chapterFolder) {
    const lower = chapterFolder.toLowerCase();
    return lower.includes('oneshot') || lower.includes('one-shot') || lower === 'os';
}

let mangaData = null;
let currentChapterFolder = null;
let currentChapter = null;
let allChapters = [];
let repoParam = null;
let readMode = 'webtoon';
let currentPage = 1;
let totalPages = 0;
let hasUserScrolled = false; // Track if user has scrolled

const readerContainer = document.getElementById('readerContainer');
const navProgressBar = document.getElementById('navProgressBar');
const navProgressExpanded = document.getElementById('navProgressExpanded');
const progressFill = document.getElementById('progressFill');
const pageThumbnails = document.getElementById('pageThumbnails');

document.addEventListener('DOMContentLoaded', async () => {
    dLog('✅ DOM Content Loaded');
    try {
        dLog('🔧 Initializing protection...');
        initProtection();
        dLog('✅ Protection initialized');
        
        dLog('🔧 Initializing reader...');
        await initializeReader();
        dLog('✅ Reader initialized');
        
        dLog('🔧 Setting up event listeners...');
        setupEnhancedEventListeners();
        dLog('✅ Event listeners set up');
        
        dLog('🔧 Initializing global login button...');
        initGlobalLoginButton(); // Setup redirect to info-manga
        dLog('✅ Global login button initialized');
        
        dLog('🎉 All initialization complete!');
    } catch (error) {
        console.error('❌ Fatal error during initialization:', error);
        console.error('Error stack:', error.stack);
        alert(`Terjadi kesalahan saat memuat reader:\n${error.message}\n\nSilakan refresh halaman atau kembali ke info.`);
        hideLoading();
    }
});

window.addEventListener('error', (event) => {
    if (DEBUG_MODE) console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    if (DEBUG_MODE) console.error('❌ Unhandled promise rejection:', event.reason);
});

/**
 * MODIFY EXISTING initializeReader function
 * Update logic untuk pass chapterFolder ke modal
 */
async function initializeReader() {
    try {
        showLoading();
        
    if (DEBUG_MODE) dLog('🚀 Initializing reader...');
        
        const urlParams = new URLSearchParams(window.location.search);
        const chapterParam = urlParams.get('chapter');
        repoParam = urlParams.get('repo') || urlParams.get('manga'); // Support both repo and manga params
        
    if (DEBUG_MODE) dLog('📋 Parameters:', { chapter: chapterParam, repo: repoParam });
    if (DEBUG_MODE) dLog('📋 Chapter type:', typeof chapterParam, 'Value:', JSON.stringify(chapterParam)); // ← TAMBAH INI
        
        // ✅ Security: Validate URL parameters
        if (!chapterParam || !validateChapterParam(chapterParam)) {
            alert('Error: Parameter chapter tidak valid atau tidak ditemukan.');
            hideLoading();
            return;
        }
        
        if (!repoParam || !validateRepoParam(repoParam)) {
            alert('Error: Parameter repo atau manga tidak valid atau tidak ditemukan.');
            hideLoading();
            return;
        }
        
        await loadMangaData(repoParam);
        
        if (!mangaData) {
            alert('Error: Gagal memuat data manga.');
            hideLoading();
            return;
        }

        // ✅ TAMBAH INI (6 baris)
    if (DEBUG_MODE) dLog('📚 Available chapters:', allChapters.map(ch => ({
            folder: ch.folder,
            title: ch.title,
            locked: ch.locked
        })));
        
        const chapterData = findChapterByFolder(chapterParam);
        
        if (!chapterData) {
            alert(`Error: Chapter ${chapterParam} tidak ditemukan.`);
            hideLoading();
            return;
        }
        
// ✅ CHECK SESSION FIRST - BEFORE CHECKING LOCKED STATUS
const isValidated = isChapterValidated(repoParam, chapterParam);

// ✅ TAMBAH INI (5 baris)
    if (DEBUG_MODE) dLog('🔐 Lock status check:');
    if (DEBUG_MODE) dLog('   Chapter locked:', chapterData.locked);
    if (DEBUG_MODE) dLog('   Is validated:', isValidated);
    if (DEBUG_MODE) dLog('   Session key:', `validated_${repoParam}_${chapterParam}`);

// ✅ SECURITY: Always verify with backend for locked chapters (NO CACHE)
const isDonatur = chapterData.locked ? await verifyDonaturStatusStrict() : await getUserDonaturStatus();
const isActuallyLocked = chapterData.locked && !isValidated && !isDonatur;

if (isActuallyLocked) {
    if (DEBUG_MODE) dLog('🔒 Chapter terkunci, belum divalidasi, dan user bukan DONATUR SETIA');
    const chapterTitle = chapterData.title || chapterParam;
    showLockedChapterModal(chapterTitle, chapterParam);
    hideLoading(); // ← TAMBAH INI!
    return;
}

if (isValidated || isDonatur) {
    if (DEBUG_MODE) dLog('✅ Session valid atau user DONATUR SETIA, chapter unlocked');
    // Don't modify chapterData - just proceed to load
}

        
        currentChapter = chapterData;
        currentChapterFolder = chapterParam;
        totalPages = currentChapter.pages;
        
        setupUI();
        
        await loadChapterPages();
        
        trackChapterView();
        
    if (DEBUG_MODE) dLog('✅ Reader initialized successfully');
        
    } catch (error) {
    if (DEBUG_MODE) console.error('❌ Error initializing reader:', error);
        alert('Terjadi kesalahan saat memuat reader.');
        hideLoading();
    }
}

async function loadMangaData(repo) {
    dLog('📡 loadMangaData called with repo:', repo);
    try {
        // ✅ CHECK CACHE FIRST (5 minutes TTL)
        const cacheKey = `reader_manga_${repo}`;
        const cached = getCachedData(cacheKey, 300000, true); // 5 min, use sessionStorage
        dLog('💾 Cache check:', cached ? 'HIT' : 'MISS');
        
        if (cached) {
            mangaData = cached.mangaData;
            allChapters = cached.allChapters;
            window.currentGithubRepo = cached.githubRepo;
            
    if (DEBUG_MODE) dLog('✅ Manga data loaded from cache');
    if (DEBUG_MODE) dLog(`📚 Loaded ${allChapters.length} chapters (cached)`);
            return;
        }
        
        // ✅ CACHE MISS - Fetch fresh
        const mangaConfig = MANGA_REPOS[repo];
        
        if (!mangaConfig) {
            throw new Error(`Repo "${repo}" tidak ditemukan di mapping`);
        }
        
    if (DEBUG_MODE) dLog(`📡 Fetching fresh manga data from: ${repo}`);
        
        let mangaJsonUrl;
        if (typeof mangaConfig === 'string') {
            mangaJsonUrl = mangaConfig;
        } else {
            mangaJsonUrl = mangaConfig.url;
            window.currentGithubRepo = mangaConfig.githubRepo;
    if (DEBUG_MODE) dLog(`🔗 GitHub repo: ${mangaConfig.githubRepo}`);
        }
        
        mangaData = await fetchFreshJSON(mangaJsonUrl);
        
    if (DEBUG_MODE) dLog('📦 Manga data loaded:', mangaData);
        
        allChapters = Object.values(mangaData.chapters).sort((a, b) => {
            const getSort = (folder) => {
                const parts = folder.split('.');
                const int = parseInt(parts[0]) || 0;
                const dec = parts[1] ? parseInt(parts[1]) : 0;
                return int + (dec / 1000);
            };
            return getSort(b.folder) - getSort(a.folder);
        });
        
    if (DEBUG_MODE) dLog(`✅ Loaded ${allChapters.length} chapters`);
        
        // ✅ SAVE TO CACHE
        setCachedData(cacheKey, {
            mangaData,
            allChapters,
            githubRepo: window.currentGithubRepo
        });
    if (DEBUG_MODE) dLog(`💾 Cached manga data: ${cacheKey}`);
        
    } catch (error) {
    if (DEBUG_MODE) console.error('❌ Error loading manga data:', error);
        
        // ✅ FALLBACK: Try stale cache
        const staleCache = getCachedData(`reader_manga_${repo}`, Infinity, true);
        if (staleCache) {
    if (DEBUG_MODE) dWarn('⚠️ Using stale cache due to error');
            mangaData = staleCache.mangaData;
            allChapters = staleCache.allChapters;
            window.currentGithubRepo = staleCache.githubRepo;
            return;
        }
        
        throw error;
    }
}

function findChapterByFolder(folder) {
    if (!mangaData || !mangaData.chapters) return null;
    
    return Object.values(mangaData.chapters).find(ch => ch.folder === folder);
}

function saveLastPage() {
    const storageKey = `lastPage_${repoParam}_${currentChapterFolder}`;
    localStorage.setItem(storageKey, currentPage);
    if (DEBUG_MODE) dLog(`💾 Saved page ${currentPage} for ${currentChapterFolder}`);
}

function loadLastPage() {
    const storageKey = `lastPage_${repoParam}_${currentChapterFolder}`;
    const savedPage = localStorage.getItem(storageKey);
    
    if (savedPage) {
        const pageNum = parseInt(savedPage);
        if (pageNum > 0 && pageNum <= totalPages) {
    if (DEBUG_MODE) dLog(`📖 Restoring last page: ${pageNum}`);
            return pageNum;
        }
    }
    return 1;
}

function adjustChapterTitleFontSize(element) {
    const parentButton = element.closest('.chapter-btn');
    if (!parentButton) return;
    
    const maxHeight = 44;
    let fontSize = parseFloat(window.getComputedStyle(element).fontSize);
    const minFontSize = 10;
    
    const checkOverflow = () => {
        return element.scrollHeight > maxHeight;
    };
    
    while (checkOverflow() && fontSize > minFontSize) {
        fontSize -= 0.5;
        element.style.fontSize = `${fontSize}px`;
    }
    
    if (DEBUG_MODE) dLog(`📏 Chapter title font adjusted to: ${fontSize}px`);
}

function setupUI() {
    // ✅ Update old header (if exists - backward compatibility)
    const mangaTitleElement = document.getElementById('mangaTitle');
    if (mangaTitleElement) {
        mangaTitleElement.textContent = mangaData.manga.title;
        adjustTitleFontSize(mangaTitleElement);
    }
    
    const titleElement = document.getElementById('chapterTitle');
    if (titleElement) {
        titleElement.textContent = currentChapter.title;
        adjustChapterTitleFontSize(titleElement);
    }
    
    document.title = `${mangaData.manga.title} - ${currentChapter.title}`;

    // ✅ Update top navbar card with manga info
    const mangaTitleTopElement = document.getElementById('mangaTitleTop');
    if (mangaTitleTopElement) {
        mangaTitleTopElement.textContent = mangaData.manga.title;
    }
    
    // Update genres
    const navCardGenresElement = document.getElementById('navCardGenres');
    if (navCardGenresElement && mangaData.manga.genre) {
        const genres = mangaData.manga.genre;
        navCardGenresElement.textContent = genres.length > 0 ? genres.join(', ') : 'Genre not available';
    }
    
    // Update status badge
    const navStatusBadgeElement = document.getElementById('navStatusBadge');
    if (navStatusBadgeElement && mangaData.manga.status) {
        const status = mangaData.manga.status.toUpperCase();
        navStatusBadgeElement.className = 'nav-status-badge';
        
        if (status === 'HIATUS') {
            navStatusBadgeElement.classList.add('status-hiatus');
            navStatusBadgeElement.textContent = 'Hiatus';
        } else if (status === 'END' || status === 'COMPLETED' || status === 'TAMAT') {
            navStatusBadgeElement.classList.add('status-completed');
            navStatusBadgeElement.textContent = 'Tamat';
        } else {
            navStatusBadgeElement.classList.add('status-ongoing');
            navStatusBadgeElement.textContent = 'Ongoing';
        }
    }
    
    // Update cover image
    try {
        dLog('📷 Starting cover image update...');
        const navCardCoverElement = document.getElementById('navCardCover');
        dLog('📷 Cover element found:', !!navCardCoverElement);
        dLog('📷 MANGA_LIST defined:', typeof MANGA_LIST !== 'undefined');
        
        if (navCardCoverElement) {
            // Get cover from MANGA_LIST (check if it's defined first)
            if (typeof MANGA_LIST !== 'undefined') {
                const urlParams = new URLSearchParams(window.location.search);
                const repoId = urlParams.get('repo') || urlParams.get('manga');
                dLog('📷 Looking for repo:', repoId);
                
                const mangaInfo = MANGA_LIST.find(m => m.id === repoId);
                dLog('📷 Manga info found:', !!mangaInfo);
                
                if (mangaInfo) {
                    dLog('📷 Cover URL:', mangaInfo.cover);
                    if (mangaInfo.cover) {
                        // Use small variant for nav card (displayed at small size)
                        const cdnUrls = getResponsiveCDN(mangaInfo.cover);
                        navCardCoverElement.src = cdnUrls.small;
                        navCardCoverElement.alt = `Cover ${mangaData.manga.title}`;
                        dLog('✅ Cover image set successfully');
                    } else {
                        dWarn('⚠️ No cover URL in mangaInfo');
                    }
                } else {
                    dWarn('⚠️ Manga info not found in MANGA_LIST for repo:', repoId);
                    dLog('📷 Available repos in MANGA_LIST:', MANGA_LIST.map(m => m.id).join(', '));
                }
            } else {
                console.error('❌ MANGA_LIST is not defined');
            }
        } else {
            console.error('❌ navCardCover element not found in DOM');
        }
    } catch (coverError) {
        console.error('❌ Error updating cover image:', coverError);
        console.error('Stack:', coverError.stack);
    }
    
    const chapterTitleTopElement = document.getElementById('chapterTitleTop');
    if (chapterTitleTopElement) {
        chapterTitleTopElement.textContent = currentChapter.title;
    }

    // ✅ Update bottom navbar title and chapter
    const mangaTitleBottomElement = document.getElementById('mangaTitleBottom');
    if (mangaTitleBottomElement) {
        mangaTitleBottomElement.textContent = mangaData.manga.title;
    }
    
    const chapterTitleBottomElement = document.getElementById('chapterTitleBottom');
    if (chapterTitleBottomElement) {
        chapterTitleBottomElement.textContent = currentChapter.title;
    }

    // ✅ Update bottom card: genres, status badge, cover (mirror top card)
    const navCardGenresBottomEl = document.getElementById('navCardGenresBottom');
    if (navCardGenresBottomEl && mangaData.manga.genre) {
        const genres = mangaData.manga.genre;
        navCardGenresBottomEl.textContent = genres.length > 0 ? genres.join(', ') : 'Genre not available';
    }

    const navStatusBadgeBottomEl = document.getElementById('navStatusBadgeBottom');
    if (navStatusBadgeBottomEl && mangaData.manga.status) {
        const status = mangaData.manga.status.toUpperCase();
        navStatusBadgeBottomEl.className = 'nav-status-badge';
        if (status === 'HIATUS') {
            navStatusBadgeBottomEl.classList.add('status-hiatus');
            navStatusBadgeBottomEl.textContent = 'Hiatus';
        } else if (status === 'END' || status === 'COMPLETED' || status === 'TAMAT') {
            navStatusBadgeBottomEl.classList.add('status-completed');
            navStatusBadgeBottomEl.textContent = 'Tamat';
        } else {
            navStatusBadgeBottomEl.classList.add('status-ongoing');
            navStatusBadgeBottomEl.textContent = 'Ongoing';
        }
    }

    const navCardCoverBottomEl = document.getElementById('navCardCoverBottom');
    if (navCardCoverBottomEl && typeof MANGA_LIST !== 'undefined') {
        const urlParams2 = new URLSearchParams(window.location.search);
        const repoId2 = urlParams2.get('repo') || urlParams2.get('manga');
        const mangaInfo2 = MANGA_LIST.find(m => m.id === repoId2);
        if (mangaInfo2 && mangaInfo2.cover) {
            const cdnUrls2 = getResponsiveCDN(mangaInfo2.cover);
            navCardCoverBottomEl.src = cdnUrls2.small;
            navCardCoverBottomEl.alt = `Cover ${mangaData.manga.title}`;
        }
    }
    
    if (DEBUG_MODE) dLog(`📖 Read mode: ${readMode}`);
    
    // ✅ Old buttons removed - now using Top/Bottom navbar buttons only

    // ✅ Setup TOP NAVBAR buttons (new)
    const btnBackToInfoTop = document.getElementById('btnBackToInfoTop');
    if (btnBackToInfoTop) {
        btnBackToInfoTop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const urlParams = new URLSearchParams(window.location.search);
            const repo = urlParams.get('repo') || repoParam;
            if (repo) {
    if (DEBUG_MODE) dLog('🔄 [BACK-TOP] Navigating to info page:', repo);
                window.location.href = `info-manga.html?repo=${repo}`;
            }
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [BACK-TOP] Button handler attached');
    }

    const btnChapterListTop = document.getElementById('btnChapterListTop');
    if (btnChapterListTop) {
        btnChapterListTop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('📋 [LIST-TOP] Opening chapter list modal');
            openChapterListModal();
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [LIST-TOP] Button handler attached');
    }

    const btnPrevChapterTop = document.getElementById('btnPrevChapterTop');
    if (btnPrevChapterTop) {
        btnPrevChapterTop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('⬅️ [PREV-TOP] Going to previous chapter');
            navigateChapter('prev');
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [PREV-TOP] Button handler attached');
    }

    const btnNextChapterTop = document.getElementById('btnNextChapterTop');
    if (btnNextChapterTop) {
        btnNextChapterTop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('➡️ [NEXT-TOP] Going to next chapter');
            navigateChapter('next');
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [NEXT-TOP] Button handler attached');
    }

    // ✅ Setup BOTTOM NAVBAR buttons (mirror dari top navbar)
    const btnBackToInfoBottom = document.getElementById('btnBackToInfoBottom');
    if (btnBackToInfoBottom) {
        btnBackToInfoBottom.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const urlParams = new URLSearchParams(window.location.search);
            const repo = urlParams.get('repo') || repoParam;
            if (repo) {
    if (DEBUG_MODE) dLog('🔄 [BACK-BOTTOM] Navigating to info page:', repo);
                window.location.href = `info-manga.html?repo=${repo}`;
            }
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [BACK-BOTTOM] Button handler attached');
    }

    const btnChapterListBottom = document.getElementById('btnChapterListBottom');
    if (btnChapterListBottom) {
        btnChapterListBottom.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('📋 [LIST-BOTTOM] Opening chapter list modal');
            openChapterListModal();
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [LIST-BOTTOM] Button handler attached');
    }

    const btnPrevChapterBottom = document.getElementById('btnPrevChapterBottom');
    if (btnPrevChapterBottom) {
        btnPrevChapterBottom.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('⬅️ [PREV-BOTTOM] Going to previous chapter');
            navigateChapter('prev');
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [PREV-BOTTOM] Button handler attached');
    }

    const btnNextChapterBottom = document.getElementById('btnNextChapterBottom');
    if (btnNextChapterBottom) {
        btnNextChapterBottom.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('➡️ [NEXT-BOTTOM] Going to next chapter');
            navigateChapter('next');
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [NEXT-BOTTOM] Button handler attached');
    }

    // ✅ Setup scroll detection untuk navbar-top (bottom navbar selalu visible)
    const navbarTop = document.getElementById('navbarTop');
    const loadingOverlay = document.getElementById('loadingOverlay');
    let lastScrollPosition = 0;
    let scrollTimeout;
    const SCROLL_THRESHOLD = 300; // Hide navbar hanya setelah scroll 300px

    window.addEventListener('scroll', () => {
        if (!navbarTop) return;

        // ✅ Don't hide navbar saat loading
        if (loadingOverlay && loadingOverlay.classList.contains('active')) {
            return;
        }

        const currentScrollPosition = window.scrollY;
        
        // Clear previous timeout
        if (scrollTimeout) clearTimeout(scrollTimeout);

        // SELALU show navbar jika di atas threshold
        if (currentScrollPosition < SCROLL_THRESHOLD) {
            if (navbarTop) navbarTop.classList.remove('hidden');
        } else {
            // Jika sudah di bawah threshold
            if (currentScrollPosition > lastScrollPosition) {
                // Hide navbar saat scroll down
                if (navbarTop) navbarTop.classList.add('hidden');
            } else {
                // Show navbar saat scroll up
                if (navbarTop) navbarTop.classList.remove('hidden');
            }
        }

        lastScrollPosition = currentScrollPosition;
    }, { passive: true });
    
    if (DEBUG_MODE) dLog('✅ [SCROLL] Scroll detection setup');
    
    updateNavigationButtons();
    
    const btnCloseModal = document.getElementById('btnCloseModal');
    if (btnCloseModal) {
        btnCloseModal.onclick = () => closeChapterListModal();
    }
    
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                closeChapterListModal();
            }
        };
    }
}

function adjustTitleFontSize(element) {
    if (!element) return;
    
    const maxLines = 2;
    const lineHeight = 1.3;
    const minFontSize = 12;
    
    requestAnimationFrame(() => {
        const initialFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const scrollHeight = element.scrollHeight;
        const maxHeight = initialFontSize * lineHeight * maxLines;
        
        if (scrollHeight <= maxHeight) {
            if (DEBUG_MODE) dLog(`📏 Title fits: ${initialFontSize}px`);
            return;
        }
        
        const ratio = maxHeight / scrollHeight;
        let newFontSize = Math.max(Math.floor(initialFontSize * ratio), minFontSize);
        
        requestAnimationFrame(() => {
            element.style.fontSize = `${newFontSize}px`;
            if (DEBUG_MODE) dLog(`📏 Title font adjusted: ${initialFontSize}px → ${newFontSize}px`);
        });
    });
}

async function loadChapterPages() {
    try {
        readerContainer.innerHTML = '';
        readerContainer.className = `reader-container ${readMode}-mode`;
        
        // Get repo info
        const repoOwner = mangaData.manga.repoUrl.split('/')[3];
        const repoName = mangaData.manga.repoUrl.split('/')[4];
        
        // 🚀 CACHE OPTIMIZATION: Reuse signed URLs from sessionStorage
        // Prevents duplicate decrypt-manifest AND r2-proxy invocations
        // when user navigates back to the same chapter
        const cacheKey = `signedPages_${repoOwner}_${repoName}_${currentChapterFolder}`;
        let workerData = null;
        
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                const nowSeconds = Math.floor(Date.now() / 1000);
                // Use cached if tokens still valid with 5-minute buffer
                if (data.expiresAt && data.expiresAt > nowSeconds + 300) {
                    workerData = data;
                    if (DEBUG_MODE) dLog(`🚀 Using cached signed URLs (expires in ${Math.floor((data.expiresAt - nowSeconds) / 60)} min)`);
                } else {
                    sessionStorage.removeItem(cacheKey);
                    if (DEBUG_MODE) dLog(`⏰ Cached signed URLs expired, fetching fresh`);
                }
            }
        } catch (e) {
            // sessionStorage may be disabled or full - continue without cache
        }
        
        if (!workerData) {
            // Call Worker untuk decrypt manifest
            if (DEBUG_MODE) dLog(`🔐 Calling decrypt worker for ${repoOwner}/${repoName}/${currentChapterFolder}`);
            
            // 🔒 SESSION TOKEN: Try session token first (instant), fallback to Turnstile
            const requestBody = {
                repo: `${repoOwner}/${repoName}`,
                chapter: currentChapterFolder
            };
            
            // 🔒 LOCKED CHAPTER: Send auth token for server-side donatur verification
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
                requestBody.authToken = authToken;
            }
            
            const sessionToken = getSessionToken();
            if (sessionToken) {
                requestBody.sessionToken = sessionToken;
                if (DEBUG_MODE) dLog(`🔑 Using session token`);
            } else {
                // No valid session → get Turnstile token (1x per 2 hours)
                try {
                    requestBody.turnstileToken = await getTurnstileToken();
                    if (DEBUG_MODE) dLog(`✅ Turnstile token obtained (new session)`);
                } catch (e) {
                    console.error('Turnstile error:', e.message);
                }
            }
            
            let workerResponse = await fetch('https://decrypt-manifest.nuranantoadhien.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            workerData = await workerResponse.json();
            
            // If session expired, server returns needsVerification → retry with Turnstile
            if (!workerData.success && workerData.needsVerification) {
                if (DEBUG_MODE) dLog(`⏰ Session expired, getting Turnstile token...`);
                try {
                    const turnstileToken = await getTurnstileToken();
                    workerResponse = await fetch('https://decrypt-manifest.nuranantoadhien.workers.dev', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            repo: `${repoOwner}/${repoName}`,
                            chapter: currentChapterFolder,
                            turnstileToken: turnstileToken,
                            authToken: authToken || undefined
                        })
                    });
                    workerData = await workerResponse.json();
                } catch (e) {
                    throw new Error('Verification failed');
                }
            }
            
            if (!workerResponse.ok && !workerData.success) {
                // 🔒 Server-side locked chapter enforcement
                if (workerData.locked) {
                    if (DEBUG_MODE) dLog('🔒 Server rejected: chapter locked, user not donatur');
                    showLockedChapterModal(currentChapterFolder, currentChapterFolder);
                    hideLoading();
                    return;
                }
                throw new Error(`Worker error: ${workerResponse.status}`);
            }
            
            if (!workerData.success || !workerData.pages) {
                throw new Error('Failed to decrypt manifest');
            }
            
            // 🔑 Save new session token if server issued one
            if (workerData.sessionToken) {
                saveSessionToken(workerData.sessionToken);
                if (DEBUG_MODE) dLog(`🔑 Session token saved (expires in 2 hours)`);
            }
            
            // 🔒 If server says forceVerification, clear cached session token
            // (repeat offender — must Turnstile every chapter)
            if (workerData.forceVerification) {
                try { localStorage.removeItem('_st'); } catch (e) {}
            }
            
            // 🚀 Cache signed URLs for reuse
            try {
                const cacheData = {
                    success: workerData.success,
                    pages: workerData.pages,
                    total: workerData.total,
                    expiresIn: workerData.expiresIn,
                    expiresAt: workerData.expiresAt
                };
                if (workerData.tiling) {
                    cacheData.tiling = true;
                    cacheData.grids = workerData.grids;
                    cacheData.orders = workerData.orders;
                }
                sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
            } catch (e) {
                // sessionStorage full - silently ignore
            }
        }
        
        const isTiling = workerData.tiling === true;
        totalPages = workerData.total || (isTiling ? workerData.pages.length : workerData.pages.length);
        
        // ✅ Log expiry info (only in debug mode)
        if (DEBUG_MODE) {
            const expiresIn = workerData.expiresIn;
            dLog(`📊 Total pages: ${totalPages}${isTiling ? ' (tiling mode)' : ''}`);
            dLog(`⏰ Token expires in ${Math.floor(expiresIn / 60)} minutes`);
        }
        
        // Clear dan reset container
        readerContainer.innerHTML = '';
        currentPage = 1;
        
        // Show skeleton placeholders
        for (let i = 0; i < totalPages; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-page';
            skeleton.setAttribute('data-skeleton', i + 1);
            readerContainer.appendChild(skeleton);
        }
        
        // ✅ Reset progress bar to 0% at start of loading
        if (progressFill) {
            progressFill.style.width = '0%';
        }
        hasUserScrolled = false; // Reset scroll flag for new chapter
        
        if (isTiling) {
            // 🧩 TILING MODE: Reassemble tiles on canvas
            renderTiledPages(workerData);
        } else {
            // 📄 NORMAL MODE: Render pages as <img>
            renderNormalPages(workerData.pages);
        }
        
        // Setup tracking dan thumbnails
        // Initialize progress bar to 0% first
        if (progressFill) progressFill.style.width = '0%';
        setupPageTracking();
        // For tiling mode, use first tile URL of each page as thumbnail
        if (isTiling) {
            renderPageThumbnails(workerData.pages.map(tiles => tiles[0]));
        } else {
            renderPageThumbnails(workerData.pages);
        }
        updateProgressBar();
        
        // Scroll ke saved page jika ada
        const savedPage = loadLastPage();
        if (savedPage > 1) {
            setTimeout(() => goToPage(savedPage), 300);
        }
        
        readerContainer.classList.add('webtoon-mode');
        readerContainer.classList.remove('manga-mode');
        
        hideLoading();
        
    } catch (error) {
    if (DEBUG_MODE) console.error('❌ Error loading pages:', error);
        hideLoading();
        alert('Gagal memuat halaman chapter: ' + error.message);
    }
}

/**
 * 📄 NORMAL MODE: Render pages as <img> tags
 */
function renderNormalPages(signedPages) {
    signedPages.forEach((signedUrl, index) => {
        const pageNum = index + 1;
        
        const img = document.createElement('img');
        img.className = 'reader-page';
        img.alt = `Page ${pageNum}`;
        img.setAttribute('data-page', pageNum);
        
        if (pageNum <= 3) {
            img.loading = 'eager';
            if (pageNum === 1) img.fetchPriority = 'high';
        } else {
            img.loading = 'lazy';
        }
        
        img.src = signedUrl;
        
        img.onload = () => {
            if (DEBUG_MODE) dLog(`✅ Page ${pageNum} loaded`);
        };
        
        img.onerror = () => {
            if (DEBUG_MODE) console.error(`❌ Failed to load page ${pageNum}`);
            const placeholder = document.createElement('div');
            placeholder.className = 'reader-page-error';
            placeholder.style.cssText = 'min-height:600px;background:var(--secondary-bg);display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.9rem';
            placeholder.textContent = '❌ Failed to load image';
            placeholder.setAttribute('data-page', pageNum);
            img.replaceWith(placeholder);
        };
        
        // Replace skeleton with real image
        const skeleton = readerContainer.querySelector(`[data-skeleton="${pageNum}"]`);
        if (skeleton) {
            skeleton.replaceWith(img);
        } else {
            readerContainer.appendChild(img);
        }
    });
}

/**
 * 🧩 TILING MODE: Reassemble tiles on canvas per page
 * workerData.pages = [[tile0url, tile1url, ...], ...]
 * workerData.grids = [[cols, rows], ...]
 * workerData.orders = [[shuffled indices], ...]
 * 
 * order[i] = the tile index at visual position i
 * Visual positions are laid out row-by-row: pos 0 = top-left, pos 1 = next col, etc.
 * To reassemble: for each visual position i, draw tile order[i] at position i
 */
function renderTiledPages(workerData) {
    const { pages, grids, orders } = workerData;
    
    pages.forEach((tileUrls, pageIndex) => {
        const pageNum = pageIndex + 1;
        const [cols, rows] = grids[pageIndex];
        const order = orders[pageIndex];
        
        // Create wrapper div (acts as placeholder until canvas ready)
        const wrapper = document.createElement('div');
        wrapper.className = 'reader-page tiled-page';
        wrapper.setAttribute('data-page', pageNum);
        wrapper.style.cssText = 'width:100%;min-height:400px;background:var(--secondary-bg);position:relative';
        
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;height:auto;display:block';
        wrapper.appendChild(canvas);
        
        // Replace skeleton with tiled wrapper
        const skeleton = readerContainer.querySelector(`[data-skeleton="${pageNum}"]`);
        if (skeleton) {
            skeleton.replaceWith(wrapper);
        } else {
            readerContainer.appendChild(wrapper);
        }
        
        // Load all tiles, then draw on canvas
        const tileImages = new Array(tileUrls.length);
        let loadedCount = 0;
        let hasError = false;
        
        tileUrls.forEach((url, tileIdx) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                tileImages[tileIdx] = img;
                loadedCount++;
                if (loadedCount === tileUrls.length && !hasError) {
                    assembleTiles(canvas, tileImages, cols, rows, order);
                    applyWatermark(canvas, workerData.viewerIp);
                    wrapper.style.minHeight = '';
                    wrapper.style.background = '';
                    if (DEBUG_MODE) dLog(`✅ Page ${pageNum} tiles assembled (${cols}x${rows})`);
                }
            };
            img.onerror = () => {
                if (!hasError) {
                    hasError = true;
                    wrapper.style.cssText = 'width:100%;min-height:600px;background:var(--secondary-bg);display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.9rem';
                    wrapper.textContent = '❌ Failed to load image';
                }
            };
            // Eager load first 3 pages worth of tiles
            if (pageNum > 3) {
                // Lazy load: use IntersectionObserver
                const observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        img.src = url;
                        observer.disconnect();
                    }
                }, { rootMargin: '800px' });
                observer.observe(wrapper);
            } else {
                img.src = url;
            }
        });
    });
}

/**
 * 🔒 WATERMARK: Draw repeating diagonal IP watermark on canvas
 * Baked into pixel — screenshot/save pasti kena watermark
 */
function applyWatermark(canvas, viewerIp) {
    if (!viewerIp) return;
    const ctx = canvas.getContext('2d');
    const text = `Dibaca oleh: ${viewerIp}`;
    
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#000000';
    
    // Diagonal repeated watermark — tidak bisa di-crop
    ctx.rotate(-25 * Math.PI / 180);
    const textWidth = ctx.measureText(text).width + 100;
    const textHeight = 70;
    
    for (let y = -canvas.height; y < canvas.height * 2; y += textHeight) {
        for (let x = -canvas.width; x < canvas.width * 2; x += textWidth) {
            ctx.fillText(text, x, y);
        }
    }
    ctx.restore();
}

/**
 * 🎨 Draw tiles onto canvas in correct order
 * order[visualPos] = tileIndex → tile at tileIndex goes to visual position visualPos
 */
function assembleTiles(canvas, tileImages, cols, rows, order) {
    // Calculate tile dimensions from loaded images
    // All tiles in same row should have same height, same col same width
    // Use first tile to estimate, then measure each
    const tileWidths = [];
    const tileHeights = [];
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const pos = r * cols + c;
            const tileIdx = order[pos];
            const img = tileImages[tileIdx];
            if (c === 0) tileHeights.push(img.naturalHeight);
            if (r === 0) tileWidths.push(img.naturalWidth);
        }
    }
    
    const totalWidth = tileWidths.reduce((a, b) => a + b, 0);
    const totalHeight = tileHeights.reduce((a, b) => a + b, 0);
    
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    
    const ctx = canvas.getContext('2d');
    
    let y = 0;
    for (let r = 0; r < rows; r++) {
        let x = 0;
        for (let c = 0; c < cols; c++) {
            const visualPos = r * cols + c;
            const tileIdx = order[visualPos];
            const img = tileImages[tileIdx];
            ctx.drawImage(img, x, y, img.naturalWidth, img.naturalHeight);
            x += tileWidths[c];
        }
        y += tileHeights[r];
    }
}

/**
 * ✅ NEW: Render pages from cached data
 */
function renderPagesFromCache(signedPages) {
    signedPages.forEach((signedUrl, index) => {
        const pageNum = index + 1;
        
        const img = document.createElement('img');
        img.className = 'reader-page';
        img.alt = `Page ${pageNum}`;
        img.setAttribute('data-page', pageNum);
        
        // Set loading attribute BEFORE src to ensure lazy loading works
        if (pageNum <= 3) {
            img.loading = 'eager';
            if (pageNum === 1) img.fetchPriority = 'high';
        } else {
            img.loading = 'lazy';
        }
        
        img.src = signedUrl;
        
        img.onload = () => {
    if (DEBUG_MODE) dLog(`✅ Page ${pageNum} loaded successfully`);
        };
        
        img.onerror = () => {
    if (DEBUG_MODE) console.error(`❌ Failed to load page ${pageNum}`);
            const placeholder = document.createElement('div');
            placeholder.className = 'reader-page-error';
            placeholder.style.minHeight = '600px';
            placeholder.style.backgroundColor = 'var(--secondary-bg)';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = 'var(--text-secondary)';
            placeholder.style.fontSize = '0.9rem';
            placeholder.textContent = '❌ Failed to load image';
            placeholder.setAttribute('data-page', pageNum);
            
            img.replaceWith(placeholder);
        };
        
        readerContainer.appendChild(img);
    });
}

function setupPageTracking() {
    const options = {
        root: readMode === 'manga' ? readerContainer : null,
        rootMargin: '0px',
        threshold: 0.5
    };
    
    let updateTimeout;
    const observer = new IntersectionObserver((entries) => {
        // Find the most visible page (highest intersectionRatio)
        let mostVisibleEntry = null;
        let highestRatio = 0;
        
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > highestRatio) {
                highestRatio = entry.intersectionRatio;
                mostVisibleEntry = entry;
            }
        });
        
        // Only update to the most visible page
        if (mostVisibleEntry) {
            const pageNum = parseInt(mostVisibleEntry.target.getAttribute('data-page'));
            if (pageNum >= 1 && pageNum <= totalPages) {
                currentPage = pageNum;
                // Only update UI if user has scrolled (prevent initial 100% flash)
                if (hasUserScrolled) {
                    // Debounce updates to prevent rapid changes
                    clearTimeout(updateTimeout);
                    updateTimeout = setTimeout(() => {
                        updatePageNavigation();
                        saveLastPage();
                    }, 50);
                }
            }
        }
    }, options);
    
    const pages = document.querySelectorAll('.reader-page');
    pages.forEach(page => observer.observe(page));
    
    // Set flag when user scrolls
    const scrollTarget = readMode === 'manga' ? readerContainer : window;
    scrollTarget.addEventListener('scroll', () => {
        if (!hasUserScrolled) {
            hasUserScrolled = true;
            // Force update progress bar after first scroll with slight delay
            setTimeout(() => {
                updateProgressBar();
            }, 100);
        }
    }, { passive: true });
}

function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    currentPage = pageNum;
    updatePageNavigation();
    saveLastPage();
    
    const pages = document.querySelectorAll('.reader-page');
    if (pages[pageNum - 1]) {
        pages[pageNum - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    updatePageNavigation();
}


/**
 * 🚀 MANGADEX-STYLE PROGRESS BAR (zero image requests)
 * Builds individual pill segments inside progress-track.
 * Hover/click a pill → floating tooltip shows page number above it.
 */
function renderPageThumbnails(pageUrls) {
    const progressTrack = document.querySelector('.progress-track');
    if (!progressTrack) return;
    
    // Remove old pills, keep progressFill (hidden by CSS)
    progressTrack.querySelectorAll('.progress-pill').forEach(p => p.remove());
    
    // Create tooltip element (reused across all pills)
    let tooltip = progressTrack.querySelector('.page-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'page-tooltip';
        progressTrack.appendChild(tooltip);
    }
    
    let hideTimeout = null;
    
    pageUrls.forEach((url, index) => {
        const pageNum = index + 1;
        const pill = document.createElement('div');
        pill.className = 'progress-pill';
        pill.setAttribute('data-page', pageNum);
        
        if (pageNum <= currentPage) {
            pill.classList.add('read');
        }
        if (pageNum === currentPage) {
            pill.classList.add('current');
        }
        
        // Hover → show tooltip with page number
        pill.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            tooltip.textContent = pageNum;
            tooltip.classList.add('visible');
            // Tooltip color: blue if read, gray if unread
            tooltip.classList.toggle('unread', !pill.classList.contains('read'));
            // Position tooltip centered above this pill
            const pillRect = pill.getBoundingClientRect();
            const trackRect = progressTrack.getBoundingClientRect();
            const pillCenter = pillRect.left + pillRect.width / 2 - trackRect.left;
            tooltip.style.left = pillCenter + 'px';
        });
        
        pill.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                tooltip.classList.remove('visible');
            }, 100);
        });
        
        // Touch: show tooltip on touchstart
        pill.addEventListener('touchstart', (e) => {
            e.preventDefault();
            clearTimeout(hideTimeout);
            tooltip.textContent = pageNum;
            tooltip.classList.add('visible');
            tooltip.classList.toggle('unread', !pill.classList.contains('read'));
            const pillRect = pill.getBoundingClientRect();
            const trackRect = progressTrack.getBoundingClientRect();
            const pillCenter = pillRect.left + pillRect.width / 2 - trackRect.left;
            tooltip.style.left = pillCenter + 'px';
        }, { passive: false });
        
        // Click → go to page
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            goToPage(pageNum);
        });
        
        // Insert before tooltip
        progressTrack.insertBefore(pill, tooltip);
    });
    
    // Hide tooltip when leaving the track
    progressTrack.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
            tooltip.classList.remove('visible');
        }, 100);
    });
    
    // Hide tooltip on touch outside
    document.addEventListener('touchstart', (e) => {
        if (!progressTrack.contains(e.target)) {
            tooltip.classList.remove('visible');
        }
    }, { passive: true });
    
    if (DEBUG_MODE) dLog(`📊 Generated ${pageUrls.length} progress pills (MangaDex style, 0 image requests)`);
}

function updatePageNavigation() {
    // Update pill states: read / current
    document.querySelectorAll('.progress-pill').forEach((pill) => {
        const pageNum = parseInt(pill.getAttribute('data-page'));
        pill.classList.toggle('read', pageNum <= currentPage);
        pill.classList.toggle('current', pageNum === currentPage);
    });
    
    updateProgressBar();
}

function updateProgressBar() {
    // Progress bar is now pill-based, no fill width needed.
    // Pills are updated in updatePageNavigation().
    // Keep progressFill hidden as fallback.
    if (progressFill) progressFill.style.width = '0%';
}

async function updateNavigationButtons() {
    const btnPrevChapterTop = document.getElementById('btnPrevChapterTop');
    const btnNextChapterTop = document.getElementById('btnNextChapterTop');
    const btnPrevChapterBottom = document.getElementById('btnPrevChapterBottom');
    const btnNextChapterBottom = document.getElementById('btnNextChapterBottom');
    
    if (!btnPrevChapterTop || !btnNextChapterTop) return;
    
    const currentIndex = allChapters.findIndex(ch => ch.folder === currentChapterFolder);
    const isFirstChapter = currentIndex === allChapters.length - 1; // Index terakhir = chapter pertama (karena diurutkan terbalik)
    const isLastChapter = currentIndex === 0; // Index 0 = chapter terakhir
    const isOneshot = isOneshotChapter(currentChapterFolder);
    
    // ============================================
    // LOGIKA TOMBOL PREVIOUS
    // ============================================
    if (isFirstChapter || isOneshot) {
        // Disable tombol Previous di chapter pertama atau oneshot
        btnPrevChapterTop.disabled = true;
        btnPrevChapterTop.classList.add('disabled');
        btnPrevChapterTop.style.pointerEvents = 'none';
        btnPrevChapterTop.style.opacity = '0.4';
        btnPrevChapterTop.style.cursor = 'not-allowed';
        
        if (btnPrevChapterBottom) {
            btnPrevChapterBottom.disabled = true;
            btnPrevChapterBottom.classList.add('disabled');
            btnPrevChapterBottom.style.pointerEvents = 'none';
            btnPrevChapterBottom.style.opacity = '0.4';
            btnPrevChapterBottom.style.cursor = 'not-allowed';
        }
    } else {
        // Enable tombol Previous
        btnPrevChapterTop.disabled = false;
        btnPrevChapterTop.classList.remove('disabled');
        btnPrevChapterTop.style.pointerEvents = 'auto';
        btnPrevChapterTop.style.opacity = '1';
        btnPrevChapterTop.style.cursor = 'pointer';
        
        if (btnPrevChapterBottom) {
            btnPrevChapterBottom.disabled = false;
            btnPrevChapterBottom.classList.remove('disabled');
            btnPrevChapterBottom.style.pointerEvents = 'auto';
            btnPrevChapterBottom.style.opacity = '1';
            btnPrevChapterBottom.style.cursor = 'pointer';
        }
    }
    
    // ============================================
    // LOGIKA TOMBOL NEXT
    // ============================================
    if (isLastChapter || isOneshot) {
        // Ubah tombol Next menjadi tombol Donasi
        const donateHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>Donasi</span>
        `;
        btnNextChapterTop.innerHTML = donateHTML;
        btnNextChapterTop.classList.add('donasi-btn');
        btnNextChapterTop.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(TRAKTEER_LINK, '_blank');
        };
        
        if (btnNextChapterBottom) {
            btnNextChapterBottom.innerHTML = donateHTML;
            btnNextChapterBottom.classList.add('donasi-btn');
            btnNextChapterBottom.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(TRAKTEER_LINK, '_blank');
            };
        }
    } else {
        // Kembalikan tombol Next ke normal
        const nextHTML = `
            <span>Next</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 19l7-7-7-7"/>
            </svg>
        `;
        btnNextChapterTop.innerHTML = nextHTML;
        btnNextChapterTop.classList.remove('donasi-btn');
        btnNextChapterTop.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('➡️ [NEXT-TOP] Going to next chapter');
            navigateChapter('next');
        };
        
        if (btnNextChapterBottom) {
            btnNextChapterBottom.innerHTML = nextHTML;
            btnNextChapterBottom.classList.remove('donasi-btn');
            btnNextChapterBottom.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
    if (DEBUG_MODE) dLog('➡️ [NEXT-BOTTOM] Going to next chapter');
                navigateChapter('next');
            };
        }
    }
}

async function navigateChapter(direction) {
    const currentIndex = allChapters.findIndex(ch => ch.folder === currentChapterFolder);
    
    let targetIndex;
    if (direction === 'prev') {
        targetIndex = currentIndex + 1;
    } else {
        targetIndex = currentIndex - 1;
    }
    
    if (targetIndex < 0 || targetIndex >= allChapters.length) {
        return;
    }
    
    const targetChapter = allChapters[targetIndex];
    
    // ✅ SECURITY: Always verify with backend for locked chapters (NO CACHE)
    const isDonatur = targetChapter.locked ? await verifyDonaturStatusStrict() : await getUserDonaturStatus();
    const isActuallyLocked = targetChapter.locked && !isDonatur;
    
    if (isActuallyLocked) {
        const chapterTitle = targetChapter.title || targetChapter.folder;
        const chapterFolder = targetChapter.folder;
        showLockedChapterModal(chapterTitle, chapterFolder);
        return;
    }

    // ✅ Show loading overlay sebelum navigate
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }

    // ✅ Wait a moment untuk ensure loading overlay visible
    await new Promise(resolve => setTimeout(resolve, 100));
    
    window.location.href = `reader.html?repo=${repoParam}&chapter=${targetChapter.folder}`;
}

/**
 * Open chapter list modal - FIXED
 */
async function openChapterListModal() {
    const modal = document.getElementById('modalOverlay');
    const modalBody = document.getElementById('chapterListModal');
    
    if (DEBUG_MODE) dLog('📋 Opening chapter list modal...');
    
    if (!modal || !modalBody) {
    if (DEBUG_MODE) console.error('❌ Modal elements not found!');
        return;
    }
    
    modalBody.innerHTML = '';
    
    // ✅ Check user status for lock icons (use cache for UI display, but verify on click)
    const isDonatur = await getUserDonaturStatus();
    
    allChapters.forEach(chapter => {
        const item = document.createElement('div');
        item.className = 'chapter-item-modal';
        
        if (chapter.folder === currentChapterFolder) {
            item.classList.add('active');
        }
        
        // ✅ Check if chapter is actually locked based on user status
        // Note: For UI display, we use cached status. Actual verification happens on click.
        const isActuallyLocked = chapter.locked && !isDonatur;
        
        if (isActuallyLocked) {
            item.classList.add('locked');
        }
        
        // ✅ Icon: 🔒 untuk locked (PEMBACA SETIA), kosong untuk DONATUR SETIA atau chapter tidak locked
        const lockIcon = isActuallyLocked ? '🔒 ' : '';
        
// ✅ CEK APAKAH CHAPTER INI ADALAH END CHAPTER (SUPPORT ONESHOT + ANGKA)
const isEndChapter = mangaData.manga.status === 'END' && 
                     mangaData.manga.endChapter && 
                     (
                       // String comparison (case-insensitive untuk oneshot)
                       (typeof mangaData.manga.endChapter === 'string' && 
                        chapter.folder.toLowerCase() === mangaData.manga.endChapter.toLowerCase()) ||
                       // Number comparison
                       parseFloat(chapter.folder) === parseFloat(mangaData.manga.endChapter) ||
                       // String-to-string comparison (jika keduanya string)
                       String(chapter.folder) === String(mangaData.manga.endChapter)
                     );

// ✅ CEK APAKAH CHAPTER INI ADALAH CHAPTER TERAKHIR YANG HIATUS
const isHiatusChapter = mangaData.manga.status === 'HIATUS' && 
                        allChapters.length > 0 && 
                        parseFloat(chapter.folder) === parseFloat(allChapters[0].folder);

// ✅ BUILD BADGES
const endBadge = isEndChapter ? '<span class="chapter-end-badge-modal">END</span>' : '';
const hiatusBadge = isHiatusChapter ? '<span class="chapter-hiatus-badge-modal">HIATUS</span>' : '';

const badges = (endBadge || hiatusBadge) 
    ? `<div class="badge-container-modal">${endBadge}${hiatusBadge}</div>` 
    : '';
        
        // ✅ FIX XSS: Use createElement + textContent untuk data dinamis (lebih aman)
        const titleDiv = document.createElement('div');
        titleDiv.className = 'chapter-item-title';
        
        // ✅ lockIcon is static HTML (safe)
        if (lockIcon) {
            const staticContent = document.createElement('span');
            staticContent.innerHTML = lockIcon; // HTML statis aman
            titleDiv.appendChild(staticContent);
        }
        
        const titleText = document.createElement('span');
        titleText.textContent = chapter.title || chapter.folder; // ✅ XSS Protection: textContent untuk data dinamis
        titleDiv.appendChild(titleText);
        
        // ✅ badges setelah title (inline)
        if (badges) {
            const badgeContent = document.createElement('span');
            badgeContent.innerHTML = badges; // HTML statis aman
            titleDiv.appendChild(badgeContent);
        }
        
        const viewsDiv = document.createElement('div');
        viewsDiv.className = 'chapter-item-views';
        viewsDiv.textContent = `👁️ ${chapter.views || 0}`; // ✅ XSS Protection: textContent untuk data dinamis
        
        item.appendChild(titleDiv);
        item.appendChild(viewsDiv);
        
        item.onclick = async () => {
            // ✅ SECURITY: Always verify with backend for locked chapters (NO CACHE)
            const userIsDonatur = chapter.locked ? await verifyDonaturStatusStrict() : await getUserDonaturStatus();
            const isActuallyLocked = chapter.locked && !userIsDonatur;
            
            if (isActuallyLocked) {
                closeChapterListModal();
                setTimeout(() => {
                    const chapterTitle = chapter.title || chapter.folder;
                    const chapterFolder = chapter.folder;
                    showLockedChapterModal(chapterTitle, chapterFolder);
                }, 100);
            } else if (chapter.folder !== currentChapterFolder) {
                window.location.href = `reader.html?repo=${repoParam}&chapter=${chapter.folder}`;
            }
        };
        
        modalBody.appendChild(item);
    });
    
    // Force show modal
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    if (DEBUG_MODE) dLog('✅ Chapter list modal opened');}

/**
 * Close chapter list modal - FIXED
 */
function closeChapterListModal() {
    const modal = document.getElementById('modalOverlay');
    
    if (DEBUG_MODE) dLog('❌ Closing chapter list modal...');
    
    modal.classList.remove('active');
    
    // Wait for transition then hide
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
    
    if (DEBUG_MODE) dLog('✅ Chapter list modal closed');
}

async function trackChapterView() {
    try {
        const viewKey = `viewed_${repoParam}_${currentChapterFolder}`;
        const VIEW_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours, match worker's per-day dedup
        
        // Check localStorage with TTL (persists across tabs/refreshes)
        const lastViewed = localStorage.getItem(viewKey);
        if (lastViewed) {
            const elapsed = Date.now() - parseInt(lastViewed, 10);
            if (elapsed < VIEW_COOLDOWN_MS) {
                if (DEBUG_MODE) dLog(`👁️ Already counted (${Math.ceil((VIEW_COOLDOWN_MS - elapsed) / 1000)}s remaining)`);
                return;
            }
        }
        
        if (DEBUG_MODE) dLog('📤 Tracking chapter view...');
        
        const githubRepo = window.currentGithubRepo || repoParam;
        
        if (DEBUG_MODE) dLog(`   URL param: ${repoParam}`);
        if (DEBUG_MODE) dLog(`   GitHub repo: ${githubRepo}`);
        if (DEBUG_MODE) dLog(`   Chapter: ${currentChapterFolder}`);
        
        const requestBody = { 
            repo: githubRepo,
            chapter: currentChapterFolder,
            type: 'chapter',
            timestamp: getWIBTimestamp()
        };
        
        if (DEBUG_MODE) {
            console.log('📤 Sending chapter view to Worker:', {
                url: VIEW_COUNTER_URL,
                body: requestBody
            });
        }
        
        const response = await fetch(VIEW_COUNTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        if (response.status === 429) {
            // Duplicate view detected by worker — save to localStorage so we don't retry
            localStorage.setItem(viewKey, String(Date.now()));
            if (DEBUG_MODE) dLog('ℹ️ View already counted by worker (429), cooldown saved locally');
            return;
        }
        
        if (DEBUG_MODE) {
            console.log('📥 Worker response:', result);
            
            if (result.success) {
                console.log('✅ Chapter view counted successfully');
            } else if (result.alreadyCounted) {
                console.log('ℹ️ Already counted today');
            }
        }
        
        // Save timestamp to localStorage on success
        localStorage.setItem(viewKey, String(Date.now()));
        
        if (DEBUG_MODE) dLog('✅ Chapter view tracked successfully (WIB)');
        
    } catch (error) {
        // 429 or network errors are not critical - log as info, not error
        console.log('ℹ️ View counter skipped:', error.message);
    }
}

// ============================================
// ✅ NEW FUNCTION - Track Reading History
// ============================================
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('active');
        if (DEBUG_MODE) dLog('📄 Loading overlay shown');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        if (DEBUG_MODE) dLog('✅ Loading overlay hidden');
    }
}

function initProtection() {
    if (DEBUG_MODE) {
    if (DEBUG_MODE) dLog('🔓 Debug mode enabled - protection disabled');  // ← Tidak perlu if lagi
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

    // Anti-debugger: pause execution when DevTools is open
    setInterval(function() {
        debugger;
    }, 1000);
}

function setupEnhancedEventListeners() {
    // Progress bar click → navigate to page based on click position (fallback if pills missed)
    navProgressBar.addEventListener('click', (e) => {
        if (totalPages > 0) {
            const progressTrack = navProgressBar.querySelector('.progress-track');
            const rect = progressTrack.getBoundingClientRect();
            const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const clickedPage = Math.max(1, Math.min(totalPages, Math.ceil(clickRatio * totalPages)));
            goToPage(clickedPage);
        }
    });
    
    // Close tooltip on scroll (webtoon mode)
    const hideTooltipOnScroll = () => {
        const tooltip = document.querySelector('.page-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    };
    
    const readerContainer = document.querySelector('.reader-container');
    if (readerContainer) {
        readerContainer.addEventListener('scroll', hideTooltipOnScroll, { passive: true });
    }
    window.addEventListener('scroll', hideTooltipOnScroll, { passive: true });
    
    // Arrow key navigation
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.shiftKey) return;
        
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                window.scrollBy({ top: -300, behavior: 'smooth' });
                break;
            case 'ArrowDown':
                e.preventDefault();
                window.scrollBy({ top: 300, behavior: 'smooth' });
                break;
        }
    });
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const mangaTitleElement = document.getElementById('mangaTitle');
            if (mangaTitleElement && mangaData) {
                mangaTitleElement.style.fontSize = '';
                adjustTitleFontSize(mangaTitleElement);
            }
        }, 250);
    });

}

// ============================================
// SCROLL TO TOP BUTTON
// ============================================

const scrollToTopBtn = document.getElementById('scrollToTopBtn');

// Show/hide button based on scroll position
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        scrollToTopBtn.classList.add('show');
    } else {
        scrollToTopBtn.classList.remove('show');
    }
});

// Scroll to top when clicked
scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ============================================
// GLOBAL LOGIN BUTTON - REDIRECT TO INFO-MANGA
// ============================================

function initGlobalLoginButton() {
    const btnGlobalLogin = document.getElementById('btnGlobalLogin');
    if (btnGlobalLogin) {
        btnGlobalLogin.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const repo = urlParams.get('repo');
            if (repo) {
                window.location.href = `info-manga.html?repo=${repo}`;
            } else {
                window.location.href = 'index.html';
            }
        });
    }
}

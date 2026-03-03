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
                        navCardCoverElement.src = mangaInfo.cover;
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
            navCardCoverBottomEl.src = mangaInfo2.cover;
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
                            turnstileToken: turnstileToken
                        })
                    });
                    workerData = await workerResponse.json();
                } catch (e) {
                    throw new Error('Verification failed');
                }
            }
            
            if (!workerResponse.ok && !workerData.success) {
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
            
            // 🚀 Cache signed URLs for reuse
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    success: workerData.success,
                    pages: workerData.pages,
                    total: workerData.total,
                    expiresIn: workerData.expiresIn,
                    expiresAt: workerData.expiresAt
                }));
            } catch (e) {
                // sessionStorage full - silently ignore
            }
        }
        
        const signedPages = workerData.pages;
        totalPages = signedPages.length;
        
        // ✅ Log expiry info (only in debug mode)
        if (DEBUG_MODE) {
            const expiresIn = workerData.expiresIn;
    if (DEBUG_MODE) dLog(`📊 Total pages: ${totalPages}`);
    if (DEBUG_MODE) dLog(`⏰ Token expires in ${Math.floor(expiresIn / 60)} minutes`);
        }
        
        // Clear dan reset container
        readerContainer.innerHTML = '';
        currentPage = 1;
        
        // ✅ Reset progress bar to 0% at start of loading
        if (progressFill) {
            progressFill.style.width = '0%';
        }
        hasUserScrolled = false; // Reset scroll flag for new chapter
        
        // Render pages dengan signed URLs
        signedPages.forEach((signedUrl, index) => {
            const pageNum = index + 1;
            
            // ❌ NO LOG in production
            if (DEBUG_MODE) {
    if (DEBUG_MODE) dLog(`🖼️ Page ${pageNum}: ${signedUrl.substring(0, 80)}...`);
            }
            
            const img = document.createElement('img');
            img.className = 'reader-page';
            img.src = signedUrl;
            img.alt = `Page ${pageNum}`;
            
            if (pageNum <= 3) {
                img.loading = 'eager';
            } else {
                img.loading = 'lazy';
            }
            
            img.setAttribute('data-page', pageNum);
            
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
        
        // Setup tracking dan thumbnails
        // Initialize progress bar to 0% first
        if (progressFill) progressFill.style.width = '0%';
        setupPageTracking();
        renderPageThumbnails(signedPages);
        updateProgressBar();
        
        // Initialize Comments (tanpa rating)
        const urlParams = new URLSearchParams(window.location.search);
        const repo = urlParams.get('repo') || urlParams.get('manga'); // Support both parameters
        const chapter = urlParams.get('chapter');
        
        if (repo && chapter) {
            const readerComments = new ReaderComments();
            readerComments.init(repo, chapter).catch(err => {
                if (DEBUG_MODE) console.error('[READER-COMMENTS] Init failed:', err);
            });
        }
        
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
 * ✅ NEW: Render pages from cached data
 */
function renderPagesFromCache(signedPages) {
    signedPages.forEach((signedUrl, index) => {
        const pageNum = index + 1;
        
        const img = document.createElement('img');
        img.className = 'reader-page';
        img.src = signedUrl;
        img.alt = `Page ${pageNum}`;
        
        if (pageNum <= 3) {
            img.loading = 'eager';
        } else {
            img.loading = 'lazy';
        }
        
        img.setAttribute('data-page', pageNum);
        
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
        
        // ✅ Icon: 🔒 untuk locked (PEMBACA SETIA), 🔓 untuk unlocked (DONATUR SETIA), atau kosong jika tidak locked
        const lockIcon = isActuallyLocked ? '🔒 ' : (chapter.locked && isDonatur ? '🔓 ' : '');
        
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
        const VIEW_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes, match worker's VIEW_EXPIRY_MINUTES
        
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
        console.error('❌ Error tracking chapter view:', error);
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

    // Hide progress bar when comment section is visible (scrolled past manga pages)
    const commentSection = document.getElementById('readerCommentContainer');
    if (commentSection && navProgressBar) {
        const commentObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navProgressBar.classList.add('hidden');
                } else {
                    navProgressBar.classList.remove('hidden');
                }
            });
        }, { threshold: 0.05 });
        commentObserver.observe(commentSection);
    }
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

// ============================================
// READER COMMENTS CLASS (tanpa rating)
// ============================================

class ReaderComments {
    constructor() {
        this.repo = null;
        this.chapter = null;
        this.chapterId = null;
        this.isLoggedIn = false;
        this.API_BASE = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
    }

    async init(repo, chapter) {
        this.repo = repo;
        this.chapter = chapter;
        this.chapterId = `${repo}-${chapter}`;
        
        dLog('[READER-COMMENTS] ========================================');
        dLog('[READER-COMMENTS] Initializing for chapter:', this.chapterId);
        dLog('[READER-COMMENTS] repo (mangaId):', this.repo);
        dLog('[READER-COMMENTS] chapter:', this.chapter);
        dLog('[READER-COMMENTS] chapterId format:', this.chapterId);
        dLog('[READER-COMMENTS] ========================================');
        
        // Setup event listeners FIRST
        this.setupEventListeners();
        
        // Check login status
        await this.checkLoginStatus();
        
        // Load comment input avatar if logged in
        if (this.isLoggedIn) {
            await this.loadCommentInputAvatar();
        }
        
        // Load comments
        await this.loadComments();
        
        // Listen for login/logout events via storage
        window.addEventListener('storage', (e) => {
            if (e.key === 'authToken') {
                dLog('[READER-COMMENTS] Auth token changed, re-checking login status');
                this.checkLoginStatus();
            }
        });
        
        // Listen for window focus (user might login in another tab)
        window.addEventListener('focus', () => {
            dLog('[READER-COMMENTS] Window focused, re-checking login status');
            this.checkLoginStatus();
        });
        
        // Listen for custom login event (if exists)
        window.addEventListener('userLoggedIn', () => {
            dLog('[READER-COMMENTS] User logged in event received');
            this.checkLoginStatus();
            this.loadComments();
        });
        
        window.addEventListener('userLoggedOut', () => {
            dLog('[READER-COMMENTS] User logged out event received');
            this.checkLoginStatus();
        });
        
        // Listen for profile modal closed (re-check status after user interaction)
        window.addEventListener('profileModalClosed', () => {
            dLog('[READER-COMMENTS] Profile modal closed, re-checking status');
            this.checkLoginStatus();
            this.loadComments();
        });
    }

    async checkLoginStatus() {
        const token = localStorage.getItem('authToken');
        dLog('[READER-COMMENTS] Checking login status, token exists:', !!token);
        
        if (!token) {
            this.isLoggedIn = false;
            this.showLoginButton();
            dLog('[READER-COMMENTS] No token, showing login button');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/donatur/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            dLog('[READER-COMMENTS] Status check response:', response.status);

            if (response.ok) {
                this.isLoggedIn = true;
                await this.showCommentInput();  // ✅ Added await
                dLog('[READER-COMMENTS] User is logged in, showing comment input');
            } else {
                this.isLoggedIn = false;
                this.showLoginButton();
                dLog('[READER-COMMENTS] Token invalid, showing login button');
            }
        } catch (error) {
            if (DEBUG_MODE) console.error('[READER-COMMENTS] Login check error:', error);
            this.isLoggedIn = false;
            this.showLoginButton();
        }
    }

    showLoginButton() {
        const btnLogin = document.getElementById('btnLoginComment');
        const inputSection = document.getElementById('commentInputSection');
        
        if (btnLogin) {
            btnLogin.style.display = 'flex';
            dLog('[READER-COMMENTS] Login button shown');
        }
        if (inputSection) {
            inputSection.style.display = 'none';
        }
    }

    async showCommentInput() {
        const btnLogin = document.getElementById('btnLoginComment');
        const inputSection = document.getElementById('commentInputSection');
        
        if (btnLogin) {
            btnLogin.style.display = 'none';
            dLog('[READER-COMMENTS] Login button hidden');
        }
        if (inputSection) {
            inputSection.style.display = 'block';
            dLog('[READER-COMMENTS] Comment input shown');
        }

        // Load and set user avatar for comment input
        await this.loadCommentInputAvatar();
        
        // ✅ Force reload setelah 500ms untuk ensure avatar terupdate
        setTimeout(() => {
            // console.log('🔄 [READER-AVATAR-INPUT] Force reload after 500ms...');
            this.loadCommentInputAvatar();
        }, 500);
    }

    async loadCommentInputAvatar() {
        const avatarEl = document.getElementById('commentInputAvatar');
        if (!avatarEl) {
            dWarn('⚠️ [READER-AVATAR-INPUT] Element commentInputAvatar not found, retrying in 100ms...');
            // Retry after short delay if element not ready
            setTimeout(() => this.loadCommentInputAvatar(), 100);
            return;
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            // console.log('🖼️ [READER-AVATAR-INPUT] No token, using default avatar');
            avatarEl.src = 'assets/Logo 2.png';
            return;
        }

        try {
            // console.log('🖼️ [READER-AVATAR-INPUT] Fetching avatar from profile-worker...');
            const response = await fetch('https://profile-worker.nuranantoadhien.workers.dev/profile/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                cache: 'no-store'  // ✅ Disable cache untuk always get fresh data
            });

            if (response.ok) {
                const data = await response.json();
                // console.log('🖼️ [READER-AVATAR-INPUT] Profile API response:', data);
                
                // ✅ FIX: Profile worker uses camelCase (avatarUrl), manga-auth-worker uses snake_case (avatar_url)
                const avatarUrl = data.profile?.avatarUrl || data.profile?.avatar_url || data.avatar_url || data.avatarUrl;
                
                // console.log('🖼️ [READER-AVATAR-INPUT] Avatar URL from API:', avatarUrl);
                
                if (avatarUrl) {
                    // Add cache busting to force reload
                    const finalUrl = avatarUrl.includes('?') 
                        ? `${avatarUrl}&t=${Date.now()}` 
                        : `${avatarUrl}?t=${Date.now()}`;
                    
                    // console.log('✅ [READER-AVATAR-INPUT] Setting avatar to:', finalUrl);
                    avatarEl.src = finalUrl;
                    avatarEl.onerror = () => {
                        console.error('❌ [READER-AVATAR-INPUT] Failed to load image, using default');
                        avatarEl.src = 'assets/Logo 2.png';
                    };
                } else {
                    // console.log('⚠️ [READER-AVATAR-INPUT] No avatar_url in response, using default');
                    avatarEl.src = 'assets/Logo 2.png';
                }
            } else {
                console.error('❌ [READER-AVATAR-INPUT] Profile API failed:', response.status);
                avatarEl.src = 'assets/Logo 2.png';
            }
        } catch (error) {
            console.error('❌ [READER-AVATAR-INPUT] Avatar load error:', error);
            avatarEl.src = 'assets/Logo 2.png';
        }
    }

    async loadComments() {
        if (!this.chapterId) return;

        try {
            const url = `${this.API_BASE}/comments?mangaId=${this.repo}&chapterId=${this.chapterId}&limit=50&offset=0&_t=${Date.now()}`;
            
            dLog('[READER-COMMENTS] ========================================');
            dLog('[READER-COMMENTS] Loading comments...');
            dLog('[READER-COMMENTS] API URL:', url);
            dLog('[READER-COMMENTS] mangaId:', this.repo);
            dLog('[READER-COMMENTS] chapterId:', this.chapterId);
            dLog('[READER-COMMENTS] ========================================');
            
            const response = await fetch(url);
            
            dLog('[READER-COMMENTS] Response status:', response.status);
            
            if (!response.ok) {
                if (DEBUG_MODE) console.error('[READER-COMMENTS] Response not OK:', response.status, response.statusText);
                this.showNoComments();
                return;
            }
            
            const data = await response.json();
            dLog('[READER-COMMENTS] Loaded data:', data);
            dLog('[READER-COMMENTS] Comments array:', data.comments);
            dLog('[READER-COMMENTS] Comments count:', data.comments?.length);

            // Check if comments exist and is an array
            if (data.comments && Array.isArray(data.comments)) {
                if (data.comments.length > 0) {
                    dLog('[READER-COMMENTS] Displaying', data.comments.length, 'comments');
                    this.displayComments(data.comments);
                } else {
                    dLog('[READER-COMMENTS] No comments found (empty array)');
                    dLog('[READER-COMMENTS] Trying alternative chapterId format...');
                    
                    // Try alternative format: without hyphen (chapter only)
                    await this.tryAlternativeChapterFormat();
                }
            } else {
                if (DEBUG_MODE) console.error('[READER-COMMENTS] Invalid comments data:', data);
                this.showNoComments();
            }
        } catch (error) {
            if (DEBUG_MODE) console.error('[READER-COMMENTS] Load error:', error);
            this.showNoComments();
        }
    }
    
    async tryAlternativeChapterFormat() {
        // Try dengan format: repo/chapter atau hanya chapter
        const alternativeFormats = [
            `${this.repo}/${this.chapter}`,  // Format: repo/chapter
            this.chapter,                      // Format: chapter only
            `${this.repo}_${this.chapter}`,   // Format: repo_chapter
        ];
        
        for (const altChapterId of alternativeFormats) {
            dLog('[READER-COMMENTS] Trying alternative chapterId:', altChapterId);
            
            try {
                const url = `${this.API_BASE}/comments?mangaId=${this.repo}&chapterId=${altChapterId}&limit=50&offset=0&_t=${Date.now()}`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.comments && data.comments.length > 0) {
                        dLog('[READER-COMMENTS] ✅ Found', data.comments.length, 'comments with format:', altChapterId);
                        this.displayComments(data.comments);
                        return;
                    }
                }
            } catch (err) {
                dLog('[READER-COMMENTS] Alternative format failed:', altChapterId, err);
            }
        }
        
        dLog('[READER-COMMENTS] No comments found in any format');
        this.showNoComments();
    }

    displayComments(comments) {
        const listEl = document.getElementById('commentsList');
        if (!listEl) return;

        dLog('[READER-COMMENTS] Displaying', comments.length, 'comments');
        dLog('[READER-COMMENTS] First comment sample:', comments[0]);
        
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
        // Login button - trigger login modal if available
        const btnLogin = document.getElementById('btnLoginComment');
        if (btnLogin) {
            btnLogin.addEventListener('click', () => {
                dLog('[READER-COMMENTS] Login button clicked');
                // Check if login modal exists (from common.js or other script)
                const loginModal = document.getElementById('loginModal');
                const btnOpenLogin = document.getElementById('btnOpenLogin');
                
                if (loginModal && btnOpenLogin) {
                    dLog('[READER-COMMENTS] Triggering login modal');
                    btnOpenLogin.click();
                } else {
                    // Fallback: redirect to info-manga with autoLogin parameter
                    dLog('[READER-COMMENTS] No login modal, redirecting to info-manga with autoLogin');
                    if (this.repo) {
                        window.location.href = `info-manga.html?repo=${this.repo}&autoLogin=true`;
                    } else {
                        window.location.href = 'index.html';
                    }
                }
            });
            dLog('[READER-COMMENTS] Login button event listener attached');
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
        if (commentsList) {
            commentsList.addEventListener('click', (e) => {
                // Use closest() to handle SVG children
                const replyBtn = e.target.closest('.btn-reply-comment');
                const editBtn = e.target.closest('.btn-edit-comment');
                const deleteBtn = e.target.closest('.btn-delete-comment');
                
                if (replyBtn) {
                    const username = replyBtn.dataset.username;
                    const commentElement = replyBtn.closest('.comment-item');
                    const commentId = commentElement?.dataset?.id;
                    if (commentId) {
                        this.replyToComment(username, commentId);
                    }
                } else if (editBtn) {
                    const commentId = editBtn.dataset.id;
                    this.editComment(commentId);
                } else if (deleteBtn) {
                    const commentId = deleteBtn.dataset.id;
                    this.deleteComment(commentId);
                }
            });
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
        const btnSubmit = document.getElementById('btnSubmitComment');
        
        // Disable button during submission
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Mengirim...';
        }
        
        try {
            const response = await fetch(`${this.API_BASE}/comments/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    mangaId: this.repo,
                    chapterId: this.chapterId,
                    content: content
                })
            });

            const data = await response.json();
            if (data.success || response.ok) {
                textarea.value = '';
                document.getElementById('commentCharCount').textContent = '0';
                showToast('Komentar berhasil dikirim!', 'success');
                await this.loadComments();
            } else {
                showToast(data.error || 'Gagal mengirim komentar', 'error');
            }
        } catch (error) {
            if (DEBUG_MODE) console.error('[READER-COMMENTS] Submit error:', error);
            showToast('Terjadi kesalahan saat mengirim komentar', 'error');
        } finally {
            // Re-enable button
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Kirim Komentar';
            }
        }
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
        
        // Get user avatar - try to get from existing comment input avatar first
        let userAvatarUrl = 'assets/Logo 2.png';
        const existingAvatar = document.getElementById('commentInputAvatar');
        
        if (existingAvatar && existingAvatar.src && !existingAvatar.src.includes('Logo 2.png')) {
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
                            <button class="btn-send-reply">
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
        targetComment.insertAdjacentElement('afterend', replyBox);
        
        // Focus on textarea and set cursor at end
        const textarea = replyBox.querySelector('.reply-textarea');
        textarea.focus();
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
                        mangaId: this.repo,
                        chapterId: this.chapterId,
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
                console.error('[READER-COMMENTS] Reply error:', error);
                showToast('Terjadi kesalahan saat mengirim balasan', 'error');
            }
        });
        
        // Cancel button
        const btnCancel = replyBox.querySelector('.btn-cancel-reply');
        btnCancel.addEventListener('click', () => {
            replyBox.remove();
        });
        
        // Scroll into view
        replyBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async editComment(commentId) {
        // Cleanup any active actions first (ensure only 1 action at a time)
        this.cleanupActiveActions();
        
        const commentEl = document.querySelector(`.comment-item[data-id="${commentId}"]`);
        if (!commentEl) return;

        const contentEl = commentEl.querySelector('.comment-content');
        const currentContent = contentEl.textContent.trim();

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

        contentEl.replaceWith(editWrapper);
        
        const editArea = editWrapper.querySelector('.comment-textarea');
        editArea.focus();
        
        const charCountEl = editWrapper.querySelector('.edit-char-count');
        editArea.addEventListener('input', (e) => {
            charCountEl.textContent = e.target.value.length;
        });

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
                console.error('[READER-COMMENTS] Edit error:', error);
                showToast('Terjadi kesalahan saat mengupdate komentar', 'error');
            }
        });

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
        
        const commentEl = document.querySelector(`.comment-item[data-id="${commentId}"]`);
        if (!commentEl) return;
        
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
        
        const contentEl = commentEl.querySelector('.comment-content');
        if (contentEl) {
            contentEl.after(confirmBox);
        }
        
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
                    showToast('Komentar berhasil dihapus', 'success');
                    await this.loadComments();
                } else {
                    showToast(data.error || 'Gagal menghapus komentar', 'error');
                }
            } catch (error) {
                console.error('[READER-COMMENTS] Delete error:', error);
                showToast('Terjadi kesalahan saat menghapus komentar', 'error');
            }
        });
        
        const btnCancel = confirmBox.querySelector('.btn-cancel-delete');
        btnCancel.addEventListener('click', () => {
            confirmBox.remove();
        });
        
        confirmBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

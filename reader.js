/**
 * READER.JS - MANIFEST-BASED WITH DECRYPTION
 * Reads encrypted manifest.json and decrypts page URLs
 */

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
        if (repoParam && chapterFolder) {
            window.location.href = `reader.html?repo=${repoParam}&chapter=${chapterFolder}`;
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
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyItVREQwjL-hAwkeWxy1fj-0lggMbNnzOGta8XAOqT6tWzyxwOFvue8uthYoq-nQYBow/exec';

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

const readerContainer = document.getElementById('readerContainer');
const navProgressBar = document.getElementById('navProgressBar');
const navProgressExpanded = document.getElementById('navProgressExpanded');
const progressFill = document.getElementById('progressFill');
const pageThumbnails = document.getElementById('pageThumbnails');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        initProtection();
        await initializeReader();
        setupEnhancedEventListeners();
        initGlobalLoginButton(); // Setup redirect to info-manga
    } catch (error) {
    if (DEBUG_MODE) console.error('❌ Fatal error during initialization:', error);
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
        repoParam = urlParams.get('repo');
        
    if (DEBUG_MODE) dLog('📋 Parameters:', { chapter: chapterParam, repo: repoParam });
    if (DEBUG_MODE) dLog('📋 Chapter type:', typeof chapterParam, 'Value:', JSON.stringify(chapterParam)); // ← TAMBAH INI
        
        if (!chapterParam) {
            alert('Error: Parameter chapter tidak ditemukan.');
            hideLoading();
            return;
        }
        
        if (!repoParam) {
            alert('Error: Parameter repo tidak ditemukan.');
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
        
        // ✅ TAMBAHKAN BARIS INI - Track reading history
        trackReadingHistory();
        
    if (DEBUG_MODE) dLog('✅ Reader initialized successfully');
        
    } catch (error) {
    if (DEBUG_MODE) console.error('❌ Error initializing reader:', error);
        alert('Terjadi kesalahan saat memuat reader.');
        hideLoading();
    }
}

async function loadMangaData(repo) {
    try {
        // ✅ CHECK CACHE FIRST (5 minutes TTL)
        const cacheKey = `reader_manga_${repo}`;
        const cached = getCachedData(cacheKey, 300000, true); // 5 min, use sessionStorage
        
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

    // ✅ Update top navbar title and chapter
    const mangaTitleTopElement = document.getElementById('mangaTitleTop');
    if (mangaTitleTopElement) {
        mangaTitleTopElement.textContent = mangaData.manga.title;
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

    const btnHomeBottom = document.getElementById('btnHomeBottom');
    if (btnHomeBottom) {
        btnHomeBottom.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    if (DEBUG_MODE) dLog('🏠 [HOME-BOTTOM] Navigating to info-manga page');
            const urlParams = new URLSearchParams(window.location.search);
            const repo = urlParams.get('repo');
            if (repo) {
                window.location.href = `info-manga.html?repo=${repo}`;
            } else {
                // Fallback ke index jika tidak ada repo parameter
                window.location.href = 'index.html';
            }
        }, { passive: false });
    if (DEBUG_MODE) dLog('✅ [HOME-BOTTOM] Button handler attached');
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
        
        // Call Worker untuk decrypt manifest
        if (DEBUG_MODE) dLog(`🔐 Calling decrypt worker for ${repoOwner}/${repoName}/${currentChapterFolder}`);
        
        const workerResponse = await fetch('https://decrypt-manifest.nuranantoadhien.workers.dev', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                repo: `${repoOwner}/${repoName}`,
                chapter: currentChapterFolder
            })
        });
        
        if (!workerResponse.ok) {
            throw new Error(`Worker error: ${workerResponse.status}`);
        }
        
        const workerData = await workerResponse.json();
        
        if (!workerData.success || !workerData.pages) {
            throw new Error('Failed to decrypt manifest');
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
        setupPageTracking();
        renderPageThumbnails(signedPages);
        updateProgressBar();
        
        // Initialize Rating & Comments
        const urlParams = new URLSearchParams(window.location.search);
        const repo = urlParams.get('repo');
        const chapter = urlParams.get('chapter');
        
        if (repo && chapter && typeof RatingCommentsHandler !== 'undefined') {
            const ratingCommentsHandler = new RatingCommentsHandler();
            ratingCommentsHandler.init(repo, chapter).catch(err => {
                console.error('[RATING-COMMENTS] Init failed:', err);
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
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.getAttribute('data-page'));
                if (pageNum >= 1 && pageNum <= totalPages) {
                    currentPage = pageNum;
                    updatePageNavigation();
                    saveLastPage();
                }
            }
        });
    }, options);
    
    const pages = document.querySelectorAll('.reader-page');
    pages.forEach(page => observer.observe(page));
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


function renderPageThumbnails(pageUrls) {
    pageThumbnails.innerHTML = '';
    
    pageUrls.forEach((imageUrl, index) => {
        const pageNum = index + 1;
        
        const thumbItem = document.createElement('div');
        thumbItem.className = 'page-thumb-item';
        if (pageNum === currentPage) {
            thumbItem.classList.add('active');
        }
        
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = `Page ${pageNum}`;
        
        img.style.backgroundColor = 'var(--secondary-bg)';
        
		img.src = imageUrl;
        
        img.onload = () => {
            thumbItem.classList.add('loaded');
        };
        
		img.onerror = () => {
    if (DEBUG_MODE) console.error(`❌ Failed to load thumbnail for page ${pageNum}`);
			thumbItem.classList.add('error');
    
			// Fallback: show page number only
			img.style.display = 'none';
			thumbItem.style.backgroundColor = 'var(--secondary-bg)';
			thumbItem.style.display = 'flex';
			thumbItem.style.alignItems = 'center';
			thumbItem.style.justifyContent = 'center';
		};
        
        const pageNumDiv = document.createElement('div');
        pageNumDiv.className = 'page-number';
        pageNumDiv.textContent = `Page ${pageNum}`;
        
        thumbItem.appendChild(img);
        thumbItem.appendChild(pageNumDiv);
        
        thumbItem.addEventListener('click', (e) => {
            // Prevent click if user was dragging
            if (window.thumbnailDragState && window.thumbnailDragState.hasMoved()) {
                e.preventDefault();
                return;
            }
            goToPage(pageNum);
            navProgressExpanded.classList.remove('active');
        });
        
        pageThumbnails.appendChild(thumbItem);
    });
    
	if (DEBUG_MODE) dLog(`🖼️ Generated ${pageUrls.length} thumbnails (direct signed URLs)`);}

function updatePageNavigation() {
    document.querySelectorAll('.page-thumb-item').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === currentPage - 1);
    });
    
    const activeThumb = document.querySelector('.page-thumb-item.active');
    if (activeThumb && navProgressExpanded.classList.contains('active')) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    updateProgressBar();
}

function updateProgressBar() {
    if (!progressFill || !totalPages || totalPages === 0) return;
    
    // Simple progress: currentPage / totalPages
    const progress = ((currentPage - 1) / Math.max(1, totalPages - 1)) * 100;
    progressFill.style.width = `${progress}%`;
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
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (hasViewed) {
            if (DEBUG_MODE) dLog('👁️ Already counted in this session');
            return;
        }
        
        if (DEBUG_MODE) dLog('📤 Tracking chapter view...');
        
        const githubRepo = window.currentGithubRepo || repoParam;
        
        if (DEBUG_MODE) dLog(`   URL param: ${repoParam}`);
        if (DEBUG_MODE) dLog(`   GitHub repo: ${githubRepo}`);
        if (DEBUG_MODE) dLog(`   Chapter: ${currentChapterFolder}`);
        
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({ 
                repo: githubRepo,
                chapter: currentChapterFolder,
                type: 'chapter',
                timestamp: getWIBTimestamp()
            }),
            mode: 'no-cors'
        });
        
        sessionStorage.setItem(viewKey, 'true');
        
        if (DEBUG_MODE) dLog('✅ Chapter view tracked successfully (WIB)');
        
    } catch (error) {
    if (DEBUG_MODE) console.error('❌ Error tracking chapter view:', error);
    }
}

// ============================================
// ✅ NEW FUNCTION - Track Reading History
// ============================================
/**
 * ✅ Track reading history to API
 * Called when user opens a chapter
 */
async function trackReadingHistory() {
    try {
        const token = localStorage.getItem('authToken');
        
        // ✅ If not logged in, skip tracking
        if (!token) {
            if (DEBUG_MODE) dLog('⏭️ [HISTORY] Not logged in - skipping');
            return;
        }
        
        // ✅ Check if already tracked in this session (prevent duplicate writes)
        const historyKey = `tracked_history_${repoParam}_${currentChapterFolder}`;
        const alreadyTracked = sessionStorage.getItem(historyKey);
        
        if (alreadyTracked) {
            if (DEBUG_MODE) dLog('⏭️ [HISTORY] Already tracked in this session');
            return;
        }
        
        if (DEBUG_MODE) dLog('📖 [HISTORY] Tracking reading history...');
        
        // ✅ Get manga title
        const mangaTitle = mangaData?.manga?.title || 'Unknown';
        
        // ✅ Get chapter number from folder (remove "ch." prefix)
        const chapterNumber = currentChapterFolder.replace(/^ch\.?/i, '');
        
        // ✅ Parse chapter base (for sorting)
        const chapterBase = parseFloat(chapterNumber) || 1;
        
        if (DEBUG_MODE) {
    if (DEBUG_MODE) dLog('   Manga:', mangaTitle);
    if (DEBUG_MODE) dLog('   Chapter ID:', currentChapterFolder);
    if (DEBUG_MODE) dLog('   Chapter Base:', chapterBase);
        }
        
        const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
        
        const response = await fetch(`${API_URL}/reading/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                mangaId: repoParam,
                mangaTitle: mangaTitle,
                chapterId: currentChapterFolder,
                chapterBase: chapterBase
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // ✅ Mark as tracked in this session
            sessionStorage.setItem(historyKey, 'true');
            if (DEBUG_MODE) dLog('✅ [HISTORY] Reading history tracked successfully');
        } else {
    if (DEBUG_MODE) console.error('❌ [HISTORY] Failed to track:', data.error);
        }
        
    } catch (error) {
    if (DEBUG_MODE) console.error('❌ [HISTORY] Error tracking reading history:', error);
    }
}

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
    // Toggle expanded view on progress bar click
    navProgressBar.addEventListener('click', (e) => {
        e.stopPropagation();
        navProgressExpanded.classList.toggle('active');
    });
    
    // Close expanded view when clicking outside
    document.addEventListener('click', (e) => {
        if (!navProgressExpanded.contains(e.target) && !navProgressBar.contains(e.target)) {
            navProgressExpanded.classList.remove('active');
        }
    });
    
    // Prevent closing when clicking inside expanded view
    navProgressExpanded.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // ============================================
    // DRAG TO SCROLL FOR PAGE THUMBNAILS
    // ============================================
    let isDown = false;
    let startX;
    let startY;
    let scrollLeft;
    let hasMoved = false; // Track if mouse has moved significantly during drag
    const DRAG_THRESHOLD = 5; // Minimum pixels to consider it a drag
    
    pageThumbnails.addEventListener('mousedown', (e) => {
        isDown = true;
        hasMoved = false;
        startX = e.pageX - pageThumbnails.offsetLeft;
        startY = e.pageY;
        scrollLeft = pageThumbnails.scrollLeft;
        pageThumbnails.style.cursor = 'grabbing';
    });
    
    pageThumbnails.addEventListener('mouseleave', () => {
        isDown = false;
        pageThumbnails.classList.remove('dragging');
        pageThumbnails.style.cursor = 'grab';
        hasMoved = false;
    });
    
    pageThumbnails.addEventListener('mouseup', () => {
        isDown = false;
        pageThumbnails.classList.remove('dragging');
        pageThumbnails.style.cursor = 'grab';
        // Reset hasMoved immediately after a microtask to allow click to read it first
        setTimeout(() => { hasMoved = false; }, 0);
    });
    
    pageThumbnails.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        
        const x = e.pageX - pageThumbnails.offsetLeft;
        const distance = Math.abs(x - startX);
        
        // Only start dragging if moved beyond threshold
        if (distance > DRAG_THRESHOLD) {
            if (!hasMoved) {
                hasMoved = true;
                pageThumbnails.classList.add('dragging');
            }
            e.preventDefault();
            const walk = (x - startX) * 2; // Multiply by 2 for faster scrolling
            pageThumbnails.scrollLeft = scrollLeft - walk;
        }
    });
    
    // Expose hasMoved flag to global scope for thumbnail click handler
    window.thumbnailDragState = { hasMoved: () => hasMoved };
    
    // Touch support for mobile
    let touchStartX = 0;
    let touchScrollLeft = 0;
    
    pageThumbnails.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].pageX - pageThumbnails.offsetLeft;
        touchScrollLeft = pageThumbnails.scrollLeft;
    }, { passive: true });
    
    pageThumbnails.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX - pageThumbnails.offsetLeft;
        const walk = (x - touchStartX) * 2;
        pageThumbnails.scrollLeft = touchScrollLeft - walk;
    }, { passive: true });
    
    // Close expanded view when user scrolls
    const readerContainer = document.querySelector('.reader-container');
    if (readerContainer) {
        readerContainer.addEventListener('scroll', () => {
            if (navProgressExpanded.classList.contains('active')) {
                navProgressExpanded.classList.remove('active');
            }
        }, { passive: true });
    }
    
    // Also close on window scroll for webtoon mode
    window.addEventListener('scroll', () => {
        if (navProgressExpanded.classList.contains('active')) {
            navProgressExpanded.classList.remove('active');
        }
    }, { passive: true });
    
    // Close on escape key and arrow navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navProgressExpanded.classList.contains('active')) {
            navProgressExpanded.classList.remove('active');
        }
        
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


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
        console.log('✅ Donatur SETIA - Opening chapter directly');
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        if (repoParam && chapterFolder) {
            window.location.href = `reader.html?repo=${repoParam}&chapter=${chapterFolder}`;
        }
        return;
    }
    
    // ✅ PEMBACA SETIA - Show modal untuk kembali ke info page (untuk semua type: manga & webtoon)
    console.log('🔒 PEMBACA SETIA - Showing modal to go back to info page');
    
    const pembacaSetiaModal = document.getElementById('pembacaSetiaModal');
    if (!pembacaSetiaModal) {
        console.error('❌ pembacaSetiaModal element not found!');
        return;
    }
    
    pembacaSetiaModal.style.display = 'flex';
    pembacaSetiaModal.classList.add('active');
    
    console.log('🔒 PEMBACA SETIA modal shown');
    
    const btnYes = document.getElementById('btnPembacaSetiaYes');
    const btnNo = document.getElementById('btnPembacaSetiaNo');
    
    const closeModal = () => {
        pembacaSetiaModal.classList.remove('active');
        setTimeout(() => {
            pembacaSetiaModal.style.display = 'none';
        }, 300);
    };
    
    btnYes.onclick = () => {
        closeModal();
        // Navigate back to info page
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        if (repoParam) {
            window.location.href = `info-manga.html?repo=${repoParam}`;
        }
    };
    
    btnNo.onclick = closeModal;
    
    pembacaSetiaModal.onclick = (e) => {
        if (e.target === pembacaSetiaModal) {
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
    if (DEBUG_MODE) console.log(`🗑️  Cleared session for ${chapter}`);
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
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwZ0-VeyloQxjvh-h65G0wtfAzxVq6VYzU5Bz9n1Rl0T4GAkGu9X7HmGh_3_0cJhCS1iA/exec';

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

async function renderEndChapterButtons() {
    const container = document.getElementById('endChapterContainer');
    if (!container) return;
    
    const currentIndex = allChapters.findIndex(ch => ch.folder === currentChapterFolder);
    const isLastChapter = currentIndex === 0;
    const isOneshot = isOneshotChapter(currentChapterFolder);
    
    // ✅ NEW: Check if manga is END and this is the actual end chapter
    const isMangaEnd = mangaData.manga.status === 'END';
    const isActualEndChapter = isMangaEnd && 
                                mangaData.manga.endChapter && 
                                parseFloat(currentChapterFolder) === parseFloat(mangaData.manga.endChapter);
    
    // ============================================
    // 1️⃣ JIKA BUKAN CHAPTER TERAKHIR
    // ============================================
    if (!isLastChapter) {
        container.innerHTML = `
            <button class="next-chapter-btn" id="btnNextChapterDynamic">
                Next Chapter
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </button>
        `;
        
        const btn = document.getElementById('btnNextChapterDynamic');
        btn.onclick = () => navigateChapter('next');
        return;
    }
    
    // ============================================
    // 2️⃣ CEK APAKAH CHAPTER BERIKUTNYA LOCKED (dengan cek status user)
    // ============================================
    const nextChapter = allChapters[currentIndex - 1];
    
    // ✅ SECURITY: Always verify with backend for locked chapters (NO CACHE)
    const isDonatur = nextChapter && nextChapter.locked ? await verifyDonaturStatusStrict() : await getUserDonaturStatus();
    const nextIsActuallyLocked = nextChapter && nextChapter.locked && !isDonatur;
    
    if (nextIsActuallyLocked) {
        container.innerHTML = `
            <button class="next-chapter-btn" id="btnNextChapterLocked">
                Next Chapter
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </button>
        `;
        
        const btn = document.getElementById('btnNextChapterLocked');
        btn.onclick = () => {
            const chapterTitle = nextChapter.title || nextChapter.folder;
            const chapterFolder = nextChapter.folder;
            showLockedChapterModal(chapterTitle, chapterFolder);
        };
        return;
    }
    
    // ============================================
    // 3️⃣ JIKA ONESHOT - TAMPILKAN BACK TO INFO + KOMENTAR (DALAM 1 ROW)
    // ============================================
if (isOneshot) {
    container.innerHTML = `
        <button class="back-to-info-btn-large" onclick="window.location.href='info-manga.html?repo=${repoParam}'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Back to Info</span>
        </button>
    `;
    return;
}
    
    // ============================================
    // 4️⃣ JIKA MANGA END DAN INI CHAPTER TERAKHIR
    // ============================================
    if (isActualEndChapter) {
        console.log('🏁 This is the actual END chapter - hiding Trakteer button');
        
        // HANYA Back to Info button (FULL WIDTH)
        container.innerHTML = `
            <button class="back-to-info-btn-large" onclick="window.location.href='info-manga.html?repo=${repoParam}'">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span>Back to Info</span>
            </button>
        `;
        return;
    }
    
    // ============================================
    // 5️⃣ JIKA CHAPTER TERAKHIR TAPI MANGA ONGOING
    // ============================================
    const predictedNext = predictNextChapter(allChapters, currentChapterFolder);
    
    container.innerHTML = `
        <div class="dual-buttons-container">
            <button class="back-to-info-btn-half" onclick="window.location.href='info-manga.html?repo=${repoParam}'">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span>Back to Info</span>
            </button>
            <button class="trakteer-btn-half" onclick="window.open('${TRAKTEER_LINK}', '_blank')">
                <img src="assets/trakteer-icon.png" alt="Trakteer" class="trakteer-icon-small">
                <span>Beli Chapter ${predictedNext || 'Selanjutnya'}</span>
            </button>
        </div>
    `;
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
const pageNav = document.getElementById('pageNav');
const pageList = document.getElementById('pageList');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        initProtection();
        await initializeReader();
        setupEnhancedEventListeners();
    } catch (error) {
        console.error('❌ Fatal error during initialization:', error);
        alert(`Terjadi kesalahan saat memuat reader:\n${error.message}\n\nSilakan refresh halaman atau kembali ke info.`);
        hideLoading();
    }
});

window.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection:', event.reason);
});

/**
 * MODIFY EXISTING initializeReader function
 * Update logic untuk pass chapterFolder ke modal
 */
async function initializeReader() {
    try {
        showLoading();
        
        console.log('🚀 Initializing reader...');
        
        const urlParams = new URLSearchParams(window.location.search);
        const chapterParam = urlParams.get('chapter');
        repoParam = urlParams.get('repo');
        
        console.log('📋 Parameters:', { chapter: chapterParam, repo: repoParam });
        console.log('📋 Chapter type:', typeof chapterParam, 'Value:', JSON.stringify(chapterParam)); // ← TAMBAH INI
        
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
        console.log('📚 Available chapters:', allChapters.map(ch => ({
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
console.log('🔐 Lock status check:');
console.log('   Chapter locked:', chapterData.locked);
console.log('   Is validated:', isValidated);
console.log('   Session key:', `validated_${repoParam}_${chapterParam}`);

// ✅ SECURITY: Always verify with backend for locked chapters (NO CACHE)
const isDonatur = chapterData.locked ? await verifyDonaturStatusStrict() : await getUserDonaturStatus();
const isActuallyLocked = chapterData.locked && !isValidated && !isDonatur;

if (isActuallyLocked) {
    console.log('🔒 Chapter terkunci, belum divalidasi, dan user bukan DONATUR SETIA');
    const chapterTitle = chapterData.title || chapterParam;
    showLockedChapterModal(chapterTitle, chapterParam);
    hideLoading(); // ← TAMBAH INI!
    return;
}

if (isValidated || isDonatur) {
    console.log('✅ Session valid atau user DONATUR SETIA, chapter unlocked');
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
        
        console.log('✅ Reader initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing reader:', error);
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
            
            console.log('✅ Manga data loaded from cache');
            console.log(`📚 Loaded ${allChapters.length} chapters (cached)`);
            return;
        }
        
        // ✅ CACHE MISS - Fetch fresh
        const mangaConfig = MANGA_REPOS[repo];
        
        if (!mangaConfig) {
            throw new Error(`Repo "${repo}" tidak ditemukan di mapping`);
        }
        
        console.log(`📡 Fetching fresh manga data from: ${repo}`);
        
        let mangaJsonUrl;
        if (typeof mangaConfig === 'string') {
            mangaJsonUrl = mangaConfig;
        } else {
            mangaJsonUrl = mangaConfig.url;
            window.currentGithubRepo = mangaConfig.githubRepo;
            console.log(`🔗 GitHub repo: ${mangaConfig.githubRepo}`);
        }
        
        mangaData = await fetchFreshJSON(mangaJsonUrl);
        
        console.log('📦 Manga data loaded:', mangaData);
        
        allChapters = Object.values(mangaData.chapters).sort((a, b) => {
            const getSort = (folder) => {
                const parts = folder.split('.');
                const int = parseInt(parts[0]) || 0;
                const dec = parts[1] ? parseInt(parts[1]) : 0;
                return int + (dec / 1000);
            };
            return getSort(b.folder) - getSort(a.folder);
        });
        
        console.log(`✅ Loaded ${allChapters.length} chapters`);
        
        // ✅ SAVE TO CACHE
        setCachedData(cacheKey, {
            mangaData,
            allChapters,
            githubRepo: window.currentGithubRepo
        });
        console.log(`💾 Cached manga data: ${cacheKey}`);
        
    } catch (error) {
        console.error('❌ Error loading manga data:', error);
        
        // ✅ FALLBACK: Try stale cache
        const staleCache = getCachedData(`reader_manga_${repo}`, Infinity, true);
        if (staleCache) {
            console.warn('⚠️ Using stale cache due to error');
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
    if (DEBUG_MODE) console.log(`💾 Saved page ${currentPage} for ${currentChapterFolder}`);
}

function loadLastPage() {
    const storageKey = `lastPage_${repoParam}_${currentChapterFolder}`;
    const savedPage = localStorage.getItem(storageKey);
    if (savedPage) {
        const pageNum = parseInt(savedPage);
        if (pageNum > 0 && pageNum <= totalPages) {
            console.log(`📖 Restoring last page: ${pageNum}`);
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
    
    if (DEBUG_MODE) console.log(`📏 Chapter title font adjusted to: ${fontSize}px`);
}

function setupUI() {
    const mangaTitleElement = document.getElementById('mangaTitle');
    mangaTitleElement.textContent = mangaData.manga.title;
    
    document.title = `${mangaData.manga.title} - ${currentChapter.title}`;
    
    adjustTitleFontSize(mangaTitleElement);
    
    const titleElement = document.getElementById('chapterTitle');
    titleElement.textContent = currentChapter.title;
    
    adjustChapterTitleFontSize(titleElement);
    
    if (DEBUG_MODE) console.log(`📖 Read mode: ${readMode}`);
    
    // ✅ Setup Back to Info button
    const btnBack = document.getElementById('btnBackToInfo');
    if (btnBack) {
        // Remove existing listeners
        btnBack.onclick = null;
        btnBack.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const urlParams = new URLSearchParams(window.location.search);
            const repo = urlParams.get('repo') || repoParam;
            if (repo) {
                console.log('🔄 [BACK] Navigating to info page:', repo);
                window.location.href = `info-manga.html?repo=${repo}`;
            } else {
                console.error('❌ [BACK] Repo parameter not found');
            }
        }, { passive: false });
        console.log('✅ [BACK] Button handler attached');
    } else {
        console.error('❌ [BACK] btnBackToInfo element not found');
    }
    
    // ✅ Setup Chapter List button
    const btnChapterList = document.getElementById('btnChapterList');
    if (btnChapterList) {
        // Remove existing listeners
        btnChapterList.onclick = null;
        btnChapterList.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📋 [LIST] Opening chapter list modal');
            openChapterListModal();
        }, { passive: false });
        console.log('✅ [LIST] Button handler attached');
    } else {
        console.error('❌ [LIST] btnChapterList element not found');
    }
    
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
            if (DEBUG_MODE) console.log(`📏 Title fits: ${initialFontSize}px`);
            return;
        }
        
        const ratio = maxHeight / scrollHeight;
        let newFontSize = Math.max(Math.floor(initialFontSize * ratio), minFontSize);
        
        requestAnimationFrame(() => {
            element.style.fontSize = `${newFontSize}px`;
            if (DEBUG_MODE) console.log(`📏 Title font adjusted: ${initialFontSize}px → ${newFontSize}px`);
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
        if (DEBUG_MODE) console.log(`🔐 Calling decrypt worker for ${repoOwner}/${repoName}/${currentChapterFolder}`);
        
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
            console.log(`📊 Total pages: ${totalPages}`);
            console.log(`⏰ Token expires in ${Math.floor(expiresIn / 60)} minutes`);
        }
        
        // Render pages dengan signed URLs
        signedPages.forEach((signedUrl, index) => {
            const pageNum = index + 1;
            
            // ❌ NO LOG in production
            if (DEBUG_MODE) {
                console.log(`🖼️ Page ${pageNum}: ${signedUrl.substring(0, 80)}...`);
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
                if (DEBUG_MODE) console.log(`✅ Page ${pageNum} loaded successfully`);
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
        
        setupPageTracking();
        setupWebtoonScrollTracking();
        
        renderPageThumbnails(signedPages);
        updateProgressBar();
        
        if (DEBUG_MODE) console.log('✅ Pages container setup complete');
        
        currentPage = loadLastPage();
        
        readerContainer.classList.add('webtoon-mode');
        readerContainer.classList.remove('manga-mode');
        
        if (currentPage > 1) {
            setTimeout(() => {
                goToPage(currentPage);
                updatePageNavigation();
            }, 100);
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error loading pages:', error);
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
            console.log(`✅ Page ${pageNum} loaded successfully`);
        };
        
        img.onerror = () => {
            console.error(`❌ Failed to load page ${pageNum}`);
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
                currentPage = pageNum;
                updatePageNavigation();
                saveLastPage();
            }
        });
    }, options);
    
    const pages = document.querySelectorAll('.reader-page');
    pages.forEach(page => observer.observe(page));
}

function setupWebtoonScrollTracking() {
    const endChapterContainer = document.getElementById('endChapterContainer');
    
    if (endChapterContainer) {
        endChapterContainer.style.display = 'none';
        
        // ✅ TAMBAHKAN INI - Auto-show jika chapter pendek (no scroll)
        setTimeout(() => {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            // Jika tidak ada scroll atau scroll area sangat kecil
            if (documentHeight <= windowHeight + 50) {
                if (DEBUG_MODE) console.log('📏 Short chapter detected - auto-showing end buttons');
                endChapterContainer.style.display = 'block';
            }
        }, 500); // Delay 500ms untuk memastikan semua gambar sudah di-render
    }
}

function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    currentPage = pageNum;
    saveLastPage();
    
    const pages = document.querySelectorAll('.reader-page');
    if (pages[pageNum - 1]) {
        pages[pageNum - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    updatePageNavigation();
}


function renderPageThumbnails(pageUrls) {
    pageList.innerHTML = '';
    
    pageUrls.forEach((imageUrl, index) => {
        const pageNum = index + 1;
        
        const thumb = document.createElement('div');
        thumb.className = 'page-thumb';
        if (pageNum === currentPage) {
            thumb.classList.add('active');
        }
        
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = `Page ${pageNum}`;
        
        img.style.backgroundColor = 'var(--secondary-bg)';
        
		img.src = imageUrl;
        
        img.onload = () => {
            thumb.classList.add('loaded');
        };
        
		img.onerror = () => {
			console.error(`❌ Failed to load thumbnail for page ${pageNum}`);
			thumb.classList.add('error');
    
			// Fallback: show page number only
			img.style.display = 'none';
			thumb.style.backgroundColor = 'var(--secondary-bg)';
			thumb.style.display = 'flex';
			thumb.style.alignItems = 'center';
			thumb.style.justifyContent = 'center';
		};
        
        const pageNumDiv = document.createElement('div');
        pageNumDiv.className = 'page-number';
        pageNumDiv.textContent = pageNum;
        
        thumb.appendChild(img);
        thumb.appendChild(pageNumDiv);
        
        thumb.addEventListener('click', () => {
            goToPage(pageNum);
        });
        
        pageList.appendChild(thumb);
    });
    
	if (DEBUG_MODE) console.log(`🖼️ Generated ${pageUrls.length} thumbnails (direct signed URLs)`);}

function updatePageNavigation() {
    document.querySelectorAll('.page-thumb').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === currentPage - 1);
    });
    
    const activeThumb = document.querySelector('.page-thumb.active');
    if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    
    updateProgressBar();
}

function updateProgressBar() {
    const pageNavHandle = document.getElementById('pageNavHandle');
    if (!pageNavHandle) return;
    
    const progress = (currentPage / totalPages) * 100;
    pageNavHandle.style.width = `${progress}%`;
    pageNavHandle.setAttribute('data-progress', `${currentPage} / ${totalPages}`);
}

async function updateNavigationButtons() {
    await renderEndChapterButtons();
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
    
    window.location.href = `reader.html?repo=${repoParam}&chapter=${targetChapter.folder}`;
}

/**
 * Open chapter list modal - FIXED
 */
async function openChapterListModal() {
    const modal = document.getElementById('modalOverlay');
    const modalBody = document.getElementById('chapterListModal');
    
    if (DEBUG_MODE) console.log('📋 Opening chapter list modal...');
    
    if (!modal || !modalBody) {
        console.error('❌ Modal elements not found!');
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
        
        // ✅ lockIcon dan badges adalah HTML statis (aman), chapter.title adalah data dinamis (perlu textContent)
        if (lockIcon || badges) {
            const staticContent = document.createElement('span');
            staticContent.innerHTML = lockIcon + badges; // HTML statis aman
            titleDiv.appendChild(staticContent);
        }
        
        const titleText = document.createElement('span');
        titleText.textContent = chapter.title || chapter.folder; // ✅ XSS Protection: textContent untuk data dinamis
        titleDiv.appendChild(titleText);
        
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
    
    if (DEBUG_MODE) console.log('✅ Chapter list modal opened');}

/**
 * Close chapter list modal - FIXED
 */
function closeChapterListModal() {
    const modal = document.getElementById('modalOverlay');
    
    if (DEBUG_MODE) console.log('❌ Closing chapter list modal...');
    
    modal.classList.remove('active');
    
    // Wait for transition then hide
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
    
    if (DEBUG_MODE) console.log('✅ Chapter list modal closed');
}

async function trackChapterView() {
    try {
        const viewKey = `viewed_${repoParam}_${currentChapterFolder}`;
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (hasViewed) {
            if (DEBUG_MODE) console.log('👁️ Already counted in this session');
            return;
        }
        
        if (DEBUG_MODE) console.log('📤 Tracking chapter view...');
        
        const githubRepo = window.currentGithubRepo || repoParam;
        
        if (DEBUG_MODE) console.log(`   URL param: ${repoParam}`);
        if (DEBUG_MODE) console.log(`   GitHub repo: ${githubRepo}`);
        if (DEBUG_MODE) console.log(`   Chapter: ${currentChapterFolder}`);
        
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
        
        if (DEBUG_MODE) console.log('✅ Chapter view tracked successfully (WIB)');
        
    } catch (error) {
        console.error('❌ Error tracking chapter view:', error);
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
            if (DEBUG_MODE) console.log('⏭️ [HISTORY] Not logged in - skipping');
            return;
        }
        
        // ✅ Check if already tracked in this session (prevent duplicate writes)
        const historyKey = `tracked_history_${repoParam}_${currentChapterFolder}`;
        const alreadyTracked = sessionStorage.getItem(historyKey);
        
        if (alreadyTracked) {
            if (DEBUG_MODE) console.log('⏭️ [HISTORY] Already tracked in this session');
            return;
        }
        
        if (DEBUG_MODE) console.log('📖 [HISTORY] Tracking reading history...');
        
        // ✅ Get manga title
        const mangaTitle = mangaData?.manga?.title || 'Unknown';
        
        // ✅ Get chapter number from folder (remove "ch." prefix)
        const chapterNumber = currentChapterFolder.replace(/^ch\.?/i, '');
        
        // ✅ Parse chapter base (for sorting)
        const chapterBase = parseFloat(chapterNumber) || 1;
        
        if (DEBUG_MODE) {
            console.log('   Manga:', mangaTitle);
            console.log('   Chapter ID:', currentChapterFolder);
            console.log('   Chapter Base:', chapterBase);
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
            if (DEBUG_MODE) console.log('✅ [HISTORY] Reading history tracked successfully');
        } else {
            console.error('❌ [HISTORY] Failed to track:', data.error);
        }
        
    } catch (error) {
        console.error('❌ [HISTORY] Error tracking reading history:', error);
    }
}

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('active');
        if (DEBUG_MODE) console.log('📄 Loading overlay shown');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        if (DEBUG_MODE) console.log('✅ Loading overlay hidden');
    }
}

function initProtection() {
    if (DEBUG_MODE) {
        console.log('🔓 Debug mode enabled - protection disabled');  // ← Tidak perlu if lagi
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
    const pageNavHandle = document.getElementById('pageNavHandle');
    
    pageNavHandle.addEventListener('click', () => {
        document.body.classList.add('show-page-nav');
    });
    
    pageNavHandle.addEventListener('mouseenter', () => {
        document.body.classList.add('show-page-nav');
    });
    
    let showNavTimeout;
    document.addEventListener('mousemove', (e) => {
        const windowHeight = window.innerHeight;
        const mouseY = e.clientY;
        
        if (mouseY > windowHeight - 80) {
            document.body.classList.add('show-page-nav');
            clearTimeout(showNavTimeout);
        } else {
            clearTimeout(showNavTimeout);
            showNavTimeout = setTimeout(() => {
                if (!pageNav.matches(':hover') && !pageNavHandle.matches(':hover')) {
                    document.body.classList.remove('show-page-nav');
                }
            }, 300);
        }
    });
    
    pageNav.addEventListener('mouseenter', () => {
        clearTimeout(showNavTimeout);
        document.body.classList.add('show-page-nav');
    });
    
    pageNav.addEventListener('mouseleave', () => {
        showNavTimeout = setTimeout(() => {
            document.body.classList.remove('show-page-nav');
        }, 500);
    });
    
    let touchTimeout;
    let isNavShowing = false;
    
    pageNavHandle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        document.body.classList.add('show-page-nav');
        isNavShowing = true;
        clearTimeout(touchTimeout);
        
        touchTimeout = setTimeout(() => {
            document.body.classList.remove('show-page-nav');
            isNavShowing = false;
        }, 5000);
    });
    
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.page-nav')) {
            return;
        }
        
        const windowHeight = window.innerHeight;
        const touchY = e.touches[0].clientY;
        
        if (touchY > windowHeight - 50) {
            document.body.classList.add('show-page-nav');
            isNavShowing = true;
            clearTimeout(touchTimeout);
            
            touchTimeout = setTimeout(() => {
                document.body.classList.remove('show-page-nav');
                isNavShowing = false;
            }, 4000);
        }
    }, { passive: true });
    
    pageNav.addEventListener('touchstart', () => {
        clearTimeout(touchTimeout);
        document.body.classList.add('show-page-nav');
        isNavShowing = true;
        
        touchTimeout = setTimeout(() => {
            document.body.classList.remove('show-page-nav');
            isNavShowing = false;
        }, 5000);
    });
    
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
// HIDE NAVBAR ON SCROLL & UPDATE HEADER TITLE
// ============================================

let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const mangaTitleElement = document.getElementById('mangaTitle');
    
    if (scrollTop === 0) {
        if (mangaData) {
            mangaTitleElement.textContent = mangaData.manga.title;
        }
    } else {
        if (mangaData && currentChapter) {
            mangaTitleElement.textContent = `${mangaData.manga.title} - ${currentChapter.title}`;
        }
    }
    
    if (scrollTop > lastScrollTop && scrollTop > 100) {
        navbar.style.transform = 'translateY(-100%)';
        navbar.style.opacity = '0';
    } else {
        navbar.style.transform = 'translateY(0)';
        navbar.style.opacity = '1';
    }
    
    // ✅ TAMBAHKAN INI - Show end chapter buttons saat scroll ke bawah
    if (readMode === 'webtoon') {
        const endChapterContainer = document.getElementById('endChapterContainer');
        if (endChapterContainer) {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollBottom = scrollTop + windowHeight;
            
            if (scrollBottom >= documentHeight - 200) {
                endChapterContainer.style.display = 'block';
            } else {
                endChapterContainer.style.display = 'none';
            }
        }
    }

    lastScrollTop = scrollTop;
});
// ============================================
// SCROLL TO TOP BUTTON - TAMBAHKAN DI SINI!
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
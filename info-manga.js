/**
 * INFO-MANGA.JS - LCP OPTIMIZED dengan CDN Image Resize
 */

/**
 * ✅ CDN IMAGE OPTIMIZER - Auto resize menggunakan images.weserv.nl (FREE)
 */
function getResponsiveCDN(originalUrl) {
  const sizes = {
    small: 400,   // Mobile
    medium: 600,  // Tablet
    large: 800    // Desktop
  };
  
  // Encode URL untuk weserv.nl
  const encodeUrl = (url, width) => {
    const encoded = encodeURIComponent(url);
    return `https://images.weserv.nl/?url=${encoded}&w=${width}&q=85&output=webp`;
  };
  
  return {
    small: encodeUrl(originalUrl, sizes.small),
    medium: encodeUrl(originalUrl, sizes.medium),
    large: encodeUrl(originalUrl, sizes.large),
    original: originalUrl
  };
}

/**
 * INFO-MANGA.JS - CODE VALIDATION FOR WEBTOON TYPE
 * Tambahkan fungsi ini di bagian atas info-manga.js (setelah constants)
 */

// ============================================
// CODE VALIDATION MODULE
// ============================================

const CODE_VALIDATION_URL = 'https://manga-code-validator.nuranantoadhien.workers.dev/';

/**
 * Validate chapter code via Google Apps Script
 */
async function validateChapterCode(repoOwner, repoName, chapterFolder, userCode) {
    try {
        console.log('🔐 Validating code for chapter:', chapterFolder);
        
        const response = await fetch(CODE_VALIDATION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'validateCode',
                repoName: repoName,
                chapter: chapterFolder,
                code: userCode
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('✅ Validation result:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Code validation error:', error);
        return { valid: false, error: error.message };
    }
}

/**
 * Show code input modal for webtoon locked chapters
 */
function showCodeInputModal(chapterNumber = null, chapterFolder = null) {
    console.log('🔐 showCodeInputModal called:', { chapterNumber, chapterFolder });
    
    const modal = document.getElementById('codeInputModal');
    if (!modal) {
        console.error('❌ codeInputModal element not found!');
        return;
    }
    
    // Update modal title
    const modalHeader = modal.querySelector('.code-modal-header h2');
    if (modalHeader && chapterNumber) {
        const hasChapter = /^chapter\s+/i.test(chapterNumber);
        const titleText = hasChapter ? chapterNumber : `Chapter ${chapterNumber}`;
        modalHeader.textContent = `🔐 Masukkan Code untuk ${titleText}`;
    }
    
    // Clear previous input
    const codeInput = document.getElementById('chapterCodeInput');
    const errorMsg = document.getElementById('codeErrorMsg');
    const successMsg = document.getElementById('codeSuccessMsg');
    
        if (codeInput) codeInput.value = '';
    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
    
    // Show modal
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    console.log('🔐 Code modal shown');
    
    // Setup button handlers
    const btnSubmit = document.getElementById('btnSubmitCode');
    const btnCancel = document.getElementById('btnCancelCode');
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            
            // ✅ RESTORE PROTECTION setelah modal tertutup
            if (codeInput) {
                codeInput.style.userSelect = 'none';
                codeInput.style.webkitUserSelect = 'none';
            }
        }, 300);
    };
    
    // Remove old event listeners
    const newBtnSubmit = btnSubmit.cloneNode(true);
    btnSubmit.parentNode.replaceChild(newBtnSubmit, btnSubmit);
    
    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    // Add new event listeners
    newBtnSubmit.onclick = async () => {
    // ✅ STEP 1: Paste from clipboard first
    try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
            codeInput.value = clipboardText.trim();
            console.log('✅ Code pasted from clipboard');
        }
    } catch (err) {
        console.log('ℹ️ Clipboard read failed or empty, using manual input');
    }
    
    // ✅ STEP 2: Validate code (from clipboard or manual input)
    const code = codeInput.value.trim();
    
    if (!code) {
        showCodeError('Paste code atau masukkan code terlebih dahulu');
        return;
    }
    
    if (code.length !== 16) {
        showCodeError('Code harus 16 karakter');
        return;
    }
    
    // Show loading
    newBtnSubmit.disabled = true;
    newBtnSubmit.textContent = 'Memvalidasi...';
    
    // Get repo info from manga data
    const urlParams = new URLSearchParams(window.location.search);
    const repoParam = urlParams.get('repo');
    
    if (!repoParam) {
        showCodeError('Error: Repo tidak ditemukan');
        newBtnSubmit.disabled = false;
        newBtnSubmit.textContent = '📋 Paste & Submit Code';
        return;
    }
    
    // Get repo owner and name from manga data
    const repoOwner = mangaData.manga.repoUrl.split('/')[3];
    const repoName = mangaData.manga.repoUrl.split('/')[4];
    
    // Validate code
    const result = await validateChapterCode(repoOwner, repoName, chapterFolder, code);
    
    if (result.valid) {
        // Success - close modal and reload/open reader
        saveValidatedChapter(repoParam, chapterFolder);
        showCodeSuccess('Code valid! Membuka chapter...');
        
        setTimeout(() => {
            closeModal();
            // For info-manga.js: open reader
            // For reader.js: reload page
            if (typeof window.location.href.includes('reader.html') !== 'undefined' && window.location.href.includes('reader.html')) {
                window.location.reload();
            } else {
                window.location.href = `reader.html?repo=${repoParam}&chapter=${chapterFolder}`;
            }
        }, 1000);
        
    } else {
        // Error
        showCodeError(result.message || 'Code tidak valid');
        newBtnSubmit.disabled = false;
        newBtnSubmit.textContent = '📋 Paste & Submit Code';
    }
};
    
    newBtnCancel.onclick = closeModal;
    
    // Close on overlay click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

/**
 * Show error message in code modal
 */
function showCodeError(message) {
    const errorMsg = document.getElementById('codeErrorMsg');
    const successMsg = document.getElementById('codeSuccessMsg');
    
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
    }
    
    if (successMsg) {
        successMsg.style.display = 'none';
    }
}

/**
 * Show success message in code modal
 */
function showCodeSuccess(message) {
    const successMsg = document.getElementById('codeSuccessMsg');
    const errorMsg = document.getElementById('codeErrorMsg');
    
    if (successMsg) {
        successMsg.textContent = message;
        successMsg.style.display = 'block';
    }
    
    if (errorMsg) {
        errorMsg.style.display = 'none';
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
        
        console.log('🔒 Locked chapter clicked:', chapter.folder);
        
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
    console.log(`💾 Saved session for ${chapter} (expires in 1 hour)`);
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
            console.log(`⏰ Session expired for ${chapter}`);
            sessionStorage.removeItem(key);
            return false;
        }
        
        const remainingMs = data.expiry - now;
        const remainingMin = Math.floor(remainingMs / 60000);
        console.log(`✅ Session valid for ${chapter} (${remainingMin} min remaining)`);
        
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
    console.log(`🗑️  Cleared session for ${chapter}`);
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
                        console.log('✅ Cover preloaded successfully');
                        // Mark as used to prevent warning
                        preloadLink.dataset.loaded = 'true';
                    };
                    
                    document.head.appendChild(preloadLink);
                    
                    console.log('🚀 Cover preload initiated');
                }
            })
            .catch(err => console.warn('⚠️ Preload failed:', err));
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

/**
 * Show locked chapter modal (with type detection)
 */
function showLockedChapterModal(chapterNumber = null) {
    console.log('🔒 showLockedChapterModal called with chapter:', chapterNumber);
    
    // Check manga type
    const mangaType = mangaData?.manga?.type || 'manga';
    
    // Extract chapter folder from chapterNumber (might be "Chapter 7.3" or "7.3")
    let chapterFolder = chapterNumber;
    if (typeof chapterNumber === 'string' && chapterNumber.toLowerCase().startsWith('chapter ')) {
        chapterFolder = chapterNumber.replace(/^chapter\s+/i, '');
    }
    
    if (mangaType === 'webtoon') {
        // Show code input modal for webtoon
        showCodeInputModal(chapterNumber, chapterFolder);
        return;
    }
    
    // Original code for manga type (Trakteer modal)
    const modal = document.getElementById('lockedChapterModal');
    if (!modal) return;
    
    const modalHeader = modal.querySelector('.locked-modal-header h2');
    if (modalHeader && chapterNumber) {
        const hasChapter = /^chapter\s+/i.test(chapterNumber);
        const titleText = hasChapter ? chapterNumber : `Chapter ${chapterNumber}`;
        modalHeader.textContent = `🔒 ${titleText} Terkunci karena RAW Berbayar`;
    } else if (modalHeader) {
        modalHeader.textContent = `🔒 Chapter Terkunci karena RAW Berbayar`;
    }
    
    modal.style.display = 'flex';
    
    const btnYes = document.getElementById('btnLockedYes');
    const btnNo = document.getElementById('btnLockedNo');
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    btnYes.onclick = () => {
        closeModal();
        window.open(TRAKTEER_LINK, '_blank');
    };
    
    btnNo.onclick = closeModal;
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

// Google Apps Script URL untuk view counter
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwZ0-VeyloQxjvh-h65G0wtfAzxVq6VYzU5Bz9n1Rl0T4GAkGu9X7HmGh_3_0cJhCS1iA/exec';

let mangaData = null;

// Load data saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    await loadMangaFromRepo();
    setupShowDetailsButton();
    
    // Track page view
    trackPageView();
});

/**
 * Get manga.json URL from URL parameter
 */
function getMangaJsonUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const repoParam = urlParams.get('repo');
    
    if (!repoParam) {
        console.error('❌ Parameter "repo" tidak ditemukan di URL');
        alert('Error: Parameter repo tidak ditemukan.\n\nContoh: info-manga.html?repo=10nenburi');
        return null;
    }
    
    const mangaConfig = MANGA_REPOS[repoParam];
    
    if (!mangaConfig) {
        console.error(`❌ Repo "${repoParam}" tidak ditemukan di mapping`);
        alert(`Error: Repo "${repoParam}" tidak terdaftar.\n\nRepo tersedia: ${Object.keys(MANGA_REPOS).join(', ')}`);
        return null;
    }
    
    console.log(`📚 Loading manga: ${repoParam}`);
    
    // Support both old format (string) and new format (object)
    if (typeof mangaConfig === 'string') {
        return mangaConfig;
    } else {
        // Store githubRepo for later use
        window.currentGithubRepo = mangaConfig.githubRepo;
        return mangaConfig.url;
    }
}

/**
 * Load manga.json dari repo chapter
 */
async function loadMangaFromRepo() {
    try {
        const mangaJsonUrl = getMangaJsonUrl();
        if (!mangaJsonUrl) return;
        
        // Add cache buster
        const timestamp = new Date().getTime();
        const response = await fetch(`${mangaJsonUrl}?t=${timestamp}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        mangaData = await response.json();
        
        console.log('📦 Raw manga data:', mangaData);
        
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
        
        console.log('✅ Manga data loaded from repo (WIB timezone)');
        
    } catch (error) {
        console.error('❌ Error loading manga data:', error);
        alert('Gagal memuat data manga dari repository. Cek console untuk detail.');
    }
}

/**
 * Display informasi manga
 */
function displayMangaInfo() {
    const manga = mangaData.manga;
    
    // Update Title - Desktop
    const mainTitle = document.getElementById('mainTitle');
    const subtitle = document.getElementById('subtitle');
    mainTitle.textContent = manga.title;
    subtitle.textContent = manga.alternativeTitle || '';
    
    // Add class untuk judul panjang
    adjustTitleSize(mainTitle, manga.title);
    adjustTitleSize(subtitle, manga.alternativeTitle, true);
    
    // Update Title - Mobile
    const mainTitleMobile = document.getElementById('mainTitleMobile');
    const subtitleMobile = document.getElementById('subtitleMobile');
    mainTitleMobile.textContent = manga.title;
    subtitleMobile.textContent = manga.alternativeTitle || '';
    
    adjustTitleSize(mainTitleMobile, manga.title);
    adjustTitleSize(subtitleMobile, manga.alternativeTitle, true);
    
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
    
    // Fallback ke original jika gagal
    coverImg.onerror = function() {
        console.error('❌ Failed to load cover via CDN, using original');
        this.src = manga.cover;
        this.srcset = ''; // Remove srcset on error
    };
    
    console.log('✅ Cover loaded with CDN optimization');
    
    // Update Views
    document.getElementById('viewsCount').textContent = manga.views || 0;
    document.getElementById('viewsCountMobile').textContent = manga.views || 0;
    
    // Update Description
    document.getElementById('descriptionContent').textContent = manga.description;
    
    // Update mobile sinopsis in details container
    const synopsisMobile = document.getElementById('synopsisMobile');
    if (synopsisMobile) {
        synopsisMobile.textContent = manga.description;
    }
    
    // Update Author & Artist
    document.getElementById('authorName').textContent = manga.author;
    document.getElementById('artistName').textContent = manga.artist;
    
    // Update Genre
    displayGenres(manga.genre);
    
    // Setup Buttons
    setupButtons(manga.links);
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
 * Display genre tags
 */
function displayGenres(genres) {
    const genreList = document.getElementById('genreList');
    genreList.innerHTML = '';
    
    if (!genres || genres.length === 0) {
        genreList.innerHTML = '<span class="genre-tag">Unknown</span>';
        return;
    }
    
    genres.forEach(genre => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.textContent = genre;
        genreList.appendChild(tag);
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
 * Display chapters
 */
function displayChapters() {
    const chapterList = document.getElementById('chapterList');
    chapterList.innerHTML = '';
    
    const chaptersArray = Object.values(mangaData.chapters);
    
    chaptersArray.sort((a, b) => {
        const numA = parseFloat(a.folder);
        const numB = parseFloat(b.folder);
        return numB - numA;
    });
    
    const initialLimit = getInitialChapterLimit();
    
    chaptersArray.forEach((chapter, index) => {
        const chapterElement = createChapterElement(chapter);
        
        if (index >= initialLimit) {
            chapterElement.classList.add('chapter-hidden');
        }
        
        chapterList.appendChild(chapterElement);
    });
    
    if (chaptersArray.length > initialLimit) {
        const showMoreBtn = createShowMoreButton(chaptersArray.length - initialLimit);
        chapterList.appendChild(showMoreBtn);
    }
    
    console.log(`✅ Loaded ${chaptersArray.length} chapters`);
}

/**
 * Create chapter element
 */
function createChapterElement(chapter) {
    const div = document.createElement('div');
    div.className = 'chapter-item';
    
    if (chapter.locked) {
        div.classList.add('chapter-locked');
        div.onclick = () => trackLockedChapterView(chapter);
    } else {
        div.onclick = () => openChapter(chapter);
    }
    
    const lockIcon = chapter.locked ? '🔒 ' : '';
    const uploadDate = getRelativeTime(chapter.uploadDate);
    const isRecent = isRecentlyUploaded(chapter.uploadDate);
    const updatedBadge = isRecent ? '<span class="chapter-updated-badge">UPDATED</span>' : '';
    
    div.innerHTML = `
        <div class="chapter-info">
            <div class="chapter-title-row">
                <span class="chapter-title-text">${lockIcon}${chapter.title}</span>
                ${updatedBadge}
            </div>
            ${uploadDate ? `<div class="chapter-upload-date">${uploadDate}</div>` : ''}
        </div>
        <div class="chapter-views">
            <span>👁️ ${chapter.views}</span>
        </div>
    `;
    
    return div;
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
        
        console.log('🔒 Locked chapter clicked:', chapter.folder);
        
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
        
        console.log('✅ Chapter view increment request sent');
        
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
    
    console.log('📖 Opening chapter:', chapter.folder);
    window.location.href = `reader.html?repo=${repoParam}&chapter=${chapter.folder}`;
}

/**
 * Get initial chapter limit
 */
function getInitialChapterLimit() {
    const width = window.innerWidth;
    
    if (width <= 480) return 2;
    else if (width <= 768) return 4;
    else if (width <= 1024) return 7;
    else return 10;
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
 * Setup buttons
 */
function setupButtons(links) {
    const btnMangadex = document.getElementById('btnMangadex');
    const btnRaw = document.getElementById('btnRaw');
    
    if (btnMangadex) {
        btnMangadex.onclick = () => {
            if (links && links.mangadex) {
                window.open(links.mangadex, '_blank');
            } else {
                alert('Link Mangadex tidak tersedia');
            }
        };
    }
    
    if (btnRaw) {
        btnRaw.onclick = () => {
            if (links && links.raw) {
                window.open(links.raw, '_blank');
            } else {
                alert('Link Raw tidak tersedia');
            }
        };
    }
}

/**
 * Setup show details button
 */
function setupShowDetailsButton() {
    const btn = document.getElementById('btnShowDetails');
    const container = document.getElementById('detailsContainer');
    const btnText = document.getElementById('detailsButtonText');
    
    if (!btn || !container) return;
    
    let isShown = false;

    btn.onclick = () => {
        isShown = !isShown;
        
        if (isShown) {
            container.classList.add('show');
            btnText.textContent = 'Hide Details';
        } else {
            container.classList.remove('show');
            btnText.textContent = 'Show Details';
        }
    };
}

/**
 * Track page view
 */
async function trackPageView() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        
        if (!repoParam) {
            console.log('⚠️ No repo parameter, skipping view tracking');
            return;
        }
        
        const viewKey = `viewed_${repoParam}`;
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (hasViewed) {
            console.log('📊 Already counted in this session');
            return;
        }
        
        const githubRepo = window.currentGithubRepo || repoParam;
        await incrementPendingViews(githubRepo);
        
        sessionStorage.setItem(viewKey, 'true');
        console.log('✅ View tracked successfully');
        
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
        
        console.log('✅ View increment request sent');
        
    } catch (error) {
        console.error('❌ Error incrementing views:', error);
    }
}

/**
 * Protection code
 */
const DEBUG_MODE = false;

function initProtection() {
    if (DEBUG_MODE) {
        console.log('🔓 Debug mode enabled - protection disabled');
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
    
    console.log('🔒 Protection enabled');
}

initProtection();

/**
 * Fetch MangaDex rating
 */
async function fetchMangaDexRating() {
    try {
        const mangadexUrl = mangaData.manga.links?.mangadex;
        
        if (!mangadexUrl) {
            console.log('⚠️ MangaDex URL tidak tersedia');
            return;
        }
        
        const mangaIdMatch = mangadexUrl.match(/\/title\/([a-f0-9-]+)/);
        
        if (!mangaIdMatch) {
            console.error('❌ Tidak bisa extract MangaDex ID dari URL');
            return;
        }
        
        const mangaId = mangaIdMatch[1];
        
        // Check cache (48 hours)
        const cachedRating = localStorage.getItem(`rating_${mangaId}`);
        const cachedTime = localStorage.getItem(`rating_time_${mangaId}`);
        
        if (cachedRating && cachedTime) {
            const cacheAge = Date.now() - parseInt(cachedTime);
            const cacheAgeHours = Math.floor(cacheAge / 3600000);
            const CACHE_DURATION = 48 * 3600000;
            
            if (cacheAge < CACHE_DURATION) {
                console.log(`📦 Using cached rating: ${cachedRating} (${cacheAgeHours} hours old)`);
                
                document.getElementById('ratingScore').textContent = cachedRating;
                document.getElementById('ratingScoreMobile').textContent = cachedRating;
                
                return;
            } else {
                console.log(`🔄 Cache expired (${cacheAgeHours} hours old), fetching fresh data...`);
            }
        }
        
        console.log(`📊 Fetching rating untuk manga ID: ${mangaId}`);
        
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
            
            document.getElementById('ratingScore').textContent = roundedRating;
            document.getElementById('ratingScoreMobile').textContent = roundedRating;
            
            console.log(`⭐ Rating MangaDex: ${roundedRating}/10`);
        } else {
            throw new Error('No rating data');
        }
        
    } catch (error) {
        console.error('❌ Error fetching MangaDex rating:', error);
        
        const mangaIdMatch = mangaData.manga.links?.mangadex?.match(/\/title\/([a-f0-9-]+)/);
        if (mangaIdMatch) {
            const cachedRating = localStorage.getItem(`rating_${mangaIdMatch[1]}`);
            if (cachedRating) {
                console.log(`📦 Using old cache: ${cachedRating}`);
                document.getElementById('ratingScore').textContent = cachedRating;
                document.getElementById('ratingScoreMobile').textContent = cachedRating;
                return;
            }
        }
        
        document.getElementById('ratingScore').textContent = '-';
        document.getElementById('ratingScoreMobile').textContent = '-';
    }
}

/**
 * Setup Read First button
 */
function setupReadFirstButton() {
    const btnReadFirstOutside = document.getElementById('btnReadFirstOutside');
    const btnReadFirstInside = document.getElementById('btnReadFirstInside');
    
    if (!btnReadFirstOutside && !btnReadFirstInside) {
        console.warn('⚠️ Read First buttons not found');
        return;
    }
    
    function getFirstUnlockedChapter() {
        if (!mangaData || !mangaData.chapters) {
            console.error('❌ Manga data not loaded');
            return null;
        }
        
        const chaptersArray = Object.values(mangaData.chapters);
        
        chaptersArray.sort((a, b) => {
            const numA = parseFloat(a.folder);
            const numB = parseFloat(b.folder);
            return numA - numB;
        });
        
        const firstUnlocked = chaptersArray.find(ch => !ch.locked);
        
        if (!firstUnlocked) {
            console.warn('⚠️ All chapters are locked');
            return null;
        }
        
        return firstUnlocked;
    }
    
    function handleReadFirstClick() {
        const firstChapter = getFirstUnlockedChapter();
        
        if (!firstChapter) {
            alert('Tidak ada chapter yang tersedia. Semua chapter terkunci.');
            openTrakteer();
            return;
        }
        
        console.log('🎬 Opening first chapter:', firstChapter.folder);
        openChapter(firstChapter);
    }
    
    if (btnReadFirstOutside) {
        btnReadFirstOutside.onclick = handleReadFirstClick;
    }
    if (btnReadFirstInside) {
        btnReadFirstInside.onclick = handleReadFirstClick;
    }
    
    console.log('✅ Read First buttons initialized');
}
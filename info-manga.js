/**
 * INFO-MANGA.JS - LCP OPTIMIZED
 * Early cover preload untuk fix "Request is discoverable"
 */

// ============================================
// EARLY COVER PRELOAD - Run immediately
// ============================================

(function() {
    // Get repo from URL
    const urlParams = new URLSearchParams(window.location.search);
    const repoId = urlParams.get('repo');
    
    if (repoId && typeof MANGA_REPOS !== 'undefined' && MANGA_REPOS[repoId]) {
        const mangaConfig = MANGA_REPOS[repoId];
        const mangaJsonUrl = typeof mangaConfig === 'string' ? mangaConfig : mangaConfig.url;
        
        // Fetch manga.json ASAP untuk dapat cover URL
        fetch(mangaJsonUrl + '?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                if (data.manga && data.manga.cover) {
                    // Create preload link immediately
                    const preloadLink = document.createElement('link');
                    preloadLink.rel = 'preload';
                    preloadLink.as = 'image';
                    preloadLink.href = data.manga.cover;
                    preloadLink.fetchpriority = 'high';
                    document.head.appendChild(preloadLink);
                    
                    console.log('🚀 Cover preloaded:', data.manga.cover);
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

// ============================================
// MANGA_REPOS sudah di-export dari manga-config.js
// TIDAK PERLU DEFINE DI SINI LAGI!
// ============================================

// Link Trakteer untuk chapter terkunci
const TRAKTEER_LINK = 'https://trakteer.id/NuranantoScanlation';

/**
 * Show locked chapter modal
 */
function showLockedChapterModal(chapterNumber = null) {
    const modal = document.getElementById('lockedChapterModal');
    if (!modal) return;
    
    // Update modal title with chapter number
    const modalHeader = modal.querySelector('.locked-modal-header h2');
    if (modalHeader && chapterNumber) {
        // Check if chapterNumber already contains "Chapter"
        const hasChapter = /^chapter\s+/i.test(chapterNumber);
        const titleText = hasChapter ? chapterNumber : `Chapter ${chapterNumber}`;
        modalHeader.textContent = `🔒 ${titleText} Terkunci karena RAW Berbayar`;
    } else if (modalHeader) {
        modalHeader.textContent = `🔒 Chapter Terkunci karena RAW Berbayar`;
    }
    
    modal.style.display = 'flex';
    
    // Setup button handlers
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
    
    // Close on overlay click
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
    
    // Update Cover
    const coverImg = document.getElementById('mangaCover');
    coverImg.src = manga.cover;
    coverImg.onerror = function() {
        console.error('❌ Failed to load cover:', manga.cover);
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="450"%3E%3Crect width="300" height="450" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999"%3ENo Cover%3C/text%3E%3C/svg%3E';
    };
    
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
 * - < 1 day: "X jam yang lalu"
 * - 1 day: "1 hari yang lalu"
 * - 2 days: "2 hari yang lalu"
 * - 3 days: "3 hari yang lalu"
 * - > 3 days: "14 Nov 2024"
 */
function getRelativeTime(uploadDateStr) {
    if (!uploadDateStr) return '';
    
    const uploadDate = new Date(uploadDateStr);
    const now = new Date();
    
    // Check if valid date
    if (isNaN(uploadDate.getTime())) {
        return '';
    }
    
    const diffMs = now - uploadDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Less than 24 hours
    if (diffHours < 24) {
        if (diffHours < 1) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffMins <= 1 ? 'Baru saja' : `${diffMins} menit yang lalu`;
        }
        return `${diffHours} jam yang lalu`;
    }
    
    // 1-3 days
    if (diffDays === 1) return '1 hari yang lalu';
    if (diffDays === 2) return '2 hari yang lalu';
    if (diffDays === 3) return '3 hari yang lalu';
    
    // More than 3 days - show full date
    return uploadDate.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
    });
}

/**
 * Check if chapter was uploaded within 2 days (for UPDATED badge)
 */
function isRecentlyUploaded(uploadDateStr) {
    if (!uploadDateStr) return false;
    
    const uploadDate = new Date(uploadDateStr);
    const now = new Date();
    
    // Check if valid date
    if (isNaN(uploadDate.getTime())) {
        return false;
    }
    
    const diffDays = (now - uploadDate) / (1000 * 60 * 60 * 24);
    
    // Show badge for chapters uploaded within 2 days
    return diffDays <= 2;
}

/**
 * Display chapters
 */
function displayChapters() {
    const chapterList = document.getElementById('chapterList');
    chapterList.innerHTML = '';
    
    // Convert chapters object to array
    const chaptersArray = Object.values(mangaData.chapters);
    
    // Sort descending (terbaru di atas)
    chaptersArray.sort((a, b) => {
        const numA = parseFloat(a.folder);
        const numB = parseFloat(b.folder);
        return numB - numA;
    });
    
    // Get initial limit
    const initialLimit = getInitialChapterLimit();
    
    chaptersArray.forEach((chapter, index) => {
        const chapterElement = createChapterElement(chapter);
        
        // Hide chapters beyond limit
        if (index >= initialLimit) {
            chapterElement.classList.add('chapter-hidden');
        }
        
        chapterList.appendChild(chapterElement);
    });
    
    // Add show more button if needed
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
    
    // Check if locked
    if (chapter.locked) {
        div.classList.add('chapter-locked');
        div.onclick = () => trackLockedChapterView(chapter);
    } else {
        div.onclick = () => openChapter(chapter);
    }
    
    const lockIcon = chapter.locked ? '🔒 ' : '';
    const uploadDate = getRelativeTime(chapter.uploadDate);
    
    // Check if chapter is recently uploaded (within 2 days)
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
 * Open Trakteer link for locked chapters
 */
function openTrakteer() {
    window.open(TRAKTEER_LINK, '_blank');
}

/**
 * Track locked chapter view and open Trakteer
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
        console.log('📊 Tracking view for locked chapter...');
        
        // Get GitHub repo name from config or use repoParam as fallback
        const githubRepo = window.currentGithubRepo || repoParam;
        
        incrementPendingChapterViews(githubRepo, chapter.folder).catch(err => {
            console.error('⚠️ Failed to track locked chapter view:', err);
        });
        
        const chapterTitle = chapter.title || chapter.folder;
        showLockedChapterModal(chapterTitle);
        
    } catch (error) {
        console.error('❌ Error tracking locked chapter:', error);
        openTrakteer();
    }
}

/**
 * Increment pending chapter views via Google Apps Script
 */
async function incrementPendingChapterViews(repo, chapter) {
    try {
        console.log('📡 Sending chapter view increment to Google Apps Script (WIB)...');
        
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
        
        console.log('✅ Chapter view increment request sent (no-cors mode, WIB)');
        
    } catch (error) {
        console.error('❌ Error incrementing chapter views:', error);
        throw error;
    }
}

/**
 * Open chapter
 */
function openChapter(chapter) {
    // Get repo param from current URL
    const urlParams = new URLSearchParams(window.location.search);
    const repoParam = urlParams.get('repo');
    
    if (!repoParam) {
        console.error('❌ Repo parameter not found');
        alert('Error: Parameter repo tidak ditemukan.');
        return;
    }
    
    console.log('📖 Opening chapter:', chapter.folder, 'from repo:', repoParam);
    
    // Redirect to reader with repo and chapter params
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
    
    // Button Mangadex
    if (btnMangadex) {
        btnMangadex.onclick = () => {
            if (links && links.mangadex) {
                window.open(links.mangadex, '_blank');
            } else {
                alert('Link Mangadex tidak tersedia');
            }
        };
    }
    
    // Button Raw
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
        // Get repo param
        const urlParams = new URLSearchParams(window.location.search);
        const repoParam = urlParams.get('repo');
        
        if (!repoParam) {
            console.log('⚠️ No repo parameter, skipping view tracking');
            return;
        }
        
        // Check if already viewed in this session
        const viewKey = `viewed_${repoParam}`;
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (hasViewed) {
            console.log('📊 Already counted in this session');
            return;
        }
        
        console.log('📤 Tracking page view for:', repoParam);
        
        // Get GitHub repo name from config or use repoParam as fallback
        const githubRepo = window.currentGithubRepo || repoParam;
        
        // Increment pending views via Google Apps Script
        await incrementPendingViews(githubRepo);
        
        // Mark as viewed in this session
        sessionStorage.setItem(viewKey, 'true');
        
        console.log('✅ View tracked successfully (WIB)');
        
    } catch (error) {
        console.error('❌ Error tracking view:', error);
        // Don't throw error - continue normal operation
    }
}

/**
 * Increment pending views via Google Apps Script
 */
async function incrementPendingViews(repo) {
    try {
        console.log('📡 Sending view increment to Google Apps Script (WIB)...');
        
        // Using text/plain to avoid CORS preflight with no-cors mode
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
        
        console.log('✅ View increment request sent (no-cors mode, WIB)');
        
    } catch (error) {
        console.error('❌ Error incrementing views:', error);
    }
}

// ============================================
// PROTECTION CODE
// ============================================

const DEBUG_MODE = false; // Set true untuk debugging

function initProtection() {
    if (DEBUG_MODE) {
        console.log('🔓 Debug mode enabled - protection disabled');
        return;
    }
    
    // Disable right-click
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    // Disable keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (
            e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
            (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
            (e.ctrlKey && e.keyCode === 85) || // Ctrl+U
            (e.ctrlKey && e.keyCode === 83) // Ctrl+S
        ) {
            e.preventDefault();
            return false;
        }
    });

    // Disable text selection on images
    document.addEventListener('selectstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });

    // Disable drag and drop
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });

    // Disable copy
    document.addEventListener('copy', (e) => {
        e.preventDefault();
        return false;
    });
    
    console.log('🔒 Protection enabled');
}

// Init protection immediately
initProtection();

/**
 * Fetch rating dari MangaDex API
 */
/**
 * Fetch rating dari MangaDex API dengan multi-proxy fallback + 48 hour cache
 */
async function fetchMangaDexRating() {
    try {
        const mangadexUrl = mangaData.manga.links?.mangadex;
        
        if (!mangadexUrl) {
            console.log('⚠️ MangaDex URL tidak tersedia');
            return;
        }
        
        // Extract manga ID dari URL
        const mangaIdMatch = mangadexUrl.match(/\/title\/([a-f0-9-]+)/);
        
        if (!mangaIdMatch) {
            console.error('❌ Tidak bisa extract MangaDex ID dari URL');
            return;
        }
        
        const mangaId = mangaIdMatch[1];
        
        // ============================================
        // CEK CACHE DULU (48 JAM)
        // ============================================
        const cachedRating = localStorage.getItem(`rating_${mangaId}`);
        const cachedTime = localStorage.getItem(`rating_time_${mangaId}`);
        
        if (cachedRating && cachedTime) {
            const cacheAge = Date.now() - parseInt(cachedTime);
            const cacheAgeHours = Math.floor(cacheAge / 3600000); // Convert to hours
            const CACHE_DURATION = 48 * 3600000; // 48 jam dalam milliseconds
            
            if (cacheAge < CACHE_DURATION) {
                console.log(`📦 Using cached rating: ${cachedRating} (${cacheAgeHours} hours old, valid for ${48 - cacheAgeHours} more hours)`);
                
                // Tampilkan rating dari cache
                const ratingScoreDesktop = document.getElementById('ratingScore');
                if (ratingScoreDesktop) {
                    ratingScoreDesktop.textContent = cachedRating;
                }
                
                const ratingScoreMobile = document.getElementById('ratingScoreMobile');
                if (ratingScoreMobile) {
                    ratingScoreMobile.textContent = cachedRating;
                }
                
                return; // STOP DI SINI - tidak perlu fetch!
            } else {
                console.log(`🔄 Cache expired (${cacheAgeHours} hours old), fetching fresh data...`);
            }
        }
        
        // ============================================
        // FETCH BARU (jika tidak ada cache atau expired)
        // ============================================
        console.log(`📊 Fetching rating untuk manga ID: ${mangaId}`);
        
        const apiUrl = `https://api.mangadex.org/statistics/manga/${mangaId}`;
        
        // Daftar proxy dengan prioritas
        const proxies = [
            { 
                name: 'GoogleAppsScript', 
                url: 'https://script.google.com/macros/s/AKfycbwZ0-VeyloQxjvh-h65G0wtfAzxVq6VYzU5Bz9n1Rl0T4GAkGu9X7HmGh_3_0cJhCS1iA/exec?action=getRating&mangaId=',
                isGAS: true
            }
        ];
        
        let rating = null;
        let successProxy = null;
        
        // Loop coba semua proxy sampai berhasil
        for (const proxy of proxies) {
            try {
                console.log(`🔄 Trying ${proxy.name}...`);
                
                let fetchUrl;
                if (proxy.isGAS) {
                    // GAS: langsung pass mangaId (tidak perlu encode full URL)
                    fetchUrl = proxy.url + mangaId;
                } else {
                    // Public proxy: encode full API URL
                    fetchUrl = proxy.url + encodeURIComponent(apiUrl);
                }
                
                const response = await fetch(fetchUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    // Timeout 5 detik per proxy
                    signal: AbortSignal.timeout(5000)
                });
                
                if (!response.ok) {
                    console.warn(`⚠️ ${proxy.name} returned ${response.status}`);
                    continue; // Coba proxy berikutnya
                }
                
                const data = await response.json();
                
                // Handle GAS response format
                if (proxy.isGAS) {
                    if (data.success && data.rating) {
                        rating = data.rating;
                        successProxy = proxy.name;
                        console.log(`✅ Success via ${proxy.name}!`);
                        break;
                    }
                } else {
                    // Handle standard MangaDex API format
                    rating = data.statistics?.[mangaId]?.rating?.average;
                    if (rating) {
                        successProxy = proxy.name;
                        console.log(`✅ Success via ${proxy.name}!`);
                        break;
                    }
                }
                
            } catch (error) {
                console.warn(`⚠️ ${proxy.name} failed:`, error.message);
                continue; // Coba proxy berikutnya
            }
        }
        
        // Update UI jika berhasil
        if (rating) {
            const roundedRating = rating.toFixed(1);
            
            // Simpan ke localStorage sebagai cache
            localStorage.setItem(`rating_${mangaId}`, roundedRating);
            localStorage.setItem(`rating_time_${mangaId}`, Date.now());
            
            // Update desktop
            const ratingScoreDesktop = document.getElementById('ratingScore');
            if (ratingScoreDesktop) {
                ratingScoreDesktop.textContent = roundedRating;
            }
            
            // Update mobile
            const ratingScoreMobile = document.getElementById('ratingScoreMobile');
            if (ratingScoreMobile) {
                ratingScoreMobile.textContent = roundedRating;
            }
            
            console.log(`⭐ Rating MangaDex: ${roundedRating}/10 (via ${successProxy})`);
        } else {
            console.warn('⚠️ Semua proxy gagal, rating tidak tersedia');
            
            // Coba ambil cache terakhir dari localStorage
            const cachedRating = localStorage.getItem(`rating_${mangaId}`);
            const cachedTime = localStorage.getItem(`rating_time_${mangaId}`);
            
            if (cachedRating) {
                const cacheAge = Math.floor((Date.now() - parseInt(cachedTime)) / 86400000); // days
                console.log(`📦 Using cached rating: ${cachedRating} (${cacheAge} days old)`);
                
                // Tampilkan rating cache
                const ratingScoreDesktop = document.getElementById('ratingScore');
                if (ratingScoreDesktop) {
                    ratingScoreDesktop.textContent = cachedRating;
                }
                
                const ratingScoreMobile = document.getElementById('ratingScoreMobile');
                if (ratingScoreMobile) {
                    ratingScoreMobile.textContent = cachedRating;
                }
            } else {
                // Benar-benar tidak ada data (pertama kali & gagal)
                console.warn('⚠️ No cache available, showing "-"');
                
                const ratingScoreDesktop = document.getElementById('ratingScore');
                if (ratingScoreDesktop) {
                    ratingScoreDesktop.textContent = '-';
                }
                
                const ratingScoreMobile = document.getElementById('ratingScoreMobile');
                if (ratingScoreMobile) {
                    ratingScoreMobile.textContent = '-';
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error fetching MangaDex rating:', error);
    }
}


/**
 * Setup tombol "Baca dari Awal"
 * Otomatis mengarahkan ke chapter paling awal yang tidak terkunci
 */
function setupReadFirstButton() {
    const btnReadFirstOutside = document.getElementById('btnReadFirstOutside');
    const btnReadFirstInside = document.getElementById('btnReadFirstInside');
    
    if (!btnReadFirstOutside && !btnReadFirstInside) {
        console.warn('⚠️ Read First buttons not found');
        return;
    }
    
    // Function untuk mendapatkan chapter pertama yang tidak locked
    function getFirstUnlockedChapter() {
        if (!mangaData || !mangaData.chapters) {
            console.error('❌ Manga data not loaded');
            return null;
        }
        
        // Convert chapters object to array
        const chaptersArray = Object.values(mangaData.chapters);
        
        // Sort ascending (dari chapter paling awal)
        chaptersArray.sort((a, b) => {
            const numA = parseFloat(a.folder);
            const numB = parseFloat(b.folder);
            return numA - numB;
        });
        
        // Find first unlocked chapter
        const firstUnlocked = chaptersArray.find(ch => !ch.locked);
        
        if (!firstUnlocked) {
            console.warn('⚠️ All chapters are locked');
            return null;
        }
        
        return firstUnlocked;
    }
    
    // Click handler
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
    
    // Attach click handlers to both buttons
    if (btnReadFirstOutside) {
        btnReadFirstOutside.onclick = handleReadFirstClick;
    }
    if (btnReadFirstInside) {
        btnReadFirstInside.onclick = handleReadFirstClick;
    }
    
    console.log('✅ Read First buttons initialized');
}

/**
 * READER.JS - MANIFEST-BASED WITH DECRYPTION
 * Reads encrypted manifest.json and decrypts page URLs
 */

// ============================================
// DECRYPTION MODULE
// ============================================

const SECRET_TOKEN = 'XfXqB1d0ud6rZCVPqzpzKxowGVpZ0GBU';
const ENCRYPTION_ALGORITHM = 'AES-CBC';

/**
 * Derive encryption key from token using SHA-256
 */
async function deriveKeyFromToken(token) {
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(token);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);
    
    const key = await crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: ENCRYPTION_ALGORITHM },
        false,
        ['decrypt']
    );
    
    return key;
}

/**
 * Decrypt single encrypted text
 */
async function decryptText(encryptedText, key) {
    try {
        const [ivHex, encryptedHex] = encryptedText.split(':');
        
        if (!ivHex || !encryptedHex) {
            throw new Error('Invalid encrypted format');
        }
        
        const iv = new Uint8Array(ivHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
        const encrypted = new Uint8Array(encryptedHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
        
        const decrypted = await crypto.subtle.decrypt(
            { name: ENCRYPTION_ALGORITHM, iv: iv },
            key,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
        
    } catch (error) {
        console.error('❌ Decryption error:', error);
        return null;
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
 * READER.JS - CODE VALIDATION FOR WEBTOON TYPE
 * Tambahkan fungsi ini di bagian atas reader.js (setelah decryption module)
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
 * MODIFY EXISTING showLockedChapterModal function
 * Tambahkan logic untuk detect type
 */
function showLockedChapterModal(chapterNumber = null, chapterFolder = null) {
    console.log('🔒 showLockedChapterModal called:', { chapterNumber, chapterFolder });
    
    // Check manga type
    const mangaType = mangaData?.manga?.type || 'manga';
    
    if (mangaType === 'webtoon') {
        // Show code input modal for webtoon
        showCodeInputModal(chapterNumber, chapterFolder);
        return;
    }
    
    // Original code for manga type (Trakteer modal)
    const modal = document.getElementById('lockedChapterModal');
    if (!modal) {
        console.error('❌ lockedChapterModal element not found!');
        return;
    }
    
    const modalHeader = modal.querySelector('.locked-modal-header h2');
    if (modalHeader && chapterNumber) {
        const hasChapter = /^chapter\s+/i.test(chapterNumber);
        const titleText = hasChapter ? chapterNumber : `Chapter ${chapterNumber}`;
        modalHeader.textContent = `🔒 ${titleText} Terkunci karena RAW Berbayar`;
    } else if (modalHeader) {
        modalHeader.textContent = `🔒 Chapter Terkunci karena RAW Berbayar`;
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    console.log('🔒 Trakteer modal shown');
    
    const btnYes = document.getElementById('btnLockedYes');
    const btnNo = document.getElementById('btnLockedNo');
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
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

/**
 * Check if text is encrypted (matches pattern: hex:hex)
 */
function isEncrypted(text) {
    if (!text || typeof text !== 'string') return false;
    return /^[0-9a-f]{32}:[0-9a-f]+$/i.test(text);
}

/**
 * Decrypt manifest pages array
 */
async function decryptManifest(manifest) {
    if (!manifest || !manifest.pages) {
        console.warn('⚠️ Invalid manifest structure');
        return null;
    }
    
    const firstPage = manifest.pages[0] || '';
    if (!isEncrypted(firstPage)) {
        console.log('ℹ️  Manifest is not encrypted');
        return manifest;
    }
    
    console.log('🔓 Decrypting manifest...');
    
    try {
        const key = await deriveKeyFromToken(SECRET_TOKEN);
        
        const decryptedPages = await Promise.all(
            manifest.pages.map(encryptedUrl => decryptText(encryptedUrl, key))
        );
        
        if (decryptedPages.some(page => page === null)) {
            console.error('❌ Some pages failed to decrypt');
            return null;
        }
        
        console.log('✅ Manifest decrypted successfully');
        
        return {
            ...manifest,
            pages: decryptedPages,
            encrypted: false
        };
        
    } catch (error) {
        console.error('❌ Error decrypting manifest:', error);
        return null;
    }
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

// Ganti fungsi renderEndChapterButtons() yang lama dengan yang ini:

function renderEndChapterButtons() {
    const container = document.getElementById('endChapterContainer');
    const commentsButtonContainer = document.getElementById('commentsButtonContainer');
    
    if (!container) return;
    
    const currentIndex = allChapters.findIndex(ch => ch.folder === currentChapterFolder);
    const isLastChapter = currentIndex === 0;
    const isOneshot = isOneshotChapter(currentChapterFolder);
    
    // Jika BUKAN chapter terakhir, tampilkan tombol Next Chapter + Komentar di bawahnya
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
        
        // Tampilkan tombol komentar di bawah Next Chapter
        if (commentsButtonContainer) {
            commentsButtonContainer.style.display = 'block';
        }
        return;
    }
    
    // Cek apakah chapter berikutnya locked
    const nextChapter = allChapters[currentIndex - 1];
    const nextIsLocked = nextChapter && nextChapter.locked;
    
    // Jika chapter berikutnya locked, tampilkan tombol Next Chapter yang mengarah ke modal
    if (nextIsLocked) {
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
            showLockedChapterModal(chapterTitle);
        };
        
        // Tampilkan tombol komentar di bawah Next Chapter
        if (commentsButtonContainer) {
            commentsButtonContainer.style.display = 'block';
        }
        return;
    }
    
    // Jika oneshot, tampilkan Back to Info + Komentar
    if (isOneshot) {
        container.innerHTML = `
            <div class="dual-buttons-container">
                <button class="back-to-info-btn-half" onclick="window.location.href='info-manga.html?repo=${repoParam}'">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>Back to Info</span>
                </button>
                <button class="comments-toggle-btn-half" id="btnToggleCommentsHalf">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Komentar</span>
                </button>
            </div>
        `;
        
        setupCommentsToggleHalf();
        return;
    }
    
    // Jika chapter terakhir dan bukan oneshot, tampilkan Back to Info + Trakteer + Komentar
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
    
    // Tampilkan tombol komentar di bawah
    if (commentsButtonContainer) {
        commentsButtonContainer.style.display = 'block';
    }
}

// Fungsi untuk setup toggle comments pada tombol setengah
function setupCommentsToggleHalf() {
    const btnToggleCommentsHalf = document.getElementById('btnToggleCommentsHalf');
    const giscusContainer = document.getElementById('giscusContainer');
    let isCommentsOpen = false;
    
    if (btnToggleCommentsHalf) {
        btnToggleCommentsHalf.addEventListener('click', function() {
            isCommentsOpen = !isCommentsOpen;
            
            if (isCommentsOpen) {
                giscusContainer.style.display = 'block';
                btnToggleCommentsHalf.querySelector('span').textContent = 'Minimize';
                
                setTimeout(() => {
                    giscusContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            } else {
                giscusContainer.style.display = 'none';
                btnToggleCommentsHalf.querySelector('span').textContent = 'Komentar';
                
                btnToggleCommentsHalf.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }
}
// ============================================
// SHOW COMMENTS BUTTON ONLY AT BOTTOM
// ============================================

function setupCommentsVisibility() {
    const commentsButtonContainer = document.getElementById('commentsButtonContainer');
    const endChapterContainer = document.getElementById('endChapterContainer');
    
    if (!commentsButtonContainer || !endChapterContainer) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Tombol chapter akhir terlihat = tampilkan tombol komentar
                commentsButtonContainer.classList.add('visible');
            } else {
                // Tombol chapter akhir tidak terlihat = sembunyikan tombol komentar
                commentsButtonContainer.classList.remove('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    observer.observe(endChapterContainer);
    
    console.log('✅ Comments visibility observer setup');
}

// Panggil fungsi ini setelah chapter pages dimuat
// Tambahkan di akhir fungsi loadChapterPages(), setelah hideLoading()
    
const DEBUG_MODE = false;

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
        
        const chapterData = findChapterByFolder(chapterParam);
        
        if (!chapterData) {
            alert(`Error: Chapter ${chapterParam} tidak ditemukan.`);
            hideLoading();
            return;
        }
        
        if (chapterData.locked) {
            console.log('🔒 Chapter terkunci');
    
         // ✅ CEK SESSION DULU
        if (isChapterValidated(repoParam, chapterParam)) {
          console.log('✅ Session valid, skip modal');
          chapterData.locked = false;
            } else {
        const chapterTitle = chapterData.title || chapterParam;
            showLockedChapterModal(chapterTitle, chapterParam);
             return;
    }
}
        
        currentChapter = chapterData;
        currentChapterFolder = chapterParam;
        totalPages = currentChapter.pages;
        
        setupUI();
        
        await loadChapterPages();
        
        trackChapterView();
        
        console.log('✅ Reader initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing reader:', error);
        alert('Terjadi kesalahan saat memuat reader.');
        hideLoading();
    }
}

async function loadMangaData(repo) {
    try {
        const mangaConfig = MANGA_REPOS[repo];
        
        if (!mangaConfig) {
            throw new Error(`Repo "${repo}" tidak ditemukan di mapping`);
        }
        
        console.log(`📚 Loading manga data from: ${repo}`);
        
        let mangaJsonUrl;
        if (typeof mangaConfig === 'string') {
            mangaJsonUrl = mangaConfig;
        } else {
            mangaJsonUrl = mangaConfig.url;
            window.currentGithubRepo = mangaConfig.githubRepo;
            console.log(`🔗 GitHub repo: ${mangaConfig.githubRepo}`);
        }
        
        const timestamp = new Date().getTime();
        const response = await fetch(`${mangaJsonUrl}?t=${timestamp}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        mangaData = await response.json();
        
        console.log('📦 Manga data loaded:', mangaData);
        
        allChapters = Object.values(mangaData.chapters).sort((a, b) => {
            return parseFloat(b.folder) - parseFloat(a.folder);
        });
        
        console.log(`✅ Loaded ${allChapters.length} chapters`);
        
    } catch (error) {
        console.error('❌ Error loading manga data:', error);
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
    console.log(`💾 Saved page ${currentPage} for ${currentChapterFolder}`);
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
    
    console.log(`📏 Chapter title font adjusted to: ${fontSize}px`);
}

function setupUI() {
    const mangaTitleElement = document.getElementById('mangaTitle');
    mangaTitleElement.textContent = mangaData.manga.title;
    
    document.title = `${mangaData.manga.title} - ${currentChapter.title}`;
    
    adjustTitleFontSize(mangaTitleElement);
    
    const titleElement = document.getElementById('chapterTitle');
    titleElement.textContent = currentChapter.title;
    
    adjustChapterTitleFontSize(titleElement);
    
    console.log(`📖 Read mode: ${readMode}`);
    
    const btnBack = document.getElementById('btnBackToInfo');
    btnBack.onclick = () => {
        window.location.href = `info-manga.html?repo=${repoParam}`;
    };
    
    const btnChapterList = document.getElementById('btnChapterList');
    btnChapterList.onclick = () => {
        openChapterListModal();
    };
    
    updateNavigationButtons();
    
    const btnCloseModal = document.getElementById('btnCloseModal');
    btnCloseModal.onclick = () => closeChapterListModal();
    
    const modalOverlay = document.getElementById('modalOverlay');
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            closeChapterListModal();
        }
    };
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
            console.log(`📏 Title fits: ${initialFontSize}px`);
            return;
        }
        
        const ratio = maxHeight / scrollHeight;
        let newFontSize = Math.max(Math.floor(initialFontSize * ratio), minFontSize);
        
        requestAnimationFrame(() => {
            element.style.fontSize = `${newFontSize}px`;
            console.log(`📏 Title font adjusted: ${initialFontSize}px → ${newFontSize}px`);
        });
    });
}

async function loadChapterPages() {
    try {
        readerContainer.innerHTML = '';
        readerContainer.className = `reader-container ${readMode}-mode`;
        
        console.log('📄 Loading chapter pages from manifest...');
        
        let { repoUrl } = mangaData.manga;
        repoUrl = repoUrl.replace(/\/$/, '');
        
        const manifestUrl = `${repoUrl}/${currentChapterFolder}/manifest.json`;
        console.log('📄 Manifest URL:', manifestUrl);
        
        const timestamp = new Date().getTime();
        const manifestResponse = await fetch(`${manifestUrl}?t=${timestamp}`);
        
        if (!manifestResponse.ok) {
            throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
        }
        
        let manifest = await manifestResponse.json();
        console.log('📦 Manifest loaded:', manifest);
        
        if (manifest.encrypted || isEncrypted(manifest.pages[0])) {
            console.log('🔒 Manifest is encrypted, decrypting...');
            manifest = await decryptManifest(manifest);
            
            if (!manifest) {
                throw new Error('Failed to decrypt manifest');
            }
            
            console.log('✅ Manifest decrypted successfully');
        } else {
            console.log('ℹ️  Manifest is not encrypted');
        }
        
        totalPages = manifest.pages.length;
        console.log(`📊 Total pages from manifest: ${totalPages}`);
        
        manifest.pages.forEach((imageUrl, index) => {
            const pageNum = index + 1;
            
            console.log(`🖼️ Page ${pageNum}: ${imageUrl}`);
            
            const img = document.createElement('img');
            img.className = 'reader-page';
            img.src = imageUrl;
            img.alt = `Page ${pageNum}`;
            
            if (pageNum <= 3) {
                img.loading = 'eager';
                console.log(`⚡ Page ${pageNum}: eager loading (priority)`);
            } else {
                img.loading = 'lazy';
            }
            
            img.setAttribute('data-page', pageNum);
            
            img.onload = () => {
                console.log(`✅ Page ${pageNum} loaded successfully`);
            };
            
            img.onerror = () => {
                console.error(`❌ Failed to load page ${pageNum}:`, imageUrl);
                const placeholder = document.createElement('div');
                placeholder.className = 'reader-page-error';
                placeholder.style.minHeight = '600px';
                placeholder.style.backgroundColor = 'var(--secondary-bg)';
                placeholder.style.display = 'flex';
                placeholder.style.alignItems = 'center';
                placeholder.style.justifyContent = 'center';
                placeholder.style.color = 'var(--text-secondary)';
                placeholder.style.fontSize = '0.9rem';
                placeholder.style.borderRadius = '4px';
                placeholder.style.border = '1px solid var(--border-color)';
                placeholder.setAttribute('data-page', pageNum);
                
                img.replaceWith(placeholder);
            };
            
            readerContainer.appendChild(img);
        });
        
        setupPageTracking();
        setupWebtoonScrollTracking();
        
        if (manifest.pages[0]) {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'image';
            preloadLink.href = manifest.pages[0];
            document.head.appendChild(preloadLink);
            console.log(`🚀 Preloading first page: ${manifest.pages[0]}`);
        }
        
        renderPageThumbnails(manifest.pages);
        
        updateProgressBar();
        
        console.log('✅ Pages container setup complete');
        
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

        // Setup comments visibility observer
        setupCommentsVisibility();
        
    } catch (error) {
        console.error('❌ Error loading pages:', error);
        hideLoading();
        alert('Gagal memuat halaman chapter. Manifest mungkin tidak tersedia atau terenkripsi salah.');
    }
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

function getThumbnailUrl(originalUrl) {
    const encodedUrl = originalUrl.replace('https://', '');
    return `https://images.weserv.nl/?url=${encodedUrl}&w=200&h=300&fit=cover&output=webp`;
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
        
        const thumbnailUrl = getThumbnailUrl(imageUrl);
        img.src = thumbnailUrl;
        
        img.onload = () => {
            thumb.classList.add('loaded');
        };
        
        img.onerror = () => {
            console.warn(`Proxy failed for page ${pageNum}, using original`);
            img.src = imageUrl;
            thumb.classList.add('error');
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
    
    console.log(`🖼️ Generated ${pageUrls.length} thumbnails using image proxy`);
}

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

function updateNavigationButtons() {
    renderEndChapterButtons();
}

function navigateChapter(direction) {
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
    
    if (targetChapter.locked) {
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
function openChapterListModal() {
    const modal = document.getElementById('modalOverlay');
    const modalBody = document.getElementById('chapterListModal');
    
    console.log('📋 Opening chapter list modal...');
    console.log('Modal element:', modal);
    console.log('Modal body:', modalBody);
    
    if (!modal || !modalBody) {
        console.error('❌ Modal elements not found!');
        return;
    }
    
    modalBody.innerHTML = '';
    
    allChapters.forEach(chapter => {
        const item = document.createElement('div');
        item.className = 'chapter-item-modal';
        
        if (chapter.folder === currentChapterFolder) {
            item.classList.add('active');
        }
        
        if (chapter.locked) {
            item.classList.add('locked');
        }
        
        const lockIcon = chapter.locked ? '🔒 ' : '';
        
        item.innerHTML = `
            <div class="chapter-item-title">${lockIcon}${chapter.title}</div>
            <div class="chapter-item-views">👁️ ${chapter.views}</div>
        `;
        
        item.onclick = () => {
            if (chapter.locked) {
                closeChapterListModal();
                setTimeout(() => {
                    const chapterTitle = chapter.title || chapter.folder;
                    const chapterFolder = chapter.folder;  // ← TAMBAH INI
                    showLockedChapterModal(chapterTitle, chapterFolder);  // ← TAMBAH PARAMETER KE-2
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
    
    console.log('✅ Chapter list modal opened');
}

/**
 * Close chapter list modal - FIXED
 */
function closeChapterListModal() {
    const modal = document.getElementById('modalOverlay');
    
    console.log('❌ Closing chapter list modal...');
    
    modal.classList.remove('active');
    
    // Wait for transition then hide
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
    
    console.log('✅ Chapter list modal closed');
}

async function trackChapterView() {
    try {
        const viewKey = `viewed_${repoParam}_${currentChapterFolder}`;
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (hasViewed) {
            console.log('👁️ Already counted in this session');
            return;
        }
        
        console.log('📤 Tracking chapter view...');
        
        const githubRepo = window.currentGithubRepo || repoParam;
        
        console.log(`   URL param: ${repoParam}`);
        console.log(`   GitHub repo: ${githubRepo}`);
        console.log(`   Chapter: ${currentChapterFolder}`);
        
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
        
        console.log('✅ Chapter view tracked successfully (WIB)');
        
    } catch (error) {
        console.error('❌ Error tracking chapter view:', error);
    }
}

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('active');
        console.log('📄 Loading overlay shown');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        console.log('✅ Loading overlay hidden');
    }
}

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
    
if (readMode === 'webtoon') {
    const endChapterContainer = document.getElementById('endChapterContainer');
    const commentsButtonContainer = document.getElementById('commentsButtonContainer');
    const giscusContainer = document.getElementById('giscusContainer');
    
    if (endChapterContainer) {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollBottom = scrollTop + windowHeight;
        
        // Cek apakah Giscus sedang terbuka
        const isGiscusOpen = giscusContainer && giscusContainer.style.display === 'block';
        
        if (scrollBottom >= documentHeight - 200) {
            endChapterContainer.style.display = 'block';
            if (commentsButtonContainer) {
                commentsButtonContainer.style.display = 'block';
            }
        } else {
            // Jika Giscus terbuka, TETAP TAMPILKAN semua tombol
            if (isGiscusOpen) {
                endChapterContainer.style.display = 'block';  // ← TAMBAHKAN INI
                if (commentsButtonContainer) {
                    commentsButtonContainer.style.display = 'block';
                }
            } else {
                // Jika Giscus tertutup, hide seperti biasa
                endChapterContainer.style.display = 'none';
                if (commentsButtonContainer) {
                    commentsButtonContainer.style.display = 'none';
                }
            }
        }
    }
}
    
    lastScrollTop = scrollTop;
});

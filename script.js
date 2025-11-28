// ============================================
// SCRIPT.JS - MAIN PAGE (index.html) - FINAL VERSION
// CDN Optimized + Accessibility Features
// ============================================

/**
 * ✅ CDN IMAGE OPTIMIZER - Auto resize menggunakan images.weserv.nl (FREE)
 */
function getResponsiveCDN(originalUrl) {
  const sizes = {
    small: 300,   // Mobile
    medium: 400,  // Tablet
    large: 600    // Desktop
  };
  
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

async function fetchMangaData(repo) {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/nurananto/${repo}/main/manga.json`);
    if (!response.ok) throw new Error('Failed to fetch manga data');
    const data = await response.json();
    
    let latestUnlockedChapter = null;
    let latestUnlockedDate = null;
    let latestLockedChapter = null;
    let latestLockedDate = null;
    
    if (data.chapters) {
      const chaptersArray = Object.values(data.chapters);
      
      const unlockedChapters = chaptersArray.filter(ch => !ch.locked);
      if (unlockedChapters.length > 0) {
        unlockedChapters.sort((a, b) => {
          const numA = parseFloat(a.folder);
          const numB = parseFloat(b.folder);
          return numB - numA;
        });
        latestUnlockedChapter = unlockedChapters[0].folder;
        latestUnlockedDate = unlockedChapters[0].uploadDate;
      }
      
      const lockedChapters = chaptersArray.filter(ch => ch.locked);
      if (lockedChapters.length > 0) {
        lockedChapters.sort((a, b) => {
          const numA = parseFloat(a.folder);
          const numB = parseFloat(b.folder);
          return numB - numA;
        });
        latestLockedChapter = lockedChapters[0].folder;
        latestLockedDate = lockedChapters[0].uploadDate;
      }
    }
    
    return {
      lastUpdated: data.lastUpdated || null,
      lastChapterUpdate: data.lastChapterUpdate || data.lastUpdated || null,
      totalChapters: Object.keys(data.chapters || {}).length,
      latestUnlockedChapter,
      latestUnlockedDate,
      latestLockedChapter,
      latestLockedDate
    };
  } catch (error) {
    console.error(`Error fetching manga data for ${repo}:`, error);
    return {
      lastUpdated: null,
      lastChapterUpdate: null,
      totalChapters: 0,
      latestUnlockedChapter: null,
      latestUnlockedDate: null,
      latestLockedChapter: null,
      latestLockedDate: null
    };
  }
}

function isRecentlyUpdated(lastChapterUpdateStr) {
  if (!lastChapterUpdateStr) return false;
  const lastChapterUpdate = new Date(lastChapterUpdateStr);
  if (!lastChapterUpdate || isNaN(lastChapterUpdate.getTime())) return false;
  const now = new Date();
  const diffDays = (now - lastChapterUpdate) / (1000 * 60 * 60 * 24);
  return diffDays <= 2;
}

function getRelativeTime(lastChapterUpdateStr) {
  if (!lastChapterUpdateStr) return '';
  const lastChapterUpdate = new Date(lastChapterUpdateStr);
  const now = new Date();
  const diffMs = now - lastChapterUpdate;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  
  return lastChapterUpdate.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
}

/**
 * ✅ CREATE CARD - WITH ACCESSIBILITY
 */
function createCard(manga, mangaData, index = 0) {
  const isRecent = isRecentlyUpdated(mangaData.lastChapterUpdate);
  
  const formatChapter = (chapterNum) => {
    if (!chapterNum) return '';
    const chapterStr = chapterNum.toString().toLowerCase();
    if (chapterStr.includes('oneshot') || chapterStr.includes('one-shot') || chapterStr === 'os') {
      return 'Oneshot';
    }
    const num = parseFloat(chapterNum);
    if (isNaN(num)) return chapterNum.toString();
    return num % 1 === 0 ? num.toString() : num.toFixed(1);
  };
  
  let chapterText = '';
  if (mangaData.latestUnlockedChapter && mangaData.latestLockedChapter) {
    const unlockedNum = parseFloat(mangaData.latestUnlockedChapter);
    const lockedNum = parseFloat(mangaData.latestLockedChapter);
    if (lockedNum > unlockedNum) {
      const lockedTime = getRelativeTime(mangaData.latestLockedDate);
      chapterText = `🔒 Ch. ${formatChapter(mangaData.latestLockedChapter)}${lockedTime ? ` - ${lockedTime}` : ''}`;
    } else {
      const unlockedTime = getRelativeTime(mangaData.latestUnlockedDate);
      chapterText = `Ch. ${formatChapter(mangaData.latestUnlockedChapter)}${unlockedTime ? ` - ${unlockedTime}` : ''}`;
    }
  } else if (mangaData.latestUnlockedChapter) {
    const unlockedTime = getRelativeTime(mangaData.latestUnlockedDate);
    chapterText = `Ch. ${formatChapter(mangaData.latestUnlockedChapter)}${unlockedTime ? ` - ${unlockedTime}` : ''}`;
  } else if (mangaData.latestLockedChapter) {
    const lockedTime = getRelativeTime(mangaData.latestLockedDate);
    chapterText = `🔒 Ch. ${formatChapter(mangaData.latestLockedChapter)}${lockedTime ? ` - ${lockedTime}` : ''}`;
  }
  
  const updatedBadge = isRecent && chapterText ? `
    <div class="updated-badge" aria-label="Recently updated: ${chapterText}">
      <span class="badge-text">UPDATED!</span>
      <span class="badge-chapter">${chapterText}</span>
    </div>
  ` : '';
  
  const placeholderSVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='420' viewBox='0 0 300 420'%3E%3Crect width='300' height='420' fill='%231a1a1a'/%3E%3Cg fill='%23666'%3E%3Cpath d='M150 160c-22.091 0-40 17.909-40 40s17.909 40 40 40 40-17.909 40-40-17.909-40-40-40zm0 60c-11.046 0-20-8.954-20-20s8.954-20 20-20 20 8.954 20 20-8.954 20-20 20z'/%3E%3Cpath d='M250 120H50c-11.046 0-20 8.954-20 20v160c0 11.046 8.954 20 20 20h200c11.046 0 20-8.954 20-20V140c0-11.046-8.954-20-20-20zm0 180H50V140h200v160z'/%3E%3C/g%3E%3Ctext x='150' y='350' font-family='Arial,sans-serif' font-size='16' fill='%23666' text-anchor='middle'%3ENo Image%3C/text%3E%3C/svg%3E`;
  
  const cdnUrls = getResponsiveCDN(manga.cover);
  
  const srcset = `
    ${cdnUrls.small} 300w,
    ${cdnUrls.medium} 400w,
    ${cdnUrls.large} 600w
  `.trim();
  
  const sizes = '(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw';
  
  const eagerLoadCount = window.innerWidth >= 1024 ? 10 : (window.innerWidth >= 768 ? 6 : 4);
  const loadingAttr = index < eagerLoadCount ? 'eager' : 'lazy';
  const fetchPriority = index < eagerLoadCount ? ' fetchpriority="high"' : '';
  const decodingAttr = index < eagerLoadCount ? ' decoding="sync"' : ' decoding="async"';
  
  // ✅ ARIA label for screen readers
  const ariaLabel = `${manga.title}${chapterText ? ', ' + chapterText : ''}${isRecent ? ', recently updated' : ''}`;
  
  return `
    <div class="manga-card ${isRecent ? 'recently-updated' : ''}" 
         role="listitem"
         tabindex="0"
         data-manga-id="${manga.id}"
         aria-label="${ariaLabel}"
         onclick="window.location.href='info-manga.html?repo=${manga.id}'"
         onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href='info-manga.html?repo=${manga.id}'}">
      <img 
        src="${cdnUrls.medium}" 
        srcset="${srcset}"
        sizes="${sizes}"
        alt="${manga.title} cover image"
        loading="${loadingAttr}"
        ${fetchPriority}
        ${decodingAttr}
        onerror="this.src='${manga.cover}'"
        aria-hidden="true">
      ${updatedBadge}
      <div class="manga-title" aria-hidden="true">${manga.title}</div>
    </div>`;
}

/**
 * ✅ SCREEN READER ANNOUNCER
 */
function announceToScreenReader(message) {
  const existingAnnouncer = document.getElementById('screenReaderAnnouncer');
  if (existingAnnouncer) existingAnnouncer.remove();
  
  const announcer = document.createElement('div');
  announcer.id = 'screenReaderAnnouncer';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'visually-hidden';
  announcer.textContent = message;
  
  document.body.appendChild(announcer);
  setTimeout(() => announcer.remove(), 5000);
}

/**
 * ✅ RENDER MANGA - WITH ANNOUNCEMENTS
 */
async function renderManga(filteredList) {
  const mangaGrid = document.getElementById("mangaGrid");
  const loadingIndicator = document.getElementById("loadingIndicator");
  
  loadingIndicator.classList.add('show');
  mangaGrid.innerHTML = '';
  
  const mangaWithData = await Promise.all(
    filteredList.map(async (manga) => {
      const mangaData = await fetchMangaData(manga.repo);
      return { manga, mangaData, lastChapterUpdate: mangaData.lastChapterUpdate };
    })
  );
  
  mangaWithData.sort((a, b) => {
    const dateA = a.lastChapterUpdate ? new Date(a.lastChapterUpdate) : new Date(0);
    const dateB = b.lastChapterUpdate ? new Date(b.lastChapterUpdate) : new Date(0);
    const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
    const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
    return timeB - timeA;
  });
  
  loadingIndicator.classList.remove('show');
  
  if (mangaWithData.length === 0) {
    mangaGrid.innerHTML = `
      <div class="empty-state" role="status">
        <p>Tidak ada manga yang ditemukan</p>
        <p style="font-size: 14px;">Coba kata kunci yang berbeda</p>
      </div>
    `;
    announceToScreenReader('Tidak ada manga yang ditemukan');
    return;
  }
  
  mangaGrid.innerHTML = mangaWithData.map(({ manga, mangaData }, index) => 
    createCard(manga, mangaData, index)
  ).join("");
  
  announceToScreenReader(`Menampilkan ${mangaWithData.length} manga`);
  console.log('✅ Manga loaded with accessibility support');
}

/**
 * ✅ KEYBOARD NAVIGATION
 */
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    const focusedElement = document.activeElement;
    
    if (focusedElement && focusedElement.classList.contains('manga-card')) {
      const cards = Array.from(document.querySelectorAll('.manga-card'));
      const currentIndex = cards.indexOf(focusedElement);
      let nextIndex = -1;
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex < cards.length) cards[nextIndex].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex >= 0) cards[nextIndex].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        cards[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        cards[cards.length - 1].focus();
      }
    }
  });
}

/**
 * ✅ SEARCH ACCESSIBILITY
 */
function setupSearchAccessibility() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;
  
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      this.value = '';
      this.dispatchEvent(new Event('input'));
      announceToScreenReader('Pencarian dibersihkan');
    }
  });
}

/**
 * ✅ PRELOAD FIRST IMAGE (LCP)
 */
(function() {
  if (typeof MANGA_LIST !== 'undefined' && MANGA_LIST.length > 0) {
    const firstManga = MANGA_LIST[0];
    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.as = 'image';
    const encodedUrl = encodeURIComponent(firstManga.cover);
    preloadLink.href = `https://images.weserv.nl/?url=${encodedUrl}&w=400&q=85&output=webp`;
    preloadLink.fetchpriority = 'high';
    document.head.appendChild(preloadLink);
    console.log('🚀 LCP image preloaded:', firstManga.title);
  }
})();

/**
 * ✅ DOM CONTENT LOADED
 */
let searchTimeout;
document.addEventListener('DOMContentLoaded', function() {
  if (typeof mangaList === 'undefined') {
    console.error('❌ ERROR: mangaList not found!');
    return;
  }
  
  console.log('🚀 Initializing with accessibility...');
  
  setupKeyboardNavigation();
  setupSearchAccessibility();
  renderManga(mangaList);
  
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", function() {
    clearTimeout(searchTimeout);
    const query = this.value.toLowerCase().trim();
    
    searchTimeout = setTimeout(() => {
      if (query === '') {
        renderManga(mangaList);
      } else {
        const filtered = mangaList.filter(manga => 
          manga.title.toLowerCase().includes(query)
        );
        renderManga(filtered);
      }
    }, 300);
  });
});

/**
 * ✅ PROTECTION CODE
 */
const DEBUG_MODE = false;

function initProtection() {
  if (DEBUG_MODE) {
    console.log('🔓 Debug mode enabled');
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

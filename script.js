// ============================================
// SCRIPT.JS - WITH TOP 5 MOST VIEWED
// ============================================

/**
 * ✅ CDN IMAGE OPTIMIZER
 */
function getResponsiveCDN(originalUrl) {
  const sizes = {
    small: 300,
    medium: 400,
    large: 600
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

/**
 * Fetch manga data with views
 */
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
          const getSort = (folder) => {
            const parts = folder.split('.');
            const int = parseInt(parts[0]) || 0;
            const dec = parts[1] ? parseInt(parts[1]) : 0;
            return int + (dec / 1000);
          };
          return getSort(b.folder) - getSort(a.folder);
        });
        latestUnlockedChapter = unlockedChapters[0].folder;
        latestUnlockedDate = unlockedChapters[0].uploadDate;
      }
      
      const lockedChapters = chaptersArray.filter(ch => ch.locked);
      if (lockedChapters.length > 0) {
        lockedChapters.sort((a, b) => {
          const getSort = (folder) => {
            const parts = folder.split('.');
            const int = parseInt(parts[0]) || 0;
            const dec = parts[1] ? parseInt(parts[1]) : 0;
            return int + (dec / 1000);
          };
          return getSort(b.folder) - getSort(a.folder);
        });
        latestLockedChapter = lockedChapters[0].folder;
        latestLockedDate = lockedChapters[0].uploadDate;
      }
    }
    
    return {
      lastUpdated: data.lastUpdated || null,
      lastChapterUpdate: data.lastChapterUpdate || data.lastUpdated || null,
      totalChapters: Object.keys(data.chapters || {}).length,
      views: data.manga?.views || 0,
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
      views: 0,
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
  const wibNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  const diffMs = wibNow - lastChapterUpdate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
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

const formatChapter = (chapterNum) => {
  if (!chapterNum) return '';
  const chapterStr = chapterNum.toString().toLowerCase();
  if (chapterStr.includes('oneshot') || chapterStr.includes('one-shot') || chapterStr === 'os') {
    return 'Oneshot';
  }
  return chapterNum.toString();
};

/**
 * Format number with thousand separator
 */
function formatViews(views) {
  return views.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * ✅ CREATE TOP 5 CARD - WITH RANKING BADGE
 */
function createTop5Card(manga, mangaData, rank, index = 0) {
  const cdnUrls = getResponsiveCDN(manga.cover);
  
  const srcset = `
    ${cdnUrls.small} 300w,
    ${cdnUrls.medium} 400w,
    ${cdnUrls.large} 600w
  `.trim();
  
  const sizes = '(max-width: 480px) 45vw, (max-width: 768px) 30vw, 20vw';
  
  const loadingAttr = index < 5 ? 'eager' : 'lazy';
  const fetchPriority = index < 5 ? ' fetchpriority="high"' : '';
  const decodingAttr = index < 5 ? ' decoding="sync"' : ' decoding="async"';
  
  // Ranking badge styles
  const rankBadges = {
    1: { emoji: '🥇', gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', text: '#000' },
    2: { emoji: '🥈', gradient: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)', text: '#000' },
    3: { emoji: '🥉', gradient: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)', text: '#fff' },
    4: { emoji: '🏆', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#fff' },
    5: { emoji: '🏆', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#fff' }
  };
  
  const badge = rankBadges[rank];
  
  const ariaLabel = `${manga.title}, Rank ${rank}, ${formatViews(mangaData.views)} views`;
  
  return `
    <div class="top5-card" 
         role="listitem"
         tabindex="0"
         data-manga-id="${manga.id}"
         aria-label="${ariaLabel}"
         onclick="window.location.href='info-manga.html?repo=${manga.id}'"
         onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href='info-manga.html?repo=${manga.id}'}">
      
      <!-- ✅ BADGES CONTAINER DI LUAR -->
      <div class="top5-badges-container">
        <div class="rank-badge" style="background: ${badge.gradient}; color: ${badge.text};">
          <span class="rank-number">#${rank}</span>
          <span class="rank-emoji">${badge.emoji}</span>
        </div>
        
        <div class="views-badge-top5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>${formatViews(mangaData.views)}</span>
        </div>
      </div>
      
      <!-- Cover Image -->
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
      
      <!-- Title -->
      <div class="manga-title" aria-hidden="true">${manga.title}</div>
    </div>`;
}

/**
 * ✅ CREATE REGULAR CARD (for Manga List)
 */
function createCard(manga, mangaData, index = 0) {
  const isRecent = isRecentlyUpdated(mangaData.lastChapterUpdate);
  
  let chapterText = '';
  if (mangaData.latestUnlockedChapter && mangaData.latestLockedChapter) {
    const unlockedDate = mangaData.latestUnlockedDate ? new Date(mangaData.latestUnlockedDate) : new Date(0);
    const lockedDate = mangaData.latestLockedDate ? new Date(mangaData.latestLockedDate) : new Date(0);
    
    if (lockedDate > unlockedDate) {
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
    <div class="manga-badges-container">
      <div class="updated-badge" aria-label="Recently updated: ${chapterText}">
        <span class="badge-text">UPDATED!</span>
        <span class="badge-chapter">${chapterText}</span>
      </div>
    </div>
  ` : `
    <div class="manga-badges-container" style="visibility: hidden;">
      <div class="updated-badge">
        <span class="badge-text">-</span>
      </div>
    </div>
  `;
  
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
  
  const ariaLabel = `${manga.title}${chapterText ? ', ' + chapterText : ''}${isRecent ? ', recently updated' : ''}`;
  
return `
    <div class="manga-card ${isRecent ? 'recently-updated' : ''}" 
         role="listitem"
         tabindex="0"
         data-manga-id="${manga.id}"
         aria-label="${ariaLabel}"
         onclick="window.location.href='info-manga.html?repo=${manga.id}'"
         onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href='info-manga.html?repo=${manga.id}'}">
      ${updatedBadge}
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
      <div class="manga-title" aria-hidden="true">${manga.title}</div>
    </div>`;
}

/**
 * ✅ RENDER TOP 5 SECTION
 */
async function renderTop5(mangaList) {
  const top5Container = document.getElementById("top5Container");
  
  if (!top5Container) return;
  
  top5Container.innerHTML = '<div class="loading-top5">Loading Top 5...</div>';
  
  // Fetch all manga with views
  const mangaWithViews = await Promise.all(
    mangaList.map(async (manga) => {
      const mangaData = await fetchMangaData(manga.repo);
      return { manga, mangaData, views: mangaData.views };
    })
  );
  
  // Sort by views (descending) and take top 5
  const top5 = mangaWithViews
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);
  
  // Render top 5 cards
  top5Container.innerHTML = top5.map(({ manga, mangaData }, index) => 
    createTop5Card(manga, mangaData, index + 1, index)
  ).join("");
  
  // Initialize scroll navigation
  initTop5Navigation();
  
  console.log('✅ Top 5 Most Viewed loaded');
}

/**
 * ✅ TOP 5 SCROLL NAVIGATION
 */
function initTop5Navigation() {
  const container = document.getElementById('top5Container');
  const btnLeft = document.getElementById('top5NavLeft');
  const btnRight = document.getElementById('top5NavRight');
  
  if (!container || !btnLeft || !btnRight) return;
  
  let currentIndex = 0;
  const cards = container.querySelectorAll('.top5-card');
  const totalCards = cards.length;
  
  // Function to update button visibility
  function updateButtons() {
    // Hide left button if at start
    if (currentIndex <= 0) {
      btnLeft.style.display = 'none';
    } else {
      btnLeft.style.display = 'flex';
    }
    
    // Hide right button if at end
    if (currentIndex >= totalCards - 1) {
      btnRight.style.display = 'none';
    } else {
      btnRight.style.display = 'flex';
    }
  }
  
  // Function to scroll to specific card
  function scrollToCard(index) {
    if (index < 0 || index >= totalCards) return;
    
    const card = cards[index];
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    
    // Calculate scroll position to center the card
    const scrollLeft = card.offsetLeft - (containerRect.width / 2) + (cardRect.width / 2);
    
    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
    
    currentIndex = index;
    updateButtons();
  }
  
  // Scroll right - go to next card
  btnRight.addEventListener('click', () => {
    if (currentIndex < totalCards - 1) {
      scrollToCard(currentIndex + 1);
    }
  });
  
  // Scroll left - go to previous card
  btnLeft.addEventListener('click', () => {
    if (currentIndex > 0) {
      scrollToCard(currentIndex - 1);
    }
  });
  
  // Update current index on manual scroll
  container.addEventListener('scroll', () => {
    const containerCenter = container.scrollLeft + (container.offsetWidth / 2);
    
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
      const distance = Math.abs(containerCenter - cardCenter);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    if (closestIndex !== currentIndex) {
      currentIndex = closestIndex;
      updateButtons();
    }
  });
  
// Initial update
  updateButtons();
  
  // Force check after short delay (for initial render)
  setTimeout(updateButtons, 100);
  
  // Update on window resize
  window.addEventListener('resize', () => {
    scrollToCard(currentIndex);
  });
}

/**
 * ✅ RENDER ALL MANGA LIST (sorted by last update)
 */
async function renderMangaList(filteredList) {
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
  
  // Sort by last update (descending)
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
    return;
  }
  
  mangaGrid.innerHTML = mangaWithData.map(({ manga, mangaData }, index) => 
    createCard(manga, mangaData, index)
  ).join("");
  
  console.log('✅ Manga list loaded');
}

/**
 * ✅ KEYBOARD NAVIGATION
 */
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    const focusedElement = document.activeElement;
    
    if (focusedElement && (focusedElement.classList.contains('manga-card') || focusedElement.classList.contains('top5-card'))) {
      const cards = Array.from(document.querySelectorAll('.manga-card, .top5-card'));
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
 * ✅ SEARCH FUNCTIONALITY
 */
function setupSearchAccessibility() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;
  
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      this.value = '';
      this.dispatchEvent(new Event('input'));
    }
  });
}

/**
 * ✅ DOM CONTENT LOADED
 */
let searchTimeout;
document.addEventListener('DOMContentLoaded', function() {
  if (typeof mangaList === 'undefined') {
    console.error('❌ ERROR: mangaList not found!');
    return;
  }
  
  console.log('🚀 Initializing...');
  
  setupKeyboardNavigation();
  setupSearchAccessibility();
  
  // Tambahkan setelah setupSearchAccessibility();
  renderTop5(mangaList);      // ← TAMBAH INI
  renderMangaList(mangaList);  // ← TAMBAH INI

    // Force hide left button on initial load
  setTimeout(() => {
    const btnLeft = document.getElementById('top5NavLeft');
    if (btnLeft) btnLeft.style.display = 'none';
  }, 200);

  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", function() {
    clearTimeout(searchTimeout);
    const query = this.value.toLowerCase().trim();
    
    searchTimeout = setTimeout(() => {
      if (query === '') {
        renderMangaList(mangaList);
      } else {
        const filtered = mangaList.filter(manga => 
          manga.title.toLowerCase().includes(query)
        );
        renderMangaList(filtered);
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
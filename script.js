// ============================================
// SCRIPT.JS - NURANANTO SCANLATION
// ============================================

const DEBUG_MODE = false;

/**
 * Fetch JSON tanpa cache
 */
async function fetchFreshJSON(url) {
    try {
        const urlObj = new URL(url);
        const isCrossOrigin = urlObj.origin !== window.location.origin;
        
        if (isCrossOrigin && urlObj.hostname.includes('githubusercontent.com')) {
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        }
        
        const cacheBuster = Date.now() + '_' + Math.random().toString(36).substring(7);
        const response = await fetch(url + '?t=' + cacheBuster, {
            method: 'GET',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('❌ fetchFreshJSON failed:', error);
        throw error;
    }
}

/**
 * CDN Image Optimizer
 */
function getResponsiveCDN(originalUrl) {
  const sizes = { small: 300, medium: 400, large: 600 };
  
  // ✅ Hapus https:// untuk weserv
  const cleanUrl = originalUrl.replace('https://', '');
  
  const buildUrl = (width) => {
    return `https://images.weserv.nl/?url=${cleanUrl}&w=${width}&q=85&output=webp`;
  };
  
  return {
    small: buildUrl(sizes.small),
    medium: buildUrl(sizes.medium),
    large: buildUrl(sizes.large),
    original: originalUrl
  };
}
/**
 * ✅ NEW: Cache helper dengan expiry
 */
function getCachedData(key, maxAge = 300000) { // 5 minutes default
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age < maxAge) {
      return data;
    }
    
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    return null;
  }
}

function setCachedData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Cache write failed:', error);
  }
}

/**
 * ✅ UPDATED: fetchMangaData dengan LocalStorage cache
 */
async function fetchMangaData(repo) {
  try {
    // ✅ CHECK CACHE FIRST (5 minutes TTL)
    const cacheKey = `manga_${repo}`;
    const cached = getCachedData(cacheKey, 300000); // 5 min
    
    if (cached) {
      return cached;
    }
    
    // ✅ CACHE MISS - Fetch fresh
    const url = `https://raw.githubusercontent.com/nurananto/${repo}/main/manga.json`;
    const data = await fetchFreshJSON(url);
    
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
    
    const result = {
      lastUpdated: data.lastUpdated || null,
      lastChapterUpdate: data.lastChapterUpdate || data.lastUpdated || null,
      totalChapters: Object.keys(data.chapters || {}).length,
      views: data.manga?.views || 0,
      status: data.manga?.status || 'ONGOING',
      latestUnlockedChapter,
      latestUnlockedDate,
      latestLockedChapter,
      latestLockedDate
    };
    
    // ✅ SAVE TO CACHE
    setCachedData(cacheKey, result);
    
    return result;

  } catch (error) {
    console.error(`Error fetching manga data for ${repo}:`, error);
    
    // ✅ FALLBACK: Try stale cache
    const staleCache = getCachedData(`manga_${repo}`, Infinity);
    if (staleCache) {
      console.warn('⚠️ Using stale cache');
      return staleCache;
    }
    
    return {
      lastUpdated: null,
      lastChapterUpdate: null,
      totalChapters: 0,
      views: 0,
      status: 'ONGOING',
      latestUnlockedChapter: null,
      latestUnlockedDate: null,
      latestLockedChapter: null,
      latestLockedDate: null
    };
  }
}

/**
 * Check if recently updated (within 2 days)
 */
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

/**
 * Get relative time string
 */
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
 * Format chapter number
 */
const formatChapter = (chapterNum) => {
  if (!chapterNum) return '';
  const chapterStr = chapterNum.toString().toLowerCase();
  if (chapterStr.includes('oneshot') || chapterStr.includes('one-shot') || chapterStr === 'os') {
    return 'Oneshot';
  }
  return chapterNum.toString();
};

/**
 * Format views dengan thousand separator
 */
function formatViews(views) {
  return views.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Create Top 5 Card dengan Rank + Views + Status Badge
 */
function createTop5Card(manga, mangaData, rank, index = 0, views24h = null) {
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
  
  const rankBadges = {
    1: { emoji: '🥇', gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', text: '#000' },
    2: { emoji: '🥈', gradient: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)', text: '#000' },
    3: { emoji: '🥉', gradient: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)', text: '#fff' },
    4: { emoji: '🏆', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#fff' },
    5: { emoji: '🏆', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#fff' }
  };
  
  const badge = rankBadges[rank];
  
  // Status & Chapter
  const status = mangaData.status || 'ONGOING';
  const statusClass = status === 'END' || status === 'COMPLETED' ? 'end' : 
                      status === 'HIATUS' ? 'hiatus' : 'ongoing';
  const statusText = status === 'END' || status === 'COMPLETED' ? 'TAMAT' :
                     status === 'HIATUS' ? 'HIATUS' : 'ONGOING';
  
  // Get chapter info dengan tanggal - SAMA DENGAN MANGA LIST
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
  
  const ariaLabel = `${manga.title}, Rank ${rank}, ${statusText}, ${formatViews(mangaData.views)} views`;
  
  return `
    <div class="top5-card" 
         role="listitem"
         tabindex="0"
         data-manga-id="${manga.id}"
         aria-label="${ariaLabel}">
               
      <!-- KOTAK 1: Rank Badge + Views Badge -->
      <div class="top5-badges-container top5-rank-views">
        <div class="rank-badge" style="background: ${badge.gradient}; color: ${badge.text};">
          <span class="rank-number">#${rank}</span>
          <span class="rank-emoji">${badge.emoji}</span>
        </div>
        
        <div class="views-badge-top5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>${formatViews(views24h !== null ? views24h : mangaData.views)}</span>
        </div>
      </div>
      
      <!-- KOTAK 2: Cover Image -->
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
      
      <!-- KOTAK 3: Status Badge + Chapter -->
      <div class="top5-badges-container top5-status-chapter">
        <div class="status-badge-top5 status-badge-top5-${statusClass}">
          <span class="status-text">${statusText}</span>
          ${chapterText ? `<span class="status-chapter">${chapterText}</span>` : ''}
        </div>
      </div>
      
      <!-- KOTAK 4: Title -->
      <div class="manga-title" aria-hidden="true">${manga.title}</div>
    </div>`;
}

/**
 * Create Regular Card (untuk Manga List)
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
  
  let badgeHTML = '';
  
  if (isRecent && chapterText) {
    badgeHTML = `
      <div class="manga-badges-container">
        <div class="updated-badge" aria-label="Recently updated: ${chapterText}">
          <span class="badge-text">UPDATED!</span>
          <span class="badge-chapter">${chapterText}</span>
        </div>
      </div>
    `;
  } else {
    const status = mangaData.status || 'ONGOING';
    let statusClass = '';
    let statusText = '';
    
    if (status === 'END' || status === 'COMPLETED') {
      statusClass = 'status-badge-end';
      statusText = 'TAMAT';
    } else if (status === 'HIATUS') {
      statusClass = 'status-badge-hiatus';
      statusText = 'HIATUS';
    } else {
      statusClass = 'status-badge-ongoing';
      statusText = 'ONGOING';
    }
    
    badgeHTML = `
      <div class="manga-badges-container">
        <div class="status-badge ${statusClass}" aria-label="${statusText}: ${chapterText}">
          <span class="badge-text">${statusText}</span>
          ${chapterText ? `<span class="badge-chapter">${chapterText}</span>` : ''}
        </div>
      </div>
    `;
  }
  
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
      ${badgeHTML}
      <div class="manga-title" aria-hidden="true">${manga.title}</div>
    </div>`;
}

/**
 * ✅ UPDATED: calculate24HourViews dengan cache
 */
async function calculate24HourViews(repo) {
  try {
    // ✅ CHECK CACHE FIRST (10 minutes TTL - daily views berubah lambat)
    const cacheKey = `daily_${repo}`;
    const cached = getCachedData(cacheKey, 600000); // 10 min
    
    if (cached !== null) {
      return cached;
    }
    
    // ✅ CACHE MISS - Fetch fresh
    const url = `https://raw.githubusercontent.com/nurananto/${repo}/main/daily-views.json`;
    const data = await fetchFreshJSON(url);
    
    if (!data || !data.dailyRecords) {
      setCachedData(cacheKey, null);
      return null;
    }
    
    const now = new Date();
    const todayStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).split(' ')[0];
    
    const todayRecord = data.dailyRecords[todayStr];
    const result = todayRecord ? (todayRecord.manga || 0) : null;
    
    // ✅ SAVE TO CACHE
    setCachedData(cacheKey, result);
    return result;
    
  } catch (error) {
    // ✅ FALLBACK: Stale cache
    const staleCache = getCachedData(`daily_${repo}`, Infinity);
    if (staleCache !== null) {
      console.warn('⚠️ Using stale daily views cache');
      return staleCache;
    }
    return null;
  }
}

/**
 * Render Top 5 - 24H TRENDING
 */
async function renderTop5(mangaList) {
    const top5Container = document.getElementById("top5Container");
  
  if (!top5Container) return;
  
  top5Container.innerHTML = '<div class="loading-top5">Loading Top 5 Trending (24h)...</div>';
  
  const mangaWith24hViews = await Promise.all(
    mangaList.map(async (manga) => {
      const mangaData = await fetchMangaData(manga.repo);
      const views24h = await calculate24HourViews(manga.repo);
      
      return { 
        manga, 
        mangaData, 
        views: views24h !== null ? views24h : mangaData.views,
        is24h: views24h !== null
      };
    })
  );
  
  const top5 = mangaWith24hViews
    .filter(({ is24h }) => is24h)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  // Jika tidak ada manga dengan daily views, tampilkan top 5 berdasarkan total views
  if (top5.length === 0) {
    const fallbackTop5 = mangaWith24hViews
      .sort((a, b) => b.mangaData.views - a.mangaData.views)
      .slice(0, 5);
    
    top5Container.innerHTML = fallbackTop5.map(({ manga, mangaData }, index) => 
      createTop5Card(manga, mangaData, index + 1, index, mangaData.views)
    ).join("");
  } else {
    top5Container.innerHTML = top5.map(({ manga, mangaData, views }, index) => 
      createTop5Card(manga, mangaData, index + 1, index, views)
    ).join("");
  }
  // ✅ Enable drag & click setelah render
enableTop5MouseDrag();
}

/**
 * Render Manga List
 */
async function renderMangaList(filteredList, showLoading = true) {
  const mangaGrid = document.getElementById("mangaGrid");
  const loadingIndicator = document.getElementById("loadingIndicator");
  
  if (showLoading) {
    loadingIndicator.classList.add('show');
    mangaGrid.innerHTML = '';
  }
  
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
  
  if (showLoading) {
    loadingIndicator.classList.remove('show');
  }
  
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
  
}

/**
 * Setup Keyboard Navigation
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
 * Setup Search Accessibility
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
 * Enable mouse drag scroll for Top5
 */
function enableTop5MouseDrag() {
  const container = document.getElementById('top5Container');
  if (!container) return;
  
  let isDown = false;
  let startX;
  let scrollLeft;
  let hasMoved = false;
  
  container.addEventListener('mousedown', (e) => {
    isDown = true;
    hasMoved = false;
    container.style.cursor = 'grabbing';
    container.classList.add('is-dragging');
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;

  });
  
  container.addEventListener('mouseleave', () => {
    isDown = false;
    container.style.cursor = 'grab';
    container.classList.remove('is-dragging');
  });
  
  container.addEventListener('mouseup', () => {
    isDown = false;
    container.style.cursor = 'grab';    
    setTimeout(() => {
      container.classList.remove('is-dragging');
      setTimeout(() => {
        hasMoved = false;
      }, 50);
    }, 50);
  });
  
  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - container.offsetLeft;
    const moved = Math.abs(x - startX);
    
    if (moved > 5) {
      e.preventDefault();
      hasMoved = true;
      const walk = (x - startX) * 2;
      container.scrollLeft = scrollLeft - walk;
    }
  });
  
// ✅ EVENT DELEGATION
// ✅ EVENT DELEGATION - Simple & Robust
container.addEventListener('click', (e) => {
  
  // Cari semua card yang visible
  const cards = Array.from(container.querySelectorAll('.top5-card'));
   
  // Cari card yang diklik berdasarkan bounding box
  const clickedCard = cards.find(card => {
    const rect = card.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  });
  
  if (!clickedCard) return;
  
  const mangaId = clickedCard.getAttribute('data-manga-id');
  
  if (hasMoved) {
     return;
  }
  
  window.location.href = `info-manga.html?repo=${mangaId}`;
});
  
  // Keyboard support
  container.addEventListener('keypress', (e) => {
    const card = e.target.closest('.top5-card');
    if (!card) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const mangaId = card.getAttribute('data-manga-id');
      window.location.href = `info-manga.html?repo=${mangaId}`;
    }
  });
}

/**
 * DOM Content Loaded
 */
let searchTimeout;
document.addEventListener('DOMContentLoaded', function() {
  if (typeof mangaList === 'undefined') {
    console.error('❌ ERROR: mangaList not found!');
    return;
  }
 
  setupKeyboardNavigation();
  setupSearchAccessibility();
  
  // ✅ Render Top5 dengan mouse drag
  renderTop5(mangaList);  
  renderMangaList(mangaList);

  const searchInput = document.getElementById("searchInput");
  let currentSearch = '';
  
  searchInput.addEventListener("input", function() {
    clearTimeout(searchTimeout);
    const query = this.value.toLowerCase().trim();
    currentSearch = query;
    
    searchTimeout = setTimeout(async () => {
      const mangaGrid = document.getElementById("mangaGrid");
      
      if (query === '') {
        await renderMangaList(mangaList, false);
      } else {
        const filtered = mangaList.filter(manga => 
          manga.title.toLowerCase().includes(query)
        );
        
        const mangaWithData = await Promise.all(
          filtered.map(async (manga) => {
            const mangaData = await fetchMangaData(manga.repo);
            return { manga, mangaData, lastChapterUpdate: mangaData.lastChapterUpdate };
          })
        );
        
        if (currentSearch === query) {
          mangaWithData.sort((a, b) => {
            const dateA = a.lastChapterUpdate ? new Date(a.lastChapterUpdate) : new Date(0);
            const dateB = b.lastChapterUpdate ? new Date(b.lastChapterUpdate) : new Date(0);
            const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
            return timeB - timeA;
          });
          
          if (mangaWithData.length === 0) {
            mangaGrid.innerHTML = `
              <div class="empty-state" role="status">
                <p>Tidak ada manga yang ditemukan</p>
                <p style="font-size: 14px;">Coba kata kunci yang berbeda</p>
              </div>
            `;
          } else {
            mangaGrid.innerHTML = mangaWithData.map(({ manga, mangaData }, index) => 
              createCard(manga, mangaData, index)
            ).join("");
          }
        }
      }
    }, 300);
  });
});

/**
 * Protection Code
 */
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

/**
 * LOGIN MODAL - FULL DEBUG VERSION
 * Replace SELURUH bagian login modal di script.js DAN info-manga.js
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 [INIT] ========================================');
    console.log('🎬 [INIT] Login modal initialization started');
    console.log('🎬 [INIT] ========================================');
    
    const btnOpen = document.getElementById('btnOpenLogin');
    const modal = document.getElementById('loginModal');
    const profileModal = document.getElementById('profileModal');
    
    console.log('🔍 [CHECK] ========================================');
    console.log('🔍 [CHECK] Checking DOM elements...');
    console.log('🔍 [CHECK] btnOpenLogin:', btnOpen);
    console.log('🔍 [CHECK] loginModal:', modal);
    console.log('🔍 [CHECK] profileModal:', profileModal);
    console.log('🔍 [CHECK] ========================================');
    
    if (!btnOpen || !modal || !profileModal) {
        console.error('❌ [ERROR] ========================================');
        console.error('❌ [ERROR] Required elements missing!');
        console.error('❌ [ERROR] btnOpen:', !!btnOpen);
        console.error('❌ [ERROR] modal:', !!modal);
        console.error('❌ [ERROR] profileModal:', !!profileModal);
        console.error('❌ [ERROR] ========================================');
        return;
    }

    // ✅ STEP 1: Check localStorage on page load
    console.log('📦 [STORAGE] ========================================');
    console.log('📦 [STORAGE] Checking localStorage...');
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');
    
    console.log('📦 [STORAGE] Raw user data:', storedUser);
    console.log('📦 [STORAGE] Has token:', !!storedToken);
    
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            console.log('📦 [STORAGE] Parsed user:', parsedUser);
        } catch (e) {
            console.error('❌ [STORAGE] JSON parse error:', e);
        }
    }
    console.log('📦 [STORAGE] ========================================');

    // ✅ STEP 2: Profile button click handler
    console.log('🔧 [SETUP] Adding click handler to profile button...');
    btnOpen.addEventListener('click', () => {
        console.log('🖱️ [CLICK] ========================================');
        console.log('🖱️ [CLICK] Profile button clicked!');
        console.log('🖱️ [CLICK] Time:', new Date().toISOString());
        
        const currentUser = localStorage.getItem('user');
        console.log('👤 [USER] Raw user data:', currentUser);
        
        if (currentUser) {
            try {
                const parsedUser = JSON.parse(currentUser);
                console.log('👤 [USER] Parsed user:', parsedUser);
                console.log('➡️ [ACTION] Opening profile modal...');
                showProfileModal(parsedUser);
            } catch (e) {
                console.error('❌ [USER] Parse error:', e);
                console.log('➡️ [ACTION] Opening login modal (parse error)');
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        } else {
            console.log('👤 [USER] No user found');
            console.log('➡️ [ACTION] Opening login modal');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        console.log('🖱️ [CLICK] ========================================');
    });
    console.log('🔧 [SETUP] Click handler added!');

    // ✅ STEP 3: Login modal overlay click
    console.log('🔧 [SETUP] Adding click handler to login modal...');
    modal.addEventListener('click', (e) => {
        console.log('🖱️ [LOGIN-CLICK] ========================================');
        console.log('🖱️ [LOGIN-CLICK] Login modal clicked');
        console.log('🖱️ [LOGIN-CLICK] Target:', e.target);
        console.log('🖱️ [LOGIN-CLICK] Target ID:', e.target.id);
        console.log('🖱️ [LOGIN-CLICK] Target tagName:', e.target.tagName);
        
        if (e.target.id === 'loginModal') {
            console.log('✅ [OVERLAY] Overlay clicked - closing');
            modal.style.display = 'none';
            document.body.style.overflow = '';
            console.log('✅ [OVERLAY] Login modal closed');
        } else {
            console.log('⚠️ [OVERLAY] Content clicked - ignoring');
        }
        console.log('🖱️ [LOGIN-CLICK] ========================================');
    });
    console.log('🔧 [SETUP] Login modal click handler added!');

    // ✅ STEP 4: Show Profile Modal Function
    function showProfileModal(user) {
        console.log('🎭 [PROFILE] ========================================');
        console.log('🎭 [PROFILE] showProfileModal called');
        console.log('🎭 [PROFILE] User object:', user);
        console.log('🎭 [PROFILE] User username:', user?.username);
        console.log('🎭 [PROFILE] Time:', new Date().toISOString());
        
        const loginModal = document.getElementById('loginModal');
        let profileModal = document.getElementById('profileModal');
        
        console.log('📍 [PROFILE] Elements:');
        console.log('📍 [PROFILE] - loginModal:', loginModal);
        console.log('📍 [PROFILE] - profileModal:', profileModal);
        
        // Close login modal
        console.log('❌ [PROFILE] Closing login modal...');
        loginModal.style.display = 'none';
        console.log('❌ [PROFILE] Login modal closed');
        
        // Clone profile modal to remove old listeners
        console.log('🔄 [PROFILE] Cloning profile modal...');
        const newProfileModal = profileModal.cloneNode(true);
        console.log('🔄 [PROFILE] Profile modal cloned');
        
        console.log('🔄 [PROFILE] Replacing in DOM...');
        profileModal.parentNode.replaceChild(newProfileModal, profileModal);
        profileModal = newProfileModal;
        console.log('🔄 [PROFILE] Profile modal replaced');
        
        // Update username
        console.log('📝 [PROFILE] Updating username...');
        const usernameEl = profileModal.querySelector('#profileUsername');
        console.log('📝 [PROFILE] Username element:', usernameEl);
        
        if (usernameEl) {
            usernameEl.textContent = user.username;
            console.log('✅ [PROFILE] Username updated to:', user.username);
        } else {
            console.error('❌ [PROFILE] Username element not found!');
        }
        
        // Show modal
        console.log('👁️ [PROFILE] Showing profile modal...');
        profileModal.style.display = 'flex';
        console.log('👁️ [PROFILE] Profile modal display set to flex');
        console.log('👁️ [PROFILE] Profile modal visible:', profileModal.style.display);
        
        // ✅ CRITICAL: Profile modal overlay click
        console.log('🔧 [PROFILE] Adding overlay click handler...');
        profileModal.addEventListener('click', (e) => {
            console.log('🖱️ [PROFILE-CLICK] ========================================');
            console.log('🖱️ [PROFILE-CLICK] Profile modal clicked!');
            console.log('🖱️ [PROFILE-CLICK] Event target:', e.target);
            console.log('🖱️ [PROFILE-CLICK] Event target ID:', e.target.id);
            console.log('🖱️ [PROFILE-CLICK] Event target class:', e.target.className);
            console.log('🖱️ [PROFILE-CLICK] Event target tagName:', e.target.tagName);
            console.log('🖱️ [PROFILE-CLICK] profileModal:', profileModal);
            console.log('🖱️ [PROFILE-CLICK] Target === profileModal?', e.target === profileModal);
            console.log('🖱️ [PROFILE-CLICK] Target ID === "profileModal"?', e.target.id === 'profileModal');
            
            if (e.target === profileModal) {
                console.log('✅ [PROFILE-CLOSE] ===== OVERLAY CLICKED =====');
                console.log('✅ [PROFILE-CLOSE] Closing profile modal...');
                profileModal.style.display = 'none';
                console.log('✅ [PROFILE-CLOSE] Profile modal display:', profileModal.style.display);
                document.body.style.overflow = '';
                console.log('✅ [PROFILE-CLOSE] Body overflow reset');
                console.log('✅ [PROFILE-CLOSE] DONE - NO LOGIN MODAL OPENED!');
                console.log('✅ [PROFILE-CLOSE] ===========================');
            } else {
                console.log('⚠️ [PROFILE-CLICK] Not overlay - ignoring click');
                console.log('⚠️ [PROFILE-CLICK] Clicked element:', e.target);
            }
            console.log('🖱️ [PROFILE-CLICK] ========================================');
        });
        console.log('🔧 [PROFILE] Overlay click handler added!');
        
        // Logout button
        console.log('🔧 [PROFILE] Setting up logout button...');
        const btnLogout = profileModal.querySelector('#btnLogout');
        console.log('🔧 [PROFILE] Logout button:', btnLogout);
        
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                console.log('🚪 [LOGOUT] ========================================');
                console.log('🚪 [LOGOUT] Logout button clicked!');
                console.log('🚪 [LOGOUT] Removing localStorage...');
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                console.log('🚪 [LOGOUT] localStorage cleared');
                
                console.log('🚪 [LOGOUT] Closing profile modal...');
                profileModal.style.display = 'none';
                console.log('🚪 [LOGOUT] Opening login modal...');
                loginModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                
                console.log('✅ [LOGOUT] Logged out successfully');
                console.log('🚪 [LOGOUT] ========================================');
                alert('Berhasil logout');
            });
            console.log('🔧 [PROFILE] Logout handler added');
        } else {
            console.error('❌ [PROFILE] Logout button not found!');
        }
        
        console.log('🔍 [PROFILE] Checking VIP status...');
        checkVIPStatus();
        console.log('🎭 [PROFILE] ========================================');
    }

    // ✅ STEP 5: Check VIP Status
    async function checkVIPStatus() {
        console.log('👑 [VIP] ========================================');
        const token = localStorage.getItem('authToken');
        console.log('👑 [VIP] Checking VIP status...');
        console.log('👑 [VIP] Token exists:', !!token);
        
        if (!token) {
            console.log('⚠️ [VIP] No token - skipping VIP check');
            console.log('👑 [VIP] ========================================');
            return;
        }
        
        const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
        
        try {
            console.log('🌐 [VIP] Fetching from:', `${API_URL}/vip/status`);
            const response = await fetch(`${API_URL}/vip/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('📥 [VIP] Response status:', response.status);
            const data = await response.json();
            console.log('📥 [VIP] Response data:', data);
            
            const vipBadge = document.getElementById('vipBadge');
            const vipText = document.getElementById('vipText');
            const vipExpiryText = document.getElementById('vipExpiryText');
            
            console.log('📍 [VIP] Elements:', {
                vipBadge: !!vipBadge,
                vipText: !!vipText,
                vipExpiryText: !!vipExpiryText
            });
            
            if (data.success && data.isVIP) {
                console.log('👑 [VIP] User is VIP!');
                if (vipBadge) {
                    vipBadge.className = 'vip-badge vip-badge-vip';
                    console.log('✅ [VIP] Badge class updated');
                }
                if (vipText) {
                    vipText.textContent = 'DONATUR SETIA';
                    console.log('✅ [VIP] Text updated');
                }
                
                const expiry = new Date(data.expiresAt);
                console.log('📅 [VIP] Expiry date:', expiry);
                
                if (vipExpiryText) {
                    vipExpiryText.textContent = `VIP Sampai ${expiry.toLocaleString('id-ID', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Jakarta'
                    })} WIB`;
                    console.log('✅ [VIP] Expiry text updated');
                }
            } else {
                console.log('👤 [VIP] User is NOT VIP');
                if (vipBadge) vipBadge.className = 'vip-badge vip-badge-free';
                if (vipText) vipText.textContent = 'PEMBACA SETIA';
                if (vipExpiryText) vipExpiryText.textContent = 'FREE ACCESS ONLY';
                console.log('✅ [VIP] Free member badges updated');
            }
        } catch (error) {
            console.error('❌ [VIP] Error:', error);
            console.error('❌ [VIP] Error stack:', error.stack);
        }
        console.log('👑 [VIP] ========================================');
    }

    // ✅ Don't auto-show profile modal - only show when user clicks profile button
console.log('ℹ️ [INIT] Profile modal ready - waiting for user click');   // ✅ STEP 7: Login/Register forms
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';

    console.log('🔧 [SETUP] Adding form handlers...');

    document.querySelector('#panelLogin form').addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('🔐 [LOGIN] ========================================');
        console.log('🔐 [LOGIN] Form submitted');
        console.log('🔐 [LOGIN] Time:', new Date().toISOString());
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        console.log('🔐 [LOGIN] Email:', email);
        
        try {
            console.log('🌐 [LOGIN] Sending request to:', `${API_URL}/auth/login`);
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            console.log('📥 [LOGIN] Response status:', response.status);
            const data = await response.json();
            console.log('📥 [LOGIN] Response data:', data);
            
            if (data.success) {
                console.log('✅ [LOGIN] Login successful!');
                console.log('💾 [LOGIN] Saving to localStorage...');
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                console.log('💾 [LOGIN] Saved');
                
                console.log('🎭 [LOGIN] Showing profile modal...');
                showProfileModal(data.user);
            } else {
                console.error('❌ [LOGIN] Login failed:', data.error);
                alert(data.error || 'Login gagal');
            }
        } catch (error) {
            console.error('❌ [LOGIN] Error:', error);
            console.error('❌ [LOGIN] Error stack:', error.stack);
            alert('Terjadi kesalahan: ' + error.message);
        }
        console.log('🔐 [LOGIN] ========================================');
    });

document.querySelector('#panelRegister form').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 [REGISTER] ========================================');
    console.log('📝 [REGISTER] Form submitted');
    console.log('📝 [REGISTER] Time:', new Date().toISOString());
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    
    console.log('📝 [REGISTER] Email:', email);
    console.log('📝 [REGISTER] Password length:', password.length);
    
    if (password !== confirm) {
        console.error('❌ [REGISTER] Password mismatch');
        alert('Password tidak cocok!');
        return;
    }
    
    if (password.length < 8) {
        console.error('❌ [REGISTER] Password too short');
        alert('Password minimal 8 karakter');
        return;
    }
    
    try {
        console.log('🌐 [REGISTER] Sending request to:', `${API_URL}/auth/register`);
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        console.log('📥 [REGISTER] Response status:', response.status);
        const data = await response.json();
        console.log('📥 [REGISTER] Response data:', data);
        
        if (data.success) {
            console.log('✅ [REGISTER] Registration successful!');
            console.log('✅ [REGISTER] Message:', data.message);
            console.log('✅ [REGISTER] User email:', data.email);
            
            alert('✅ ' + data.message);
            
            // Tutup modal dan switch ke login tab
            console.log('🚪 [REGISTER] Closing modal...');
            document.getElementById('loginModal').style.display = 'none';
            document.body.style.overflow = '';
            console.log('✅ [REGISTER] Modal closed');
        } else {
            console.error('❌ [REGISTER] Registration failed:', data.error);
            alert('❌ ' + data.error);
        }
    } catch (error) {
        console.error('❌ [REGISTER] Error:', error);
        console.error('❌ [REGISTER] Error stack:', error.stack);
        alert('Terjadi kesalahan: ' + error.message);
    }
    console.log('📝 [REGISTER] ========================================');
});

    console.log('🔧 [SETUP] Form handlers added');

    // Password toggle
    console.log('🔧 [SETUP] Adding password toggle handlers...');
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            console.log('👁️ [PASSWORD] Toggled to:', type);
            
            const svg = btn.querySelector('svg');
            if (type === 'text') {
                svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
            } else {
                svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            }
        });
    });
    console.log('🔧 [SETUP] Password toggle handlers added');

    // Tab switching
    console.log('🔧 [SETUP] Adding tab switching handlers...');
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            console.log('📑 [TAB] Switched to:', tab.id);
            
            document.querySelectorAll('.login-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            
            const panelId = tab.id.replace('tab', 'panel');
            document.getElementById(panelId)?.classList.add('active');
        });
    });
    console.log('🔧 [SETUP] Tab switching handlers added');

    // Forgot password
    console.log('🔧 [SETUP] Adding forgot password handler...');
    document.querySelector('#panelForgot form').addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('🔑 [FORGOT] Form submitted');
        alert('Fitur reset password segera hadir!');
    });
    console.log('🔧 [SETUP] Forgot password handler added');

    console.log('✅ [INIT] ========================================');
    console.log('✅ [INIT] Login modal fully initialized!');
    console.log('✅ [INIT] ========================================');
});
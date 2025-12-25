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
 * ✅ NEW: Cache helper dengan expiry
 */
function getCachedData(key, maxAge = 300000) { // 5 minutes default
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age < maxAge) {
      console.log(`📦 Cache HIT: ${key} (${Math.floor(age/1000)}s old)`);
      return data;
    }
    
    console.log(`⏰ Cache EXPIRED: ${key}`);
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
    console.log(`💾 Cached: ${cacheKey}`);
    
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
         aria-label="${ariaLabel}"
         onclick="window.location.href='info-manga.html?repo=${manga.id}'"
         onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href='info-manga.html?repo=${manga.id}'}">
      
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
    console.log(`💾 Cached daily views: ${cacheKey}`);
    
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
  console.log('🔥 renderTop5 CALLED at:', new Date().toISOString());
  console.trace();
    
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

  console.log('✅ Top 5 Trending (24h) loaded');
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
  
  console.log('✅ Manga list loaded');
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
    container.classList.add('is-dragging'); // ← TAMBAHKAN
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });
  
  container.addEventListener('mouseleave', () => {
    isDown = false;
    container.style.cursor = 'grab';
    container.classList.remove('is-dragging'); // ← TAMBAHKAN
  });
  
  container.addEventListener('mouseup', () => {
    isDown = false;
    container.style.cursor = 'grab';
    // ← TAMBAHKAN: Delay remove class untuk smooth transition
    setTimeout(() => {
      container.classList.remove('is-dragging');
    }, 50);
  });
  
  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    hasMoved = true;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 2;
    container.scrollLeft = scrollLeft - walk;
  });
  
  container.addEventListener('click', (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
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
  
  console.log('🚀 Initializing...');
  
  setupKeyboardNavigation();
  setupSearchAccessibility();
  
  // ✅ Render Top5 dengan mouse drag
  renderTop5(mangaList).then(() => {
    enableTop5MouseDrag();
  });
  
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

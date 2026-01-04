// ============================================
// SCRIPT.JS - NURANANTO SCANLATION
// ============================================
// Note: Uses common.js for shared utilities (DEBUG_MODE, fetchFreshJSON, cache functions, etc.)

// ✅ TEST FUNCTION: Test manga type reading
// Usage: testMangaType('Waka-chan') or testMangaType('waka-chan')
async function testMangaType(repoName) {
  console.log(`🧪 Testing manga type for repo: ${repoName}`);
  
  try {
    const mangaData = await fetchMangaData(repoName);
    
    console.log('📦 Full mangaData:', mangaData);
    console.log('📖 mangaData.manga:', mangaData.manga);
    console.log('🏷️ mangaData.manga.type:', mangaData.manga?.type || 'NOT SET');
    
    const mangaType = (mangaData.manga && mangaData.manga.type) ? mangaData.manga.type : 'manga';
    const isWebtoon = mangaType.toLowerCase() === 'webtoon';
    
    console.log(`✅ Detected Type: ${mangaType}`);
    console.log(`✅ Is Webtoon: ${isWebtoon}`);
    console.log(`✅ Badge Text: ${isWebtoon ? 'Berwarna' : 'Hitam Putih'}`);
    console.log(`✅ Badge Class: ${isWebtoon ? 'type-badge-webtoon' : 'type-badge-manga'}`);
    
    // Find manga in config
    const manga = mangaList.find(m => m.repo === repoName || m.id === repoName.toLowerCase().replace(/\s+/g, '-'));
    if (manga) {
      console.log(`📚 Manga Config:`, manga);
    }
    
    return {
      repo: repoName,
      type: mangaType,
      isWebtoon,
      badgeText: isWebtoon ? 'Berwarna' : 'Hitam Putih',
      badgeClass: isWebtoon ? 'type-badge-webtoon' : 'type-badge-manga',
      mangaData: mangaData.manga
    };
  } catch (error) {
    console.error('❌ Error testing manga type:', error);
    return null;
  }
}

async function fetchMangaData(repo) {
  try {
    const cacheKey = `manga_${repo}`;
    const cached = getCachedData(cacheKey, 300000); // 5 min
    
    if (cached) {
      return cached;
    }
    
    // ✅ CACHE MISS - Fetch fresh
    const url = `https://raw.githubusercontent.com/nurananto/${repo}/main/manga.json`;
    const data = await fetchFreshJSON(url);
    
    // ✅ DEBUG: Log manga type
    if (DEBUG_MODE) {
      dLog(`📖 [FETCH] Repo: ${repo}, Type: ${data.manga?.type || 'not set'}`);
    }
    
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
      latestLockedDate,
      manga: data.manga || {} // ✅ Include full manga object for type access
    };
    
    // ✅ DEBUG: Verify type is included
    if (DEBUG_MODE) {
      dLog(`📖 [RESULT] Repo: ${repo}, Manga type in result: ${result.manga?.type || 'not set'}`);
    }
    
    // ✅ SAVE TO CACHE
    setCachedData(cacheKey, result);
    
    return result;

  } catch (error) {
    console.error(`Error fetching manga data for ${repo}:`, error);
    
    const staleCache = getCachedData(`manga_${repo}`, Infinity);
    if (staleCache) {
      dWarn('⚠️ Using stale cache');
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
      latestLockedDate: null,
      manga: {} // ✅ Include empty manga object for type access
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

function formatViews(views) {
  return views.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function createTop5Card(manga, mangaData, rank, index = 0, views24h = null) {
  const cdnUrls = getResponsiveCDN(manga.cover);
  
  // ✅ FIX: Match srcset widths dengan actual CDN sizes untuk prevent pixelation
  const srcset = `
    ${cdnUrls.small} 500w,
    ${cdnUrls.medium} 700w,
    ${cdnUrls.large} 900w,
    ${cdnUrls.xlarge} 1200w
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
  
  // ✅ Get manga type from manga-config.js (not from manga.json)
  const mangaType = (manga.type || 'manga').toLowerCase();
  const isWebtoon = mangaType === 'webtoon';
  const typeBadgeText = isWebtoon ? 'Colour' : 'B/W';
  const typeBadgeClass = isWebtoon ? 'type-badge-colour' : 'type-badge-bw';
  
  if (DEBUG_MODE) {
    dLog(`📖 [TYPE-BADGE] Manga: ${manga.title}, Type: ${mangaType}, Badge: ${typeBadgeText}`);
  }
  
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
      
      <!-- KOTAK 2: Cover Image with Type Badge -->
      <div class="manga-cover-wrapper">
        <img 
          src="${cdnUrls.medium}"
          srcset="${srcset}"
          sizes="${sizes}"
          alt="${manga.title} cover image"
          loading="${loadingAttr}"
          ${fetchPriority}
          ${decodingAttr}
          data-original="${manga.cover}"
          aria-hidden="true">
        <div class="type-badge ${typeBadgeClass}" aria-label="Type: ${typeBadgeText}">
          <svg class="type-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <path d="M6.5 2v20"/>
          </svg>
          <span class="type-badge-text">${typeBadgeText}</span>
        </div>
      </div>
      
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
  
  // ✅ FIX: Match srcset widths dengan actual CDN sizes untuk prevent pixelation
  const srcset = `
    ${cdnUrls.small} 500w,
    ${cdnUrls.medium} 700w,
    ${cdnUrls.large} 900w,
    ${cdnUrls.xlarge} 1200w
  `.trim();
  
  // ✅ FIX: Optimized sizes untuk better image selection
  const sizes = '(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw';
  
  const eagerLoadCount = window.innerWidth >= 1024 ? 10 : (window.innerWidth >= 768 ? 6 : 4);
  const loadingAttr = index < eagerLoadCount ? 'eager' : 'lazy';
  const fetchPriority = index < eagerLoadCount ? ' fetchpriority="high"' : '';
  const decodingAttr = index < eagerLoadCount ? ' decoding="sync"' : ' decoding="async"';
  
  const ariaLabel = `${manga.title}${chapterText ? ', ' + chapterText : ''}${isRecent ? ', recently updated' : ''}`;
  
  // ✅ Get manga type from manga-config.js (not from manga.json)
  const mangaType = (manga.type || 'manga').toLowerCase();
  const isWebtoon = mangaType === 'webtoon';
  const typeBadgeText = isWebtoon ? 'Colour' : 'B/W';
  const typeBadgeClass = isWebtoon ? 'type-badge-colour' : 'type-badge-bw';
  
  if (DEBUG_MODE) {
    dLog(`📖 [TYPE-BADGE] Manga: ${manga.title}, Type: ${mangaType}, Badge: ${typeBadgeText}`);
  }
  
  return `
    <div class="manga-card ${isRecent ? 'recently-updated' : ''}" 
         role="listitem"
         tabindex="0"
         data-manga-id="${manga.id}"
         aria-label="${ariaLabel}"
         onclick="window.location.href='info-manga.html?repo=${manga.id}'"
         onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href='info-manga.html?repo=${manga.id}'}">
      <div class="manga-cover-wrapper">
        <img 
          src="${cdnUrls.medium}"
          srcset="${srcset}"
          sizes="${sizes}"
          alt="${manga.title} cover image"
          loading="${loadingAttr}"
          ${fetchPriority}
          ${decodingAttr}
          data-original="${manga.cover}"
          aria-hidden="true">
        <div class="type-badge ${typeBadgeClass}" aria-label="Type: ${typeBadgeText}">
          <svg class="type-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <path d="M6.5 2v20"/>
          </svg>
          <span class="type-badge-text">${typeBadgeText}</span>
        </div>
      </div>
      ${badgeHTML}
      <div class="manga-title" aria-hidden="true">${manga.title}</div>
    </div>`;
}

async function calculate24HourViews(repo) {
  try {
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
    const staleCache = getCachedData(`daily_${repo}`, Infinity);
    if (staleCache !== null) {
      dWarn('⚠️ Using stale daily views cache');
      return staleCache;
    }
    return null;
  }
}

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
/**
 * Protection Code - UPDATED
 */
/**
 * Protection Code - UPDATED
 */
function initProtection() {
  if (DEBUG_MODE) {
    dLog('🔓 Debug mode enabled');
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
    if (e.target.id === 'inputVIPCode') {
      dLog('✅ [PROTECTION] Copy allowed for VIP input');
      return;
    }
    e.preventDefault();
    return false;
  });

  document.addEventListener('paste', (e) => {
    if (e.target.id === 'inputVIPCode') {
      dLog('✅ [PROTECTION] Paste allowed for VIP input');
      return;
    }
    e.preventDefault();
    return false;
  });

  dLog('🔒 Protection enabled');
}

initProtection();


// ============================================
// UPGRADE & CODE MODAL HANDLERS (GLOBAL)
// ============================================

// Close upgrade modal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnCloseUpgrade') {
        const upgradeModal = document.getElementById('upgradeModal');
        if (upgradeModal) {
            upgradeModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
});

// Donasi button
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnDonasi') {
        window.open('https://trakteer.id/NuranantoScanlation', '_blank');
    }
});

// Panduan button
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnPanduan') {
        const upgradeModal = document.getElementById('upgradeModal');
        const panduanModal = document.getElementById('panduanModal');
        
        if (upgradeModal) upgradeModal.style.display = 'none';
        if (panduanModal) panduanModal.style.display = 'flex';
    }
});

// Back to Upgrade button
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnBackToUpgrade') {
        const upgradeModal = document.getElementById('upgradeModal');
        const panduanModal = document.getElementById('panduanModal');
        
        if (panduanModal) panduanModal.style.display = 'none';
        if (upgradeModal) {
            upgradeModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
});

// Close upgrade modal on overlay click
document.addEventListener('click', (e) => {
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal && e.target === upgradeModal) {
        upgradeModal.style.display = 'none';
        document.body.style.overflow = '';
    }
});

// VIP Code button
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnVIPCode') {
        const upgradeModal = document.getElementById('upgradeModal');
        const codeModal = document.getElementById('codeModal');
        const inputVIPCode = document.getElementById('inputVIPCode');
        const btnPaste = document.getElementById('btnPasteCode');
        const btnRedeem = document.getElementById('btnRedeemCode');
        const errorEl = document.getElementById('codeError');
        
        if (upgradeModal) {
            upgradeModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (codeModal) {
            // Reset state
            inputVIPCode.value = '';
            errorEl.textContent = '';
            
            codeModal.style.display = 'flex';
            
            // ✅ Setup input listener untuk toggle button saat value berubah
            setupVIPCodeInputToggle();
            // ✅ Set state awal (input kosong = tampilkan Paste button)
            toggleVIPCodeButton();
        }
    }
});

// ✅ Function untuk toggle button berdasarkan value input (bisa dipanggil langsung)
function toggleVIPCodeButton() {
    const inputEl = document.getElementById('inputVIPCode');
    const btnPaste = document.getElementById('btnPasteCode');
    const btnRedeem = document.getElementById('btnRedeemCode');
    
    if (!inputEl || !btnPaste || !btnRedeem) return;
    
    const hasValue = inputEl.value.trim().length > 0;
    
    if (hasValue) {
        // Ada kode -> tampilkan Redeem, sembunyikan Paste
        btnPaste.style.display = 'none';
        btnRedeem.style.display = 'flex';
        inputEl.readOnly = false; // ✅ Biarkan user bisa edit/hapus
    } else {
        // Kosong -> tampilkan Paste, sembunyikan Redeem
        btnPaste.style.display = 'flex';
        btnRedeem.style.display = 'none';
        inputEl.readOnly = true;
    }
}

// ✅ Function untuk setup input listener
function setupVIPCodeInputToggle() {
    const inputEl = document.getElementById('inputVIPCode');
    
    if (!inputEl) return;
    
    // ✅ Hapus listener lama jika ada
    if (inputEl._toggleHandler) {
        inputEl.removeEventListener('input', inputEl._toggleHandler);
    }
    
    // ✅ Buat handler function yang memanggil toggleVIPCodeButton
    inputEl._toggleHandler = function() {
        toggleVIPCodeButton();
    };
    
    // Tambahkan listener baru
    inputEl.addEventListener('input', inputEl._toggleHandler);
}

// ✅ PASTE CODE Button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'btnPasteCode' || e.target.closest('#btnPasteCode')) {
        dLog('📋 [PASTE-BTN] Paste button clicked');
        
        const inputEl = document.getElementById('inputVIPCode');
        const btnPaste = document.getElementById('btnPasteCode');
        const btnRedeem = document.getElementById('btnRedeemCode');
        const errorEl = document.getElementById('codeError');
        
        try {
            // Read from clipboard
            const text = await navigator.clipboard.readText();
            dLog('📋 [PASTE-BTN] Clipboard text:', text);
            dLog('📋 [PASTE-BTN] Text length:', text.length);
            
            if (text && text.trim().length > 0) {
                inputEl.value = text.trim();
                // ✅ Toggle button secara manual (karena set value programmatically tidak selalu trigger input event)
                toggleVIPCodeButton();
                errorEl.textContent = '';
                dLog('✅ [PASTE-BTN] Code pasted successfully');
            } else {
                errorEl.textContent = 'Clipboard kosong';
                console.error('❌ [PASTE-BTN] Empty clipboard');
            }
        } catch (error) {
            console.error('❌ [PASTE-BTN] Error:', error);
            errorEl.textContent = 'Gagal membaca clipboard. Paste manual (Ctrl+V)';
            
            // Allow manual paste
            inputEl.readOnly = false;
            inputEl.focus();
            // ✅ Toggle button akan otomatis ter-handle oleh input listener ketika user paste manual
            // ✅ Juga panggil toggle sekarang untuk memastikan state benar
            toggleVIPCodeButton();
        }
    }
});

// ✅ REDEEM CODE - Submit VIP Code
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'formVIPCode') {
        e.preventDefault();
        dLog('🎫 [VIP-CODE] Form submitted');
        
        const inputEl = document.getElementById('inputVIPCode');
        const code = inputEl.value.trim();
        const errorEl = document.getElementById('codeError');
        const token = localStorage.getItem('authToken');
        const btnRedeem = document.getElementById('btnRedeemCode');
        
        dLog('📝 [VIP-CODE] Code:', code);
        dLog('📝 [VIP-CODE] Code length:', code.length);
        
        if (!token) {
            console.error('❌ [VIP-CODE] No token found');
            errorEl.textContent = 'Please login first';
            return;
        }
        
        if (!code) {
            console.error('❌ [VIP-CODE] Empty code');
            errorEl.textContent = 'Kode tidak boleh kosong';
            return;
        }
        
        // Disable button during request
        btnRedeem.disabled = true;
        btnRedeem.textContent = '⏳ PROCESSING...';
        
        try {
            dLog('🌐 [VIP-CODE] Sending request...');
            
            const response = await fetch('https://manga-auth-worker.nuranantoadhien.workers.dev/donatur/redeem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });
            
            dLog('📥 [VIP-CODE] Response status:', response.status);
            
            // ✅ FIX: Check response status before parsing JSON
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ [VIP-CODE] Failed to parse response:', parseError);
                errorEl.textContent = response.status === 404 ? 'Endpoint tidak ditemukan. Silakan refresh halaman.' : 'Terjadi kesalahan saat memproses response';
                return;
            }
            
            dLog('📥 [VIP-CODE] Response data:', data);
            
            // ✅ FIX: Handle both success response and error response properly
            if (!response.ok) {
                // Response status bukan 200-299
                const errorMessage = data.error || data.message || `Error ${response.status}: ${response.statusText}`;
                console.error('❌ [VIP-CODE] Failed:', errorMessage);
                errorEl.textContent = errorMessage;
                return;
            }
            
            if (data.success) {
                dLog('✅ [VIP-CODE] Success!');
                alert('✅ ' + data.message);
                
                const codeModal = document.getElementById('codeModal');
                if (codeModal) codeModal.style.display = 'none';
                
                // ✅ Update donatur status and countdown
                await checkDonaturStatus();
                
                // Reset
                inputEl.value = '';
                errorEl.textContent = '';
            } else {
                console.error('❌ [VIP-CODE] Failed:', data.error);
                errorEl.textContent = data.error || 'Terjadi kesalahan';
            }
        } catch (error) {
            console.error('❌ [VIP-CODE] Error:', error);
            errorEl.textContent = error.message || 'Terjadi kesalahan koneksi';
        } finally {
            // Re-enable button
            btnRedeem.disabled = false;
            btnRedeem.textContent = '⚡ REDEEM CODE';
        }
    }
});

// Back from code modal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnBackFromCode') {
        const upgradeModal = document.getElementById('upgradeModal');
        const codeModal = document.getElementById('codeModal');
        if (codeModal) codeModal.style.display = 'none';
        if (upgradeModal) {
            upgradeModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
});

// Close code modal on overlay click
document.addEventListener('click', (e) => {
    const codeModal = document.getElementById('codeModal');
    if (e.target === codeModal) {
        codeModal.style.display = 'none';
    }
});
/**
 * LOGIN MODAL - FULL DEBUG VERSION
 * Replace SELURUH bagian login modal di script.js DAN info-manga.js
 */
document.addEventListener('DOMContentLoaded', () => {
    dLog('🎬 [INIT] ========================================');
    dLog('🎬 [INIT] Login modal initialization started');
    dLog('🎬 [INIT] ========================================');
    
    const btnOpen = document.getElementById('btnOpenLogin');
    const modal = document.getElementById('loginModal');
    const profileModal = document.getElementById('profileModal');
    
    dLog('🔍 [CHECK] ========================================');
    dLog('🔍 [CHECK] Checking DOM elements...');
    dLog('🔍 [CHECK] btnOpenLogin:', btnOpen);
    dLog('🔍 [CHECK] loginModal:', modal);
    dLog('🔍 [CHECK] profileModal:', profileModal);
    dLog('🔍 [CHECK] ========================================');
    
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
    dLog('📦 [STORAGE] ========================================');
    dLog('📦 [STORAGE] Checking localStorage...');
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');
    
    dLog('📦 [STORAGE] Raw user data:', storedUser);
    dLog('📦 [STORAGE] Has token:', !!storedToken);
    
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            dLog('📦 [STORAGE] Parsed user:', parsedUser);
        } catch (e) {
            console.error('❌ [STORAGE] JSON parse error:', e);
        }
    }
    dLog('📦 [STORAGE] ========================================');

    // ✅ STEP 2: Profile button click handler
    dLog('🔧 [SETUP] Adding click handler to profile button...');
    btnOpen.addEventListener('click', async (e) => {
        // ✅ Prevent multiple clicks
        if (btnOpen.disabled) {
            dLog('⚠️ [CLICK] Button already processing, ignoring...');
            return;
        }
        
        try {
            dLog('🖱️ [CLICK] ========================================');
            dLog('🖱️ [CLICK] Profile button clicked!');
            dLog('🖱️ [CLICK] Time:', new Date().toISOString());
            
            // ✅ Temporarily disable button to prevent double-click
            btnOpen.disabled = true;
            
            const currentUser = localStorage.getItem('user');
            dLog('👤 [USER] Raw user data:', currentUser);
            
            if (currentUser) {
                try {
                    const parsedUser = JSON.parse(currentUser);
                    dLog('👤 [USER] Parsed user:', parsedUser);
                    dLog('➡️ [ACTION] Opening profile modal...');
                    
                    // ✅ Ensure modal elements exist before calling
                    const profileModal = document.getElementById('profileModal');
                    if (!profileModal) {
                        console.error('❌ [ERROR] Profile modal not found, showing login modal instead');
                        modal.style.display = 'flex';
                        document.body.style.overflow = 'hidden';
                        return;
                    }
                    
                    await showProfileModal(parsedUser);
                } catch (e) {
                    console.error('❌ [USER] Parse error:', e);
                    dLog('➡️ [ACTION] Opening login modal (parse error)');
                    modal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                }
            } else {
                dLog('👤 [USER] No user found');
                dLog('➡️ [ACTION] Opening login modal');
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
            dLog('🖱️ [CLICK] ========================================');
        } catch (error) {
            console.error('❌ [CLICK] Unexpected error:', error);
            // ✅ Fallback: Always show login modal if something goes wrong
            try {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } catch (fallbackError) {
                console.error('❌ [CLICK] Fallback error:', fallbackError);
            }
        } finally {
            // ✅ Re-enable button after a short delay
            setTimeout(() => {
                btnOpen.disabled = false;
            }, 300);
        }
    });
    dLog('🔧 [SETUP] Click handler added!');

    // ✅ STEP 3: Login modal overlay click
    dLog('🔧 [SETUP] Adding click handler to login modal...');
    modal.addEventListener('click', (e) => {
        dLog('🖱️ [LOGIN-CLICK] ========================================');
        dLog('🖱️ [LOGIN-CLICK] Login modal clicked');
        dLog('🖱️ [LOGIN-CLICK] Target:', e.target);
        dLog('🖱️ [LOGIN-CLICK] Target ID:', e.target.id);
        dLog('🖱️ [LOGIN-CLICK] Target tagName:', e.target.tagName);
        
        if (e.target.id === 'loginModal') {
            dLog('✅ [OVERLAY] Overlay clicked - closing');
            modal.style.display = 'none';
            document.body.style.overflow = '';
            dLog('✅ [OVERLAY] Login modal closed');
        } else {
            dLog('⚠️ [OVERLAY] Content clicked - ignoring');
        }
        dLog('🖱️ [LOGIN-CLICK] ========================================');
    });
    dLog('🔧 [SETUP] Login modal click handler added!');

    // ✅ STEP 4: Show Profile Modal Function
    async function showProfileModal(user) {
    try {
        dLog('🎭 [PROFILE] ========================================');
        dLog('🎭 [PROFILE] showProfileModal called');
        dLog('🎭 [PROFILE] User object:', user);
        
        const loginModal = document.getElementById('loginModal');
        let profileModal = document.getElementById('profileModal');
        
        // ✅ Validate elements exist
        if (!profileModal) {
            console.error('❌ [PROFILE] Profile modal not found!');
            // Fallback to login modal
            if (loginModal) {
                loginModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
            return;
        }
        
        // Close login modal
        dLog('❌ [PROFILE] Closing login modal...');
        if (loginModal) loginModal.style.display = 'none';
        
        // Clone profile modal to remove old listeners
        dLog('🔄 [PROFILE] Cloning profile modal...');
        const newProfileModal = profileModal.cloneNode(true);
        profileModal.parentNode.replaceChild(newProfileModal, profileModal);
        profileModal = newProfileModal;
        
        // Update username
        const usernameEl = profileModal.querySelector('#profileUsername');
        if (usernameEl && user && user.username) {
            usernameEl.textContent = user.username;
            dLog('✅ [PROFILE] Username updated to:', user.username);
        }
        
        // ✅ Tampilkan modal DULU (sebelum check status) agar tidak stuck
        profileModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        dLog('✅ [PROFILE] Modal shown immediately');
        
        // ✅ Setelah modal ditampilkan, check status di background
        try {
            // ✅ Validate cache first to ensure expired status is updated
            validateAndUpdateExpiredStatus();
            dLog('🔍 [PROFILE] Checking DONATUR status...');
            await checkDonaturStatus();
        } catch (statusError) {
            console.error('❌ [PROFILE] Error checking status:', statusError);
            // Continue anyway - modal already shown
        }
        
        // ✅ Setelah status ready, pastikan content opacity 1
        const profileContent = profileModal.querySelector('.profile-content');
        if (profileContent) {
            profileContent.style.removeProperty('opacity');
            profileContent.style.opacity = '1';
        }
        
        dLog('✅ [PROFILE] Modal ready with content');
        
        // Profile modal overlay click
        profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            dLog('✅ [PROFILE-CLOSE] Closing profile modal...');
            profileModal.style.display = 'none';
            document.body.style.overflow = '';
            // Clear countdown interval when modal closes
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
        }
    });
    
    // Logout button
    const btnLogout = profileModal.querySelector('#btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            dLog('🚪 [LOGOUT] Logout button clicked!');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            // Clear countdown interval on logout
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
            
            profileModal.style.display = 'none';
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            alert('Berhasil logout');
        });
    }
        // ✅ Upgrade button handler
    const btnUpgrade = profileModal.querySelector('#btnUpgrade');
    const upgradeModal = document.getElementById('upgradeModal');
    
    if (btnUpgrade && upgradeModal) {
        btnUpgrade.addEventListener('click', () => {
            dLog('💎 [UPGRADE] Upgrade button clicked');
            profileModal.style.display = 'none';
            upgradeModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    }
        
        dLog('🎭 [PROFILE] ========================================');
    } catch (error) {
        console.error('❌ [PROFILE] Error in showProfileModal:', error);
        // ✅ Fallback: Show login modal if profile modal fails
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
}

    // Upgrade button di profile modal
const upgradeModal = document.getElementById('upgradeModal');
const codeModal = document.getElementById('codeModal');

    // ✅ STEP 5: Check VIP Status
    async function checkDonaturStatus() {
    // ✅ VALIDATE CACHE FIRST - Check if cached status is expired
    validateAndUpdateExpiredStatus();
    
    const token = localStorage.getItem('authToken');
    if (!token) {
        // ✅ Jika tidak ada token, set status sebagai PEMBACA SETIA
        const statusBox = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        const btnUpgrade = document.getElementById('btnUpgrade');
        const countdownBox = document.getElementById('countdownBox');
        
        if (statusBox && statusText) {
            statusBox.className = 'status-box pembaca-setia';
            statusText.textContent = 'PEMBACA SETIA';
        }
        if (btnUpgrade) btnUpgrade.style.display = 'block';
        if (countdownBox) countdownBox.style.display = 'none';
        
        localStorage.setItem('userDonaturStatus', JSON.stringify({
            isDonatur: false,
            timestamp: Date.now()
        }));
        return;
    }
    
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
    
    try {
        // ✅ Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_URL}/donatur/status`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const statusBox = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        const btnUpgrade = document.getElementById('btnUpgrade');
        const countdownBox = document.getElementById('countdownBox');
        const countdownText = document.getElementById('countdownText');
        
        if (data.success && data.isDonatur) {
            // ✅ Cek apakah expiresAt sudah lewat
            const now = new Date();
            const expiry = data.expiresAt ? new Date(data.expiresAt) : null;
            const isExpired = expiry && expiry <= now;
            
            if (isExpired) {
                // ✅ Status sudah berakhir - kembalikan ke PEMBACA SETIA
                statusBox.className = 'status-box pembaca-setia';
                statusText.textContent = 'PEMBACA SETIA';
                
                if (btnUpgrade) btnUpgrade.style.display = 'block';
                
                // Sembunyikan countdown box
                if (countdownBox) countdownBox.style.display = 'none';
                if (window.countdownInterval) {
                    clearInterval(window.countdownInterval);
                    window.countdownInterval = null;
                }
                
                // ✅ Store status in localStorage for reader.js
                localStorage.setItem('userDonaturStatus', JSON.stringify({
                    isDonatur: false,
                    timestamp: Date.now()
                }));
            } else {
                // ✅ DONATUR AKTIF - LANGSUNG UPDATE (TANPA FADE)
                statusBox.className = 'status-box donatur-setia';
                statusText.textContent = 'DONATUR SETIA';
                
                if (btnUpgrade) btnUpgrade.style.display = 'none';
                
                // ✅ Tampilkan countdown jika ada expiresAt
                if (data.expiresAt && countdownBox && countdownText) {
                    countdownBox.style.display = 'block';
                    updateCountdown(data.expiresAt, countdownText);
                    // Update countdown setiap detik
                    if (window.countdownInterval) {
                        clearInterval(window.countdownInterval);
                    }
                    window.countdownInterval = setInterval(() => {
                        // ✅ Validate expired status every time countdown updates
                        if (validateAndUpdateExpiredStatus()) {
                            // Status expired, stop countdown
                            return;
                        }
                        updateCountdown(data.expiresAt, countdownText);
                    }, 1000);
                } else if (countdownBox) {
                    countdownBox.style.display = 'none';
                }
                
                // ✅ Store status in localStorage for reader.js
                localStorage.setItem('userDonaturStatus', JSON.stringify({
                    isDonatur: true,
                    expiresAt: data.expiresAt,
                    timestamp: Date.now()
                }));
            }
            
        } else {
            // ❌ NON-DONATUR - LANGSUNG UPDATE (TANPA FADE)
            statusBox.className = 'status-box pembaca-setia';
            statusText.textContent = 'PEMBACA SETIA';
            
            if (btnUpgrade) btnUpgrade.style.display = 'block';
            
            // ✅ Sembunyikan countdown untuk non-donatur
            if (countdownBox) countdownBox.style.display = 'none';
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
            
            // ✅ Store status in localStorage for reader.js
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: false,
                timestamp: Date.now()
            }));
        }
    } catch (error) {
        // ✅ Handle network errors gracefully - use localStorage as fallback
        if (error.name === 'AbortError') {
            console.warn('Donatur status check timeout - using cached status');
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            console.warn('Network error - using cached donatur status from localStorage');
        } else {
            console.error('Donatur check error:', error);
        }
        
        // ✅ Fallback to localStorage if available
        try {
            const cachedStatus = localStorage.getItem('userDonaturStatus');
            if (cachedStatus) {
                const parsed = JSON.parse(cachedStatus);
                const statusBox = document.getElementById('statusBadge');
                const statusText = document.getElementById('statusText');
                const btnUpgrade = document.getElementById('btnUpgrade');
                const countdownBox = document.getElementById('countdownBox');
                const countdownText = document.getElementById('countdownText');
                
                if (parsed.isDonatur && parsed.expiresAt) {
                    // ✅ Cek apakah expiresAt sudah lewat
                    const now = new Date();
                    const expiry = new Date(parsed.expiresAt);
                    const isExpired = expiry <= now;
                    
                    if (isExpired) {
                        // Status sudah berakhir
                        if (statusBox) statusBox.className = 'status-box pembaca-setia';
                        if (statusText) statusText.textContent = 'PEMBACA SETIA';
                        if (btnUpgrade) btnUpgrade.style.display = 'block';
                        if (countdownBox) countdownBox.style.display = 'none';
                        if (window.countdownInterval) {
                            clearInterval(window.countdownInterval);
                            window.countdownInterval = null;
                        }
                    } else {
                        // Status masih aktif
                        if (statusBox) statusBox.className = 'status-box donatur-setia';
                        if (statusText) statusText.textContent = 'DONATUR SETIA';
                        if (btnUpgrade) btnUpgrade.style.display = 'none';
                        if (countdownBox && countdownText) {
                            countdownBox.style.display = 'block';
                            updateCountdown(parsed.expiresAt, countdownText);
                            if (window.countdownInterval) {
                                clearInterval(window.countdownInterval);
                            }
                            window.countdownInterval = setInterval(() => {
                                // ✅ Validate expired status every time countdown updates
                                if (validateAndUpdateExpiredStatus()) {
                                    // Status expired, stop countdown
                                    return;
                                }
                                updateCountdown(parsed.expiresAt, countdownText);
                            }, 1000);
                        }
                    }
                } else {
                    // Non-donatur
                    if (statusBox) statusBox.className = 'status-box pembaca-setia';
                    if (statusText) statusText.textContent = 'PEMBACA SETIA';
                    if (btnUpgrade) btnUpgrade.style.display = 'block';
                    if (countdownBox) countdownBox.style.display = 'none';
                    if (window.countdownInterval) {
                        clearInterval(window.countdownInterval);
                        window.countdownInterval = null;
                    }
                }
            } else {
                // No cached status - default to PEMBACA SETIA
                const statusBox = document.getElementById('statusBadge');
                const statusText = document.getElementById('statusText');
                const btnUpgrade = document.getElementById('btnUpgrade');
                const countdownBox = document.getElementById('countdownBox');
                
                if (statusBox && statusText) {
                    statusBox.className = 'status-box pembaca-setia';
                    statusText.textContent = 'PEMBACA SETIA';
                }
                if (btnUpgrade) btnUpgrade.style.display = 'block';
                if (countdownBox) countdownBox.style.display = 'none';
            }
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
        }
    }
}

    // ✅ Function to validate and update expired status
    function validateAndUpdateExpiredStatus() {
        const cachedStatus = localStorage.getItem('userDonaturStatus');
        if (!cachedStatus) return false;
        
        try {
            const parsed = JSON.parse(cachedStatus);
            
            // ✅ Cek jika status donatur dan ada expiresAt
            if (parsed.isDonatur && parsed.expiresAt) {
                const now = new Date();
                const expiry = new Date(parsed.expiresAt);
                const isExpired = expiry <= now;
                
                if (isExpired) {
                    // ✅ Status sudah berakhir - update cache dan DOM
                    const statusBox = document.getElementById('statusBadge');
                    const statusText = document.getElementById('statusText');
                    const btnUpgrade = document.getElementById('btnUpgrade');
                    const countdownBox = document.getElementById('countdownBox');
                    
                    // Update DOM
                    if (statusBox) statusBox.className = 'status-box pembaca-setia';
                    if (statusText) statusText.textContent = 'PEMBACA SETIA';
                    if (btnUpgrade) btnUpgrade.style.display = 'block';
                    if (countdownBox) countdownBox.style.display = 'none';
                    
                    // Clear interval
                    if (window.countdownInterval) {
                        clearInterval(window.countdownInterval);
                        window.countdownInterval = null;
                    }
                    
                    // ✅ Update localStorage - INVALIDATE CACHE
                    localStorage.setItem('userDonaturStatus', JSON.stringify({
                        isDonatur: false,
                        timestamp: Date.now()
                    }));
                    
                    return true; // Status was expired and updated
                }
            }
        } catch (error) {
            console.error('Error validating cached status:', error);
        }
        
        return false; // Status is still valid or not donatur
    }

    // ✅ Function to update countdown timer
    function updateCountdown(expiresAt, countdownTextElement) {
        if (!expiresAt || !countdownTextElement) return;
        
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;
        
        if (diff <= 0) {
            // ✅ Status sudah berakhir - kembalikan ke PEMBACA SETIA
            const statusBox = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const btnUpgrade = document.getElementById('btnUpgrade');
            const countdownBox = document.getElementById('countdownBox');
            
            // Update status ke PEMBACA SETIA
            if (statusBox) statusBox.className = 'status-box pembaca-setia';
            if (statusText) statusText.textContent = 'PEMBACA SETIA';
            
            // Tampilkan tombol upgrade
            if (btnUpgrade) btnUpgrade.style.display = 'block';
            
            // Sembunyikan countdown box
            if (countdownBox) countdownBox.style.display = 'none';
            
            // Clear interval
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
            
            // ✅ Update localStorage - INVALIDATE CACHE
            localStorage.setItem('userDonaturStatus', JSON.stringify({
                isDonatur: false,
                timestamp: Date.now()
            }));
            
            return;
        }
        
        // Format tanggal Indonesia
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
            hour12: false
        };
        
        const formattedDate = expiry.toLocaleDateString('id-ID', options);
        const timeStr = formattedDate.split('pukul')[1]?.trim() || '';
        const dateStr = formattedDate.split('pukul')[0].trim();
        
        countdownTextElement.textContent = `Hingga ${dateStr}, pukul ${timeStr} WIB`;
    }

    // ✅ Don't auto-show profile modal - only show when user clicks profile button
    dLog('ℹ️ [INIT] Profile modal ready - waiting for user click');

    // ✅ STEP 6: Check donatur status immediately on page load (without waiting for profile button click)
    // ✅ Validate cache first
    validateAndUpdateExpiredStatus();
    dLog('🔍 [INIT] Checking donatur status on page load...');
    checkDonaturStatus().then(() => {
        dLog('✅ [INIT] Donatur status checked, chapter list will reflect correct lock icons');
    });
    
    // ✅ Set up periodic validation (every 10 seconds) to check for expired status
    setInterval(() => {
        validateAndUpdateExpiredStatus();
    }, 10000); // Check every 10 seconds
    
    // ✅ Validate when page becomes visible (user switches back to tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            dLog('👁️ [VISIBILITY] Page visible - validating expired status');
            validateAndUpdateExpiredStatus();
            // Also refresh status from API if available
            const token = localStorage.getItem('authToken');
            if (token) {
                checkDonaturStatus();
            }
        }
    });
    
    // ✅ Validate when window gains focus (user clicks back to browser)
    window.addEventListener('focus', () => {
        dLog('🎯 [FOCUS] Window focused - validating expired status');
        validateAndUpdateExpiredStatus();
        // Also refresh status from API if available
        const token = localStorage.getItem('authToken');
        if (token) {
            checkDonaturStatus();
        }
    });

    // ✅ STEP 7: Login/Register forms
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';

    dLog('🔧 [SETUP] Adding form handlers...');

    document.querySelector('#panelLogin form').addEventListener('submit', async (e) => {
        e.preventDefault();
        dLog('🔐 [LOGIN] ========================================');
        dLog('🔐 [LOGIN] Form submitted');
        dLog('🔐 [LOGIN] Time:', new Date().toISOString());
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (DEBUG_MODE) dLog('🔐 [LOGIN] Email:', email);
        
        try {
            dLog('🌐 [LOGIN] Sending request to:', `${API_URL}/auth/login`);
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            dLog('📥 [LOGIN] Response status:', response.status);
            const data = await response.json();
            dLog('📥 [LOGIN] Response data:', data);
            
            if (data.success) {
                dLog('✅ [LOGIN] Login successful!');
                dLog('💾 [LOGIN] Saving to localStorage...');
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                dLog('💾 [LOGIN] Saved');
                
                dLog('🎭 [LOGIN] Showing profile modal...');
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
        dLog('🔐 [LOGIN] ========================================');
    });

document.querySelector('#panelRegister form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // ✅ Prevent double submission
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton.disabled) {
        dLog('⚠️ [REGISTER] Already submitting, ignoring...');
        return;
    }
    
    dLog('📝 [REGISTER] ========================================');
    dLog('📝 [REGISTER] Form submitted');
    dLog('📝 [REGISTER] Time:', new Date().toISOString());
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    
    if (DEBUG_MODE) dLog('📝 [REGISTER] Email:', email);
    dLog('📝 [REGISTER] Password length:', password.length);
    
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
    
    // ✅ Disable button dan show loading state
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '⏳ Registering...';
    
    try {
        dLog('🌐 [REGISTER] Sending request to:', `${API_URL}/auth/register`);
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        dLog('📥 [REGISTER] Response status:', response.status);
        
        // ✅ Parse JSON response
        const data = await response.json();
        dLog('📥 [REGISTER] Response data:', data);
        
        // ✅ Check response status dan success flag
        if (response.ok && data.success) {
            dLog('✅ [REGISTER] Registration successful!');
            dLog('✅ [REGISTER] Message:', data.message);
            if (DEBUG_MODE) dLog('✅ [REGISTER] User email:', data.email);
            
            alert('✅ ' + data.message);
            
            // Tutup modal dan switch ke login tab
            dLog('🚪 [REGISTER] Closing modal...');
            document.getElementById('loginModal').style.display = 'none';
            document.body.style.overflow = '';
            dLog('✅ [REGISTER] Modal closed');
        } else {
            // ✅ Handle error response (misalnya 409 Conflict - user sudah terdaftar)
            const errorMessage = data.error || data.message || 'Registration failed';
            console.error('❌ [REGISTER] Registration failed:', errorMessage);
            alert('❌ ' + errorMessage);
        }
    } catch (error) {
        console.error('❌ [REGISTER] Error:', error);
        console.error('❌ [REGISTER] Error stack:', error.stack);
        alert('Terjadi kesalahan: ' + error.message);
    } finally {
        // ✅ Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
    dLog('📝 [REGISTER] ========================================');
});

    dLog('🔧 [SETUP] Form handlers added');

    // Password toggle
    dLog('🔧 [SETUP] Adding password toggle handlers...');
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            dLog('👁️ [PASSWORD] Toggled to:', type);
            
            const svg = btn.querySelector('svg');
            if (type === 'text') {
                svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
            } else {
                svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            }
        });
    });
    dLog('🔧 [SETUP] Password toggle handlers added');

    // Tab switching
    dLog('🔧 [SETUP] Adding tab switching handlers...');
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            dLog('📑 [TAB] Switched to:', tab.id);
            
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
    dLog('🔧 [SETUP] Tab switching handlers added');

    // ✅ Handle Forgot Password Form
    dLog('🔧 [SETUP] Adding forgot password handler...');
    document.getElementById('formForgotPassword').addEventListener('submit', async (e) => {
        e.preventDefault();
        dLog('🔑 [FORGOT] Form submitted');
        
        const email = document.getElementById('forgotEmail').value.trim();
        const errorEl = document.getElementById('forgotError');
        const btnSubmit = document.getElementById('btnSendReset');
        
        if (!email) {
            errorEl.textContent = 'Email wajib diisi';
            return;
        }
        
        // Disable button
        const originalText = btnSubmit.textContent;
        btnSubmit.disabled = true;
        btnSubmit.textContent = '⏳ Mengirim...';
        errorEl.textContent = '';
        
        try {
            dLog('🌐 [FORGOT] Sending request to:', `${API_URL}/auth/request-reset`);
            const response = await fetch(`${API_URL}/auth/request-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            dLog('📥 [FORGOT] Response status:', response.status);
            const data = await response.json();
            dLog('📥 [FORGOT] Response data:', data);
            
            if (data.success) {
                alert('✅ ' + data.message);
                document.getElementById('forgotEmail').value = '';
                
                // Switch to login tab
                document.getElementById('tabLogin').click();
            } else {
                errorEl.textContent = data.error || 'Terjadi kesalahan';
            }
        } catch (error) {
            console.error('❌ [FORGOT] Error:', error);
            errorEl.textContent = 'Terjadi kesalahan koneksi';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    });
    dLog('🔧 [SETUP] Forgot password handler added');

    dLog('✅ [INIT] ========================================');
    dLog('✅ [INIT] Login modal fully initialized!');
    dLog('✅ [INIT] ========================================');
});

// ============================================
// ============================================
// HISTORY MODAL - FULL VERSION
// ============================================

/**
 * ✅ Fetch reading history from API with limit
 */
let historyCache = null;
let historyCacheTime = 0;
const HISTORY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchReadingHistory(limit = 3, skipCache = false) {
  const now = Date.now();
  
  // ✅ Cache per limit (3 vs all)
  const cacheKey = `history_${limit}`;
  
  // Return cached data if fresh (unless skipCache is true)
  if (!skipCache && historyCache?.[cacheKey] && (now - historyCacheTime) < HISTORY_CACHE_DURATION) {
    dLog(`📦 [HISTORY] Using cached data (limit=${limit})`);
    return historyCache[cacheKey];
  }
  
  const token = localStorage.getItem('authToken');
  if (!token) return { history: [], total: 0, showing: 0 };
  
  const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
  
  try {
    dLog(`🌐 [HISTORY] Fetching from API (limit=${limit}, skipCache=${skipCache})...`);
    // Add timestamp to prevent browser cache
    const response = await fetch(`${API_URL}/reading/history?limit=${limit}&_t=${now}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Initialize cache object if needed
      if (!historyCache) historyCache = {};
      
      historyCache[cacheKey] = data;
      historyCacheTime = now;
      dLog('✅ [HISTORY] Fetched:', data.showing, 'of', data.total, 'items');
      return data;
    }
    
    return { history: [], total: 0, showing: 0 };
  } catch (error) {
    console.error('[HISTORY] Fetch error:', error);
    return { history: [], total: 0, showing: 0 };
  }
}

/**
 * ✅ Format relative time
 */
function formatRelativeTime(isoString) {
  if (!isoString) return 'Tidak diketahui';
  
  // ✅ Parse waktu dari database
  let date;
  
  if (isoString.includes('T') && (isoString.includes('Z') || isoString.includes('+'))) {
    // ISO format dengan timezone (dari backend yang sudah diperbaiki)
    date = new Date(isoString);
  } else if (isoString.includes('T')) {
    // ISO format tanpa timezone - assume UTC
    date = new Date(isoString + 'Z');
  } else if (isoString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    // SQLite datetime format (YYYY-MM-DD HH:MM:SS) - assume UTC
    // Convert to ISO format first
    const isoFormat = isoString.replace(' ', 'T') + 'Z';
    date = new Date(isoFormat);
  } else {
    // Try parsing as-is
    date = new Date(isoString);
  }
  
  // ✅ Validate date
  if (isNaN(date.getTime())) {
    console.warn('Invalid date format:', isoString);
    return 'Tidak diketahui';
  }
  
  const now = new Date();
  const diffMs = now - date;
  
  // ✅ Handle negative difference (future time) - should not happen but just in case
  if (diffMs < 0) {
    return 'Baru saja';
  }
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  
  // ✅ Format tanggal dengan timezone lokal Indonesia
  return date.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
}

/**
 * ✅ Get manga cover from manga-config.js
 */
function getMangaCover(mangaId) {
  const manga = mangaList.find(m => m.id === mangaId);
  if (!manga) return 'assets/Logo 2.png';
  
  // Return original URL directly to avoid CDN issues
  // CDN will be handled by getResponsiveCDN when needed
  return manga.cover;
}

/**
 * ✅ Render history list
 */
function renderHistoryList(history) {
  const listEl = document.getElementById('historyList');
  
  if (!history || history.length === 0) {
    return;
  }
  
  listEl.innerHTML = history.map(item => {
    const cover = getMangaCover(item.manga_id);
    const chapterNum = item.chapter_id.replace(/^ch\.?/i, '');
    const timeAgo = formatRelativeTime(item.read_at);
    
    return `
      <div class="history-card" 
           data-manga-id="${item.manga_id}" 
           data-chapter="${item.chapter_id}"
           tabindex="0"
           role="button">
        <img src="${cover}" 
             alt="${item.manga_title} cover" 
             class="history-cover"
             loading="lazy"
             data-original="${cover}"
             onerror="this.onerror=null; this.src='assets/Logo 2.png';">
        <div class="history-info">
          <div class="history-manga-title">${item.manga_title}</div>
          <div class="history-chapter">Chapter ${chapterNum}</div>
          <div class="history-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  listEl.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const mangaId = card.getAttribute('data-manga-id');
      const chapterId = card.getAttribute('data-chapter');
      window.location.href = `reader.html?repo=${mangaId}&chapter=${chapterId}`;
    });
    
    // Keyboard support
    card.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

/**
 * ✅ Show history modal with expand/collapse toggle
 */
let currentHistoryLimit = 3; // Track current state

async function showHistoryModal(expandAll = false) {
  dLog('📖 [HISTORY] Opening modal...', expandAll ? '(expand all)' : '(show 3)');
  
  const historyModal = document.getElementById('historyModal');
  const historyLoading = document.getElementById('historyLoading');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const historyTitle = historyModal.querySelector('.history-title');
  const btnCloseHistory = document.getElementById('btnCloseHistory');
  
  // ✅ Determine limit
  const limit = expandAll ? 0 : 3; // 0 = fetch all
  currentHistoryLimit = limit;
  
  dLog('🔢 [HISTORY] Using limit:', limit);
  
  // Show modal with loading
  historyModal.style.display = 'flex';
  historyLoading.style.display = 'block';
  historyList.style.display = 'none';
  historyEmpty.style.display = 'none';
  
  // ✅ Lock body scroll when modal is open
  document.body.style.overflow = 'hidden';
  
  // Fetch history (skip cache when toggling)
  const data = await fetchReadingHistory(limit, true);
  const { history, total, showing } = data;
  
  // Hide loading
  historyLoading.style.display = 'none';
  
  if (history.length === 0) {
    historyEmpty.style.display = 'block';
    if (historyTitle) {
      historyTitle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        History Baca
      `;
    }
  } else {
    historyList.style.display = 'flex';
    renderHistoryList(history);
    
    // ✅ Update title with count
    if (historyTitle) {
      historyTitle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        History Baca (${showing}${total > showing ? `/${total}` : ''})
      `;
    }
    
    // ✅ Add/Update toggle button
    let btnToggle = historyModal.querySelector('#btnToggleHistory');
    
    if (!btnToggle && btnCloseHistory) {
      btnToggle = document.createElement('button');
      btnToggle.id = 'btnToggleHistory';
      btnToggle.className = 'btn-toggle-history';
      btnCloseHistory.parentNode.insertBefore(btnToggle, btnCloseHistory);
    }
    
    // ✅ Update button text based on state
    if (total > 3 && btnToggle) {
      btnToggle.style.display = 'block';
      
      if (expandAll) {
        // Show "collapse" button
        btnToggle.innerHTML = `TAMPILKAN 3 TERAKHIR`;
        btnToggle.onclick = () => showHistoryModal(false);
      } else {
        // Show "expand" button
        btnToggle.innerHTML = `TAMPILKAN SEMUA (${total})`;
        btnToggle.onclick = () => showHistoryModal(true);
      }
    } else {
      // Hide toggle if total <= 3
      if (btnToggle) btnToggle.style.display = 'none';
    }
  }
}

/**
 * ✅ History button click handler
 */
document.addEventListener('click', (e) => {
  if (e.target.id === 'btnHistory' || e.target.closest('#btnHistory')) {
    dLog('🖱️ [HISTORY] Button clicked');
    
    const profileModal = document.getElementById('profileModal');
    if (profileModal) profileModal.style.display = 'none';
    
    showHistoryModal(false); // Start with 3 items
  }
});

/**
 * ✅ Close history modal helper function
 */
function closeHistoryModal() {
  const historyModal = document.getElementById('historyModal');
  if (historyModal) {
    historyModal.style.display = 'none';
    // ✅ Restore body scroll when modal is closed
    document.body.style.overflow = '';
    dLog('✅ [HISTORY] Modal closed, scroll restored');
  }
}

/**
 * ✅ Close history modal
 */
document.addEventListener('click', (e) => {
  const historyModal = document.getElementById('historyModal');
  
  // Close on overlay click
  if (e.target.id === 'historyModal') {
    closeHistoryModal();
  }
  
  // Close on button click
  if (e.target.id === 'btnCloseHistory') {
    closeHistoryModal();
  }
});

// ✅ Close history modal on Escape key
document.addEventListener('keydown', (e) => {
  const historyModal = document.getElementById('historyModal');
  if (historyModal && historyModal.style.display === 'flex' && e.key === 'Escape') {
    closeHistoryModal();
  }
});

// ============================================
// DEBUG: PASTE EVENT untuk VIP Code Input
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Tambahkan delay untuk memastikan modal sudah di-render
    setTimeout(() => {
        const vipInput = document.getElementById('inputVIPCode');
        
        if (vipInput) {
            dLog('🔧 [PASTE-DEBUG] VIP input found, adding listeners');
            
            // Paste event
            vipInput.addEventListener('paste', (e) => {
                dLog('📋 [PASTE] ========================================');
                dLog('📋 [PASTE] Paste event triggered');
                dLog('📋 [PASTE] Time:', new Date().toISOString());
                dLog('📋 [PASTE] Event:', e);
                dLog('📋 [PASTE] ClipboardData:', e.clipboardData);
                
                const pastedText = e.clipboardData.getData('text');
                dLog('📋 [PASTE] Pasted text:', pastedText);
                dLog('📋 [PASTE] Text length:', pastedText.length);
                dLog('📋 [PASTE] Current input value BEFORE:', vipInput.value);
                
                // Let browser handle paste naturally, then log result
                setTimeout(() => {
                    dLog('📋 [PASTE] Current input value AFTER:', vipInput.value);
                    dLog('📋 [PASTE] ========================================');
                }, 10);
            });
            
            // Input event (triggers on any input change including paste)
            vipInput.addEventListener('input', (e) => {
                dLog('⌨️ [INPUT] Input changed');
                dLog('⌨️ [INPUT] New value:', e.target.value);
                dLog('⌨️ [INPUT] Value length:', e.target.value.length);
            });
            
            // Focus/Blur for debugging
            vipInput.addEventListener('focus', () => {
                dLog('👁️ [FOCUS] VIP input focused');
            });
            
            vipInput.addEventListener('blur', () => {
                dLog('👁️ [BLUR] VIP input blurred');
                dLog('👁️ [BLUR] Final value:', vipInput.value);
            });
            
            dLog('✅ [PASTE-DEBUG] All listeners added to VIP input');
        } else {
            dWarn('⚠️ [PASTE-DEBUG] VIP input not found on first check');
            dWarn('⚠️ [PASTE-DEBUG] This is normal if modal not opened yet');
        }
    }, 500);
});
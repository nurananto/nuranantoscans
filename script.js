// ============================================
// SCRIPT.JS - NURANANTO SCANLATION
// ============================================
// Note: Uses common.js for shared utilities (DEBUG_MODE, fetchFreshJSON, cache functions, etc.)

// ✅ TEST FUNCTION: Test manga type reading
// Usage: testMangaType('Waka-chan') or testMangaType('waka-chan')
async function testMangaType(repoName) {
  dLog(`🧪 Testing manga type for repo: ${repoName}`);
  
  try {
    const mangaData = await fetchMangaData(repoName);
    
    dLog('📦 Full mangaData:', mangaData);
    dLog('📖 mangaData.manga:', mangaData.manga);
    dLog('🏷️ mangaData.manga.type:', mangaData.manga?.type || 'NOT SET');
    
    const mangaType = (mangaData.manga && mangaData.manga.type) ? mangaData.manga.type : 'manga';
    const isWebtoon = mangaType.toLowerCase() === 'webtoon';
    
    dLog(`✅ Detected Type: ${mangaType}`);
    dLog(`✅ Is Webtoon: ${isWebtoon}`);
    dLog(`✅ Badge Text: ${isWebtoon ? 'Berwarna' : 'Hitam Putih'}`);
    dLog(`✅ Badge Class: ${isWebtoon ? 'type-badge-webtoon' : 'type-badge-manga'}`);
    
    // Find manga in config
    const manga = mangaList.find(m => m.repo === repoName || m.id === repoName.toLowerCase().replace(/\s+/g, '-'));
    if (manga) {
      dLog(`📚 Manga Config:`, manga);
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
    let top3Chapters = []; // ✅ NEW: Store top 3 chapters
    
    if (data.chapters) {
      const chaptersArray = Object.values(data.chapters);
      
      // ✅ NEW: Get top 3 chapters sorted by chapter number (highest first)
      const sortedChapters = [...chaptersArray].sort((a, b) => {
        const getSort = (folder) => {
          const parts = folder.split('.');
          const int = parseInt(parts[0]) || 0;
          const dec = parts[1] ? parseInt(parts[1]) : 0;
          return int + (dec / 1000);
        };
        return getSort(b.folder) - getSort(a.folder);
      });
      top3Chapters = sortedChapters.slice(0, 3);
      
      // ✅ DEBUG: Log top3Chapters
      if (DEBUG_MODE) {
        dLog(`📚 [TOP3] Repo: ${repo}, Top 3 chapters:`, top3Chapters.map(ch => ch.folder));
      }
      
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
      top3Chapters, // ✅ NEW: Include top 3 chapters
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
      top3Chapters: [], // ✅ NEW: Empty array for fallback
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

// ✅ NEW: Check if chapter is updated within 48 hours
function isChapterRecent(uploadDateStr) {
  if (!uploadDateStr) return false;
  const uploadDate = new Date(uploadDateStr);
  if (!uploadDate || isNaN(uploadDate.getTime())) return false;
  
  const now = new Date();
  const wibNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  const diffMs = wibNow - uploadDate;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours <= 48; // Within 48 hours
}

function getRelativeTime(lastChapterUpdateStr) {
  if (!lastChapterUpdateStr) return '';
  const lastChapterUpdate = new Date(lastChapterUpdateStr);
  const now = new Date();
  const diffMs = now - lastChapterUpdate;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) return `${diffMins} menit`;
  if (diffHours < 24) return `${diffHours} jam`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari`;
  
  return lastChapterUpdate.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short',
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

// ========================================
// TRENDING SECTION - TOP 5 MOST VIEWED (24 HOURS)
// ========================================

/**
 * Create Trending Card HTML (Landscape Layout)
 */
function createTrendingCard(manga, mangaData, views24h, rank) {
  const cdnUrls = getResponsiveCDN(manga.cover);
  
  // Get manga details
  const title = mangaData.manga?.title || manga.title || 'Unknown Title';
  const genres = mangaData.manga?.genre || [];
  const genresText = genres.length > 0 ? genres.join(', ') : 'Genre not available';
  const synopsis = mangaData.manga?.description || 'Sinopsis tidak tersedia.';
  const status = (mangaData.manga?.status || 'ONGOING').toUpperCase();
  const dailyViews = views24h || 0; // ✅ FIX: Use daily views instead of total views
  
  // Status badge class
  let statusClass = 'status-ongoing';
  let statusText = 'Ongoing';
  if (status === 'HIATUS') {
    statusClass = 'status-hiatus';
    statusText = 'Hiatus';
  } else if (status === 'COMPLETED' || status === 'TAMAT' || status === 'END') {
    statusClass = 'status-completed';
    statusText = 'Tamat';
  }
  
  // Create wrapper for ranking label + card
  const wrapper = document.createElement('div');
  wrapper.className = 'trending-card-wrapper';
  
  // Create header with rank label and views
  const header = document.createElement('div');
  header.className = 'trending-card-header';
  header.innerHTML = `
    <div class="trending-rank-label">Populer #${rank}</div>
    <div class="trending-views-counter">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span>${dailyViews.toLocaleString('id-ID')} views (24h)</span>
    </div>
  `;
  
  const card = document.createElement('div');
  card.className = 'trending-card';
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${escapeHTML(title)} - ${statusText}`);
  
  card.innerHTML = `
    <div class="trending-card-left">
      <div class="trending-badges-container">
        <span class="trending-status-badge ${statusClass}">${statusText}</span>
      </div>
      <h3 class="trending-card-title">${escapeHTML(title)}</h3>
      <div class="trending-card-genres">${escapeHTML(genresText)}</div>
      <div class="trending-card-synopsis-label">Sinopsis</div>
      <p class="trending-card-synopsis">${escapeHTML(synopsis)}</p>
    </div>
    <div class="trending-card-right">
      <img 
        src="${escapeHTML(cdnUrls.medium)}" 
        srcset="${escapeHTML(cdnUrls.small)} 500w, ${escapeHTML(cdnUrls.medium)} 700w"
        sizes="(max-width: 768px) 200px, 180px"
        alt="Cover ${escapeHTML(title)}" 
        class="trending-card-cover"
        loading="eager"
        onerror="if(this.src!=='${escapeHTML(manga.cover)}'){this.src='${escapeHTML(manga.cover)}';this.srcset='';}else{this.onerror=null;}"
      />
    </div>
  `;
  
  // Click handler for card (not button) - with drag prevention
  card.addEventListener('click', (e) => {
    // Ignore if clicking on button or anchor
    if (e.target.closest('.trending-view-more')) return;
    
    // Check if this was a drag action
    const container = document.getElementById('trendingContainer');
    if (container && container.classList.contains('is-dragging')) return;
    
    if (validateRepoParam(manga.id)) {
      window.location.href = `info-manga.html?repo=${encodeURIComponent(manga.id)}`;
    }
  });
  
  // Append header and card to wrapper
  wrapper.appendChild(header);
  wrapper.appendChild(card);
  
  return wrapper;
}

/**
 * Render Trending - Top 5 Most Viewed (24 hours)
 */
async function renderTrending(mangaList) {
  const container = document.getElementById('trendingContainer');
  if (!container) return;
  
  try {
    // Show loading
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 2rem;">Memuat trending...</p>';
    
    // Fetch all manga data with 24h views
    const mangaWithData = await Promise.all(
      mangaList.map(async (manga) => {
        try {
          const mangaData = await fetchMangaData(manga.repo);
          const views24h = await calculate24HourViews(manga.repo);
          const lastUpdate = mangaData.lastChapterUpdate ? new Date(mangaData.lastChapterUpdate) : new Date(0);
          return { manga, mangaData, views24h, lastUpdate };
        } catch (error) {
          console.error(`Error fetching data for ${manga.repo}:`, error);
          return { manga, mangaData: { manga: {} }, views24h: 0, lastUpdate: new Date(0) };
        }
      })
    );
    
    if (DEBUG_MODE) {
      dLog('📊 Trending data:', mangaWithData.map(m => ({ repo: m.manga.repo, views: m.views24h })));
    }
    
    // Always sort by 24h views (descending) and take top 5
    // Manga with higher views will be shown first, those with 0 views will be at the end
    const trending = mangaWithData
      .sort((a, b) => {
        // Primary sort: by views (descending)
        if (b.views24h !== a.views24h) {
          return b.views24h - a.views24h;
        }
        // Secondary sort: by latest update (descending)
        return b.lastUpdate - a.lastUpdate;
      })
      .slice(0, 5);
    
    // Clear container
    container.innerHTML = '';
    
    // Render cards with ranking
    const fragment = document.createDocumentFragment();
    trending.forEach((item, index) => {
      const cardWrapper = createTrendingCard(item.manga, item.mangaData, item.views24h, index + 1);
      fragment.appendChild(cardWrapper);
    });
    
    container.appendChild(fragment);
    
    // Generate pagination dots
    updateTrendingDots(trending.length);
    
    // Enable drag scroll
    enableTrendingMouseDrag();
    
  } catch (error) {
    console.error('Error rendering Trending:', error);
    container.innerHTML = '<p style="text-align: center; color: #dc2626; padding: 2rem;">Gagal memuat trending</p>';
  }
}

/**
 * Update Trending Pagination Dots
 */
function updateTrendingDots(totalCards) {
  const dotsContainer = document.getElementById('trendingDots');
  if (!dotsContainer) return;
  
  dotsContainer.innerHTML = '';
  
  for (let i = 0; i < totalCards; i++) {
    const dot = document.createElement('div');
    dot.className = 'trending-dot';
    if (i === 0) dot.classList.add('active');
    
    dot.addEventListener('click', () => {
      const container = document.getElementById('trendingContainer');
      if (container) {
        const cardWidth = container.scrollWidth / totalCards;
        container.scrollTo({
          left: cardWidth * i,
          behavior: 'smooth'
        });
      }
    });
    
    dotsContainer.appendChild(dot);
  }
  
  // Listen to scroll to update active dot
  const container = document.getElementById('trendingContainer');
  if (container) {
    container.addEventListener('scroll', () => {
      const cardWidth = container.scrollWidth / totalCards;
      const currentIndex = Math.round(container.scrollLeft / cardWidth);
      
      const dots = dotsContainer.querySelectorAll('.trending-dot');
      dots.forEach((dot, index) => {
        if (index === currentIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    });
  }
}

/**
 * Enable mouse drag scroll for Trending
 */
function enableTrendingMouseDrag() {
  const container = document.getElementById('trendingContainer');
  if (!container) return;
  
  let isDown = false;
  let startX;
  let scrollLeft;
  let hasMoved = false;
  
  container.addEventListener('mousedown', (e) => {
    // Prevent default to avoid text selection and image drag
    e.preventDefault();
    isDown = true;
    hasMoved = false;
    container.style.cursor = 'grabbing';
    // Don't add is-dragging immediately - wait for actual movement
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
    
    // If no movement, remove is-dragging immediately
    if (!hasMoved) {
      container.classList.remove('is-dragging');
      return;
    }
    
    // Snap to nearest card after drag
    const cards = container.querySelectorAll('.trending-card');
    const containerWidth = container.offsetWidth;
    const currentScroll = container.scrollLeft;
    const nearestCardIndex = Math.round(currentScroll / containerWidth);
    
    container.scrollTo({
      left: nearestCardIndex * containerWidth,
      behavior: 'smooth'
    });
    
    // Remove is-dragging after a short delay to prevent click
    setTimeout(() => {
      container.classList.remove('is-dragging');
      setTimeout(() => {
        hasMoved = false;
      }, 50);
    }, 50);
  });
  
  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    
    const x = e.pageX - container.offsetLeft;
    const moved = Math.abs(x - startX);
    
    // Lower threshold for better responsiveness
    if (moved > 2) {
      if (!hasMoved) {
        // First movement detected - now we're dragging
        hasMoved = true;
        container.classList.add('is-dragging');
      }
      const walk = (x - startX) * 1.5;
      container.scrollLeft = scrollLeft - walk;
    }
  });
  
  // Prevent click if dragged
  container.addEventListener('click', (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  
  // Snap to nearest card on scroll end
  let scrollTimeout;
  container.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const containerWidth = container.offsetWidth;
      const currentScroll = container.scrollLeft;
      const nearestCardIndex = Math.round(currentScroll / containerWidth);
      
      // Only snap if not already at the right position
      const targetScroll = nearestCardIndex * containerWidth;
      if (Math.abs(currentScroll - targetScroll) > 5) {
        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    }, 100);
  });
}

// ========================================
// TOP 5 MOST VIEWED (24 HOURS)
// ========================================

function createCard(manga, mangaData, index = 0) {
  const isRecent = isRecentlyUpdated(mangaData.lastChapterUpdate);
  
  // ✅ Check if user is donatur setia (use cached status)
  const isDonaturSetia = isDonaturFromDOM();
  
  // ✅ Security: Validate and escape all dynamic data
  const safeRepoId = validateRepoParam(manga.id) ? encodeURIComponent(manga.id) : '';
  const safeMangaTitle = escapeHTML(manga.title);
  
  const cdnUrls = getResponsiveCDN(manga.cover);
  
  // ✅ Get top 3 chapters
  const top3Chapters = mangaData.top3Chapters || [];
  
  // ✅ DEBUG: Log chapters availability
  if (DEBUG_MODE) {
    dLog(`🎯 [CARD] Manga: ${manga.title}, Top3 chapters count: ${top3Chapters.length}`);
  }
  
  // ✅ Build chapters HTML
  let chaptersHTML = '';
  if (top3Chapters.length > 0) {
    chaptersHTML = top3Chapters.map((chapter, idx) => {
      const chapterNumber = formatChapter(chapter.folder);
      const chapterText = chapterNumber === 'Oneshot' ? 'Oneshot' : 'Ch. ' + chapterNumber;
      const timeText = getRelativeTime(chapter.uploadDate) || '';
      const lockIcon = chapter.locked ? (isDonaturSetia ? '🔓' : '🔒') : '';
      
      // ✅ Badge UP for chapters updated within 48 hours (with glowing)
      const isChapterNew = isChapterRecent(chapter.uploadDate);
      const upBadgeHTML = isChapterNew ? `
        <div class="manga-chapter-badge-up">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          UP
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </div>
      ` : '';
      
      const safeChapterText = escapeHTML(`${lockIcon}${chapterText}`);
      const safeTimeText = escapeHTML(timeText);
      const safeChapterFolder = escapeHTML(chapter.folder);
      
      // ✅ Handle locked chapter - add onclick handler
      const onclickHandler = chapter.locked 
        ? `onclick="handleChapterClick(event, '${safeRepoId}', '${safeChapterFolder}', true); return false;"`
        : `onclick="event.stopPropagation()"`;
      
      return `
        <a href="reader.html?repo=${safeRepoId}&chapter=${safeChapterFolder}" 
           class="manga-chapter-item"
           data-locked="${chapter.locked ? 'true' : 'false'}"
           data-repo="${safeRepoId}"
           data-chapter="${safeChapterFolder}"
           ${onclickHandler}>
          <div class="manga-chapter-left">
            <span class="manga-chapter-text">${safeChapterText}</span>
            ${upBadgeHTML}
          </div>
          <span class="manga-chapter-time">${safeTimeText}</span>
        </a>
      `;
    }).join('');
  } else {
    chaptersHTML = '<div style="color: #888; font-size: 0.9rem; padding: 1rem;">No chapters available</div>';
  }
  
  const eagerLoadCount = 10; // First 10 items
  const loadingAttr = index < eagerLoadCount ? 'eager' : 'lazy';
  const fetchPriority = index < eagerLoadCount ? ' fetchpriority="high"' : '';
  const decodingAttr = index < eagerLoadCount ? ' decoding="sync"' : ' decoding="async"';
  
  // Determine manga type badge
  const mangaType = (manga.type || 'manga').toLowerCase();
  let typeBadge = '';
  
  if (mangaType === 'webtoon' || mangaType === 'colour') {
    typeBadge = '<div class="manga-type-badge badge-colour">COLOUR</div>';
  } else if (mangaType === 'manga' || mangaType === 'bw') {
    typeBadge = '<div class="manga-type-badge badge-bw">B/W</div>';
  }
  
  // Determine status badge (below cover)
  const mangaStatus = (mangaData.manga?.status || mangaData.status || 'ONGOING').toUpperCase();
  let statusBadge = '';
  let statusClass = 'status-ongoing';
  let statusText = 'Ongoing';
  
  if (mangaStatus === 'HIATUS') {
    statusClass = 'status-hiatus';
    statusText = 'Hiatus';
  } else if (mangaStatus === 'COMPLETED' || mangaStatus === 'TAMAT' || mangaStatus === 'END') {
    statusClass = 'status-completed';
    statusText = 'Tamat';
  }
  
  statusBadge = `<div class="manga-card-status-badge ${statusClass}">${statusText}</div>`;
  
  return `
    <div class="manga-card-horizontal" data-manga-id="${escapeHTML(manga.id)}">
      <a href="info-manga.html?repo=${safeRepoId}" class="manga-card-title-link">
        <h3 class="manga-card-title-text">${safeMangaTitle}</h3>
      </a>
      <div class="manga-card-content">
        <div class="manga-card-cover-wrapper">
          <a href="info-manga.html?repo=${safeRepoId}" class="manga-card-cover-link">
            <img 
              src="${escapeHTML(cdnUrls.medium)}"
              alt="${safeMangaTitle} cover"
              loading="${loadingAttr}"
              ${fetchPriority}
              ${decodingAttr}
              class="manga-card-cover-img"
              onerror="if(this.src!=='${escapeHTML(manga.cover)}'){this.src='${escapeHTML(manga.cover)}';this.srcset='';}else{this.onerror=null;}">
            ${typeBadge}
          </a>
          ${statusBadge}
        </div>
        <div class="manga-card-chapters">
          ${chaptersHTML}
        </div>
      </div>
    </div>`;
}

async function calculate24HourViews(repo) {
  try {
    const cacheKey = `daily_${repo}`;
    const cached = getCachedData(cacheKey, 300000); // 5 min cache (reduced from 10)
    
    if (cached !== null) {
      if (DEBUG_MODE) {
        dLog(`📊 [CACHE HIT] ${repo}: ${cached} views`);
      }
      return cached;
    }
    
    // ✅ CACHE MISS - Fetch fresh
    const url = `https://raw.githubusercontent.com/nurananto/${repo}/main/daily-views.json`;
    const data = await fetchFreshJSON(url);
    
    if (!data || !data.dailyRecords) {
      if (DEBUG_MODE) {
        dLog(`📊 No daily views data for ${repo}`);
      }
      setCachedData(cacheKey, 0);
      return 0;
    }
    
    // Get all available dates sorted descending (newest first)
    const availableDates = Object.keys(data.dailyRecords).sort().reverse();
    
    if (DEBUG_MODE) {
      dLog(`📊 Available dates for ${repo}:`, availableDates.slice(0, 3));
    }
    
    if (availableDates.length === 0) {
      if (DEBUG_MODE) {
        dLog(`📊 No records found for ${repo}`);
      }
      setCachedData(cacheKey, 0);
      return 0;
    }
    
    // Get the most recent date (first in sorted descending array)
    const latestDate = availableDates[0];
    const latestRecord = data.dailyRecords[latestDate];
    const result = latestRecord ? (latestRecord.manga || 0) : 0;
    
    if (DEBUG_MODE) {
      dLog(`📊 Daily views for ${repo}: ${result} views (date: ${latestDate})`);
    }
    
    // ✅ SAVE TO CACHE
    setCachedData(cacheKey, result);
    return result;
    
  } catch (error) {
    if (DEBUG_MODE) {
      dWarn(`⚠️ Error fetching daily views for ${repo}:`, error);
    }
    const staleCache = getCachedData(`daily_${repo}`, Infinity);
    if (staleCache !== null) {
      if (DEBUG_MODE) {
        dWarn(`⚠️ Using stale cache for ${repo}: ${staleCache}`);
      }
      return staleCache;
    }
    return 0;
  }
}

// ============================================
// PAGINATION SYSTEM
// ============================================

let currentMangaData = []; // Store current manga data for pagination
let currentPage = 0;

/**
 * Get items per page - Fixed at 10 for new layout
 */
function getItemsPerPage() {
  return 10; // Fixed at 10 items per page
}

/**
 * Render pagination with pages
 */
function renderPagination(mangaWithData) {
  const mangaGrid = document.getElementById("mangaGrid");
  const paginationControls = document.getElementById("paginationControls");
  
  const itemsPerPage = getItemsPerPage();
  const totalPages = Math.ceil(mangaWithData.length / itemsPerPage);
  
  // Store manga data for pagination
  currentMangaData = mangaWithData;
  currentPage = 0;
  
  // Render first page
  renderCurrentPage();
  
  // Show/hide pagination controls
  if (totalPages <= 1) {
    paginationControls.style.display = 'none';
  } else {
    paginationControls.style.display = 'flex';
    updatePaginationUI();
  }
}

/**
 * Render current page
 */
function renderCurrentPage() {
  const mangaGrid = document.getElementById("mangaGrid");
  const itemsPerPage = getItemsPerPage();
  const startIdx = currentPage * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, currentMangaData.length);
  const pageItems = currentMangaData.slice(startIdx, endIdx);
  
  const pageDiv = document.createElement('div');
  pageDiv.className = 'manga-list-page';
  pageDiv.innerHTML = pageItems.map(({ manga, mangaData }, index) => 
    createCard(manga, mangaData, startIdx + index)
  ).join("");
  
  // Replace content
  mangaGrid.innerHTML = '';
  mangaGrid.appendChild(pageDiv);
  
  // Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Go to specific page
 */
function goToPage(pageIndex) {
  const itemsPerPage = getItemsPerPage();
  const totalPages = Math.ceil(currentMangaData.length / itemsPerPage);
  
  if (pageIndex < 0 || pageIndex >= totalPages) return;
  
  currentPage = pageIndex;
  renderCurrentPage();
  updatePaginationUI();
}

/**
 * Update pagination UI with buttons
 */
function updatePaginationUI() {
  const itemsPerPage = getItemsPerPage();
  const totalPages = Math.ceil(currentMangaData.length / itemsPerPage);
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  const pageIndicator = document.getElementById("pageIndicator");
  
  if (!prevBtn || !nextBtn || !pageIndicator) return;
  
  // Update button states
  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage >= totalPages - 1;
  
  // Update page indicator
  pageIndicator.textContent = `Page ${currentPage + 1} of ${totalPages}`;
}

/**
 * Setup pagination event listeners
 */
function setupPaginationListeners() {
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      goToPage(currentPage - 1);
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      goToPage(currentPage + 1);
    });
  }
  
  // Keyboard navigation (arrow keys)
  document.addEventListener('keydown', (e) => {
    // Only handle if not in an input
    if (document.activeElement.tagName === 'INPUT') return;
    
    if (e.key === 'ArrowLeft' && currentPage > 0) {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight') {
      const itemsPerPage = getItemsPerPage();
      const totalPages = Math.ceil(currentMangaData.length / itemsPerPage);
      if (currentPage < totalPages - 1) {
        e.preventDefault();
        goToPage(currentPage + 1);
      }
    }
  });
}

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
    document.getElementById("paginationControls").style.display = 'none';
    return;
  }
  
  // Store current data for pagination
  currentMangaData = mangaWithData;
  currentPage = 0;
  
  // Render with pagination
  renderPagination(mangaWithData);
}

/**
 * Setup Keyboard Navigation
 */
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    const focusedElement = document.activeElement;
    
    if (focusedElement && (focusedElement.classList.contains('manga-card') || focusedElement.classList.contains('trending-card'))) {
      const cards = Array.from(document.querySelectorAll('.manga-card, .trending-card'));
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
 * Enable mouse drag scroll for Trending
 */
/**
 * Enable mouse drag scroll for Manga List
 */
function enableMangaListMouseDrag() {
  const container = document.getElementById('mangaGrid');
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
  
  // Prevent click if dragged
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
  
  // ✅ Clear old manga cache to force refresh with top3Chapters
  if (DEBUG_MODE) {
    dLog('🔄 Clearing old manga cache to fetch fresh data with top3Chapters...');
  }
  mangaList.forEach(manga => {
    const cacheKey = `manga_${manga.repo}`;
    const cached = getCachedData(cacheKey, Infinity);
    // Only clear if cache exists but doesn't have top3Chapters
    if (cached && !cached.top3Chapters) {
      if (DEBUG_MODE) {
        dLog(`🗑️ Clearing cache for ${manga.repo} (missing top3Chapters)`);
      }
      localStorage.removeItem(cacheKey);
    }
  });
 
  setupKeyboardNavigation();
  setupSearchAccessibility();
  setupPaginationListeners(); // ✅ Setup pagination
  
  // Render trending section
  renderTrending(mangaList);
  
  // Render manga list
  renderMangaList(mangaList);

  const searchInput = document.getElementById("searchInput");
  let currentSearch = '';
  let isSearching = false;
  const searchCache = {};
  
  searchInput.addEventListener("input", function() {
    clearTimeout(searchTimeout);
    const query = this.value.toLowerCase().trim();
    currentSearch = query;
    
    const mangaGrid = document.getElementById("mangaGrid");
    const paginationControls = document.getElementById("paginationControls");
    
    searchTimeout = setTimeout(async () => {
      if (isSearching) return;
      isSearching = true;
      
      try {
        if (query === '') {
          await renderMangaList(mangaList, false);
        } else {
          // Check cache first
          if (searchCache[query]) {
            if (currentSearch === query) {
              currentMangaData = searchCache[query];
              currentPage = 0;
              renderPagination(searchCache[query]);
            }
            return;
          }
          
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
              paginationControls.style.display = 'none';
            } else {
              // ✅ Use pagination for search results
              searchCache[query] = mangaWithData;
              currentMangaData = mangaWithData;
              currentPage = 0;
              renderPagination(mangaWithData);
            }
          }
        }
      } finally {
        isSearching = false;
      }
    }, 150);
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

  // Anti-debugger: pause execution when DevTools is open
  setInterval(function() {
      debugger;
  }, 1000);

  dLog('🔒 Protection enabled');
}

initProtection();


// ============================================
// UPGRADE & CODE MODAL HANDLERS (GLOBAL)
// ============================================

// ✅ Close loginRequiredModal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnCloseLoginRequired') {
        const loginRequiredModal = document.getElementById('loginRequiredModal');
        if (loginRequiredModal) {
            loginRequiredModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
});

// ✅ Open login modal from loginRequiredModal
document.addEventListener('click', (e) => {
    if (e.target.id === 'btnLoginFromRequired') {
        const loginRequiredModal = document.getElementById('loginRequiredModal');
        const loginModal = document.getElementById('loginModal');
        
        if (loginRequiredModal) loginRequiredModal.style.display = 'none';
        if (loginModal) {
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
});

// ✅ Close loginRequiredModal on overlay click
document.addEventListener('click', (e) => {
    const loginRequiredModal = document.getElementById('loginRequiredModal');
    if (loginRequiredModal && e.target === loginRequiredModal) {
        loginRequiredModal.style.display = 'none';
        document.body.style.overflow = '';
    }
});

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
                showToast(data.message, 'success', 4000);
                
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

    // ✅ Function to update profile button text
    function updateProfileButtonText() {
        console.log('🔄 [BUTTON-UPDATE] ======================================== START');
        const storedUser = localStorage.getItem('user');
        console.log('🔄 [BUTTON-UPDATE] storedUser from localStorage:', storedUser);
        const isLoggedIn = !!storedUser;
        console.log('🔄 [BUTTON-UPDATE] isLoggedIn:', isLoggedIn);
        
        // Update desktop button
        console.log('🔄 [BUTTON-UPDATE] Updating desktop button...');
        const desktopButtonText = btnOpen.querySelector('.button-text');
        console.log('🔄 [BUTTON-UPDATE] Desktop button element:', desktopButtonText);
        if (desktopButtonText) {
            const newText = isLoggedIn ? 'Profile' : 'Login';
            console.log('🔄 [BUTTON-UPDATE] Setting desktop button text to:', newText);
            desktopButtonText.textContent = newText;
            console.log('🔄 [BUTTON-UPDATE] Desktop button text now:', desktopButtonText.textContent);
        } else {
            console.error('❌ [BUTTON-UPDATE] Desktop button .button-text NOT FOUND!');
        }
        
        // Update mobile button
        console.log('🔄 [BUTTON-UPDATE] Updating mobile button...');
        const btnOpenMobile = document.getElementById('btnOpenLoginMobile');
        console.log('🔄 [BUTTON-UPDATE] Mobile button element:', btnOpenMobile);
        if (btnOpenMobile) {
            const mobileButtonText = btnOpenMobile.querySelector('span');
            console.log('🔄 [BUTTON-UPDATE] Mobile button span:', mobileButtonText);
            if (mobileButtonText) {
                const newText = isLoggedIn ? 'Profile' : 'Login';
                console.log('🔄 [BUTTON-UPDATE] Setting mobile button text to:', newText);
                mobileButtonText.textContent = newText;
                console.log('🔄 [BUTTON-UPDATE] Mobile button text now:', mobileButtonText.textContent);
            } else {
                console.error('❌ [BUTTON-UPDATE] Mobile button span NOT FOUND!');
            }
        } else {
            console.log('ℹ️ [BUTTON-UPDATE] Mobile button not found (may not exist on this page)');
        }
        
        console.log('✅ [BUTTON-UPDATE] Profile button updated to:', isLoggedIn ? 'Profile' : 'Login');
        console.log('🔄 [BUTTON-UPDATE] ======================================== END');
    }
    
    // ✅ Make function globally accessible
    window.updateProfileButtonText = updateProfileButtonText;
    console.log('✅ [MAIN] updateProfileButtonText added to window object');

    // ✅ STEP 1: Check localStorage on page load and update button
    console.log('📦 [PAGE-LOAD] ======================================== START');
    console.log('📦 [PAGE-LOAD] Checking localStorage on page load...');
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');
    const storedEmail = localStorage.getItem('userEmail');
    const storedUsername = localStorage.getItem('username');
    console.log('📦 [PAGE-LOAD] localStorage contents:');
    console.log('   - user:', storedUser);
    console.log('   - authToken:', storedToken ? 'EXISTS (length: ' + storedToken.length + ')' : 'NULL');
    console.log('   - userEmail:', storedEmail);
    console.log('   - username:', storedUsername);
    console.log('📦 [PAGE-LOAD] Calling updateProfileButtonText()...');
    updateProfileButtonText();
    console.log('📦 [PAGE-LOAD] updateProfileButtonText() completed');
    
    console.log('📦 [PAGE-LOAD] Has token?', !!storedToken);
    
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            console.log('📦 [PAGE-LOAD] Parsed user object:', parsedUser);
        } catch (e) {
            console.error('❌ [PAGE-LOAD] JSON parse error:', e);
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
                    
                    // 🔥 Check status BEFORE showing modal to ensure fresh data
                    dLog('🔍 [CLICK] Refreshing donatur status before showing modal...');
                    await checkDonaturStatus();
                    dLog('✅ [CLICK] Status refreshed');
                    
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
        console.log('🎭 [PROFILE-MODAL] ======================================== START');
        console.log('🎭 [PROFILE-MODAL] showProfileModal CALLED');
        console.log('🎭 [PROFILE-MODAL] User parameter:', user);
        console.log('🎭 [PROFILE-MODAL] User type:', typeof user);
        
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
        
        // Update username (temporary - will be replaced by loadProfileData)
        const usernameEl = profileModal.querySelector('#profileUsername');
        if (usernameEl && user && user.username) {
            usernameEl.textContent = user.username;
            dLog('✅ [PROFILE] Username updated to (temporary):', user.username);
        }
        
        // 🔥 Update avatar from Google or localStorage
        const avatarEl = profileModal.querySelector('#profileAvatar');
        if (avatarEl) {
            // Priority: user.avatar_url > localStorage.userAvatar > default logo
            const googleAvatar = user && user.avatar_url && user.avatar_url !== 'null' ? user.avatar_url : null;
            const storedAvatar = localStorage.getItem('userAvatar');
            const hasStoredAvatar = storedAvatar && storedAvatar !== 'null' && storedAvatar !== 'undefined';
            
            console.log('🖼️ [PROFILE-MODAL] Avatar sources:');
            console.log('   - user.avatar_url:', googleAvatar || 'NONE');
            console.log('   - localStorage.userAvatar:', hasStoredAvatar ? storedAvatar : 'NONE');
            
            if (googleAvatar) {
                console.log('✅ [PROFILE-MODAL] Using Google avatar:', googleAvatar);
                avatarEl.src = googleAvatar;
                avatarEl.onerror = function() {
                    console.error('❌ [PROFILE-MODAL] Google avatar failed to load, using default');
                    this.src = 'assets/Logo 2.png';
                    this.onerror = null; // Prevent infinite loop
                };
            } else if (hasStoredAvatar) {
                console.log('✅ [PROFILE-MODAL] Using stored avatar:', storedAvatar);
                avatarEl.src = storedAvatar;
                avatarEl.onerror = function() {
                    console.error('❌ [PROFILE-MODAL] Stored avatar failed to load, using default');
                    this.src = 'assets/Logo 2.png';
                    this.onerror = null;
                };
            } else {
                console.log('✅ [PROFILE-MODAL] No avatar, using default logo');
                avatarEl.src = 'assets/Logo 2.png';
            }
        } else {
            // Avatar element not found - not an error, modal may not have avatar element
            dLog('ℹ️ [PROFILE-MODAL] Avatar element not found (optional)');
        }
        
        // ✅ Tampilkan modal DULU (sebelum check status) agar tidak stuck
        profileModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        dLog('✅ [PROFILE] Modal shown immediately');
        
        // 🔥 Load fresh profile data from database (avatar + display_name)
        if (typeof window.loadProfileData === 'function') {
            dLog('🔄 [PROFILE] Loading fresh profile data from database...');
            window.loadProfileData();
        } else {
            dLog('⚠️ [PROFILE] loadProfileData function not available');
        }
        
        // 🔥 Check edit eligibility and hide pencil if rate limited
        if (typeof window.checkEditEligibility === 'function') {
            dLog('🔍 [PROFILE] Checking edit eligibility...');
            window.checkEditEligibility();
        } else {
            dLog('⚠️ [PROFILE] checkEditEligibility function not available');
        }
        
        // 🔥 NOTE: Status checking is now handled BEFORE showProfileModal is called
        // No need to call checkDonaturStatus here to avoid double-call race condition
        // The status is already fresh from the login handler or caller
        
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
            localStorage.removeItem('userDonaturStatus'); // 🔥 Clear donatur status cache
            
            // 🆕 Stop periodic status check
            if (window.stopPeriodicStatusCheck) {
                window.stopPeriodicStatusCheck();
            }
            
            // 🔥 FORCE UPDATE DOM TO PEMBACA SETIA immediately
            const statusBox = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const btnUpgrade = document.getElementById('btnUpgrade');
            const countdownBox = document.getElementById('countdownBox');
            
            if (statusBox) statusBox.className = 'status-box pembaca-setia';
            if (statusText) statusText.textContent = 'PEMBACA SETIA';
            if (btnUpgrade) btnUpgrade.style.display = 'block';
            if (countdownBox) countdownBox.style.display = 'none';
            
            dLog('📢 [LOGOUT] DOM status updated to PEMBACA SETIA');
            
            // 🔥 RESET PROFILE PHOTO AND USERNAME TO DEFAULT
            const profileAvatar = document.querySelector('.profile-avatar');
            const profileUsername = document.getElementById('profileUsername');
            
            if (profileAvatar) {
                profileAvatar.src = 'assets/Logo 2.png';
                dLog('📢 [LOGOUT] Profile avatar reset to default');
            }
            
            if (profileUsername) {
                profileUsername.textContent = 'Username';
                dLog('📢 [LOGOUT] Profile username reset to default');
            }
            
            // ✅ Update profile button text
            if (window.updateProfileButtonText) {
                window.updateProfileButtonText();
            }
            
            // ✅ Clear notification badge
            if (window.updateNotificationBadge) {
                window.updateNotificationBadge();
            }
            
            // Clear countdown interval on logout
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
            
            profileModal.style.display = 'none';
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Reset login button state
            const loginForm = document.querySelector('#panelLogin form');
            if (loginForm) {
                const loginButton = loginForm.querySelector('button[type="submit"]');
                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Login';
                }
            }
            
            // Show success message in login modal
            setTimeout(() => {
                showFormMessage('loginMessage', '✅ Berhasil logout', 'success', 3000);
            }, 100);
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

        // ✅ Initialize Edit Profile functionality (after modal clone)
        if (window.initEditProfile) {
            dLog('🔧 [PROFILE] Initializing edit profile...');
            dLog('🔍 [PROFILE] Checking imageCompression library...');
            dLog('   - typeof imageCompression:', typeof imageCompression);
            
            // Wait for imageCompression library to load
            if (typeof imageCompression !== 'undefined') {
                dLog('✅ [PROFILE] imageCompression available');
                window.initEditProfile();
                dLog('✅ [PROFILE] Edit profile initialized');
            } else {
                dLog('⚠️ [PROFILE] imageCompression not loaded yet, waiting...');
                let retryCount = 0;
                const maxRetries = 30; // 30 retries x 500ms = 15 seconds
                const checkInterval = setInterval(() => {
                    retryCount++;
                    dLog(`🔄 [PROFILE] Retry ${retryCount}/${maxRetries} - checking imageCompression...`);
                    
                    if (typeof imageCompression !== 'undefined') {
                        dLog('✅ [PROFILE] imageCompression now available!');
                        clearInterval(checkInterval);
                        window.initEditProfile();
                        dLog('✅ [PROFILE] Edit profile initialized (delayed)');
                    } else if (retryCount >= maxRetries) {
                        console.error(`❌ [PROFILE] imageCompression failed to load after ${maxRetries} retries (${maxRetries * 0.5}s)`);
                        console.error('❌ [PROFILE] Please check console for CDN loader errors');
                        console.error('💡 [PROFILE] Try refreshing the page or check your internet connection');
                        clearInterval(checkInterval);
                    }
                }, 500);
            }
        } else {
            dLog('⚠️ [PROFILE] initEditProfile not found');
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

    // 🆕 Helper function to get current user ID
    function getCurrentUserId() {
        try {
            const userStr = localStorage.getItem('user');
            if (!userStr) return null;
            const user = JSON.parse(userStr);
            return user.uid || user.id || null;
        } catch (error) {
            return null;
        }
    }

    // ✅ STEP 5: Check VIP Status
    async function checkDonaturStatus() {
    dLog('🔍 [STATUS-CHECK] ========================================');
    dLog('🔍 [STATUS-CHECK] Starting donatur status check...');
    
    // ✅ VALIDATE CACHE FIRST - Check if cached status is expired
    validateAndUpdateExpiredStatus();
    
    const token = localStorage.getItem('authToken');
    const currentUserId = getCurrentUserId();
    
    dLog('🔍 [STATUS-CHECK] Token exists:', !!token);
    dLog('🔍 [STATUS-CHECK] Current user ID:', currentUserId);
    
    // 🆕 VALIDATE USER ID - Clear cache if it belongs to a different user
    const cachedStatus = localStorage.getItem('userDonaturStatus');
    if (cachedStatus && currentUserId) {
        try {
            const parsed = JSON.parse(cachedStatus);
            dLog('🔍 [STATUS-CHECK] Cached userId:', parsed.userId, '| Current userId:', currentUserId);
            if (parsed.userId && parsed.userId !== currentUserId) {
                dLog('⚠️ [CACHE] Cached status belongs to different user, clearing');
                localStorage.removeItem('userDonaturStatus');
            }
        } catch (e) {
            // Invalid cache, remove it
            dLog('⚠️ [CACHE] Invalid cache, removing');
            localStorage.removeItem('userDonaturStatus');
        }
    }
    
    if (!token) {
        dLog('⚠️ [STATUS-CHECK] No token found, setting PEMBACA SETIA');
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
            userId: currentUserId,
            timestamp: Date.now()
        }));
        dLog('✅ [STATUS-CHECK] No token - set PEMBACA SETIA');
        dLog('🔍 [STATUS-CHECK] ========================================');
        return;
    }
    
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';
    
    try {
        dLog('🌐 [STATUS-CHECK] Fetching from API:', `${API_URL}/donatur/status`);
        
        // ✅ Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_URL}/donatur/status`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        dLog('📥 [STATUS-CHECK] API Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        dLog('📥 [STATUS-CHECK] API Response data:', data);
        
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
            
            dLog('💎 [STATUS-CHECK] User IS donatur, expired:', isExpired);
            
            if (isExpired) {
                // ✅ Status sudah berakhir - kembalikan ke PEMBACA SETIA
                dLog('⚠️ [STATUS-CHECK] Status expired, setting PEMBACA SETIA');
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
                    userId: currentUserId,
                    timestamp: Date.now()
                }));
                dLog('✅ [STATUS-CHECK] DOM updated to PEMBACA SETIA (expired)');
            } else {
                // ✅ DONATUR AKTIF - LANGSUNG UPDATE (TANPA FADE)
                dLog('✨ [STATUS-CHECK] Active donatur, setting DONATUR SETIA');
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
                    userId: currentUserId,
                    expiresAt: data.expiresAt,
                    timestamp: Date.now()
                }));
                dLog('✅ [STATUS-CHECK] DOM updated to DONATUR SETIA (active)');
            }
            
        } else {
            // ❌ NON-DONATUR - LANGSUNG UPDATE (TANPA FADE)
            dLog('ℹ️ [STATUS-CHECK] User is NOT donatur, setting PEMBACA SETIA');
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
                userId: currentUserId,
                timestamp: Date.now()
            }));
            dLog('✅ [STATUS-CHECK] DOM updated to PEMBACA SETIA (non-donatur)');
        }
        
        dLog('✅ [STATUS-CHECK] Status check completed successfully');
        dLog('🔍 [STATUS-CHECK] ========================================');
    } catch (error) {
        // ✅ Handle network errors gracefully - use localStorage as fallback
        dLog('❌ [STATUS-CHECK] Error occurred:', error.name, error.message);
        
        if (error.name === 'AbortError') {
            dWarn('Donatur status check timeout - using cached status');
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            dWarn('Network error - using cached donatur status from localStorage');
        } else {
            console.error('Donatur check error:', error);
        }
        
        dLog('🔄 [STATUS-CHECK] Attempting fallback to cache...');
        
        // ✅ Fallback to localStorage if available
        try {
            const cachedStatus = localStorage.getItem('userDonaturStatus');
            if (cachedStatus) {
                dLog('📦 [STATUS-CHECK] Cache found, using it');
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
                dLog('⚠️ [STATUS-CHECK] No cache found, defaulting to PEMBACA SETIA');
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
            dLog('✅ [STATUS-CHECK] Fallback completed');
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
            dLog('❌ [STATUS-CHECK] Fallback failed:', fallbackError.message);
        }
        
        dLog('🔍 [STATUS-CHECK] ========================================');
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
                        userId: getCurrentUserId(),
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
                userId: getCurrentUserId(),
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
    
    // 🆕 Set up periodic API status check (every 10 minutes)
    // ✅ OPTIMIZED: Was 2 minutes, now 10 minutes - saves requests while keeping status fresh
    const PERIODIC_CHECK_INTERVAL = 600000; // 10 minutes (was 2 minutes)
    let periodicStatusCheckInterval = null;
    
    function startPeriodicStatusCheck() {
        // Clear existing interval if any
        if (periodicStatusCheckInterval) {
            clearInterval(periodicStatusCheckInterval);
        }
        
        // Only start periodic check if user is logged in
        const token = localStorage.getItem('authToken');
        if (token) {
            dLog('⏰ [PERIODIC] Starting periodic status check (every', PERIODIC_CHECK_INTERVAL / 1000, 'seconds)');
            periodicStatusCheckInterval = setInterval(() => {
                const currentToken = localStorage.getItem('authToken');
                if (currentToken) {
                    dLog('🔄 [PERIODIC] Periodic status check triggered');
                    checkDonaturStatus().catch(err => {
                        dLog('⚠️ [PERIODIC] Status check failed:', err.message);
                    });
                } else {
                    // User logged out, stop periodic check
                    dLog('🛑 [PERIODIC] User logged out, stopping periodic check');
                    clearInterval(periodicStatusCheckInterval);
                    periodicStatusCheckInterval = null;
                }
            }, PERIODIC_CHECK_INTERVAL);
        }
    }
    
    // Start periodic check on page load if user is logged in
    startPeriodicStatusCheck();
    
    // Export function for use in login/logout handlers
    window.startPeriodicStatusCheck = startPeriodicStatusCheck;
    window.stopPeriodicStatusCheck = () => {
        if (periodicStatusCheckInterval) {
            clearInterval(periodicStatusCheckInterval);
            periodicStatusCheckInterval = null;
            dLog('🛑 [PERIODIC] Periodic status check stopped');
        }
    };
    
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

    // 🆕 Listen for storage changes (cross-tab/window account switching detection)
    window.addEventListener('storage', (e) => {
        // Detect authToken changes (login/logout/account switch in another tab)
        if (e.key === 'authToken') {
            dLog('🔄 [STORAGE] Auth token changed in another tab');
            dLog('🔄 [STORAGE] Old token:', e.oldValue ? 'exists' : 'null');
            dLog('🔄 [STORAGE] New token:', e.newValue ? 'exists' : 'null');
            
            // Clear donatur status cache immediately to prevent stuck status
            localStorage.removeItem('userDonaturStatus');
            dLog('🧹 [STORAGE] Cleared userDonaturStatus cache');
            
            // Update UI
            if (window.updateProfileButtonText) {
                window.updateProfileButtonText();
            }
            
            // If logged out in another tab
            if (!e.newValue) {
                dLog('🚪 [STORAGE] User logged out in another tab');
                // Stop periodic status check
                if (window.stopPeriodicStatusCheck) {
                    window.stopPeriodicStatusCheck();
                }
                const profileModal = document.getElementById('profileModal');
                if (profileModal && profileModal.style.display !== 'none') {
                    profileModal.style.display = 'none';
                }
                // Clear notification badge
                if (window.updateNotificationBadge) {
                    window.updateNotificationBadge();
                }
            }
            // If logged in or switched account in another tab
            else {
                dLog('🔐 [STORAGE] User logged in/switched account in another tab');
                // Restart periodic status check with new account
                if (window.startPeriodicStatusCheck) {
                    window.startPeriodicStatusCheck();
                }
                // Refresh donatur status with new account
                checkDonaturStatus();
            }
        }
        
        // Detect userDonaturStatus changes (status upgraded in another tab)
        if (e.key === 'userDonaturStatus') {
            dLog('💎 [STORAGE] Donatur status changed in another tab');
            // Refresh profile modal if it's open
            const profileModal = document.getElementById('profileModal');
            if (profileModal && profileModal.style.display !== 'none') {
                dLog('🔄 [STORAGE] Refreshing profile modal after status change');
                const currentUser = localStorage.getItem('user');
                if (currentUser && window.showProfileModal) {
                    setTimeout(() => {
                        window.showProfileModal();
                    }, 300);
                }
            }
        }
    });

    // 🆕 Listen for custom status update events (for manual triggers)
    window.addEventListener('forceStatusUpdate', () => {
        dLog('🔄 [EVENT] Force status update triggered');
        const token = localStorage.getItem('authToken');
        if (token) {
            checkDonaturStatus();
        }
    });

    // ✅ STEP 7: Login/Register forms
    const API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';

    dLog('🔧 [SETUP] Adding form handlers...');

    // 🆕 PASSWORD STRENGTH CHECKER
    // 🆕 PASSWORD STRENGTH CHECKER
    // Requirement: Minimum 8 characters + 2 out of 4 criteria (uppercase, lowercase, number, special)
    function checkPasswordStrength(password) {
        const strength = {
            score: 0,
            criteriaScore: 0, // Score for the 4 criteria (not including length)
            level: 'weak',
            message: '',
            hints: [],
            meetsMinLength: false
        };
        
        // Check minimum length (mandatory)
        if (password.length >= 8) {
            strength.meetsMinLength = true;
        } else {
            strength.hints.push('⚠️ Minimal 8 karakter (WAJIB)');
        }
        
        // Check 4 criteria
        if (/[A-Z]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan huruf besar (A-Z)');
        }
        
        if (/[a-z]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan huruf kecil (a-z)');
        }
        
        if (/[0-9]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan angka (0-9)');
        }
        
        if (/[^A-Za-z0-9]/.test(password)) {
            strength.criteriaScore += 1;
        } else {
            strength.hints.push('Tambahkan karakter spesial (!@#$%^&*)');
        }
        
        // Calculate total score for display (0-100%)
        // Length (20%) + each criteria (20% each) = 100%
        strength.score = (strength.meetsMinLength ? 1 : 0) + strength.criteriaScore;
        
        // Determine level
        // Strong: min length + all 4 criteria (score 5)
        // Medium: min length + 2-3 criteria (score 3-4)
        // Weak: anything else
        if (strength.meetsMinLength && strength.criteriaScore >= 4) {
            strength.level = 'strong';
            strength.message = 'Password kuat 💪';
        } else if (strength.meetsMinLength && strength.criteriaScore >= 2) {
            strength.level = 'medium';
            strength.message = `Password cukup kuat (${strength.criteriaScore}/4 kriteria)`;
        } else {
            strength.level = 'weak';
            strength.message = 'Password lemah ⚠️';
        }
        
        if (DEBUG_MODE) {
            dLog('🔐 [PASSWORD] Length OK:', strength.meetsMinLength, '| Criteria:', strength.criteriaScore, '/4 | Level:', strength.level);
        }
        
        return strength;
    }

    // 🆕 ATTACH PASSWORD STRENGTH CHECKER TO REGISTER PASSWORD INPUT
    const registerPasswordInput = document.getElementById('registerPassword');
    const strengthIndicator = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const strengthHints = document.getElementById('strengthHints');
    const registerButton = document.querySelector('#panelRegister button[type="submit"]');

    if (DEBUG_MODE) {
        dLog('🔐 [REGISTER] Elements found:');
        dLog('  - registerPasswordInput:', !!registerPasswordInput);
        dLog('  - strengthIndicator:', !!strengthIndicator);
        dLog('  - strengthFill:', !!strengthFill);
        dLog('  - strengthText:', !!strengthText);
        dLog('  - strengthHints:', !!strengthHints);
        dLog('  - registerButton:', !!registerButton);
    }

    if (registerPasswordInput && strengthIndicator && strengthFill && strengthText && strengthHints && registerButton) {
        // Initially disable button
        registerButton.disabled = true;
        registerButton.style.opacity = '0.5';
        registerButton.style.cursor = 'not-allowed';
        registerButton.title = 'Password harus: min 8 karakter + 2 dari 4 kriteria';

        // 🆕 Shared function to update button state
        let currentPasswordMatch = false;

        function updateButtonState() {
            const password = registerPasswordInput.value;
            const confirmPassword = document.getElementById('registerConfirm')?.value || '';
            const strength = checkPasswordStrength(password);
            const isPasswordValid = strength.meetsMinLength && strength.criteriaScore >= 2;
            const isMatch = confirmPassword.length === 0 || password === confirmPassword;
            const shouldEnable = isPasswordValid && (confirmPassword.length === 0 || (isMatch && confirmPassword.length > 0));

            currentPasswordMatch = isMatch;

            if (shouldEnable && confirmPassword.length > 0 && isMatch) {
                registerButton.disabled = false;
                registerButton.style.opacity = '1';
                registerButton.style.cursor = 'pointer';
                registerButton.title = 'Klik untuk register';
                if (DEBUG_MODE) dLog('✅ [BUTTON] Enabled');
            } else {
                registerButton.disabled = true;
                registerButton.style.opacity = '0.5';
                registerButton.style.cursor = 'not-allowed';
                if (!isPasswordValid) {
                    if (!strength.meetsMinLength) {
                        registerButton.title = 'Password harus minimal 8 karakter';
                    } else {
                        registerButton.title = `Password perlu ${2 - strength.criteriaScore} kriteria lagi (2 dari 4)`;
                    }
                } else if (confirmPassword.length > 0 && !isMatch) {
                    registerButton.title = 'Password tidak cocok dengan Confirm Password';
                } else {
                    registerButton.title = 'Password harus: min 8 karakter + 2 dari 4 kriteria';
                }
                if (DEBUG_MODE) dLog('❌ [BUTTON] Disabled -', registerButton.title);
            }
        }

        registerPasswordInput.addEventListener('input', (e) => {
            const password = e.target.value;
            
            if (password.length === 0) {
                strengthIndicator.style.display = 'none';
                registerButton.disabled = true;
                registerButton.style.opacity = '0.5';
                registerButton.style.cursor = 'not-allowed';
                registerButton.title = 'Password harus: min 8 karakter + 2 dari 4 kriteria';
                return;
            }
            
            strengthIndicator.style.display = 'block';
            const strength = checkPasswordStrength(password);
            
            // Update bar (score 0-5, each worth 20%)
            strengthFill.style.width = (strength.score * 20) + '%';
            strengthFill.className = 'strength-fill ' + strength.level;
            
            if (DEBUG_MODE) {
                dLog('🎨 [INDICATOR] Width:', (strength.score * 20) + '%', '| Class:', 'strength-fill ' + strength.level);
            }
            
            // Update text
            strengthText.textContent = strength.message;
            strengthText.className = 'strength-text ' + strength.level;
            
            // Update hints
            strengthHints.innerHTML = strength.hints
                .map(hint => `<li>${hint}</li>`)
                .join('');
            
            // Update button state
            updateButtonState();
        });

        // Make updateButtonState available globally within this scope
        window._updateRegisterButtonState = updateButtonState;
    } else {
        console.error('❌ [REGISTER] Missing password strength elements!');
        if (!registerPasswordInput) console.error('  - Missing: registerPasswordInput');
        if (!strengthIndicator) console.error('  - Missing: strengthIndicator');
        if (!strengthFill) console.error('  - Missing: strengthFill');
        if (!strengthText) console.error('  - Missing: strengthText');
        if (!strengthHints) console.error('  - Missing: strengthHints');
        if (!registerButton) console.error('  - Missing: registerButton');
    }

    // 🆕 PASSWORD MATCH CHECKER FOR CONFIRM PASSWORD
    const registerConfirmInput = document.getElementById('registerConfirm');
    const passwordMatch = document.getElementById('passwordMatch');

    // 🆕 FORM MESSAGE HELPER FUNCTIONS
    function showFormMessage(elementId, message, type = 'info', duration = 0) {
        const messageEl = document.getElementById(elementId);
        if (!messageEl) {
            console.error(`❌ Message element #${elementId} not found`);
            return;
        }

        messageEl.textContent = message;
        messageEl.className = `form-message ${type}`;
        messageEl.style.display = 'block';

        if (DEBUG_MODE) {
            dLog(`📣 [MESSAGE] Showing ${type} message in #${elementId}:`, message);
        }

        // Auto-hide after duration (if specified)
        if (duration > 0) {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, duration);
        }
    }

    function hideFormMessage(elementId) {
        const messageEl = document.getElementById(elementId);
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    // 🆕 RESET REGISTER FORM FUNCTION
    function resetRegisterForm() {
        if (DEBUG_MODE) dLog('🔄 [RESET] Resetting register form indicators');
        
        // Reset password strength indicator
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');
        const strengthHints = document.getElementById('strengthHints');
        const strengthIndicator = document.getElementById('passwordStrength');
        
        if (strengthFill) {
            strengthFill.style.width = '0%';
            strengthFill.className = 'strength-fill';
        }
        if (strengthText) {
            strengthText.textContent = '';
        }
        if (strengthHints) {
            strengthHints.innerHTML = '';
        }
        if (strengthIndicator) {
            strengthIndicator.style.display = 'none';
        }
        
        // Reset password match indicator
        const passwordMatch = document.getElementById('passwordMatch');
        if (passwordMatch) {
            passwordMatch.style.display = 'none';
            passwordMatch.innerHTML = '';
        }
        
        // Reset register button
        const registerButton = document.querySelector('#panelRegister button[type="submit"]');
        if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = 'Register';
        }
        
        // Hide register message
        hideFormMessage('registerMessage');
        
        if (DEBUG_MODE) dLog('✅ [RESET] Register form reset complete');
    }

    if (DEBUG_MODE) {
        dLog('🔐 [PASSWORD MATCH] Elements found:');
        dLog('  - registerConfirmInput:', !!registerConfirmInput);
        dLog('  - passwordMatch:', !!passwordMatch);
    }

    if (registerPasswordInput && registerConfirmInput && passwordMatch && registerButton) {
        function checkPasswordMatch() {
            const password = registerPasswordInput.value;
            const confirmPassword = registerConfirmInput.value;

            // Jangan tampilkan apapun jika confirm password kosong
            if (confirmPassword.length === 0) {
                passwordMatch.style.display = 'none';
                // Call updateButtonState if available
                if (window._updateRegisterButtonState) {
                    window._updateRegisterButtonState();
                }
                return;
            }

            passwordMatch.style.display = 'block';

            const isMatch = password === confirmPassword;

            if (isMatch) {
                passwordMatch.innerHTML = '<span class="match-success">✓ Password cocok</span>';
                passwordMatch.className = 'password-match success';
                if (DEBUG_MODE) dLog('✅ [PASSWORD MATCH] Passwords match');
            } else {
                passwordMatch.innerHTML = '<span class="match-error">✗ Password tidak cocok</span>';
                passwordMatch.className = 'password-match error';
                if (DEBUG_MODE) dLog('❌ [PASSWORD MATCH] Passwords do not match');
            }

            // Call updateButtonState if available
            if (window._updateRegisterButtonState) {
                window._updateRegisterButtonState();
            }
        }

        // Check on both password and confirm password input
        registerPasswordInput.addEventListener('input', checkPasswordMatch);
        registerConfirmInput.addEventListener('input', checkPasswordMatch);
    } else {
        if (DEBUG_MODE) {
            console.error('❌ [PASSWORD MATCH] Missing elements!');
            if (!registerPasswordInput) console.error('  - Missing: registerPasswordInput');
            if (!registerConfirmInput) console.error('  - Missing: registerConfirmInput');
            if (!passwordMatch) console.error('  - Missing: passwordMatch');
            if (!registerButton) console.error('  - Missing: registerButton');
        }
    }

    // ============= GOOGLE OAUTH CONFIGURATION =============
    const GOOGLE_CLIENT_ID = '729629270107-kv2m7vngrmrnh9hp18va6765autf8g5a.apps.googleusercontent.com';

    /**
     * Handle Google Sign-In response
     */
    async function handleGoogleSignIn(response) {
        console.log('🔥🔥🔥 [GOOGLE-LOGIN] ======================================== START');
        console.log('🔥 [GOOGLE-LOGIN] handleGoogleSignIn CALLED');
        console.log('🔥 [GOOGLE-LOGIN] Time:', new Date().toISOString());
        console.log('🔥 [GOOGLE-LOGIN] Response object:', response);
        console.log('🔥 [GOOGLE-LOGIN] Has credential?', !!response.credential);
        
        try {
            console.log('🌐 [GOOGLE-LOGIN] Sending credential to backend:', API_URL + '/auth/google-login');
            const apiResponse = await fetch(`${API_URL}/auth/google-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });
            
            console.log('📥 [GOOGLE-LOGIN] Response status:', apiResponse.status);
            console.log('📥 [GOOGLE-LOGIN] Response ok?', apiResponse.ok);
            const data = await apiResponse.json();
            console.log('📥 [GOOGLE-LOGIN] Response data:', JSON.stringify(data, null, 2));
            
            if (data.success) {
                console.log('✅ [GOOGLE-LOGIN] Login successful!');
                console.log('💾 [GOOGLE-LOGIN] Data received from backend:');
                console.log('   - Token:', data.token ? 'YES (length: ' + data.token.length + ')' : 'NO');
                console.log('   - User object:', data.user);
                console.log('   - isNewUser:', data.isNewUser);
                console.log('💾 [GOOGLE-LOGIN] Saving to localStorage...');
                
                // Clear old donatur status cache
                localStorage.removeItem('userDonaturStatus');
                console.log('🧹 [GOOGLE-LOGIN] Cleared old donatur status cache');
                
                // Save auth data
                localStorage.setItem('authToken', data.token);
                console.log('✅ [GOOGLE-LOGIN] Saved authToken');
                
                localStorage.setItem('user', JSON.stringify(data.user));
                console.log('✅ [GOOGLE-LOGIN] Saved user object:', JSON.stringify(data.user));
                
                localStorage.setItem('userEmail', data.user.email);
                console.log('✅ [GOOGLE-LOGIN] Saved userEmail:', data.user.email);
                
                localStorage.setItem('userUid', data.user.uid);
                console.log('✅ [GOOGLE-LOGIN] Saved userUid:', data.user.uid);
                
                localStorage.setItem('username', data.user.username);
                console.log('✅ [GOOGLE-LOGIN] Saved username:', data.user.username);
                
                // 🔥 Only save avatar if it exists and is not null
                if (data.user.avatar_url && data.user.avatar_url !== 'null') {
                    localStorage.setItem('userAvatar', data.user.avatar_url);
                    console.log('✅ [GOOGLE-LOGIN] Saved avatar_url:', data.user.avatar_url);
                } else {
                    // Remove avatar from localStorage if null, so default logo is used
                    localStorage.removeItem('userAvatar');
                    console.log('ℹ️ [GOOGLE-LOGIN] No avatar from Google, using default logo');
                }
                
                console.log('✅ [GOOGLE-LOGIN] All data saved to localStorage');
                console.log('📦 [GOOGLE-LOGIN] Verifying localStorage:');
                console.log('   - authToken:', localStorage.getItem('authToken') ? 'EXISTS' : 'MISSING');
                console.log('   - user:', localStorage.getItem('user') ? 'EXISTS' : 'MISSING');
                console.log('   - userEmail:', localStorage.getItem('userEmail'));
                console.log('   - username:', localStorage.getItem('username'));
                
                // Update button text immediately
                console.log('🔄 [GOOGLE-LOGIN] Checking updateProfileButtonText function...');
                if (window.updateProfileButtonText) {
                    console.log('✅ [GOOGLE-LOGIN] updateProfileButtonText EXISTS, calling it...');
                    try {
                        window.updateProfileButtonText();
                        console.log('✅ [GOOGLE-LOGIN] updateProfileButtonText executed');
                        const btnText = document.querySelector('#btnOpenLogin .button-text');
                        console.log('🔍 [GOOGLE-LOGIN] Button text now:', btnText ? btnText.textContent : 'BUTTON NOT FOUND');
                    } catch (e) {
                        console.error('❌ [GOOGLE-LOGIN] Error calling updateProfileButtonText:', e);
                    }
                } else {
                    console.error('❌ [GOOGLE-LOGIN] updateProfileButtonText NOT FOUND on window!');
                }
                
                // Start periodic status check
                console.log('🔄 [GOOGLE-LOGIN] Checking startPeriodicStatusCheck...');
                if (window.startPeriodicStatusCheck) {
                    console.log('✅ [GOOGLE-LOGIN] startPeriodicStatusCheck exists, calling...');
                    window.startPeriodicStatusCheck();
                } else {
                    console.log('⚠️ [GOOGLE-LOGIN] startPeriodicStatusCheck not found');
                }
                
                // Update notification badge
                console.log('🔄 [GOOGLE-LOGIN] Checking updateNotificationBadge...');
                if (window.updateNotificationBadge) {
                    console.log('✅ [GOOGLE-LOGIN] updateNotificationBadge exists, calling...');
                    window.updateNotificationBadge();
                } else {
                    console.log('⚠️ [GOOGLE-LOGIN] updateNotificationBadge not found');
                }
                
                // Close login modal
                console.log('🚪 [GOOGLE-LOGIN] Closing login modal...');
                const modal = document.getElementById('loginModal');
                if (modal) {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                    console.log('✅ [GOOGLE-LOGIN] Login modal closed');
                } else {
                    console.error('❌ [GOOGLE-LOGIN] Login modal not found!');
                }
                
                // Show success message
                console.log('📢 [GOOGLE-LOGIN] Showing success message...');
                showFormMessage('loginMessage', '✅ Login berhasil!', 'success', 1000);
                
                // 🆕 Check if this is a new user registration
                if (data.isNewUser) {
                    console.log('🆕 [GOOGLE-LOGIN] New user detected - opening Edit Profile Modal...');
                    
                    // Set global flag to track this is from Google registration
                    window.isFromGoogleRegistration = true;
                    
                    setTimeout(() => {
                        // Open edit profile modal instead of profile modal
                        const editProfileModal = document.getElementById('editProfileModal');
                        const displayNameInput = document.getElementById('displayNameInput');
                        const avatarPreview = document.getElementById('avatarPreview');
                        
                        if (editProfileModal && displayNameInput && avatarPreview) {
                            // Pre-fill with Google data
                            displayNameInput.value = data.user.username || '';
                            avatarPreview.src = 'assets/Logo 2.png'; // Default logo
                            
                            // Show edit profile modal
                            editProfileModal.style.display = 'flex';
                            document.body.style.overflow = 'hidden';
                            
                            console.log('✅ [GOOGLE-LOGIN] Edit Profile Modal opened for new user');
                        } else {
                            console.error('❌ [GOOGLE-LOGIN] Edit Profile Modal elements not found!');
                            // Fallback: show profile modal
                            checkDonaturStatus().then(() => {
                                setTimeout(() => showProfileModal(data.user), 500);
                            });
                        }
                    }, 500);
                } else {
                    // Existing user - normal flow
                    console.log('👤 [GOOGLE-LOGIN] Existing user - showing Profile Modal...');
                    
                    // Clear flag
                    window.isFromGoogleRegistration = false;
                    
                    // 🔥 FORCE REFRESH STATUS immediately after login (before showing modal)
                    // This ensures fresh status without needing page reload
                    console.log('🔍 [GOOGLE-LOGIN] Force refreshing donatur status...');
                    checkDonaturStatus().then(() => {
                        console.log('✅ [GOOGLE-LOGIN] Status refreshed, showing profile modal...');
                        // Show profile modal after status is refreshed
                        setTimeout(async () => {
                            try {
                                console.log('🎭 [GOOGLE-LOGIN] Opening profile modal...');
                                if (typeof showProfileModal === 'function') {
                                    console.log('✅ [GOOGLE-LOGIN] showProfileModal EXISTS, calling with user:', data.user);
                                    await showProfileModal(data.user);
                                    console.log('✅ [GOOGLE-LOGIN] showProfileModal completed');
                                } else {
                                    console.error('❌ [GOOGLE-LOGIN] showProfileModal is NOT a function! Type:', typeof showProfileModal);
                                    console.log('🔄 [GOOGLE-LOGIN] Reloading page as fallback...');
                                    location.reload();
                                }
                            } catch (error) {
                                console.error('❌ [GOOGLE-LOGIN] Error opening profile modal:', error);
                                console.error('❌ [GOOGLE-LOGIN] Error stack:', error.stack);
                                // Fallback: reload page
                                console.log('🔄 [GOOGLE-LOGIN] Reloading page as fallback...');
                                location.reload();
                            }
                        }, 500);
                    }).catch(err => {
                        console.log('⚠️ [GOOGLE-LOGIN] Status refresh error:', err);
                        // Show modal anyway even if status check fails
                        setTimeout(async () => {
                            try {
                                if (typeof showProfileModal === 'function') {
                                    await showProfileModal(data.user);
                                } else {
                                    location.reload();
                                }
                            } catch (error) {
                                console.error('❌ [GOOGLE-LOGIN] Error opening profile modal:', error);
                                location.reload();
                            }
                        }, 500);
                    });
                }
            } else {
                console.error('❌ [GOOGLE-LOGIN] Login FAILED:', data.error);
                console.error('❌ [GOOGLE-LOGIN] Full response:', data);
                showFormMessage('loginMessage', `❌ ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ [GOOGLE-LOGIN] EXCEPTION during sign-in:', error);
            console.error('❌ [GOOGLE-LOGIN] Error message:', error.message);
            console.error('❌ [GOOGLE-LOGIN] Error stack:', error.stack);
            showFormMessage('loginMessage', '❌ Terjadi kesalahan saat login dengan Google', 'error');
        }
        console.log('🔥🔥🔥 [GOOGLE-LOGIN] ======================================== END');
    }

    /**
     * Initialize Google Sign-In
     */
    function initGoogleSignIn() {
        console.log('🔧 [GOOGLE-INIT] ======================================== START');
        console.log('🔧 [GOOGLE-INIT] Checking Google library...');
        console.log('🔧 [GOOGLE-INIT] typeof google:', typeof google);
        console.log('🔧 [GOOGLE-INIT] google.accounts exists?', typeof google !== 'undefined' && google.accounts ? 'YES' : 'NO');
        
        if (typeof google !== 'undefined' && google.accounts) {
            console.log('✅ [GOOGLE-INIT] Google library loaded! Initializing...');
            console.log('✅ [GOOGLE-INIT] Client ID:', GOOGLE_CLIENT_ID);
            
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleSignIn
            });
            console.log('✅ [GOOGLE-INIT] google.accounts.id.initialize called');
            
            // Attach to both buttons using renderButton (no FedCM)
            const loginButton = document.getElementById('googleSignInLogin');
            const registerButton = document.getElementById('googleSignInRegister');
            console.log('🔍 [GOOGLE-INIT] Login button:', loginButton);
            console.log('🔍 [GOOGLE-INIT] Register button:', registerButton);
            
            if (loginButton) {
                console.log('🔧 [GOOGLE-INIT] Setting up LOGIN button...');
                // Create hidden container for Google button
                const hiddenDiv = document.createElement('div');
                hiddenDiv.style.display = 'none';
                hiddenDiv.id = 'hiddenGoogleLoginDiv';
                loginButton.parentElement.appendChild(hiddenDiv);
                console.log('✅ [GOOGLE-INIT] Hidden div created for login button');
                
                // Render Google button
                google.accounts.id.renderButton(hiddenDiv, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large'
                });
                console.log('✅ [GOOGLE-INIT] Google button rendered in hidden div');
                
                // Click hidden button when custom button clicked
                loginButton.addEventListener('click', () => {
                    console.log('🖱️ [GOOGLE-INIT] 🔥🔥🔥 CUSTOM GOOGLE LOGIN BUTTON CLICKED!');
                    const googleBtn = hiddenDiv.querySelector('div[role="button"]');
                    console.log('🔍 [GOOGLE-INIT] Looking for Google button in hidden div...');
                    console.log('🔍 [GOOGLE-INIT] Found Google button?', googleBtn ? 'YES' : 'NO');
                    if (googleBtn) {
                        console.log('✅ [GOOGLE-INIT] Clicking hidden Google button...');
                        googleBtn.click();
                        console.log('✅ [GOOGLE-INIT] Hidden Google button clicked!');
                    } else {
                        console.error('❌ [GOOGLE-INIT] Hidden Google button NOT FOUND!');
                    }
                });
                console.log('✅ [GOOGLE-INIT] Click handler attached to login button');
            } else {
                console.error('❌ [GOOGLE-INIT] Login button NOT FOUND in DOM!');
            }
            
            if (registerButton) {
                console.log('🔧 [GOOGLE-INIT] Setting up REGISTER button...');
                // Create hidden container for Google button
                const hiddenDiv = document.createElement('div');
                hiddenDiv.style.display = 'none';
                hiddenDiv.id = 'hiddenGoogleRegisterDiv';
                registerButton.parentElement.appendChild(hiddenDiv);
                console.log('✅ [GOOGLE-INIT] Hidden div created for register button');
                
                // Render Google button
                google.accounts.id.renderButton(hiddenDiv, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large'
                });
                console.log('✅ [GOOGLE-INIT] Google button rendered in hidden div');
                
                // Click hidden button when custom button clicked
                registerButton.addEventListener('click', () => {
                    console.log('🖱️ [GOOGLE-INIT] 🔥🔥🔥 CUSTOM GOOGLE REGISTER BUTTON CLICKED!');
                    const googleBtn = hiddenDiv.querySelector('div[role="button"]');
                    console.log('🔍 [GOOGLE-INIT] Looking for Google button in hidden div...');
                    console.log('🔍 [GOOGLE-INIT] Found Google button?', googleBtn ? 'YES' : 'NO');
                    if (googleBtn) {
                        console.log('✅ [GOOGLE-INIT] Clicking hidden Google button...');
                        googleBtn.click();
                        console.log('✅ [GOOGLE-INIT] Hidden Google button clicked!');
                    } else {
                        console.error('❌ [GOOGLE-INIT] Hidden Google button NOT FOUND!');
                    }
                });
                console.log('✅ [GOOGLE-INIT] Click handler attached to register button');
            } else {
                console.error('❌ [GOOGLE-INIT] Register button NOT FOUND in DOM!');
            }
            
            console.log('✅ [GOOGLE-INIT] Sign-In initialized successfully');
            console.log('🔧 [GOOGLE-INIT] ======================================== END');
        } else {
            console.log('⚠️ [GOOGLE-INIT] Google library not loaded yet, retrying in 500ms...');
            console.log('🔧 [GOOGLE-INIT] ======================================== RETRY');
            setTimeout(initGoogleSignIn, 500);
        }
    }

    /**
     * Attach helper link click handlers
     */
    function attachHelperLinkHandlers() {
        const linkToRegister = document.getElementById('linkToRegister');
        const linkToLogin = document.getElementById('linkToLogin');
        
        if (linkToRegister) {
            linkToRegister.addEventListener('click', (e) => {
                e.preventDefault();
                dLog('🔄 [HELPER] Switching to Register panel');
                document.getElementById('tabRegister')?.click();
            });
        }
        
        if (linkToLogin) {
            linkToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                dLog('🔄 [HELPER] Switching to Login panel');
                document.getElementById('tabLogin')?.click();
            });
        }
    }

    // Initialize Google Sign-In and helper links
    console.log('🚀 [MAIN] Calling initGoogleSignIn...');
    initGoogleSignIn();
    console.log('🚀 [MAIN] Calling attachHelperLinkHandlers...');
    attachHelperLinkHandlers();
    console.log('🚀 [MAIN] Google OAuth initialization complete');

    document.querySelector('#panelLogin form').addEventListener('submit', async (e) => {
        e.preventDefault();
        dLog('🔐 [LOGIN] ========================================');
        dLog('🔐 [LOGIN] Form submitted');
        dLog('🔐 [LOGIN] Time:', new Date().toISOString());
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (DEBUG_MODE) dLog('🔐 [LOGIN] Email:', email);
        
        // Hide any previous messages
        hideFormMessage('loginMessage');
        
        // ✅ Show loading state
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = '⏳ Logging in...';
        
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
                
                // 🔥 CRITICAL: Clear donatur status BEFORE setting new auth token
                // This prevents stuck status when switching accounts in the SAME tab
                localStorage.removeItem('userDonaturStatus');
                dLog('🧹 [LOGIN] Cleared old donatur status cache before login');
                
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                dLog('💾 [LOGIN] Saved');
                
                // 🆕 Start periodic status check for new login
                if (window.startPeriodicStatusCheck) {
                    window.startPeriodicStatusCheck();
                }
                
                // ✅ Show success message
                showFormMessage('loginMessage', '✅ Login berhasil! Redirecting...', 'success', 2000);
                
                // ✅ Update profile button text
                if (window.updateProfileButtonText) {
                    window.updateProfileButtonText();
                }
                
                // ✅ Update notification badge
                if (window.updateNotificationBadge) {
                    window.updateNotificationBadge();
                }
                
                // 🔥 FORCE REFRESH STATUS immediately after login (before showing modal)
                // This ensures fresh status without needing page reload
                dLog('🔍 [LOGIN] Force refreshing donatur status...');
                checkDonaturStatus().then(() => {
                    dLog('✅ [LOGIN] Status refreshed, showing profile modal...');
                    // Show profile modal after status is refreshed
                    setTimeout(() => {
                        showProfileModal(data.user);
                    }, 500);
                }).catch(err => {
                    dLog('⚠️ [LOGIN] Status refresh error:', err);
                    // Show modal anyway even if status check fails
                    setTimeout(() => {
                        showProfileModal(data.user);
                    }, 500);
                });
            } else {
                console.error('❌ [LOGIN] Login failed:', data.error);
                showFormMessage('loginMessage', data.error || 'Login gagal', 'error');
                // Re-enable button on error
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        } catch (error) {
            console.error('❌ [LOGIN] Error:', error);
            console.error('❌ [LOGIN] Error stack:', error.stack);
            showFormMessage('loginMessage', 'Terjadi kesalahan: ' + error.message, 'error');
            // Re-enable button on error
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
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
    
    // Hide any previous messages
    hideFormMessage('registerMessage');
    
    if (password !== confirm) {
        console.error('❌ [REGISTER] Password mismatch');
        showFormMessage('registerMessage', 'Password tidak cocok!', 'error');
        return;
    }
    
    if (password.length < 8) {
        console.error('❌ [REGISTER] Password too short');
        showFormMessage('registerMessage', 'Password minimal 8 karakter', 'error');
        return;
    }
    
    // 🆕 Validate password strength (minimum: 8 chars + 2/4 criteria)
    const strength = checkPasswordStrength(password);
    if (!strength.meetsMinLength || strength.criteriaScore < 2) {
        console.error('❌ [REGISTER] Password too weak');
        showFormMessage('registerMessage', 'Password terlalu lemah! Harus minimal 8 karakter + 2 dari 4 kriteria (huruf besar, huruf kecil, angka, karakter spesial).', 'error');
        return;
    }
    
    if (DEBUG_MODE) {
        dLog('✅ [REGISTER] Password valid:', strength.meetsMinLength, 'length +', strength.criteriaScore, '/4 criteria');
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
            
            // Show success message
            showFormMessage('registerMessage', '✅ Registrasi berhasil! Silakan cek kotak masuk dan folder spam email yang sudah didaftarkan untuk verifikasi.', 'success');
            
            // Clear form after 5 seconds and close modal
            setTimeout(() => {
                e.target.reset();
                resetRegisterForm();
                dLog('🚪 [REGISTER] Closing modal...');
                document.getElementById('loginModal').style.display = 'none';
                document.body.style.overflow = '';
                dLog('✅ [REGISTER] Modal closed');
            }, 5000);
        } else {
            // ✅ Handle error response (misalnya 409 Conflict - user sudah terdaftar)
            const errorMessage = data.error || data.message || 'Registration failed';
            console.error('❌ [REGISTER] Registration failed:', errorMessage);
            showFormMessage('registerMessage', errorMessage, 'error');
            // Re-enable button on error
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    } catch (error) {
        console.error('❌ [REGISTER] Error:', error);
        console.error('❌ [REGISTER] Error stack:', error.stack);
        showFormMessage('registerMessage', 'Terjadi kesalahan: ' + error.message, 'error');
        // Re-enable button on error
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
            
            // Reset register form when switching to register tab
            if (tab.id === 'tabRegister') {
                resetRegisterForm();
            }
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
                showFormMessage('forgotMessage', '✅ Link untuk reset password sudah dikirimkan silahkan cek kotak masuk atau kotak spam', 'success');
                document.getElementById('forgotEmail').value = '';
                
                // Switch to login tab after 5 seconds
                setTimeout(() => {
                    document.getElementById('tabLogin').click();
                    hideFormMessage('forgotMessage');
                }, 5000);
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
// BOOKMARK MODAL
// ============================================

const BOOKMARK_API_URL = 'https://manga-auth-worker.nuranantoadhien.workers.dev';

/**
 * Get manga cover from manga-config.js
 */
function getMangaCover(mangaId) {
  if (typeof mangaList !== 'undefined' && mangaList) {
    const manga = mangaList.find(m => m.id === mangaId);
    if (manga) return manga.cover;
  }
  if (typeof MANGA_LIST !== 'undefined' && MANGA_LIST) {
    const manga = MANGA_LIST.find(m => m.id === mangaId);
    if (manga) return manga.cover;
  }
  return 'assets/Logo 2.png';
}

/**
 * Fetch bookmarks from API
 */
async function fetchBookmarks() {
  const token = localStorage.getItem('authToken');
  if (!token) return { bookmarks: [] };

  try {
    dLog('[BOOKMARK] Fetching bookmarks...');
    const response = await fetch(`${BOOKMARK_API_URL}/bookmarks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      dLog('[BOOKMARK] Fetched', data.bookmarks.length, 'bookmarks');
      return data;
    }
    return { bookmarks: [] };
  } catch (error) {
    console.error('[BOOKMARK] Fetch error:', error);
    return { bookmarks: [] };
  }
}

/**
 * Remove bookmark
 */
async function removeBookmark(mangaId) {
  const token = localStorage.getItem('authToken');
  if (!token) return { success: false, error: 'Not logged in' };

  try {
    const response = await fetch(`${BOOKMARK_API_URL}/bookmarks/remove`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mangaId })
    });
    return await response.json();
  } catch (error) {
    console.error('[BOOKMARK] Remove error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Render bookmark list in modal
 */
async function renderBookmarkList(bookmarks) {
  const listEl = document.getElementById('bookmarkList');
  if (!bookmarks || bookmarks.length === 0) return;

  // Fetch manga data (genre + status) for all bookmarks in parallel
  const mangaInfoMap = {};
  try {
    await Promise.all(bookmarks.map(async (item) => {
      try {
        let repoName = item.manga_id;
        if (typeof MANGA_LIST !== 'undefined') {
          const entry = MANGA_LIST.find(m => m.id === item.manga_id);
          if (entry) repoName = entry.repo;
        }

        const cacheKey = `manga_${repoName}`;
        const cached = getCachedData(cacheKey, 300000);
        if (cached) {
          mangaInfoMap[item.manga_id] = {
            genres: cached.manga?.genre || [],
            status: (cached.manga?.status || 'ONGOING').toUpperCase()
          };
          return;
        }

        const url = `https://raw.githubusercontent.com/nurananto/${repoName}/main/manga.json`;
        const data = await fetchFreshJSON(url);
        if (data) {
          setCachedData(cacheKey, data);
          mangaInfoMap[item.manga_id] = {
            genres: data.manga?.genre || [],
            status: (data.manga?.status || 'ONGOING').toUpperCase()
          };
        }
      } catch (e) {
        mangaInfoMap[item.manga_id] = { genres: [], status: 'ONGOING' };
      }
    }));
  } catch (e) {
    console.error('[BOOKMARK] Manga info fetch error:', e);
  }

  listEl.innerHTML = bookmarks.map(item => {
    const cover = getMangaCover(item.manga_id);
    const safeMangaId = escapeHTML(item.manga_id);
    const safeMangaTitle = escapeHTML(item.manga_title);
    const safeCover = escapeHTML(cover);
    const info = mangaInfoMap[item.manga_id] || { genres: [], status: 'ONGOING' };
    const genresText = info.genres.length > 0 ? info.genres.join(', ') : '';

    // Status badge
    let statusClass = 'status-ongoing';
    let statusText = 'Ongoing';
    if (info.status === 'HIATUS') {
      statusClass = 'status-hiatus';
      statusText = 'Hiatus';
    } else if (info.status === 'COMPLETED' || info.status === 'TAMAT' || info.status === 'END') {
      statusClass = 'status-completed';
      statusText = 'Tamat';
    }

    return `
      <div class="bookmark-card" data-manga-id="${safeMangaId}" tabindex="0" role="button">
        <img src="${safeCover}" 
             alt="${safeMangaTitle} cover" 
             class="bookmark-cover"
             loading="lazy"
             onerror="this.onerror=null; this.src='assets/Logo 2.png';">
        <div class="bookmark-info">
          <span class="bookmark-status-badge ${statusClass}">${statusText}</span>
          <div class="bookmark-manga-title">${safeMangaTitle}</div>
          ${genresText ? `<div class="bookmark-genres">${escapeHTML(genresText)}</div>` : ''}
        </div>
        <button class="btn-unbookmark" data-manga-id="${safeMangaId}" title="Hapus Bookmark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Click on card → go to info page
  listEl.querySelectorAll('.bookmark-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-unbookmark')) return;
      const mangaId = card.getAttribute('data-manga-id');
      if (mangaId) {
        window.location.href = `info-manga.html?repo=${encodeURIComponent(mangaId)}`;
      }
    });
    card.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  // Unbookmark buttons
  listEl.querySelectorAll('.btn-unbookmark').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mangaId = btn.getAttribute('data-manga-id');
      btn.disabled = true;
      const result = await removeBookmark(mangaId);
      if (result.success) {
        const card = btn.closest('.bookmark-card');
        if (card) {
          card.style.transition = 'opacity 0.3s, transform 0.3s';
          card.style.opacity = '0';
          card.style.transform = 'translateX(20px)';
          setTimeout(() => {
            card.remove();
            const remaining = listEl.querySelectorAll('.bookmark-card');
            if (remaining.length === 0) {
              listEl.style.display = 'none';
              document.getElementById('bookmarkEmpty').style.display = 'block';
            }
          }, 300);
        }
      } else {
        btn.disabled = false;
        if (typeof showToast === 'function') showToast(result.error || 'Gagal menghapus', 'error');
      }
    });
  });
}

/**
 * Show bookmark modal
 */
async function showBookmarkModal() {
  dLog('[BOOKMARK] Opening modal...');

  const bookmarkModal = document.getElementById('bookmarkModal');
  const bookmarkLoading = document.getElementById('bookmarkLoading');
  const bookmarkList = document.getElementById('bookmarkList');
  const bookmarkEmpty = document.getElementById('bookmarkEmpty');

  bookmarkModal.style.display = 'flex';
  bookmarkLoading.style.display = 'block';
  bookmarkList.style.display = 'none';
  bookmarkEmpty.style.display = 'none';
  document.body.style.overflow = 'hidden';

  const data = await fetchBookmarks();
  const { bookmarks } = data;

  bookmarkLoading.style.display = 'none';

  if (!bookmarks || bookmarks.length === 0) {
    bookmarkEmpty.style.display = 'block';
  } else {
    bookmarkList.style.display = 'flex';
    await renderBookmarkList(bookmarks);
  }
}

/**
 * Bookmark button click handler (profile modal)
 */
document.addEventListener('click', (e) => {
  if (e.target.id === 'btnBookmark' || e.target.closest('#btnBookmark')) {
    dLog('[BOOKMARK] Button clicked');
    const profileModal = document.getElementById('profileModal');
    if (profileModal) profileModal.style.display = 'none';
    showBookmarkModal();
  }
});

/**
 * Close bookmark modal
 */
function closeBookmarkModal() {
  const bookmarkModal = document.getElementById('bookmarkModal');
  if (bookmarkModal) {
    bookmarkModal.style.display = 'none';
    document.body.style.overflow = '';
    dLog('[BOOKMARK] Modal closed');
  }
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'bookmarkModal') closeBookmarkModal();
  if (e.target.id === 'btnCloseBookmark') closeBookmarkModal();
});

// Close bookmark modal on Escape
document.addEventListener('keydown', (e) => {
  const bookmarkModal = document.getElementById('bookmarkModal');
  if (bookmarkModal && bookmarkModal.style.display === 'flex' && e.key === 'Escape') {
    closeBookmarkModal();
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

// ============================================
// LOCKED CHAPTER HANDLING (Same as info-manga.js)
// ============================================

/**
 * Show locked chapter modal - check login status first
 */
async function showLockedChapterModal(repoId, chapterFolder) {
    dLog('🔒 showLockedChapterModal called');
    dLog('   - Repo:', repoId);
    dLog('   - Chapter:', chapterFolder);
    
    // ✅ Get manga type from MANGA_LIST
    let mangaType = 'manga'; // default
    if (typeof MANGA_LIST !== 'undefined') {
        const manga = MANGA_LIST.find(m => m.id === repoId || m.repo === repoId);
        if (manga && manga.type) {
            mangaType = manga.type;
        }
    }
    dLog('   - Manga Type:', mangaType);
    
    // ✅ Check if user is logged in
    const isLoggedIn = isTokenValid();
    
    if (!isLoggedIn) {
        // ✅ USER BELUM LOGIN - Show locked chapter modal
        dLog('🔒 User belum login - Showing loginRequiredModal');
        const loginRequiredModal = document.getElementById('loginRequiredModal');
        if (loginRequiredModal) {
            loginRequiredModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // ✅ Conditional: Hide trakteer button for webtoon type
            const btnTrakteerPost = document.getElementById('btnTrakteerPost');
            if (btnTrakteerPost) {
                if (mangaType === 'webtoon') {
                    btnTrakteerPost.style.display = 'none';
                    dLog('   - Trakteer button: HIDDEN (webtoon)');
                } else {
                    btnTrakteerPost.style.display = 'block';
                    dLog('   - Trakteer button: SHOWN (manga)');
                }
            }
        }
        return;
    }
    
    // ✅ User is logged in - check if donatur
    const isDonatur = await checkIsDonatur();
    
    if (isDonatur) {
        dLog('✅ Donatur SETIA - Opening chapter directly');
        window.location.href = `reader.html?repo=${encodeURIComponent(repoId)}&chapter=${encodeURIComponent(chapterFolder)}`;
        return;
    }
    
    // ✅ User logged in but not donatur - Show upgrade modal
    dLog('🔒 PEMBACA SETIA (logged in but not donatur) - Showing upgradeModal');
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) {
        upgradeModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Handle chapter link click
 */
function handleChapterClick(event, repoId, chapterFolder, isLocked) {
    dLog('🖱️ Chapter clicked');
    dLog('   - Repo:', repoId);
    dLog('   - Chapter:', chapterFolder);
    dLog('   - Locked:', isLocked);
    
    if (isLocked) {
        event.preventDefault();
        event.stopPropagation();
        showLockedChapterModal(repoId, chapterFolder);
    }
    // If not locked, let the default link behavior work
}

// Make functions available globally for onclick handlers
window.handleChapterClick = handleChapterClick;
window.showLockedChapterModal = showLockedChapterModal;
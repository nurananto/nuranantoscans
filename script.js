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
function createTrendingCard(manga, mangaData, views24h) {
  const cdnUrls = getResponsiveCDN(manga.cover);
  
  // Get manga details
  const title = mangaData.manga?.title || manga.title || 'Unknown Title';
  const genres = mangaData.manga?.genre || [];
  const genresText = genres.length > 0 ? genres.join(', ') : 'Genre not available';
  const synopsis = mangaData.manga?.description || 'Sinopsis tidak tersedia.';
  const status = (mangaData.manga?.status || 'ONGOING').toUpperCase();
  
  // Status badge class
  let statusClass = 'status-ongoing';
  let statusText = 'Ongoing';
  if (status === 'HIATUS') {
    statusClass = 'status-hiatus';
    statusText = 'Hiatus';
  } else if (status === 'COMPLETED' || status === 'TAMAT') {
    statusClass = 'status-completed';
    statusText = 'Tamat';
  }
  
  const card = document.createElement('div');
  card.className = 'trending-card';
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${escapeHTML(title)} - ${statusText}`);
  
  card.innerHTML = `
    <div class="trending-card-left">
      <div class="trending-badges-container">
        <span class="trending-status-badge ${statusClass}">${statusText}</span>
        <div class="trending-24h-badge">
          <svg class="trending-24h-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          TRENDING
        </div>
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
  
  return card;
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
          const views24h = await calculate24HourViews(manga.repo) || 0;
          const lastUpdate = mangaData.lastChapterUpdate ? new Date(mangaData.lastChapterUpdate) : new Date(0);
          return { manga, mangaData, views24h, lastUpdate };
        } catch (error) {
          console.error(`Error fetching data for ${manga.repo}:`, error);
          return { manga, mangaData: { manga: {} }, views24h: 0, lastUpdate: new Date(0) };
        }
      })
    );
    
    // Check if we have views data
    const hasViewsData = mangaWithData.some(item => item.views24h > 0);
    
    let trending;
    if (hasViewsData) {
      // Sort by 24h views (descending) and take top 5
      trending = mangaWithData
        .sort((a, b) => b.views24h - a.views24h)
        .slice(0, 5);
    } else {
      // Fallback: Sort by latest chapter update
      trending = mangaWithData
        .sort((a, b) => b.lastUpdate - a.lastUpdate)
        .slice(0, 5);
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Render cards
    const fragment = document.createDocumentFragment();
    trending.forEach((item) => {
      const card = createTrendingCard(item.manga, item.mangaData, item.views24h);
      fragment.appendChild(card);
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
  
  // ✅ Get chapter info and time for info bar (mirip trending card)
  let chapterNumber = '';
  let timeText = '';
  
  if (mangaData.latestUnlockedChapter && mangaData.latestLockedChapter) {
    const unlockedDate = mangaData.latestUnlockedDate ? new Date(mangaData.latestUnlockedDate) : new Date(0);
    const lockedDate = mangaData.latestLockedDate ? new Date(mangaData.latestLockedDate) : new Date(0);
    
    if (lockedDate > unlockedDate) {
      const formatted = formatChapter(mangaData.latestLockedChapter);
      const lockIcon = isDonaturSetia ? '🔓 ' : '🔒 ';
      chapterNumber = `${lockIcon}${formatted === 'Oneshot' ? 'Oneshot' : 'Ch. ' + formatted}`;
      timeText = getRelativeTime(mangaData.latestLockedDate) || '';
    } else {
      const formatted = formatChapter(mangaData.latestUnlockedChapter);
      chapterNumber = `${formatted === 'Oneshot' ? 'Oneshot' : 'Ch. ' + formatted}`;
      timeText = getRelativeTime(mangaData.latestUnlockedDate) || '';
    }
  } else if (mangaData.latestUnlockedChapter) {
    const formatted = formatChapter(mangaData.latestUnlockedChapter);
    chapterNumber = `${formatted === 'Oneshot' ? 'Oneshot' : 'Ch. ' + formatted}`;
    timeText = getRelativeTime(mangaData.latestUnlockedDate) || '';
  } else if (mangaData.latestLockedChapter) {
    const formatted = formatChapter(mangaData.latestLockedChapter);
    const lockIcon = isDonaturSetia ? '🔓 ' : '🔒 ';
    chapterNumber = `${lockIcon}${formatted === 'Oneshot' ? 'Oneshot' : 'Ch. ' + formatted}`;
    timeText = getRelativeTime(mangaData.latestLockedDate) || '';
  }
  
  // ✅ Status badge di pojok kiri atas cover (seperti trending badge)
  let statusBadgeHTML = '';
  const status = mangaData.status || 'ONGOING';
  
  if (isRecent) {
    // UPDATED badge dengan arrow up icon
    statusBadgeHTML = `
      <div class="status-badge status-badge-updated" aria-label="Recently updated">
        <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        <span>UPDATED!</span>
        <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </div>
    `;
  } else {
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
    
    statusBadgeHTML = `
      <div class="status-badge ${statusClass}" aria-label="${statusText}">
        <span>${statusText}</span>
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
  
  const ariaLabel = `${manga.title}${chapterNumber ? ', ' + chapterNumber : ''}${isRecent ? ', recently updated' : ''}`;
  
  // ✅ Get manga type from manga-config.js (not from manga.json)
  const mangaType = (manga.type || 'manga').toLowerCase();
  const isWebtoon = mangaType === 'webtoon';
  const isNovel = mangaType === 'novel';
  
  let typeBadgeText, typeBadgeClass;
  if (isNovel) {
    typeBadgeText = 'Novel';
    typeBadgeClass = 'type-badge-novel';
  } else if (isWebtoon) {
    typeBadgeText = 'Colour';
    typeBadgeClass = 'type-badge-colour';
  } else {
    typeBadgeText = 'B/W';
    typeBadgeClass = 'type-badge-bw';
  }
  
  if (DEBUG_MODE) {
    dLog(`📖 [TYPE-BADGE] Manga: ${manga.title}, Type: ${mangaType}, Badge: ${typeBadgeText}`);
  }
  
  // ✅ Security: Validate and escape all dynamic data
  const safeRepoId = validateRepoParam(manga.id) ? encodeURIComponent(manga.id) : '';
  const safeMangaTitle = escapeHTML(manga.title);
  const safeAriaLabel = escapeHTML(ariaLabel);
  const safeTypeBadgeText = escapeHTML(typeBadgeText);
  const safeTypeBadgeClass = escapeHTML(typeBadgeClass);
  const safeChapterNumber = escapeHTML(chapterNumber);
  const safeTimeText = escapeHTML(timeText);
  
  return `
    <div class="manga-card ${isRecent ? 'recently-updated' : ''}" 
         role="listitem"
         tabindex="0"
         data-manga-id="${escapeHTML(manga.id)}"
         aria-label="${safeAriaLabel}"
         onclick="if('${safeRepoId}'){window.location.href='info-manga.html?repo=${safeRepoId}'}"
         onkeypress="if((event.key==='Enter'||event.key===' ')&&'${safeRepoId}'){event.preventDefault();window.location.href='info-manga.html?repo=${safeRepoId}'}">
      <div class="manga-cover-wrapper">
        <img 
          src="${escapeHTML(cdnUrls.medium)}"
          srcset="${escapeHTML(srcset)}"
          sizes="${escapeHTML(sizes)}"
          alt="${safeMangaTitle} cover image"
          loading="${loadingAttr}"
          ${fetchPriority}
          ${decodingAttr}
          data-original="${escapeHTML(manga.cover)}"
          aria-hidden="true">
        ${statusBadgeHTML}
        <div class="type-badge ${safeTypeBadgeClass}" aria-label="Type: ${safeTypeBadgeText}">
          <svg class="type-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <path d="M6.5 2v20"/>
          </svg>
          <span class="type-badge-text">${safeTypeBadgeText}</span>
        </div>
      </div>
      <div class="manga-title" aria-hidden="true">${safeMangaTitle}</div>
      <div class="manga-info-bar">
        <span class="manga-chapter">${safeChapterNumber}</span>
        <span class="manga-time">${safeTimeText}</span>
      </div>
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

// ============================================
// PAGINATION SYSTEM
// ============================================

let currentMangaData = []; // Store current manga data for pagination
let currentPage = 0;

/**
 * Get items per page based on viewport
 */
function getItemsPerPage() {
  const width = window.innerWidth;
  if (width >= 1400) return 10; // 5 columns × 2 rows
  if (width >= 1024) return 8;  // 4 columns × 2 rows
  if (width >= 768) return 6;   // 3 columns × 2 rows
  return 4; // 2 columns × 2 rows (mobile)
}

/**
 * Render pagination with pages
 */
function renderPagination(mangaWithData) {
  const mangaGrid = document.getElementById("mangaGrid");
  const paginationControls = document.getElementById("paginationControls");
  const paginationDots = document.getElementById("paginationDots");
  
  const itemsPerPage = getItemsPerPage();
  const totalPages = Math.ceil(mangaWithData.length / itemsPerPage);
  
  // Hide pagination if only 1 page
  if (totalPages <= 1) {
    paginationControls.style.display = 'none';
    // Render single page with smooth transition
    const fragment = document.createDocumentFragment();
    const pageDiv = document.createElement('div');
    pageDiv.className = 'manga-list-page';
    pageDiv.innerHTML = mangaWithData.map(({ manga, mangaData }, index) => 
      createCard(manga, mangaData, index)
    ).join("");
    fragment.appendChild(pageDiv);
    
    // Replace content in one operation
    mangaGrid.innerHTML = '';
    mangaGrid.appendChild(fragment);
    return;
  }
  
  // Show pagination
  paginationControls.style.display = 'flex';
  
  // Build all pages in document fragment first (off-screen)
  const fragment = document.createDocumentFragment();
  
  // Create pages
  for (let i = 0; i < totalPages; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'manga-list-page';
    pageDiv.setAttribute('data-page', i);
    
    const startIdx = i * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, mangaWithData.length);
    const pageItems = mangaWithData.slice(startIdx, endIdx);
    
    pageDiv.innerHTML = pageItems.map(({ manga, mangaData }, index) => 
      createCard(manga, mangaData, startIdx + index)
    ).join("");
    
    fragment.appendChild(pageDiv);
  }
  
  // Replace all content in single operation (no flicker)
  mangaGrid.innerHTML = '';
  mangaGrid.appendChild(fragment);
  
  // Update pagination UI after grid is rendered
  updatePaginationUI();
  
  // Enable mouse drag scroll
  enableMangaListMouseDrag();
}

/**
 * Go to specific page
 */
function goToPage(pageIndex) {
  const itemsPerPage = getItemsPerPage();
  const totalPages = Math.ceil(currentMangaData.length / itemsPerPage);
  
  if (pageIndex < 0 || pageIndex >= totalPages) return;
  
  currentPage = pageIndex;
  scrollToPage(pageIndex);
  updatePaginationUI();
}

/**
 * Scroll to page
 */
function scrollToPage(pageIndex) {
  const mangaGrid = document.getElementById("mangaGrid");
  const pageWidth = mangaGrid.offsetWidth;
  mangaGrid.scrollTo({
    left: pageIndex * pageWidth,
    behavior: 'smooth'
  });
}

/**
 * Update pagination UI with circular dots
 */
function updatePaginationUI() {
  const itemsPerPage = getItemsPerPage();
  const totalPages = Math.ceil(currentMangaData.length / itemsPerPage);
  const paginationDots = document.getElementById("paginationDots");
  
  if (!paginationDots) return;
  
  // Clear existing dots
  paginationDots.innerHTML = '';
  
  // Create circular dots for each page
  for (let i = 0; i < totalPages; i++) {
    const dot = document.createElement('div');
    dot.className = 'pagination-dot';
    if (i === currentPage) dot.classList.add('active');
    
    // Click to navigate to page
    dot.addEventListener('click', () => goToPage(i));
    
    paginationDots.appendChild(dot);
  }
  
  // Scroll to current page
  scrollToPage(currentPage);
}

/**
 * Setup pagination event listeners
 */
function setupPaginationListeners() {
  const mangaGrid = document.getElementById("mangaGrid");
  
  // Scroll detection for updating active dot
  let scrollTimeout;
  mangaGrid.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollLeft = mangaGrid.scrollLeft;
      const pageWidth = mangaGrid.offsetWidth;
      const newPage = Math.round(scrollLeft / pageWidth);
      
      if (newPage !== currentPage) {
        currentPage = newPage;
        updatePaginationUI();
      }
    }, 100);
  });
  
  // Keyboard navigation (arrow keys)
  mangaGrid.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToPage(currentPage + 1);
    }
  });
  
  // Window resize - recalculate pages
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (currentMangaData.length > 0) {
        currentPage = 0; // Reset to first page
        renderPagination(currentMangaData);
      }
    }, 300);
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
        const storedUser = localStorage.getItem('user');
        const isLoggedIn = !!storedUser;
        
        // Update desktop button
        const desktopButtonText = btnOpen.querySelector('.button-text');
        if (desktopButtonText) {
            desktopButtonText.textContent = isLoggedIn ? 'Profile' : 'Login';
        }
        
        // Update mobile button
        const btnOpenMobile = document.getElementById('btnOpenLoginMobile');
        if (btnOpenMobile) {
            const mobileButtonText = btnOpenMobile.querySelector('span');
            if (mobileButtonText) {
                mobileButtonText.textContent = isLoggedIn ? 'Profile' : 'Login';
            }
        }
        
        dLog('🔄 [UPDATE] Profile button updated:', isLoggedIn ? 'Profile' : 'Login');
    }
    
    // ✅ Make function globally accessible
    window.updateProfileButtonText = updateProfileButtonText;

    // ✅ STEP 1: Check localStorage on page load and update button
    dLog('📦 [STORAGE] ========================================');
    dLog('📦 [STORAGE] Checking localStorage...');
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');
    updateProfileButtonText();
    
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
        
        // Update username (temporary - will be replaced by loadProfileData)
        const usernameEl = profileModal.querySelector('#profileUsername');
        if (usernameEl && user && user.username) {
            usernameEl.textContent = user.username;
            dLog('✅ [PROFILE] Username updated to (temporary):', user.username);
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
    
    // 🆕 Set up periodic API status check (every 2 minutes) - RECOMMENDED FOR WEBAPP
    // This ensures donatur status stays fresh even if user doesn't switch tabs
    const PERIODIC_CHECK_INTERVAL = 120000; // 2 minutes (adjustable: 60000 = 1 min, 300000 = 5 min)
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
    dWarn('Invalid date format:', isoString);
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
    
    // ✅ Security: Escape all dynamic data
    const safeMangaId = escapeHTML(item.manga_id);
    const safeChapterId = escapeHTML(item.chapter_id);
    const safeMangaTitle = escapeHTML(item.manga_title);
    const safeCover = escapeHTML(cover);
    const safeChapterNum = escapeHTML(chapterNum);
    const safeTimeAgo = escapeHTML(timeAgo);
    
    return `
      <div class="history-card" 
           data-manga-id="${safeMangaId}" 
           data-chapter="${safeChapterId}"
           tabindex="0"
           role="button">
        <img src="${safeCover}" 
             alt="${safeMangaTitle} cover" 
             class="history-cover"
             loading="lazy"
             data-original="${safeCover}"
             onerror="this.onerror=null; this.src='assets/Logo 2.png';">
        <div class="history-info">
          <div class="history-manga-title">${safeMangaTitle}</div>
          <div class="history-chapter">Chapter ${safeChapterNum}</div>
          <div class="history-time">${safeTimeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  listEl.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const mangaId = card.getAttribute('data-manga-id');
      const chapterId = card.getAttribute('data-chapter');
      // ✅ Security: Validate parameters before redirect
      if (validateRepoParam(mangaId) && validateChapterParam(chapterId)) {
        window.location.href = `reader.html?repo=${encodeURIComponent(mangaId)}&chapter=${encodeURIComponent(chapterId)}`;
      }
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
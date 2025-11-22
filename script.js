// ============================================
// SCRIPT.JS - MAIN PAGE (index.html) - FIXED
// ============================================

async function fetchMangaData(repo) {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/nurananto/${repo}/main/manga.json`);
    if (!response.ok) throw new Error('Failed to fetch manga data');
    const data = await response.json();
    
    // Get latest unlocked chapter
    let latestUnlockedChapter = null;
    let latestUnlockedDate = null;
    
    // Get latest locked chapter
    let latestLockedChapter = null;
    let latestLockedDate = null;
    
    if (data.chapters) {
      const chaptersArray = Object.values(data.chapters);
      
      // Filter unlocked chapters
      const unlockedChapters = chaptersArray.filter(ch => !ch.locked);
      if (unlockedChapters.length > 0) {
        // Sort by uploadDate (newest first)
        unlockedChapters.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        latestUnlockedChapter = unlockedChapters[0].folder;
        latestUnlockedDate = unlockedChapters[0].uploadDate;
      }
      
      // Filter locked chapters
      const lockedChapters = chaptersArray.filter(ch => ch.locked);
      if (lockedChapters.length > 0) {
        // Sort by uploadDate (newest first)
        lockedChapters.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        latestLockedChapter = lockedChapters[0].folder;
        latestLockedDate = lockedChapters[0].uploadDate;
      }
    }
    
    return {
      lastUpdated: data.lastUpdated || null,
      lastChapterUpdate: data.lastChapterUpdate || data.lastUpdated || null,
      totalChapters: Object.keys(data.chapters || {}).length,
      latestUnlockedChapter: latestUnlockedChapter,
      latestUnlockedDate: latestUnlockedDate,
      latestLockedChapter: latestLockedChapter,
      latestLockedDate: latestLockedDate
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
  
  if (!lastChapterUpdate || isNaN(lastChapterUpdate.getTime())) {
    console.warn(`Invalid date format: ${lastChapterUpdateStr}`);
    return false;
  }
  
  const now = new Date();
  const diffDays = (now - lastChapterUpdate) / (1000 * 60 * 60 * 24);
  
  if (diffDays < 0) {
    console.warn(`Future date detected: ${lastChapterUpdateStr}`);
    return false;
  }
  
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
  
  if (diffMins < 60) {
    return `${diffMins} menit yang lalu`;
  } else if (diffHours < 24) {
    return `${diffHours} jam yang lalu`;
  } else if (diffDays === 1) {
    return 'Kemarin';
  } else if (diffDays < 7) {
    return `${diffDays} hari yang lalu`;
  } else {
    return lastChapterUpdate.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
  }
}

function createCard(manga, mangaData, index = 0) {
  const isRecent = isRecentlyUpdated(mangaData.lastChapterUpdate);
  
  // Format chapter number (remove leading zeros, keep decimal if exists)
  const formatChapter = (chapterNum) => {
    if (!chapterNum) return '';
    
    // Check if it's "oneshot" or similar
    const chapterStr = chapterNum.toString().toLowerCase();
    if (chapterStr.includes('oneshot') || chapterStr.includes('one-shot') || chapterStr === 'os') {
      return 'Oneshot';
    }
    
    // Try to parse as number
    const num = parseFloat(chapterNum);
    if (isNaN(num)) {
      // If not a number, return as-is (capitalized)
      return chapterNum.toString();
    }
    
    return num % 1 === 0 ? num.toString() : num.toFixed(1);
  };
  
  // Determine which chapter to show (newest one)
  let chapterText = '';
  
  if (mangaData.latestUnlockedDate && mangaData.latestLockedDate) {
    // Both exist - compare dates
    const unlockedDate = new Date(mangaData.latestUnlockedDate);
    const lockedDate = new Date(mangaData.latestLockedDate);
    
    if (lockedDate > unlockedDate) {
      // Locked is newer
      const lockedTime = getRelativeTime(mangaData.latestLockedDate);
      chapterText = `🔒 Ch. ${formatChapter(mangaData.latestLockedChapter)}${lockedTime ? ` - ${lockedTime}` : ''}`;
    } else {
      // Unlocked is newer (or same date)
      const unlockedTime = getRelativeTime(mangaData.latestUnlockedDate);
      chapterText = `Ch. ${formatChapter(mangaData.latestUnlockedChapter)}${unlockedTime ? ` - ${unlockedTime}` : ''}`;
    }
  } else if (mangaData.latestUnlockedDate) {
    // Only unlocked exists
    const unlockedTime = getRelativeTime(mangaData.latestUnlockedDate);
    chapterText = `Ch. ${formatChapter(mangaData.latestUnlockedChapter)}${unlockedTime ? ` - ${unlockedTime}` : ''}`;
  } else if (mangaData.latestLockedDate) {
    // Only locked exists
    const lockedTime = getRelativeTime(mangaData.latestLockedDate);
    chapterText = `🔒 Ch. ${formatChapter(mangaData.latestLockedChapter)}${lockedTime ? ` - ${lockedTime}` : ''}`;
  }
  
  const updatedBadge = isRecent && chapterText ? `
    <div class="updated-badge">
      <span class="badge-text">UPDATED!</span>
      <span class="badge-chapter">${chapterText}</span>
    </div>
  ` : '';
  
  const placeholderSVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='420' viewBox='0 0 300 420'%3E%3Crect width='300' height='420' fill='%231a1a1a'/%3E%3Cg fill='%23666'%3E%3Cpath d='M150 160c-22.091 0-40 17.909-40 40s17.909 40 40 40 40-17.909 40-40-17.909-40-40-40zm0 60c-11.046 0-20-8.954-20-20s8.954-20 20-20 20 8.954 20 20-8.954 20-20 20z'/%3E%3Cpath d='M250 120H50c-11.046 0-20 8.954-20 20v160c0 11.046 8.954 20 20 20h200c11.046 0 20-8.954 20-20V140c0-11.046-8.954-20-20-20zm0 180H50V140h200v160z'/%3E%3C/g%3E%3Ctext x='150' y='350' font-family='Arial,sans-serif' font-size='16' fill='%23666' text-anchor='middle'%3ENo Image%3C/text%3E%3C/svg%3E`;
  
  // Desktop (5 cols): First 10 covers = 2 rows (above fold)
  // Tablet (3 cols): First 6 covers = 2 rows
  // Mobile (2 cols): First 4 covers = 2 rows
  const eagerLoadCount = window.innerWidth >= 1024 ? 10 : (window.innerWidth >= 768 ? 6 : 4);
  
  const loadingAttr = index < eagerLoadCount ? 'eager' : 'lazy';
  const fetchPriority = index < eagerLoadCount ? ' fetchpriority="high"' : '';
  
  return `
    <div class="manga-card ${isRecent ? 'recently-updated' : ''}" onclick="window.location.href='info-manga.html?repo=${manga.id}'">
      <img src="${manga.cover}" alt="${manga.title}" loading="${loadingAttr}"${fetchPriority} onerror="this.src='${placeholderSVG}'">
      ${updatedBadge}
      <div class="manga-title">${manga.title}</div>
    </div>`;
}

async function renderManga(filteredList) {
  const mangaGrid = document.getElementById("mangaGrid");
  const loadingIndicator = document.getElementById("loadingIndicator");
  
  loadingIndicator.classList.add('show');
  mangaGrid.innerHTML = '';
  
  const mangaWithData = await Promise.all(
    filteredList.map(async (manga) => {
      const mangaData = await fetchMangaData(manga.repo);
      return { 
        manga, 
        mangaData,
        lastChapterUpdate: mangaData.lastChapterUpdate
      };
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
      <div class="empty-state">
        <p>Tidak ada manga yang ditemukan</p>
        <p style="font-size: 14px;">Coba kata kunci yang berbeda</p>
      </div>
    `;
    return;
  }
  
  mangaGrid.innerHTML = mangaWithData.map(({ manga, mangaData }, index) => 
    createCard(manga, mangaData, index)
  ).join("");
  
  console.log('✅ Manga sorted by lastChapterUpdate (newest first)');
}

let searchTimeout;
document.addEventListener('DOMContentLoaded', function() {
  // manga-config.js exports: const mangaList = MANGA_LIST;
  if (typeof mangaList === 'undefined') {
    console.error('❌ ERROR: mangaList not found!');
    console.error('Make sure manga-config.js is loaded before script.js in index.html');
    return;
  }
  
  console.log('🚀 Initializing manga list...');
  console.log('📚 Total manga:', mangaList.length);
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

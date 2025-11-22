// ============================================
// MANGA CONFIGURATION - SINGLE SOURCE OF TRUTH
// ============================================
// File ini adalah SATU-SATUNYA tempat untuk manage data manga
// Dipakai oleh: index.html, info-manga.html, reader.html
//
// CARA TAMBAH MANGA BARU:
// 1. Copy salah satu entry di bawah
// 2. Paste di paling atas array MANGA_LIST
// 3. Update semua field (title, cover, repo)
// 4. Save & push - DONE! Otomatis muncul di semua halaman
// ============================================

MANGA_LIST = [
  {
    id: 'Waka-chan',
    title: 'Waka-chan wa Kyou mo Azatoi',
    cover: 'covers/wakachan-c15f762d-5437-4f73-aa85-64a7b686ddba.webp',
    repo: 'Waka-chan'
  },
  ];

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get manga by ID
function getMangaById(id) {
  return MANGA_LIST.find(manga => manga.id === id);
}

// Get manga by repo name
function getMangaByRepo(repo) {
  return MANGA_LIST.find(manga => manga.repo === repo);
}

// Construct URLs
function getMangaDataURL(manga) {
  return `https://raw.githubusercontent.com/nurananto/${manga.repo}/main/manga.json`;
}

function getChaptersDataURL(manga) {
  return `https://raw.githubusercontent.com/nurananto/${manga.repo}/main/chapters.json`;
}

function getChapterImageURL(manga, chapterFolder, imageName) {
  return `https://raw.githubusercontent.com/nurananto/${manga.repo}/main/${chapterFolder}/${imageName}`;
}

// ============================================
// EXPORTS (untuk compatibility)
// ============================================

// Export untuk script.js (index.html)
const mangaList = MANGA_LIST;

// Export untuk info-manga.js dan reader.js
// NEW FORMAT: Include githubRepo untuk view counter
MANGA_REPOS = {};
MANGA_LIST.forEach(manga => {
  MANGA_REPOS[manga.id] = {
    url: getMangaDataURL(manga),
    githubRepo: manga.repo  // ← ADD THIS for view counter!
  };
});

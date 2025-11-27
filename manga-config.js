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
    id: 'waka-chan',
    title: 'Waka-chan wa Kyou mo Azatoi',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/waka-chan-c15f762d-5437-4f73-aa85-64a7b686ddba.webp',
    repo: 'Waka-chan'
  },
  {
    id: 'aiwooshiete',
    title: 'Watashi ni Ai wo Oshiete',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/aiwooshiete-e56a300a-60aa-433e-8589-c8a963f188f8.webp',
    repo: 'AiwoOshiete'
  },
  {
    id: 'madogiwa',
    title: 'Madogiwa Henshuu to Baka ni Sareta Ore ga, Futago JK to Doukyo suru Koto ni Natta',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/madogiwa-ce74d132-81f0-491a-bb19-83de73746c8e.webp',
    repo: 'MadogiwaHenshuu'
  },
  {
    id: 'aotosakura',
    title: 'Ao to Sakura',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/aotosakura-8f1fc328-3eaf-4bd9-8631-c5c9f8029ed5.webp',
    repo: 'AotoSakura'
  },
  {
    id: 'yarikonda',
    title: 'Yarikonda Renai Game no Akuyaku ni Tensei shitanode, Gensaku Chishiki de Heroine wo Kouryaku shimasu',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/yarikonda-eaecd9b5-0510-46aa-b65c-a09611fa912b.webp',
    repo: 'YarikondaRenaiGame'
  },
  {
    id: 'negatte',
    title: 'Negatte mo Nai Tsuihou Go kara no Slow Life? ~Intai Shita Hazu ga Nariyuki de Bishoujo Gal no Shishou ni Nattara Naze ka Mechakucha Natsukareta~',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/negatte-dee7c542-0efd-4e72-8df1-5d71a2b08c6d.webp',
    repo: 'NegattemoNai'
  },
  {
    id: 'vtuber',
    title: 'Yuumei VTuber no Ani Dakedo, Nazeka Ore ga Yuumei ni Natteita',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/vtuber-493c315e-5492-4d76-80e9-1f55f9e5849e.webp',
    repo: 'YuumeiVTuber'
  },
  {
    id: '10nenburi',
    title: '10-Nen Buri ni Saikai shita Kusogaki wa Seijun Bishoujo JK ni Seichou shiteita',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/10nenburi-254730e0-71bd-4008-9c08-e9d9d1d0989e.webp',
    repo: '10nenburi'
  },
  {
    id: 'suufungo',
    title: 'Suufungo no Mirai ga Wakaru You ni Natta kedo, Onnagokoro wa Wakaranai.',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/suufungo-b681b78e-75ce-4464-8089-50f37f00e0e9.webp',
    repo: 'SuufungonoMirai'
  },
  {
    id: 'mememenomememe',
    title: 'Mememe no Mememe',
    cover: 'https://cdn.nuranantoscans.my.id/manga-list/covers/mememenomememe-1a442277-f099-4ebb-8ea2-6d7e55002838.webp',
    repo: 'MememenoMememe'
  }
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

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
    id: 'tenshisenpai',
    title: 'Tenshi Senpai',
    cover: 'https://cdn.nuranantoscans.my.id/covers/tenshisenpai-cover.webp',
    repo: 'TenshiSenpai'
  },
  {
    id: 'haibarakun',
    title: 'Haibara-kun no Tsuyokute Seishun New Game',
    cover: 'https://cdn.nuranantoscans.my.id/covers/haibarakun-4b90a775-bf6a-41fb-aefb-73d88720ddbc.webp',
    repo: 'Haibara-kun'
  },
  {
    id: 'kiminisasayaku',
    title: 'Kimi ni Sasayaku',
    cover: 'https://cdn.nuranantoscans.my.id/covers/KiminiSasayaku-cover.webp',
    repo: 'KiminiSasayaku'
  },
  {
    id: 'wearenotdating',
    title: 'We Are not Dating!!',
    cover: 'https://cdn.nuranantoscans.my.id/covers/wearenotdating-ff110214-8c55-4479-b7d8-bf2fc4658e4e.webp',
    repo: 'WearenotDating'
  },
  {
    id: 'gotousan',
    title: 'Gotou-san wa Furimukasetai!',
    cover: 'https://cdn.nuranantoscans.my.id/covers/gotousan-c396db84-6cc5-41c0-bf66-f54d0cfa2b44.webp',
    repo: 'Gotou-san'
  },
  {
    id: 'yuurikuntochihirochan',
    title: 'Yuuri-kun to Chihiro-chan',
    cover: 'https://cdn.nuranantoscans.my.id/covers/yuurikuntochihirochan-8235d341-4f78-4d32-a747-08ba7c4afa58.webp',
    repo: 'YuurikuntoChihirochan'
  },
  {
    id: 'teisougyakuten',
    title: 'Teisou Gyakuten Sekai Nara Moteru to Omotte Itara',
    cover: 'https://cdn.nuranantoscans.my.id/covers/teisougyakuten-bdb1f782-3cad-4938-919f-0035c38e641a.webp',
    repo: 'TeisouGyakuten'
  },
  {
    id: 'karadaoarawasanai',
    title: 'Na wa Karada o Arawasanai',
    cover: 'https://cdn.nuranantoscans.my.id/covers/KaradaoArawasanai-Cover.webp',
    repo: 'KaradaoArawasanai'
  },
  {
    id: 'yuureigahatsukoi',
    title: 'Moshimo, Yuurei ga Hatsukoi o Shitara',
    cover: 'https://cdn.nuranantoscans.my.id/covers/yuureigahatsukoi-1f5fe857-3e84-451f-8a1c-d25e3960c1b4.webp',
    repo: 'YuureigaHatsukoi'
  },
  {
    id: 'mendokusai',
    title: 'Mendokusai Yuurei desu ga, Watashi to Koi Shite Kuremasu ka?',
    cover: 'https://cdn.nuranantoscans.my.id/covers/mendokusai-ac0ac741-c94b-441b-ac30-9b4d9a41f9f1.webp',
    repo: 'MendokusaiYuurei'
  },
  {
    id: 'youkyaninatta',
    title: 'Youkya ni Natta Ore no Seishun Shijou Shugi',
    cover: 'https://cdn.nuranantoscans.my.id/covers/youkyaninatta-3eaf02cf-980c-44af-9ab9-2032f7458fb8.webp',
    repo: 'YoukyaniNatta'
  },
  {
    id: 'kawaiigal',
    title: 'Class de Ichiban Kawaii Gal o Ezuke Shiteiru Hanashi',
    cover: 'https://cdn.nuranantoscans.my.id/covers/kawaiigal-057c4259-5fef-4db3-aef5-a805c7f096c2.webp',
    repo: 'KawaiiGal'
  },
  {
    id: 'amarichan',
    title: 'Kanojo ni Shitai Joshi Ichii, no Tonari de Mitsuketa Amari-chan',
    cover: 'https://cdn.nuranantoscans.my.id/covers/amarichan-6ffed041-aa59-49e2-b79f-dac40ac0ef53.webp',
    repo: 'Amarichan'
  },
  {
    id: 'sankakukei',
    title: 'Seishun wa Sankakukei no Loop',
    cover: 'https://cdn.nuranantoscans.my.id/covers/sankakukei-4cf5a0cc-9123-43bd-bf54-c5f8c0aa9e16.webp',
    repo: 'SankakukeinoLoop'
  },
  {
    id: 'tensai',
    title: 'Tensai Bishoujo Sanshimai wa Isourou ni Dake Choro Kawaii',
    cover: 'https://cdn.nuranantoscans.my.id/covers/tensai-3964fb0f-aa43-492f-a693-a83b70e35371.webp',
    repo: 'TensaiBishoujo'
  },
  {
    id: 'midari',
    title: 'Midari ni Tsukasete wa Narimasen',
    cover: 'https://cdn.nuranantoscans.my.id/covers/midari-d86648a6-77d3-4a95-a8d2-b296da206065.webp',
    repo: 'Midari'
  },
  {
    id: 'kiminonegai',
    title: 'Kimi no Negai ga Kanau Made',
    cover: 'https://cdn.nuranantoscans.my.id/covers/kiminonegai-5c6872ff-e467-44e1-b190-b01c0c1d8857.webp',
    repo: 'KiminoNegai'
  },
  {
    id: 'uchi',
    title: 'Uchi no Seiso-kei Iinchou ga Katsute Chuunibyou Idol datta Koto o Ore Dake ga Shitteiru.',
    cover: 'https://cdn.nuranantoscans.my.id/covers/uchi-10d163e1-853d-4bbb-9131-b99534a1836b.webp',
    repo: 'UchinoSeiso-kei'
  },
  {
    id: 'waka-chan',
    title: 'Waka-chan wa Kyou mo Azatoi',
    cover: 'https://cdn.nuranantoscans.my.id/covers/waka-chan-c15f762d-5437-4f73-aa85-64a7b686ddba.webp',
    repo: 'Waka-chan'
  },
  {
    id: 'aiwooshiete',
    title: 'Watashi ni Ai wo Oshiete',
    cover: 'https://cdn.nuranantoscans.my.id/covers/aiwooshiete-e56a300a-60aa-433e-8589-c8a963f188f8.webp',
    repo: 'AiwoOshiete'
  },
  {
    id: 'madogiwa',
    title: 'Madogiwa Henshuu to Baka ni Sareta Ore ga, Futago JK to Doukyo suru Koto ni Natta',
    cover: 'https://cdn.nuranantoscans.my.id/covers/madogiwa-ce74d132-81f0-491a-bb19-83de73746c8e.webp',
    repo: 'MadogiwaHenshuu'
  },
  {
    id: 'aotosakura',
    title: 'Ao to Sakura',
    cover: 'https://cdn.nuranantoscans.my.id/covers/aotosakura-8f1fc328-3eaf-4bd9-8631-c5c9f8029ed5.webp',
    repo: 'AotoSakura'
  },
  {
    id: 'yarikonda',
    title: 'Yarikonda Renai Game no Akuyaku ni Tensei shitanode, Gensaku Chishiki de Heroine wo Kouryaku shimasu',
    cover: 'https://cdn.nuranantoscans.my.id/covers/yarikonda-eddbbab2-d0a4-4bb2-a12d-98e4f2ad7a1d.webp',
    repo: 'YarikondaRenaiGame'
  },
  {
    id: 'negatte',
    title: 'Negatte mo Nai Tsuihou Go kara no Slow Life? ~Intai Shita Hazu ga Nariyuki de Bishoujo Gal no Shishou ni Nattara Naze ka Mechakucha Natsukareta~',
    cover: 'https://cdn.nuranantoscans.my.id/covers/negatte-dee7c542-0efd-4e72-8df1-5d71a2b08c6d.webp',
    repo: 'NegattemoNai'
  },
  {
    id: 'vtuber',
    title: 'Yuumei VTuber no Ani Dakedo, Nazeka Ore ga Yuumei ni Natteita',
    cover: 'https://cdn.nuranantoscans.my.id/covers/vtuber-493c315e-5492-4d76-80e9-1f55f9e5849e.webp',
    repo: 'YuumeiVTuber'
  },
  {
    id: '10nenburi',
    title: '10-Nen Buri ni Saikai shita Kusogaki wa Seijun Bishoujo JK ni Seichou shiteita',
    cover: 'https://cdn.nuranantoscans.my.id/covers/10nenburi-254730e0-71bd-4008-9c08-e9d9d1d0989e.webp',
    repo: '10nenburi'
  },
  {
    id: 'suufungo',
    title: 'Suufungo no Mirai ga Wakaru You ni Natta kedo, Onnagokoro wa Wakaranai.',
    cover: 'https://cdn.nuranantoscans.my.id/covers/suufungo-b681b78e-75ce-4464-8089-50f37f00e0e9.webp',
    repo: 'SuufungonoMirai'
  },
  {
    id: 'mememenomememe',
    title: 'Mememe no Mememe',
    cover: 'https://cdn.nuranantoscans.my.id/covers/mememenomememe-1a442277-f099-4ebb-8ea2-6d7e55002838.webp',
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

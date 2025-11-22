/**
 * SCRIPT DOWNLOAD COVER MANGA DARI MANGADEX v6.0
 * FITUR: Auto-ambil cover TERBARU & Auto-convert JPG → WebP
 * 
 * Update v6.0:
 * - Smart detection: auto-convert existing JPG to WebP
 * - Single script untuk semua kebutuhan
 * 
 * Cara Pakai:
 * 1. npm install sharp
 * 2. node download-covers.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');
const sharp = require('sharp');

// Config
const DELAY_MS = 1500;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const FORCE_UPDATE = false;
const WEBP_QUALITY = 85;

// Load manga-config.js
const MANGA_CONFIG_PATH = path.join(__dirname, 'manga-config.js');
let MANGA_LIST = [];
let MANGA_REPOS = {};

try {
  console.log('📋 Loading manga-config.js...');
  
  const configContent = fs.readFileSync(MANGA_CONFIG_PATH, 'utf-8');
  
  const sandbox = {
    console: console,
    MANGA_LIST: null,
    MANGA_REPOS: null
  };
  
  vm.createContext(sandbox);
  vm.runInContext(configContent, sandbox);
  
  MANGA_LIST = sandbox.MANGA_LIST;
  MANGA_REPOS = sandbox.MANGA_REPOS;
  
  if (!MANGA_LIST || MANGA_LIST.length === 0) {
    throw new Error('MANGA_LIST is empty or undefined');
  }
  
  if (!MANGA_REPOS || Object.keys(MANGA_REPOS).length === 0) {
    throw new Error('MANGA_REPOS is empty or undefined');
  }
  
  console.log(`✅ Loaded ${MANGA_LIST.length} manga from manga-config.js`);
  console.log(`✅ Generated ${Object.keys(MANGA_REPOS).length} repo mappings\n`);
  
} catch (error) {
  console.error('❌ Error loading manga-config.js:', error.message);
  console.error('\n💡 Pastikan manga-config.js ada dan format nya benar');
  process.exit(1);
}

console.log('🔍 Mode: Smart cover management');
console.log('   - Detect existing JPG → auto-convert to WebP');
console.log('   - Download new covers → convert to WebP');
console.log('   - Skip covers that are already WebP\n');

// Buat folder covers
const coversDir = path.join(__dirname, 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir);
}

// Fetch manga.json dari URL
function fetchMangaJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      let data = '';
      
      if (res.statusCode === 404) {
        reject(new Error('manga.json tidak ditemukan'));
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function getMangaIdFromUrl(url) {
  const match = url.match(/\/title\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const options = {
      headers: { 'User-Agent': USER_AGENT }
    };
    
    https.get(url, options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return https.get(response.headers.location, options, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function convertToWebP(inputPath, outputPath) {
  try {
    const info = await sharp(inputPath)
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);
    
    return info;
  } catch (error) {
    throw new Error(`WebP conversion failed: ${error.message}`);
  }
}

async function fetchLatestCover(mangaId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mangadex.org',
      path: `/cover?manga[]=${mangaId}&limit=1&order[createdAt]=desc`,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      if (res.statusCode === 429) {
        reject(new Error('Rate limit exceeded'));
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (!json.data || json.data.length === 0) {
            reject(new Error('Cover tidak ditemukan'));
            return;
          }
          
          const coverData = json.data[0];
          const coverFilename = coverData.attributes.fileName;
          const coverUrl = `https://uploads.mangadex.org/covers/${mangaId}/${coverFilename}`;
          const createdAt = coverData.attributes.createdAt;
          
          resolve({ 
            url: coverUrl, 
            filename: coverFilename,
            createdAt: createdAt 
          });
          
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processAllManga() {
  const updatedMangaList = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let convertedCount = 0; // JPG → WebP conversion count

  for (let i = 0; i < MANGA_LIST.length; i++) {
    const manga = MANGA_LIST[i];
    
    console.log(`\n[${i + 1}/${MANGA_LIST.length}] ${manga.title}`);
    
    try {
      const mangaConfig = MANGA_REPOS[manga.id];
      
      if (!mangaConfig) {
        console.log(`  ⚠️  Tidak ada config untuk: ${manga.id}`);
        updatedMangaList.push(manga);
        errorCount++;
        continue;
      }
      
      const mangaJsonUrl = typeof mangaConfig === 'string' ? mangaConfig : mangaConfig.url;
      
      console.log(`  🔍 Fetch manga.json...`);
      const mangaJson = await fetchMangaJson(mangaJsonUrl);
      
      let mangadexUrl = null;
      
      if (mangaJson.manga && mangaJson.manga.links && mangaJson.manga.links.mangadex) {
        mangadexUrl = mangaJson.manga.links.mangadex;
      } else if (mangaJson.links && mangaJson.links.mangadex) {
        mangadexUrl = mangaJson.links.mangadex;
      } else if (mangaJson.mangadex) {
        mangadexUrl = mangaJson.mangadex;
      }
      
      if (!mangadexUrl) {
        console.log('  ⚠️  Tidak ada MangaDex URL di manga.json');
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }
      
      const mangaId = getMangaIdFromUrl(mangadexUrl);
      if (!mangaId) {
        console.log('  ⚠️  MangaDex URL tidak valid');
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }

      console.log('  🔍 Cek cover terbaru dari MangaDex...');
      const latestCover = await fetchLatestCover(mangaId);

      const coverHash = latestCover.filename.split('.')[0];
      
      // Target WebP filename
      const newCoverFilename = `${manga.id}-${coverHash}.webp`;
      const newCoverPath = path.join(coversDir, newCoverFilename);
      
      // Check existing covers (JPG, JPEG, WebP)
      const existingCovers = fs.readdirSync(coversDir)
        .filter(f => f.startsWith(manga.id + '-'));
      
      // Check if already has WebP with latest hash
      const alreadyHasWebP = existingCovers.some(f => f === newCoverFilename);
      
      // Check if has JPG version (same hash or different)
      const jpgVersions = existingCovers.filter(f => 
        (f.endsWith('.jpg') || f.endsWith('.jpeg'))
      );
      
      // SCENARIO 1: Already has WebP with latest hash → Skip
      if (alreadyHasWebP && jpgVersions.length === 0 && !FORCE_UPDATE) {
        console.log(`  ✅ Sudah punya cover terbaru (WebP)`);
        manga.cover = `covers/${newCoverFilename}`;
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }
      
      // SCENARIO 2: Has JPG version (same hash) → Convert to WebP
      const jpgSameHash = jpgVersions.find(f => f.includes(coverHash));
      if (jpgSameHash && !alreadyHasWebP) {
        console.log(`  🔄 Converting existing JPG to WebP...`);
        const jpgPath = path.join(coversDir, jpgSameHash);
        const jpgSize = fs.statSync(jpgPath).size;
        
        const info = await convertToWebP(jpgPath, newCoverPath);
        const webpSize = info.size;
        const reduction = ((1 - webpSize / jpgSize) * 100).toFixed(1);
        
        console.log(`  ✅ ${(jpgSize / 1024).toFixed(1)} KB → ${(webpSize / 1024).toFixed(1)} KB (${reduction}% smaller)`);
        
        // Delete old JPG
        fs.unlinkSync(jpgPath);
        console.log(`  🗑️  Deleted: ${jpgSameHash}`);
        
        manga.cover = `covers/${newCoverFilename}`;
        updatedMangaList.push(manga);
        convertedCount++;
        successCount++;
        continue;
      }
      
      // SCENARIO 3: Has old JPG (different hash) → Download new & convert
      // SCENARIO 4: No cover at all → Download & convert
      console.log('  📥 Downloading cover...');
      const tempJpgPath = path.join(coversDir, `temp-${manga.id}.jpg`);
      await downloadFile(latestCover.url, tempJpgPath);
      
      console.log('  🔄 Converting to WebP...');
      const tempJpgSize = fs.statSync(tempJpgPath).size;
      const info = await convertToWebP(tempJpgPath, newCoverPath);
      const webpSize = info.size;
      const reduction = ((1 - webpSize / tempJpgSize) * 100).toFixed(1);
      
      console.log(`  ✅ WebP created: ${(webpSize / 1024).toFixed(1)} KB (${reduction}% smaller)`);
      
      // Delete temp JPG
      fs.unlinkSync(tempJpgPath);
      
      // Delete ALL old covers (JPG and old WebP)
      if (existingCovers.length > 0) {
        console.log('  🔄 Mengganti cover lama...');
        existingCovers.forEach(oldCover => {
          const oldCoverPath = path.join(coversDir, oldCover);
          if (oldCoverPath !== newCoverPath && fs.existsSync(oldCoverPath)) {
            fs.unlinkSync(oldCoverPath);
            console.log(`  🗑️  Deleted: ${oldCover}`);
          }
        });
      }
      
      console.log(`  ✅ Berhasil: covers/${newCoverFilename}`);
      console.log(`  📅 Upload: ${new Date(latestCover.createdAt).toLocaleDateString()}`);
      
      manga.cover = `covers/${newCoverFilename}`;
      updatedMangaList.push(manga);
      successCount++;
      
      if (i < MANGA_LIST.length - 1) {
        await delay(DELAY_MS);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      
      if (error.message.includes('Rate limit')) {
        console.log('  ⏸️  Tunggu 30 detik...');
        await delay(30000);
        i--;
        continue;
      }
      
      if (manga.cover) {
        console.log('  ℹ️  Pakai cover lama');
      }
      
      updatedMangaList.push(manga);
      errorCount++;
    }
  }

  return { updatedMangaList, successCount, skipCount, errorCount, convertedCount };
}

async function syncCoverToRepos(updatedMangaList) {
  console.log('\n📤 Syncing covers to manga repos...\n');
  
  let syncSuccess = 0;
  let syncFailed = 0;
  
  for (const manga of updatedMangaList) {
    if (!manga.cover) {
      console.log(`  ⏭️  Skip ${manga.id} (no cover)`);
      continue;
    }
    
    try {
      const coverUrl = `https://raw.githubusercontent.com/nurananto/NuranantoScanlation/refs/heads/main/${manga.cover}`;
      const configUrl = `https://raw.githubusercontent.com/nurananto/${manga.repo}/main/manga-config.json`;
      
      console.log(`  📝 ${manga.id}...`);
      
      const response = await new Promise((resolve, reject) => {
        https.get(configUrl, { headers: { 'User-Agent': USER_AGENT } }, resolve).on('error', reject);
      });
      
      if (response.statusCode !== 200) {
        throw new Error(`HTTP ${response.statusCode}`);
      }
      
      let data = '';
      for await (const chunk of response) {
        data += chunk;
      }
      
      const config = JSON.parse(data);
      config.cover = coverUrl;
      
      const repoPath = path.join(__dirname, '..', manga.repo);
      if (fs.existsSync(repoPath)) {
        const configPath = path.join(repoPath, 'manga-config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`  ✅ Updated ${manga.id}`);
        syncSuccess++;
      } else {
        console.log(`  ⚠️  Repo ${manga.repo} not found locally (will sync via workflow)`);
      }
      
      await delay(500);
      
    } catch (error) {
      console.log(`  ❌ ${manga.id}: ${error.message}`);
      syncFailed++;
    }
  }
  
  console.log(`\n✅ Sync complete: ${syncSuccess} success, ${syncFailed} failed\n`);
}

function updateMangaConfigJs(updatedMangaList) {
  const configContent = fs.readFileSync(MANGA_CONFIG_PATH, 'utf-8');
  
  const listStart = configContent.indexOf('MANGA_LIST = [');
  const listEnd = configContent.indexOf('];', listStart) + 2;
  
  if (listStart === -1 || listEnd === -1) {
    throw new Error('Could not find MANGA_LIST in manga-config.js');
  }
  
  const newMangaListStr = 'MANGA_LIST = [\n' +
    updatedMangaList.map(manga => {
      return `  {\n` +
        `    id: '${manga.id}',\n` +
        `    title: '${manga.title.replace(/'/g, "\\'")}',\n` +
        `    cover: '${manga.cover}',\n` +
        `    repo: '${manga.repo}'\n` +
        `  }`;
    }).join(',\n') +
    '\n];';
  
  const before = configContent.substring(0, listStart);
  const after = configContent.substring(listEnd);
  const newContent = before + newMangaListStr + after;
  
  const backupPath = path.join(__dirname, 'manga-config.js.backup');
  fs.copyFileSync(MANGA_CONFIG_PATH, backupPath);
  
  fs.writeFileSync(MANGA_CONFIG_PATH, newContent, 'utf-8');
  console.log('\n💾 manga-config.js diupdate!');
  console.log('📦 Backup disimpan: manga-config.js.backup');
}

// Main
(async () => {
  try {
    const { updatedMangaList, successCount, skipCount, errorCount, convertedCount } = await processAllManga();
    
    console.log('\n╔════════════════════════════════════╗');
    console.log('📊 HASIL:');
    console.log(`  ✅ Berhasil download/update: ${successCount}`);
    console.log(`  🔄 JPG → WebP converted: ${convertedCount}`);
    console.log(`  ⭐ Sudah terbaru (skip): ${skipCount}`);
    console.log(`  ❌ Error: ${errorCount}`);
    console.log(`  📚 Total: ${MANGA_LIST.length}`);
    console.log('╚════════════════════════════════════╝\n');
    
    updateMangaConfigJs(updatedMangaList);
    
    if (successCount > 0 || convertedCount > 0) {
      await syncCoverToRepos(updatedMangaList);
      
      console.log('🎉 Selesai!');
      if (convertedCount > 0) {
        console.log(`   ${convertedCount} cover JPG diconvert ke WebP`);
      }
      if (successCount > 0) {
        console.log(`   ${successCount} cover di-download & converted to WebP`);
      }
      
      console.log('\n📝 Push ke GitHub:');
      console.log('   git add covers/ manga-config.js');
      console.log('   git commit -m "Auto-convert covers to WebP"');
      console.log('   git push\n');
    } else {
      console.log('✨ Semua cover sudah up-to-date (WebP)!');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})();

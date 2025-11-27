/**
 * SCRIPT DOWNLOAD COVER MANGA DARI MANGADEX v7.3
 * FITUR: Auto-upload ke Cloudflare R2 + Auto-delete old covers
 * 
 * Update v7.3:
 * - Clean encoding (no emoji corruption)
 * - Handle existing local cover paths
 * - Preserve hash from old covers
 * - Smart migration from GitHub to R2
 * - Auto-fill empty covers
 * 
 * Cara Pakai:
 * 1. npm install sharp @aws-sdk/client-s3
 * 2. Set env: CF_ACCOUNT_ID, CF_ACCESS_KEY_ID, CF_SECRET_ACCESS_KEY, R2_PUBLIC_DOMAIN
 * 3. node download-covers-r2.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');
const sharp = require('sharp');
const { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Config
const DELAY_MS = 1500;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const WEBP_QUALITY = 85;

// R2 Configuration
const R2_CONFIG = {
  accountId: process.env.CF_ACCOUNT_ID,
  accessKeyId: process.env.CF_ACCESS_KEY_ID,
  secretAccessKey: process.env.CF_SECRET_ACCESS_KEY,
  bucketName: 'manga-list',
  publicDomain: process.env.R2_PUBLIC_DOMAIN || 'cdn.nuranantoscans.my.id'
};

// Validate R2 Config
if (!R2_CONFIG.accountId || !R2_CONFIG.accessKeyId || !R2_CONFIG.secretAccessKey) {
  console.error('[ERROR] Missing R2 credentials! Set CF_ACCOUNT_ID, CF_ACCESS_KEY_ID, CF_SECRET_ACCESS_KEY');
  process.exit(1);
}

// Initialize R2 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey
  }
});

// Load manga-config.js
const MANGA_CONFIG_PATH = path.join(__dirname, 'manga-config.js');
let MANGA_LIST = [];
let MANGA_REPOS = {};

try {
  console.log('[INFO] Loading manga-config.js...');
  
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
  
  console.log(`[SUCCESS] Loaded ${MANGA_LIST.length} manga from manga-config.js`);
  console.log(`[SUCCESS] Generated ${Object.keys(MANGA_REPOS).length} repo mappings\n`);
  
} catch (error) {
  console.error('[ERROR] Error loading manga-config.js:', error.message);
  console.error('\n[TIP] Pastikan manga-config.js ada dan format nya benar');
  process.exit(1);
}

console.log('[MODE] Upload covers to Cloudflare R2');
console.log(`[BUCKET] ${R2_CONFIG.bucketName}`);
console.log(`[PUBLIC URL] https://${R2_CONFIG.publicDomain}/\n`);

// Buat folder covers temporary
const coversDir = path.join(__dirname, 'covers-temp');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir);
}

// Helper: Extract hash from existing cover path
function extractHashFromCover(coverPath) {
  if (!coverPath) return null;
  
  // Match pattern: covers/manga-id-{hash}.webp or full URL with hash
  const match = coverPath.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.webp$/i);
  return match ? match[1] : null;
}

// Helper: Check if cover is already R2 URL
function isR2Url(coverPath) {
  if (!coverPath) return false;
  return coverPath.startsWith('https://') && 
         (coverPath.includes('r2.cloudflarestorage.com') || 
          coverPath.includes('.r2.dev') ||
          coverPath.includes('cdn.nuranantoscans.my.id'));
}

// R2 Functions
async function listR2Objects(prefix) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: R2_CONFIG.bucketName,
      Prefix: prefix
    });
    const response = await r2Client.send(command);
    return response.Contents || [];
  } catch (error) {
    throw new Error(`R2 list failed: ${error.message}`);
  }
}

async function deleteR2Object(key) {
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key
    }));
  } catch (error) {
    throw new Error(`R2 delete failed: ${error.message}`);
  }
}

async function checkR2ObjectExists(key) {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key
    }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function uploadToR2(filePath, key) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const contentType = 'image/webp';
    
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000'
    }));
    
    // FIXED: Don't include bucket name in public URL for custom domain
    return `https://${R2_CONFIG.publicDomain}/${key}`;
  } catch (error) {
    throw new Error(`R2 upload failed: ${error.message}`);
  }
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
  let deletedCount = 0;
  let migratedCount = 0;

  for (let i = 0; i < MANGA_LIST.length; i++) {
    const manga = MANGA_LIST[i];
    
    console.log(`\n[${i + 1}/${MANGA_LIST.length}] ${manga.title}`);
    
    try {
      const mangaConfig = MANGA_REPOS[manga.id];
      
      if (!mangaConfig) {
        console.log(`  [WARN] Tidak ada config untuk: ${manga.id}`);
        updatedMangaList.push(manga);
        errorCount++;
        continue;
      }
      
      // Check if cover already R2 URL
      if (isR2Url(manga.cover)) {
        console.log(`  [SKIP] Cover sudah di R2: ${manga.cover}`);
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }
      
      // Try to extract hash from existing cover path
      let existingHash = extractHashFromCover(manga.cover);
      
      if (existingHash) {
        console.log(`  [FOUND] Existing hash: ${existingHash}`);
        
        // Check if already uploaded to R2
        const r2Key = `covers/${manga.id}-${existingHash}.webp`;
        const existsInR2 = await checkR2ObjectExists(r2Key);
        
        if (existsInR2) {
          console.log(`  [MIGRATE] Cover already in R2, updating URL...`);
          const r2Url = `https://${R2_CONFIG.publicDomain}/${r2Key}`;
          manga.cover = r2Url;
          updatedMangaList.push(manga);
          migratedCount++;
          continue;
        }
      }
      
      // Fetch manga.json to get MangaDex URL
      const mangaJsonUrl = typeof mangaConfig === 'string' ? mangaConfig : mangaConfig.url;
      
      console.log(`  [FETCH] Getting manga.json...`);
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
        console.log('  [WARN] Tidak ada MangaDex URL di manga.json');
        
        // If has existing cover, keep it
        if (manga.cover) {
          console.log('  [INFO] Pakai cover lama');
        }
        
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }
      
      const mangaId = getMangaIdFromUrl(mangadexUrl);
      if (!mangaId) {
        console.log('  [WARN] MangaDex URL tidak valid');
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }

      console.log('  [CHECK] Cek cover terbaru dari MangaDex...');
      const latestCover = await fetchLatestCover(mangaId);

      const coverHash = latestCover.filename.split('.')[0];
      const r2Key = `covers/${manga.id}-${coverHash}.webp`;
      
      // Check if already exists in R2
      const existsInR2 = await checkR2ObjectExists(r2Key);
      
      if (existsInR2) {
        console.log(`  [SKIP] Cover sudah ada di R2`);
        const r2Url = `https://${R2_CONFIG.publicDomain}/${r2Key}`;
        manga.cover = r2Url;
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }
      
      // Download & convert to WebP
      console.log('  [DOWNLOAD] Downloading cover...');
      const tempJpgPath = path.join(coversDir, `temp-${manga.id}.jpg`);
      await downloadFile(latestCover.url, tempJpgPath);
      
      console.log('  [CONVERT] Converting to WebP...');
      const tempWebpPath = path.join(coversDir, `${manga.id}-${coverHash}.webp`);
      const tempJpgSize = fs.statSync(tempJpgPath).size;
      const info = await convertToWebP(tempJpgPath, tempWebpPath);
      const webpSize = info.size;
      const reduction = ((1 - webpSize / tempJpgSize) * 100).toFixed(1);
      
      console.log(`  [SUCCESS] WebP created: ${(webpSize / 1024).toFixed(1)} KB (${reduction}% smaller)`);
      
      // Delete old covers from R2 (if any)
      console.log('  [CHECK] Checking for old covers in R2...');
      const existingCovers = await listR2Objects(`covers/${manga.id}-`);
      
      if (existingCovers.length > 0) {
        console.log(`  [DELETE] Found ${existingCovers.length} old cover(s), deleting...`);
        for (const oldCover of existingCovers) {
          if (oldCover.Key !== r2Key) {
            await deleteR2Object(oldCover.Key);
            console.log(`  [DELETED] ${oldCover.Key}`);
            deletedCount++;
          }
        }
      }
      
      // Upload to R2
      console.log('  [UPLOAD] Uploading to R2...');
      const r2Url = await uploadToR2(tempWebpPath, r2Key);
      console.log(`  [SUCCESS] Uploaded: ${r2Url}`);
      console.log(`  [INFO] MangaDex Upload: ${new Date(latestCover.createdAt).toLocaleDateString()}`);
      
      // Cleanup temp files
      fs.unlinkSync(tempJpgPath);
      fs.unlinkSync(tempWebpPath);
      
      manga.cover = r2Url;
      updatedMangaList.push(manga);
      successCount++;
      
      if (i < MANGA_LIST.length - 1) {
        await delay(DELAY_MS);
      }
      
    } catch (error) {
      console.log(`  [ERROR] ${error.message}`);
      
      if (error.message.includes('Rate limit')) {
        console.log('  [WAIT] Tunggu 30 detik...');
        await delay(30000);
        i--;
        continue;
      }
      
      if (manga.cover) {
        console.log('  [INFO] Pakai cover lama');
      }
      
      updatedMangaList.push(manga);
      errorCount++;
    }
  }

  return { updatedMangaList, successCount, skipCount, errorCount, deletedCount, migratedCount };
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
  console.log('\n[SAVED] manga-config.js updated with R2 URLs!');
  console.log('[BACKUP] Backup saved: manga-config.js.backup');
}

function exportRepoList() {
  const repos = MANGA_LIST.map(m => m.repo).filter(Boolean);
  const repoListPath = path.join(__dirname, 'repo-list.txt');
  fs.writeFileSync(repoListPath, repos.join('\n'));
  console.log(`\n[EXPORT] Exported ${repos.length} repos to repo-list.txt`);
  return repos;
}

// Main
(async () => {
  try {
    const { updatedMangaList, successCount, skipCount, errorCount, deletedCount, migratedCount } = await processAllManga();
    
    console.log('\n========================================');
    console.log('[RESULTS]');
    console.log(`  [SUCCESS] Uploaded to R2: ${successCount}`);
    console.log(`  [MIGRATE] URL updated: ${migratedCount}`);
    console.log(`  [DELETE] Old covers deleted: ${deletedCount}`);
    console.log(`  [SKIP] Already in R2: ${skipCount}`);
    console.log(`  [ERROR] Failed: ${errorCount}`);
    console.log(`  [TOTAL] ${MANGA_LIST.length} manga`);
    console.log('========================================\n');
    
    updateMangaConfigJs(updatedMangaList);
    
    // Export repo list for GitHub Actions
    const repos = exportRepoList();
    
    if (successCount > 0 || migratedCount > 0) {
      console.log('[COMPLETE] Process finished!');
      if (successCount > 0) {
        console.log(`  - ${successCount} covers uploaded to R2`);
      }
      if (migratedCount > 0) {
        console.log(`  - ${migratedCount} cover URLs migrated to R2`);
      }
      if (deletedCount > 0) {
        console.log(`  - ${deletedCount} old covers deleted from R2`);
      }
      
      console.log('\n[NEXT STEP] Push to GitHub:');
      console.log('  git add manga-config.js repo-list.txt');
      console.log('  git commit -m "Auto-update covers (R2)"');
      console.log('  git push\n');
    } else {
      console.log('[INFO] All covers are already up-to-date in R2!');
    }
    
    // Cleanup temp folder
    if (fs.existsSync(coversDir)) {
      fs.rmSync(coversDir, { recursive: true });
    }
    
  } catch (error) {
    console.error('\n[FATAL ERROR]', error.message);
    process.exit(1);
  }
})();
/**
 * SCRIPT DOWNLOAD COVER MANGA DARI MANGADEX v8.0
 * FITUR: Auto-upload ke Cloudflare R2 + Multi-Resolution WebP + Auto-delete old covers
 * 
 * Update v8.0:
 * - Generate 3 resolusi cover (sm/md/lg) untuk responsive loading
 * - Mode --migrate untuk konversi cover lama ke 3 resolusi
 * - Eliminasi dependency ke images.weserv.nl
 * - sm: 320px (mobile), md: 480px (tablet), lg: 640px (desktop/retina)
 * 
 * Update v7.6:
 * - Export list of repos that actually have cover updates
 * - Only trigger repos with actual changes
 * 
 * Required Environment Variables:
 * - CF_ACCOUNT_ID
 * - CF_ACCESS_KEY_ID
 * - CF_SECRET_ACCESS_KEY
 * - R2_PUBLIC_DOMAIN
 *
 * Usage:
 *   node download-covers-r2.js          # Normal: check MangaDex for new covers
 *   node download-covers-r2.js --migrate # Migrate existing single covers to 3 resolutions
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

// CLI flags
const MIGRATE_MODE = process.argv.includes('--migrate');

// ============================================
// MULTI-RESOLUTION COVER SIZES
// ============================================
const COVER_SIZES = [
  { suffix: 'sm', width: 320, quality: 85 },   // Mobile (displayed at ~100-160px CSS, 2x = 320px)
  { suffix: 'md', width: 480, quality: 82 },   // Tablet (displayed at ~180-250px CSS, 2x = 480px)
  { suffix: 'lg', width: 640, quality: 80 },   // Desktop/Retina (displayed at ~320px CSS, 2x = 640px)
];

// R2 Configuration
const R2_CONFIG = {
  accountId: process.env.CF_ACCOUNT_ID,
  accessKeyId: process.env.CF_ACCESS_KEY_ID,
  secretAccessKey: process.env.CF_SECRET_ACCESS_KEY,
  bucketName: 'manga-list',
  publicDomain: process.env.R2_PUBLIC_DOMAIN
};

// ============================================
// STRICT VALIDATION
// ============================================
console.log('[INIT] Validating R2 configuration...\n');

const REQUIRED_ENV = {
  'CF_ACCOUNT_ID': R2_CONFIG.accountId,
  'CF_ACCESS_KEY_ID': R2_CONFIG.accessKeyId,
  'CF_SECRET_ACCESS_KEY': R2_CONFIG.secretAccessKey,
  'R2_PUBLIC_DOMAIN': R2_CONFIG.publicDomain
};

let missingEnv = [];
Object.keys(REQUIRED_ENV).forEach(key => {
  if (!REQUIRED_ENV[key]) {
    missingEnv.push(key);
  }
});

if (missingEnv.length > 0) {
  console.error('[ERROR] Missing required environment variables:');
  missingEnv.forEach(env => {
    console.error(`  ✗ ${env}`);
  });
  console.error('\n[TIP] Set all required environment variables:');
  console.error('  export CF_ACCOUNT_ID=your_account_id');
  console.error('  export CF_ACCESS_KEY_ID=your_access_key');
  console.error('  export CF_SECRET_ACCESS_KEY=your_secret_key');
  console.error('  export R2_PUBLIC_DOMAIN=cdn.nuranantoscans.my.id');
  process.exit(1);
}

console.log('[SUCCESS] All required environment variables set:');
console.log(`  ✓ CF_ACCOUNT_ID: ${R2_CONFIG.accountId.substring(0, 8)}...`);
console.log(`  ✓ CF_ACCESS_KEY_ID: ${R2_CONFIG.accessKeyId.substring(0, 8)}...`);
console.log(`  ✓ CF_SECRET_ACCESS_KEY: ${R2_CONFIG.secretAccessKey.substring(0, 8)}...`);
console.log(`  ✓ R2_PUBLIC_DOMAIN: ${R2_CONFIG.publicDomain}`);
console.log('');

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

// Helper functions
function extractHashFromCover(coverPath) {
  if (!coverPath) return null;
  const match = coverPath.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.webp$/i);
  return match ? match[1] : null;
}

function isR2Url(coverPath) {
  if (!coverPath) return false;
  return coverPath.startsWith('https://') && 
         (coverPath.includes('r2.cloudflarestorage.com') || 
          coverPath.includes('.r2.dev') ||
          coverPath.includes(R2_CONFIG.publicDomain));
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
    
    return `https://${R2_CONFIG.publicDomain}/${key}`;
  } catch (error) {
    throw new Error(`R2 upload failed: ${error.message}`);
  }
}

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

/**
 * Convert to WebP with specific width (for multi-resolution)
 */
async function convertToWebPResized(inputPath, outputPath, width, quality) {
  try {
    const info = await sharp(inputPath)
      .resize(width, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: quality, effort: 6 })
      .toFile(outputPath);
    
    return info;
  } catch (error) {
    throw new Error(`WebP resize failed (${width}px): ${error.message}`);
  }
}

/**
 * Generate R2 keys for all 3 resolutions from a base key
 * e.g., 'covers/manga-id-hash' → ['covers/manga-id-hash-sm.webp', ...]
 */
function getMultiResKeys(baseKey) {
  return COVER_SIZES.map(size => `${baseKey}-${size.suffix}.webp`);
}

/**
 * Check if all 3 resolution variants exist in R2
 */
async function checkAllResolutionsExist(baseKey) {
  const keys = getMultiResKeys(baseKey);
  const checks = await Promise.all(keys.map(key => checkR2ObjectExists(key)));
  return checks.every(Boolean);
}

/**
 * Upload all 3 resolutions to R2
 * @param {string} inputPath - Path to original downloaded image (JPG or WebP)
 * @param {string} baseKey - Base R2 key without extension (e.g., 'covers/manga-id-hash')
 * @returns {Object} Upload results with sizes
 */
async function uploadMultiResolution(inputPath, baseKey) {
  const results = {};
  
  for (const size of COVER_SIZES) {
    const outputPath = path.join(coversDir, `temp-${size.suffix}.webp`);
    const r2Key = `${baseKey}-${size.suffix}.webp`;
    
    const info = await convertToWebPResized(inputPath, outputPath, size.width, size.quality);
    console.log(`    [${size.suffix.toUpperCase()}] ${size.width}px → ${info.width}x${info.height} (${(info.size / 1024).toFixed(1)} KB)`);
    
    const r2Url = await uploadToR2(outputPath, r2Key);
    results[size.suffix] = { url: r2Url, size: info.size, width: info.width, height: info.height };
    
    // Cleanup temp file
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
  
  return results;
}

/**
 * Delete all resolution variants + old single file from R2
 */
async function deleteOldCovers(mangaId, currentBaseKey) {
  const existingCovers = await listR2Objects(`covers/${mangaId}-`);
  let deletedCount = 0;
  
  const currentKeys = getMultiResKeys(currentBaseKey);
  
  for (const oldCover of existingCovers) {
    if (!currentKeys.includes(oldCover.Key)) {
      await deleteR2Object(oldCover.Key);
      console.log(`    [DELETED] ${oldCover.Key}`);
      deletedCount++;
    }
  }
  
  return deletedCount;
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
  const updatedRepos = new Set(); // Track repos with actual updates
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let deletedCount = 0;
  let migratedCount = 0;
  let noMangaDexCount = 0;

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
      
      if (!mangadexUrl || mangadexUrl.trim() === '') {
        console.log('  [NO-MDEX] Tidak ada MangaDex URL (blank)');
        
        if (manga.cover && isR2Url(manga.cover)) {
          console.log('  [PRESERVE] Cover di R2 dipertahankan (tidak di-check/update)');
          updatedMangaList.push(manga);
          noMangaDexCount++;
          skipCount++;
          continue;
        } else if (manga.cover) {
          console.log('  [KEEP] Cover lama dipertahankan (tidak dari R2)');
          updatedMangaList.push(manga);
          noMangaDexCount++;
          skipCount++;
          continue;
        } else {
          console.log('  [WARN] Tidak ada cover & tidak ada MangaDex URL');
          updatedMangaList.push(manga);
          noMangaDexCount++;
          errorCount++;
          continue;
        }
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
      const baseKey = `covers/${manga.id}-${coverHash}`;
      
      // Check if all 3 resolutions already exist
      const allExist = await checkAllResolutionsExist(baseKey);
      
      if (allExist) {
        console.log(`  [SKIP] All 3 resolutions already in R2`);
        // Use base URL (frontend derives -sm/-md/-lg)
        const r2Url = `https://${R2_CONFIG.publicDomain}/${baseKey}.webp`;
        manga.cover = r2Url;
        updatedMangaList.push(manga);
        skipCount++;
        continue;
      }
      
      // NEW COVER DETECTED - This repo needs to be triggered
      console.log('  [DOWNLOAD] Downloading cover...');
      const tempJpgPath = path.join(coversDir, `temp-${manga.id}.jpg`);
      await downloadFile(latestCover.url, tempJpgPath);
      
      const tempJpgSize = fs.statSync(tempJpgPath).size;
      console.log(`  [DOWNLOADED] ${(tempJpgSize / 1024).toFixed(1)} KB`);
      
      console.log('  [CONVERT] Converting to 3 resolutions...');
      const uploadResults = await uploadMultiResolution(tempJpgPath, baseKey);
      
      const totalSize = Object.values(uploadResults).reduce((sum, r) => sum + r.size, 0);
      const reduction = ((1 - totalSize / tempJpgSize) * 100).toFixed(1);
      console.log(`  [SUCCESS] 3 resolutions created: ${(totalSize / 1024).toFixed(1)} KB total (${reduction}% smaller than original)`);
      
      // Delete old covers (single file + old resolutions)
      console.log('  [CHECK] Checking for old covers in R2...');
      const deleted = await deleteOldCovers(manga.id, baseKey);
      deletedCount += deleted;
      
      console.log(`  [INFO] MangaDex Upload: ${new Date(latestCover.createdAt).toLocaleDateString()}`);
      
      // Cleanup temp
      if (fs.existsSync(tempJpgPath)) fs.unlinkSync(tempJpgPath);
      
      // Store base URL (without -sm/-md/-lg suffix)
      // Frontend will derive responsive URLs from this
      const r2Url = `https://${R2_CONFIG.publicDomain}/${baseKey}.webp`;
      manga.cover = r2Url;
      updatedMangaList.push(manga);
      updatedRepos.add(manga.repo); // Mark repo as updated
      successCount++;
      
      if (i < MANGA_LIST.length - 1) {
        await delay(DELAY_MS);
      }
      
    } catch (error) {
      console.log(`  [FAILED] ${error.message}`);
      
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

  return { 
    updatedMangaList, 
    updatedRepos: Array.from(updatedRepos), 
    successCount, 
    skipCount, 
    errorCount, 
    deletedCount, 
    migratedCount, 
    noMangaDexCount 
  };
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
        `    repo: '${manga.repo}'${manga.type ? `,\n    type: '${manga.type}'` : ''}\n` +
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

function exportUpdatedRepoList(updatedRepos) {
  const repoListPath = path.join(__dirname, 'updated-repo-list.txt');
  fs.writeFileSync(repoListPath, updatedRepos.join('\n'));
  console.log(`\n[EXPORT] Exported ${updatedRepos.length} updated repos to updated-repo-list.txt`);
  return updatedRepos;
}

// ============================================
// MIGRATE MODE: Convert existing single covers to 3 resolutions
// ============================================
async function migrateExistingCovers() {
  console.log('\n🔄 ========================================');
  console.log('🔄 MIGRATION MODE: Converting existing covers to 3 resolutions');
  console.log('🔄 ========================================\n');
  
  let migratedCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < MANGA_LIST.length; i++) {
    const manga = MANGA_LIST[i];
    console.log(`\n[${i + 1}/${MANGA_LIST.length}] ${manga.title}`);
    console.log(`  Cover: ${manga.cover}`);
    
    try {
      if (!manga.cover || !isR2Url(manga.cover)) {
        console.log('  [SKIP] Cover is not from R2, skipping...');
        skipCount++;
        continue;
      }
      
      // Extract base key from cover URL
      // e.g., 'https://cdn.../covers/manga-id-hash.webp' → 'covers/manga-id-hash'
      const urlPath = new URL(manga.cover).pathname;
      const baseKey = urlPath.replace(/^\//, '').replace('.webp', '');
      
      // Check if already migrated (all 3 resolutions exist)
      const allExist = await checkAllResolutionsExist(baseKey);
      if (allExist) {
        console.log('  [SKIP] All 3 resolutions already exist');
        skipCount++;
        continue;
      }
      
      // Download existing single cover from R2
      console.log('  [DOWNLOAD] Downloading existing cover from R2...');
      const tempPath = path.join(coversDir, `migrate-${manga.id}.webp`);
      await downloadFile(manga.cover, tempPath);
      
      const originalSize = fs.statSync(tempPath).size;
      console.log(`  [DOWNLOADED] ${(originalSize / 1024).toFixed(1)} KB`);
      
      // Generate 3 resolutions from existing cover
      console.log('  [CONVERT] Generating 3 resolutions...');
      const uploadResults = await uploadMultiResolution(tempPath, baseKey);
      
      const totalSize = Object.values(uploadResults).reduce((sum, r) => sum + r.size, 0);
      console.log(`  [SUCCESS] 3 resolutions: ${(totalSize / 1024).toFixed(1)} KB total`);
      
      // Delete old single file (the one without -sm/-md/-lg suffix)
      const oldSingleKey = baseKey + '.webp';
      const oldExists = await checkR2ObjectExists(oldSingleKey);
      if (oldExists) {
        await deleteR2Object(oldSingleKey);
        console.log(`  [DELETED] Old single file: ${oldSingleKey}`);
      }
      
      // Cleanup temp
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      
      migratedCount++;
      console.log('  ✅ Migrated!');
      
      // Small delay to avoid rate limiting
      await delay(500);
      
    } catch (error) {
      console.error(`  [ERROR] ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n🔄 ========================================');
  console.log('🔄 MIGRATION RESULTS');
  console.log('🔄 ========================================');
  console.log(`  ✅ Migrated: ${migratedCount}`);
  console.log(`  ⏭️  Skipped:  ${skipCount}`);
  console.log(`  ❌ Errors:   ${errorCount}`);
  console.log(`  📊 Total:    ${MANGA_LIST.length}`);
  console.log('========================================\n');
  
  // Cleanup temp folder
  if (fs.existsSync(coversDir)) {
    fs.rmSync(coversDir, { recursive: true });
  }
  
  return { migratedCount, skipCount, errorCount };
}

// Main
(async () => {
  try {
    // MIGRATE MODE
    if (MIGRATE_MODE) {
      await migrateExistingCovers();
      return;
    }
    
    // NORMAL MODE
    const { 
      updatedMangaList, 
      updatedRepos, 
      successCount, 
      skipCount, 
      errorCount, 
      deletedCount, 
      migratedCount, 
      noMangaDexCount 
    } = await processAllManga();
    
    console.log('\n========================================');
    console.log('[RESULTS]');
    console.log(`  [SUCCESS] Uploaded to R2: ${successCount}`);
    console.log(`  [MIGRATE] URL updated: ${migratedCount}`);
    console.log(`  [DELETE] Old covers deleted: ${deletedCount}`);
    console.log(`  [SKIP] Already in R2: ${skipCount}`);
    console.log(`  [NO-MDEX] Blank MangaDex (preserved): ${noMangaDexCount}`);
    console.log(`  [FAILED] Failed: ${errorCount}`);
    console.log(`  [TOTAL] ${MANGA_LIST.length} manga`);
    console.log(`  [UPDATED REPOS] ${updatedRepos.length} repos need sync`);
    console.log('========================================\n');
    
    updateMangaConfigJs(updatedMangaList);
    
    // Export ONLY updated repos (for triggering)
    if (updatedRepos.length > 0) {
      exportUpdatedRepoList(updatedRepos);
    }
    
    if (successCount > 0 || migratedCount > 0) {
      console.log('[COMPLETE] Process finished!');
      if (successCount > 0) {
        console.log(`  - ${successCount} covers uploaded to R2 (3 resolutions each)`);
      }
      if (migratedCount > 0) {
        console.log(`  - ${migratedCount} cover URLs migrated to R2`);
      }
      if (deletedCount > 0) {
        console.log(`  - ${deletedCount} old covers deleted from R2`);
      }
      if (noMangaDexCount > 0) {
        console.log(`  - ${noMangaDexCount} manga without MangaDex (preserved)`);
      }
      if (updatedRepos.length > 0) {
        console.log(`  - ${updatedRepos.length} repos will be triggered for sync`);
      }
      
      console.log('\n[NEXT STEP] Push to GitHub:');
      console.log('  git add manga-config.js updated-repo-list.txt');
      console.log('  git commit -m "Auto-update covers (R2 multi-resolution)"');
      console.log('  git push\n');
    } else {
      console.log('[INFO] All covers are already up-to-date in R2!');
      if (noMangaDexCount > 0) {
        console.log(`[INFO] ${noMangaDexCount} manga without MangaDex URL (covers preserved)`);
      }
      console.log('[INFO] No repos need to be triggered');
    }
    
    // Cleanup temp folder
    if (fs.existsSync(coversDir)) {
      fs.rmSync(coversDir, { recursive: true });
    }
    
  } catch (error) {
    console.error('\n[FATAL] Script error:', error.message);
    process.exit(1);
  }
})();

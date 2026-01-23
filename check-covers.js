const fs = require('fs');
const fetch = require('node-fetch');

// Read manga list from file (comma-separated)
const mangaListCsv = fs.readFileSync('manga-list.txt', 'utf8').trim();
const MANGA_LIST = mangaListCsv.split(',').map(repo => ({ repo: repo.trim() }));

async function checkCover(repoName) {
  console.log(`\n🔍 Checking: ${repoName}`);
  
  try {
    // Step 1: Fetch manga.json
    const url = `https://raw.githubusercontent.com/nurananto/${repoName}/main/manga.json`;
    console.log(`   📥 Fetching manga.json...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`   ❌ Failed to fetch manga.json (HTTP ${res.status})`);
      return null;
    }
    
    const data = await res.json();
    const currentCover = data.manga?.cover || '';
    console.log(`   📄 Current cover: ${currentCover || '(empty)'}`);
    
    // Step 2: Extract MangaDex ID
    const mdUrl = data.manga?.links?.mangadex;
    if (!mdUrl) {
      console.log(`   ⚠️  No MangaDex link found`);
      return { repo: repoName, needsUpdate: false, reason: 'No MangaDex link' };
    }
    
    const mdId = mdUrl.match(/\/title\/([a-f0-9-]+)/)?.[1];
    if (!mdId) {
      console.log(`   ⚠️  Invalid MangaDex URL format`);
      return { repo: repoName, needsUpdate: false, reason: 'Invalid MD URL' };
    }
    console.log(`   🔑 MangaDex ID: ${mdId}`);
    
    // Step 3: Query MangaDex API for latest cover
    const apiUrl = `https://api.mangadex.org/cover?manga[]=${mdId}&limit=1&order[createdAt]=desc`;
    console.log(`   🌐 Querying MangaDex API...`);
    const coverRes = await fetch(apiUrl);
    if (!coverRes.ok) {
      console.log(`   ❌ MangaDex API failed (HTTP ${coverRes.status})`);
      return null;
    }
    
    const coverData = await coverRes.json();
    if (!coverData.data?.[0]) {
      console.log(`   ⚠️  No cover data from MangaDex`);
      return { repo: repoName, needsUpdate: false, reason: 'No cover on MD' };
    }
    
    // Step 4: Compare covers
    const latestFileName = coverData.data[0].attributes.fileName;
    const latestHash = latestFileName.split('.')[0];
    const latestFullUrl = `https://uploads.mangadex.org/covers/${mdId}/${latestFileName}`;
    
    console.log(`   🆕 Latest hash: ${latestHash}`);
    console.log(`   🆕 Latest URL: ${latestFullUrl}`);
    
    // Check if current cover contains latest hash OR is the exact URL
    const hasLatestHash = currentCover.includes(latestHash);
    const hasExactUrl = currentCover === latestFullUrl;
    const hasLatest = hasLatestHash || hasExactUrl;
    
    if (hasLatest) {
      console.log(`   ✅ Cover is up-to-date`);
      return { repo: repoName, needsUpdate: false, reason: 'Already latest' };
    } else {
      console.log(`   🔄 Cover needs update!`);
      return { 
        repo: repoName, 
        needsUpdate: true, 
        hash: latestHash,
        currentCover: currentCover,
        latestUrl: latestFullUrl
      };
    }
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    console.log(`   📝 Stack: ${err.stack}`);
    return null;
  }
}

(async () => {
  console.log(`🖼️  Starting cover check for ${MANGA_LIST.length} manga...\n`);
  console.log('='.repeat(60));
  
  const results = [];
  for (const item of MANGA_LIST) {
    const result = await checkCover(item.repo);
    if (result) results.push(result);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  const needsUpdate = results.filter(r => r.needsUpdate);
  console.log(`\n📊 Cover Check Summary:`);
  console.log(`   Total checked: ${results.length}`);
  console.log(`   Needs update: ${needsUpdate.length}`);
  console.log(`   Up-to-date: ${results.length - needsUpdate.length}`);
  
  if (needsUpdate.length > 0) {
    console.log(`\n🖼️  Manga requiring cover update:`);
    needsUpdate.forEach(r => {
      console.log(`   - ${r.repo}`);
      console.log(`     Current: ${r.currentCover || '(empty)'}`);
      console.log(`     Latest: ${r.latestUrl}`);
    });
  } else {
    console.log(`\n✅ All covers are up-to-date!`);
  }
  
  fs.writeFileSync('cover-check-result.json', JSON.stringify({ 
    needsUpdate: needsUpdate.length > 0,
    details: results
  }));
})();

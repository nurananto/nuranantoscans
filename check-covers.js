const fs = require('fs');
const fetch = require('node-fetch');

const MANGA_LIST = JSON.parse(fs.readFileSync('pending-manga-updates.json', 'utf8')).pending;

async function checkCover(repoName) {
  try {
    const url = `https://raw.githubusercontent.com/nurananto/${repoName}/main/manga.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    const mdUrl = data.manga?.links?.mangadex;
    if (!mdUrl) return null;
    
    const mdId = mdUrl.match(/\/title\/([a-f0-9-]+)/)?.[1];
    if (!mdId) return null;
    
    const apiUrl = `https://api.mangadex.org/cover?manga[]=${mdId}&limit=1&order[createdAt]=desc`;
    const coverRes = await fetch(apiUrl);
    if (!coverRes.ok) return null;
    
    const coverData = await coverRes.json();
    if (!coverData.data?.[0]) return null;
    
    const latestHash = coverData.data[0].attributes.fileName.split('.')[0];
    const currentCover = data.manga.cover || '';
    const hasLatest = currentCover.includes(latestHash);
    
    return { repo: repoName, needsUpdate: !hasLatest, hash: latestHash };
  } catch (err) {
    console.warn(`⚠️ ${repoName}: ${err.message}`);
    return null;
  }
}

(async () => {
  const results = [];
  for (const item of MANGA_LIST) {
    const result = await checkCover(item.repo);
    if (result) results.push(result);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const needsUpdate = results.filter(r => r.needsUpdate);
  console.log(`\n📊 Cover check results:`);
  console.log(`   Total checked: ${results.length}`);
  console.log(`   Needs update: ${needsUpdate.length}`);
  
  if (needsUpdate.length > 0) {
    console.log(`\n🖼️ Manga with new covers:`);
    needsUpdate.forEach(r => console.log(`   - ${r.repo}`));
  }
  
  fs.writeFileSync('cover-check-result.json', JSON.stringify({ needsUpdate: needsUpdate.length > 0 }));
})();

# Nurananto Scanlation

Website baca manga terjemahan bahasa Indonesia.

🔗 **https://nuranantoscans.my.id**

---

## Tech Stack

### Frontend
- [x] HTML / CSS / JavaScript (vanilla, tanpa framework)
- [x] Responsive design (mobile-first)
- [x] Service Worker — offline support + caching strategy
- [x] Auto-reload — live update tanpa perlu refresh manual
- [x] Roboto font (self-hosted woff2)

### Manga Reader
- [x] Manifest-based chapter loading
- [x] Encrypted manifest (AES) — anti-scraping
- [x] Session token + Cloudflare Turnstile (anti-bot)
- [x] Support tipe manga (hitam putih) & webtoon (berwarna)
- [x] Locked chapters (chapter berbayar)
- [x] Oneshot support
- [x] Lazy loading gambar + preload halaman berikutnya
- [x] Daily view counter per chapter

### Hosting & Infrastruktur
- [x] GitHub Pages — hosting website statis
- [x] Cloudflare — DNS, CDN, caching layer
- [x] Cloudflare R2 — penyimpanan cover manga (WebP)
- [x] Cloudinary — penyimpanan avatar user
- [x] Custom domain (`nuranantoscans.my.id`)

### Backend (Cloudflare Workers)
- [x] **manga-auth-worker** — registrasi, login, JWT auth, email verification, reset password
- [x] **profile-worker** — upload avatar, ganti display name (rate limit 1x/30 hari)
- [x] **r2-proxy** — serve gambar manga dari R2 + headless browser detection
- [x] **manga-view-counter** — tracking views per manga & per chapter
- [x] **decrypt-manifest** — decrypt manifest.json untuk reader (server-side)

### Database
- [x] Cloudflare D1 — user database (auth, profile)
- [x] Cloudflare KV — session storage, view counter, rate limiting

### Keamanan
- [x] PBKDF2 password hashing (100k iterations, auto-migrate dari SHA-256)
- [x] JWT token authentication
- [x] XSS protection (input sanitization)
- [x] CORS whitelist (hanya domain tertentu)
- [x] CSP headers via `_headers` file
- [x] Cloudflare Turnstile (CAPTCHA alternatif)
- [x] Headless browser detection
- [x] Rate limiting per endpoint

### CI/CD & Automation
- [x] GitHub Actions — auto deploy ke GitHub Pages
- [x] **manga-automation.js** — generate `manga.json` otomatis dari folder chapter
- [x] **encrypt-manifest.js** — enkripsi manifest.json saat push
- [x] **download-covers-r2.js** — auto-download cover dari MangaDex → upload ke R2
- [x] **sync-cover.yml** — sinkronisasi cover URL dari website ke tiap repo manga
- [x] **auto-version.yml** — auto bump version setelah deploy (cache busting)
- [x] **manga-update-trigger.yml** — batch processing update dari banyak repo manga
- [x] Debounce system — menunggu beberapa detik sebelum proses agar batch update terkumpul

---

## Struktur Repo

```
├── index.html            # Halaman utama (daftar manga)
├── info-manga.html       # Halaman detail manga
├── reader.html           # Halaman baca manga
├── reset-password.html   # Reset password
├── verify-email.html     # Verifikasi email
│
├── script.js             # Logic halaman utama
├── info-manga.js         # Logic halaman detail
├── reader.js             # Logic reader manga
├── common.js             # Shared utilities (fetch, cache, debug)
├── manga-config.js       # Daftar manga (single source of truth)
├── auto-reload.js        # Live reload / update checker
├── sw.js                 # Service Worker
│
├── style.css             # Style halaman utama
├── info-manga.css        # Style halaman detail
├── reader.css            # Style reader
├── fonts.css             # Font face declarations
│
├── download-covers-r2.js # Script CI: download cover → R2
├── pending-manga-updates.json  # State: antrian update manga
├── version.txt           # Commit hash (untuk cache busting)
│
├── _headers              # Cloudflare Pages header rules
├── robots.txt            # Block search engine indexing
├── CNAME                 # Custom domain
└── .github/workflows/    # GitHub Actions
    ├── auto-deploy-and-version.yml
    ├── auto-version.yml
    ├── deploy-pages.yml
    └── manga-update-trigger.yml
```

## Repo Manga (terpisah)

Setiap judul manga punya repo sendiri dengan struktur:

```
├── manga-config.json     # Metadata manga (judul, author, genre, dll)
├── manga.json            # Generated: data chapter + views
├── manga-automation.js   # Script: generate manga.json
├── encrypt-manifest.js   # Script: enkripsi manifest
├── daily-views.json      # Data views harian (dari Cloudflare Worker)
├── 1/                    # Folder chapter 1
│   └── manifest.json     # Daftar halaman (encrypted)
├── 2.1/                  # Folder chapter 2 part 1
├── 2.2/                  # Folder chapter 2 part 2
├── Oneshot/              # Folder oneshot (kalau ada)
└── .github/workflows/
    ├── manga-automation.yml
    ├── encrypt-manifest.yml
    └── sync-cover.yml
```

---

## Alur Kerja

```
Push chapter baru ke repo manga
        │
        ▼
encrypt-manifest.yml → enkripsi manifest.json
        │
        ▼
manga-automation.yml → regenerate manga.json + push
        │
        ▼
Trigger repository_dispatch ke repo website
        │
        ▼
manga-update-trigger.yml
  ├── Debounce (tunggu batch)
  ├── Cek cover baru dari MangaDex
  ├── Upload cover ke R2 (kalau berubah)
  ├── Trigger sync-cover ke repo manga yang berubah
  ├── Deploy ke GitHub Pages
  └── Auto bump version (cache busting)
```

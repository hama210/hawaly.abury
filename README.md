# Hawali Aburi

Multilingual financial news and market intelligence for Iraq and the Kurdistan Region.

## Local development

```sh
npm ci
npm run dev
```

Run the reliability tests and production build before deploying:

```sh
npm run check
```

## Deploy

Cloudflare Pages settings:

```txt
Build command: npm run build
Output directory: dist
```

Keep `package-lock.json` committed so local, CI, and Cloudflare builds use the same dependency versions.

## Market desk update (October 2026)

Cloudflare Pages must build with `npm run build`, serve `dist`, and deploy the root `functions` directory. The Pages middleware renders current headlines and available rates into the initial HTML, with a 120-second snapshot cache. `/`, `/ar/`, `/en/` and localized `/about` and `/contact` pages have canonical and alternate language links. The share image is a 1200×630 PNG.

The dashboard keeps city buy/sell quotes separate. It reads reported Shafaq city prices and the CBI published reference; absent city data remains unavailable. Source quote time is distinct from retrieval time. The CBI page currently supplies a reference without a quote timestamp, which is explicitly labelled. Yahoo metals/oil prices are futures references, not local retail or spot gold quotes. The gold calculator defaults to a user-adjustable 5 g mithqal and 21K purity; results exclude workmanship, premiums and tax.

Currency conversions use USD-per-currency, with explicit city/side, CBI or manual IQD basis. Local observations are stored on the device. Alerts are opt-in, in-page only while the app is open, and compare dated quotes from the same source/city/side. Telegram/background push require a separate channel/bot or push backend and are not configured. Official calendar links replace undated placeholder events; no salary or meeting dates are invented.

`npm run check` runs tests and the production build. Source failure must preserve a labelled last-known quote or show unavailable; it must never generate a substitute quote. The service worker uses network-first navigation and a clearly labelled offline page, never a cached document presented as current rates.

## Real article pictures and Sorani translation (October 2026)

The news feed now keeps publisher thumbnails instead of discarding major image
hosts. A restricted image proxy serves approved publishers' media when hotlinking
is blocked. If a feed has no photo, `/api/article-image` attempts to retrieve
the publisher's own OpenGraph image. It can also resolve encoded Google News RSS
article links on a best-effort basis. When a publisher blocks access, a clearly
illustrated local category cover remains; the site must never invent a photo or
claim a placeholder is original news imagery.

The client translates visible headlines first, caches successful translations
and does not restart an unfinished queue every time another feed loads.

**Recommended for reliable Kurdish Sorani (ckb) and Arabic translation:** add a
Cloudflare Workers AI binding called `AI` to the **production** Pages project:
Workers & Pages → Hawal Pages project → Settings → Bindings → Add → Workers AI
→ variable name `AI` → Save → **Redeploy**. Before enabling AI, review the
applicable Workers AI quota and charges in your Cloudflare account. The code
does not enable a paid AI service on its own. After redeploying, visit
`/api/translation-status` and check `workersAIConfigured`. Hawal uses a
Cloudflare-hosted multilingual model if configured; otherwise it tries the
existing third-party free endpoints, which may throttle or reject requests.
Untranslated headlines remain in their original language and must be labelled
rather than replaced with unrelated generic Kurdish or Arabic text.

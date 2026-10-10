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

## Inline news translation (October 2026)

Hawal translates news titles, summaries and available article text **inside the website** using **Google Translate only**, with Central Kurdish (Sorani, code `ckb`) and Arabic (`ar`). No Microsoft Translator code is used.

No API key, billing account or secret is required. The browser first requests the public Google Translate endpoint with cookies omitted. Headlines, summaries and article chunks share a serial queue and a 24-hour session cache. No proxy service is used.

If the browser route fails, the app tries the same keyless Google service through Pages. A failed route cools down for one minute instead of repeatedly sending the feed into a rate limit. Google’s public endpoint is unofficial and may still be unavailable. Existing Google and Microsoft secrets are ignored.

After deployment, open `/api/translation-status` for the active version and `/api/translation-health` to check the server fallback. The health response labels its route; server failure does not describe the browser route. Verify Kurdish and Arabic headlines, summaries and the article reader in the actual preview before merging.

Every translation is checked for suspicious output, numeric alterations and changed currency pairs. If the Google service is unavailable or a translation fails checks, the original news text remains visible; a Retry button is provided. For longer articles, all chunks must pass before any translated version is shown.

Previously cached translations were invalidated so Microsoft-origin results cannot be reused by the browser or Cloudflare cache. Tradukka is not integrated.

Publisher images use approved media and verified OpenGraph photos when possible. Missing photos remain clearly labelled illustrations, not invented images.

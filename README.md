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

## News translation

The translator is rebuilt around the Cloudflare Workers AI binding `AI`, using Google's `@cf/google/gemma-4-26b-a4b-it` model. The deployment configuration is in `wrangler.jsonc`; neither the browser nor the server needs a translation API key. The previous public Google endpoint, browser fallback, and legacy translated fields are removed.

Selecting Sorani (`ckb`), Arabic (`ar`), or English (`en`) queues every headline, summary, and publisher-provided article body in the loaded feed. Headlines have priority, and opening a story raises its article text to the front of the queue. Long text is split without truncation, and displayed only after every chunk succeeds. Native text needs no translation. The publisher's original stays available when a request fails.

Successful results use a shared browser cache for 24 hours and an edge cache for seven days, keyed by the original text, language, and translator version. Language changes cancel that view's pending work without cancelling another reader's request. Output checks reject missing figures, altered currency pairs, malformed results, or unexpected scripts; these checks do not certify translation quality.

Cloudflare Workers AI includes a daily free allocation. The existing account's plan and usage limits apply; this configuration does not enable or upgrade a paid plan. Exhausted quota or unavailable inference leaves originals visible with a Retry action.

Check `/api/translation-status` for the deployed binding and `/api/translation-health` for a real Sorani inference. Verify Kurdish and Arabic headlines, summaries, and the reader in a preview before merging. For local inference use Cloudflare Pages development with the `AI` binding; Vite alone reports that inference is not configured.

Publisher images use approved media and verified OpenGraph photos when possible. Missing photos remain clearly labelled illustrations, not invented images.

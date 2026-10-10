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

Hawal translates RSS headlines, summaries and available article text directly
**inside its own website**. The interface remains Kurdish, Arabic and English.
The translator uses Central Kurdish (Sorani) and Arabic targets:

1. If `MICROSOFT_TRANSLATOR_KEY` is configured on Cloudflare Pages, use the
   official Azure Translator API with target `ku`. A regional Microsoft
   resource may also require `MICROSOFT_TRANSLATOR_REGION`.
2. If `GOOGLE_TRANSLATE_API_KEY` is configured, use the official Cloud
   Translation API with target `ckb` for Sorani.
3. Without either key, try Google's public web translation endpoint as a
   **best-effort fallback**. This is not a documented production API: it
   may stop working, rate-limit or return inaccurate translations.

To configure the reliable supported provider: open Cloudflare Dashboard →
Workers & Pages → Hawal Pages project → Settings → Variables and Secrets.
Add the Microsoft or Google key as an encrypted **secret**, not as a GitHub file
or browser variable. With Microsoft regional resources, also set the region.
Save and redeploy. Translation API credentials are never returned to clients.
Cloud translation products may have usage costs. Verify entitlements with
your cloud account before enabling.

Check `/api/translation-status` for the deployment revision and whether either
official API is configured. Only a successful real news translation can confirm
that the provider is working.

Every translation is screened for repeated gibberish, foreign-script output,
English leakage, broken numbers and altered currency pairs before use.
The app keeps publisher original text when translation does not validate.
Successful translations are cached, while historical machine translations
from earlier builds are ignored. An article body only switches to translated
text if all of its chunks complete and validate successfully; partial
translations are never assembled together with original-language paragraphs.

Tradukka was not integrated because a suitable official API could not be
confirmed. There is no Tradukka link or redirect in the actual UI.

Publisher images use approved media and verified OpenGraph photos when possible.
Missing photos remain clearly labelled illustrations, not invented images.

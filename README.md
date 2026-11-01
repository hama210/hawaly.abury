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

Translation uses Google only: `ckb` for Sorani and `ar` for Arabic. Without
keys it uses the public Google endpoint on a best-effort basis. Optional
`GOOGLE_TRANSLATE_API_KEY` enables Google Cloud Translation. No Microsoft
translation path is used. Never commit credentials.

The public endpoint can reject server traffic. Redirects and rate limits are
reported as failures, not followed or worked around. Configuration is not proof
of successful translation: `/api/translation-health` must return `ok:true`.
Requests have deadlines and a failed batch pauses the queue until retry, instead
of flooding the provider with every remaining headline. Successful output is cached.

The Kurdish/Arabic news screens also offer a Retry button if translation
fails; they never present an unverified translation as publisher text.

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

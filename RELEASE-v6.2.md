# Hawal v6.2 — production polish

Prepared 30 October 2026. Preserves the existing logo, navy/blue/gold styling,
mobile navigation work and Federal Reserve feeds on `master`.

## What changed

- City rates: scan all available dated Shafaq reports, preserve each city's source and timestamp, retain only that city's last-known quote for up to seven days, and label outdated data. Sulaymaniyah has an explanatory empty state instead of a bare dash. No city prices are invented.
- Rate board: consistent source/quote/check timestamps, prominent Baghdad last-check status, loading skeletons, missing-side text, retry and an accessible disclaimer.
- Converter: USD → IQD uses dealer buy; IQD → USD uses dealer sell. City and CBI bases, amount validation, swap control and stale/undated warnings are included. Existing multi-currency and gold tools remain.
- History: expandable city/CBI sparklines and the existing history screen use real source reports plus browser observations. CBI observations remain distinguished from publication times; unchanged references do not consume a new history slot every minute.
- Languages: Sorani-primary HTML `ckb`/RTL, Arabic/RTL and English/LTR; locale-formatted amounts and Baghdad dates with Kurdish month names. UI additions and trust pages have complete three-language dictionaries. English translation targets are supported alongside Sorani and Arabic. News marks machine translations or original text. Translation validation preserves decimal values.
- UX: Sources is integrated into the page/footer; city/rate search works alongside news search. Mobile rate panels remain non-sticky; small screens use a single rate column. Light-theme contrast, focus rings, skip link, modal focus management and reduced-motion support are improved.
- Trust: About explains source collection, timing, retention, translation, privacy and corrections. Contact provides a prefilled feedback report for visitors to review and submit, plus optional owner-approved email/Telegram links. Developer credit is preserved and version v6.2 is unobtrusive.
- SEO/deployment: canonical, Open Graph/Twitter images and `ckb`/`ar`/`en` alternates use the serving origin or `SITE_URL`. Robots/sitemap are generated at the edge. Rate metadata uses a labelled Dataset; no retail exchange service or real-time guarantee is claimed. Existing logos/share image remain.
- Reliability: the build no longer edits the homepage. Service-worker version is bumped; document, JavaScript, CSS and API requests bypass its asset cache. Client fallback quotes retain their timestamps and become stale after a failed refresh.

## Validation

`npm run check`: **88 tests passed, 0 failed**, then the production build passed.
`git diff --check`: clean. No runtime dependencies added.

Coverage includes actual React server rendering in all three locales, unavailable
Sulaymaniyah, per-city retention/expiry, converter buy/sell direction, CBI observation
history, rate search, decimal-safe translation, English/Sorani translation API contracts,
custom-domain metadata/sitemap, SSR escaping, prior mobile navigation and cache contracts,
news/image behavior and Federal Reserve feeds.

The live browser connection was unavailable during this session and direct live-site
retrieval timed out. Visual desktop/iPhone QA, actual provider availability, and current
machine-translation quality were therefore **not verified**. Automated source/layout
checks are not a substitute for that final device check.

## Operational follow-up

1. Attach an actual custom domain in Cloudflare; set `SITE_URL` to that verified HTTPS origin and configure redirects.
2. Provide a public contact email and/or Telegram link through `CONTACT_EMAIL` / `CONTACT_TELEGRAM`. No personal address or username was invented. The feedback report flow works without them and requires the visitor's GitHub account.
3. Add an agreed, timestamped Sulaymaniyah market feed for dependable coverage. Current reports may still omit the city; the UI now states that clearly and preserves its own known quote where available.
4. Verify the mobile experience on a real iPhone and check translation output on production. Keyless Google translation remains best effort; original-language labels are intentional when it fails.
5. Add durable scheduled collection for a complete shared history. Current charts accurately describe local/feed observations. Background push needs a separate subscription/backend flow; existing alerts work while the site is open.

## Files changed

The following list includes additions and deletions. Deleted static robots/sitemap
files are replaced by domain-aware middleware; the deleted build patch is no longer needed.

- [README.md](README.md)
- [RELEASE-v6.2.md](RELEASE-v6.2.md)
- [functions/_middleware.js](functions/_middleware.js)
- [functions/api/markets.js](functions/api/markets.js)
- [functions/api/translate.js](functions/api/translate.js)
- [functions/api/translation-status.js](functions/api/translation-status.js)
- [index.html](index.html)
- [package-lock.json](package-lock.json)
- [package.json](package.json)
- [public/_routes.json](public/_routes.json)
- `public/robots.txt` — removed
- `public/sitemap.xml` — removed
- [public/sw.js](public/sw.js)
- `scripts/patch-main.mjs` — removed
- [src/components/HawalDashboard.jsx](src/components/HawalDashboard.jsx)
- [src/components/HawalFeatures.jsx](src/components/HawalFeatures.jsx)
- [src/components/MarketDesk.jsx](src/components/MarketDesk.jsx)
- [src/components/NewsLanguage.jsx](src/components/NewsLanguage.jsx)
- [src/components/RateBoard.jsx](src/components/RateBoard.jsx)
- [src/components/TrustPages.jsx](src/components/TrustPages.jsx)
- [src/hooks/useClientTranslator.js](src/hooks/useClientTranslator.js)
- [src/hooks/useRateHistory.js](src/hooks/useRateHistory.js)
- [src/lib/article-content.js](src/lib/article-content.js)
- [src/lib/article-translation.js](src/lib/article-translation.js)
- [src/lib/dashboard-copy.js](src/lib/dashboard-copy.js)
- [src/lib/hawal-features.js](src/lib/hawal-features.js)
- [src/lib/market-tools.js](src/lib/market-tools.js)
- [src/lib/polish-copy.js](src/lib/polish-copy.js)
- [src/lib/server-page.js](src/lib/server-page.js)
- [src/lib/translation-check.js](src/lib/translation-check.js)
- [src/main.jsx](src/main.jsx)
- [src/production.css](src/production.css)
- [src/services/markets.js](src/services/markets.js)
- [src/utils/categories.js](src/utils/categories.js)
- [src/utils/news.js](src/utils/news.js)
- [test/mobile-browsing.test.mjs](test/mobile-browsing.test.mjs)
- [tests/edge-routing.test.js](tests/edge-routing.test.js)
- [tests/market-desk.test.js](tests/market-desk.test.js)
- [tests/markets.test.js](tests/markets.test.js)
- [tests/news-images.test.js](tests/news-images.test.js)
- [tests/production-polish.test.js](tests/production-polish.test.js)
- [tests/redesign.test.js](tests/redesign.test.js)
- [tests/translation-inline.test.js](tests/translation-inline.test.js)
- [vite.config.js](vite.config.js)

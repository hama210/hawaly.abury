# Hawall v6.3 — restore the v6.1 layout and improve news ingestion

Prepared 30 October 2026.

## Incident diagnosis

- v6.2 moved the full rate board ahead of the lead story and moved the quick-market aside out of the hero region. The original v6.1 news-first layout and its palette were preferred.
- The news API attempted up to 22 RSS sources in one full batch. Fast mode used 21 sources at once, while an unavailable direct publisher feed could trigger a second, sequential publisher-domain search. Frontend requests stopped after 18 seconds in fast mode and 32 seconds in full mode. This creates a real risk of client-side timeouts without delivering fresh headlines.
- The first response could fail without preventing other batches, but failure status was invisible and a previous browser or SSR headline could continue to look current.
- These code paths were confirmed by repository review. Live Cloudflare feed success could not be measured in this session.

## Changes

1. **v6.1 homepage restored**: lead article and market sidebar together; original navy/blue and light-mode palette variables. No forced full rate board at the top. The detailed 6.2 rates, timestamps, history and converter remain on Markets and in a collapsible Home section.
2. **Bounded RSS requests**: 12 sources per full batch rather than 22; four concurrent publisher requests per API invocation; shorter capped primary and fallback windows. Preserve priority Fed/Warsh, Iraq dollar, Reuters and key conflict sources in fast mode. Bump edge news cache key so a previously empty response is not reused.
3. **Complete batch discovery**: load all six currently configured batches in two waves, including the later ones if early batches fail. Keep publishing whatever usable headlines arrive, with their genuine publication dates.
4. **Visible failures**: add localized 'source unavailable' and 'no recent items' notices with retry. Keep old news distinguishable from live source activity.
5. **Fast first paint**: edge SSR now caps its wait for live news and market snapshot to 1.2 seconds, warming missing snapshots with Cloudflare `waitUntil`. Browser API refresh remains authoritative for current news; an absent snapshot is not misrepresented as fresh.\n6. **Mobile/PWA refresh**: renew the service-worker cache name and asset registration revision. Mark the release v6.3.
7. **Tests**: validate batch partition coverage, last-batch recovery, health status and the v6.1 hero position.

## Files modified

- `functions/api/news.js`, `functions/_middleware.js`
- `src/services/news.js`
- `src/main.jsx`
- `src/production.css`
- `public/sw.js`
- `package.json`, `package-lock.json`
- `test/mobile-browsing.test.mjs`
- `tests/redesign.test.js`, `tests/news.test.js`, `tests/edge-routing.test.js`
- `tests/news-reliability-v63.test.js` (new)

## Required live acceptance checks

1. Open `/api/news?mode=fast&refresh=1` and inspect `status`, `feedStats.succeeded`, `feedStats.failed`, `items[0].publishedAt`, and `Server-Timing`. A successful HTTP 200 with `status=unavailable` is NOT successful news ingestion.
2. For each full batch from 0 to `batchCount-1`, verify that it returns at least one current original-publisher headline or a justified quiet/failed source diagnostic; confirm the full browser app eventually sorts all valid stories by `publishedAt`.
3. On iPhone Safari, confirm hero + market aside are visible without an oversized rate panel, bottom navigation scroll works, and rates/converter are accessible from Markets.
4. Check all three language toggles and real Sorani/Arabic news translations; this PR does not replace the keyless translation service or claim provider quality.
5. Monitor actual upstream 403/429/timeouts. If live feeds remain unavailable, provision scheduled ingestion (Cloudflare Cron + D1/KV), source monitoring and an agreed alternate feed instead of silently fabricating headlines.

**Verification:** GitHub CI should pass after the final commit. A real-device screenshot and live Cloudflare provider check remain outstanding; the repository tests alone cannot certify them.

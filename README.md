# هەواڵی ئابوری — Phase 5 Sprint 1

Live financial terminal upgrade.

## Added
- Live market ticker API: `/api/markets`
- Gold, Oil, BTC, ETH, EUR/USD, GBP/USD, USD/JPY, DXY, US500, NASDAQ, USD/IQD
- Market dashboard cards with mini charts
- Watchlist widget
- Economic calendar widget
- Market heatmap
- 60-second refresh

## Cloudflare Pages
Build command: `npm run build`
Output directory: `dist`

Delete `package-lock.json` before deploy if npm install hangs on Cloudflare.

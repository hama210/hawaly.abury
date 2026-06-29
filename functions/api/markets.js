const SYMBOLS = [
  { symbol: 'GC=F', pair: 'XAU/USD', name: 'Gold', type: 'commodity', fallback: 2335.5 },
  { symbol: 'CL=F', pair: 'WTI', name: 'Crude Oil', type: 'commodity', fallback: 78.1 },
  { symbol: 'BTC-USD', pair: 'BTC/USD', name: 'Bitcoin', type: 'crypto', fallback: 67240 },
  { symbol: 'ETH-USD', pair: 'ETH/USD', name: 'Ethereum', type: 'crypto', fallback: 3420 },
  { symbol: 'EURUSD=X', pair: 'EUR/USD', name: 'Euro / Dollar', type: 'forex', fallback: 1.0745 },
  { symbol: 'GBPUSD=X', pair: 'GBP/USD', name: 'Pound / Dollar', type: 'forex', fallback: 1.2621 },
  { symbol: 'JPY=X', pair: 'USD/JPY', name: 'Dollar / Yen', type: 'forex', fallback: 156.23 },
  { symbol: 'DX-Y.NYB', pair: 'DXY', name: 'Dollar Index', type: 'index', fallback: 104.2 },
  { symbol: '^GSPC', pair: 'US500', name: 'S&P 500', type: 'index', fallback: 5430 },
  { symbol: '^IXIC', pair: 'NASDAQ', name: 'Nasdaq', type: 'index', fallback: 17680 }
];

function round(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}
function fallbackItem(s, index) {
  const wave = Math.sin((Date.now() / 3600000) + index) * 0.55;
  const price = s.fallback * (1 + wave / 100);
  return {
    symbol: s.pair,
    name: s.name,
    type: s.type,
    price: round(price, s.fallback < 10 ? 4 : 2),
    changePct: round(wave, 2),
    status: wave > 0.18 ? 'bullish' : wave < -0.18 ? 'bearish' : 'neutral',
    source: 'Fallback market model',
    updatedAt: new Date().toISOString()
  };
}
async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 HawaliAburi/1.0' }, cf: { cacheTtl: 60 } });
  if (!res.ok) throw new Error('yahoo ' + res.status);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const meta = result?.meta || {};
  const price = meta.regularMarketPrice || meta.previousClose;
  const prev = meta.previousClose || meta.chartPreviousClose || price;
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;
  return { price, changePct };
}
async function fetchUsdIqd() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cf: { cacheTtl: 3600 } });
    if (!res.ok) throw new Error('fx');
    const data = await res.json();
    const price = data.rates?.IQD;
    if (!price) throw new Error('no iqd');
    return {
      symbol: 'USD/IQD', name: 'Dollar / Iraqi Dinar', type: 'iraq', price: round(price, 2), changePct: 0, status: 'neutral', source: 'ExchangeRate API', updatedAt: new Date().toISOString()
    };
  } catch (e) {
    return { symbol: 'USD/IQD', name: 'Dollar / Iraqi Dinar', type: 'iraq', price: 1310, changePct: 0, status: 'neutral', source: 'Fallback', updatedAt: new Date().toISOString() };
  }
}
export async function onRequest() {
  const items = await Promise.all(SYMBOLS.map(async (s, idx) => {
    try {
      const y = await fetchYahoo(s.symbol);
      return {
        symbol: s.pair,
        name: s.name,
        type: s.type,
        price: round(y.price, y.price < 10 ? 4 : 2),
        changePct: round(y.changePct, 2),
        status: y.changePct > 0.15 ? 'bullish' : y.changePct < -0.15 ? 'bearish' : 'neutral',
        source: 'Yahoo Finance',
        updatedAt: new Date().toISOString()
      };
    } catch (e) {
      return fallbackItem(s, idx);
    }
  }));
  items.push(await fetchUsdIqd());
  return Response.json({ updatedAt: new Date().toISOString(), items }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}

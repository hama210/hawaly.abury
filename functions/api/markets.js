import { quoteState, mergeCityRates, RATE_CITIES, positive } from '../../src/lib/market-tools.js';

const SYMBOLS = [
  { symbol: 'CL=F', pair: 'WTI/USD', name: 'WTI crude futures · barrel', type: 'commodity' },
  { symbol: 'BZ=F', pair: 'BRENT/USD', name: 'Brent crude futures · barrel', type: 'commodity' },
  { symbol: 'BTC-USD', pair: 'BTC/USD', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'GC=F', pair: 'XAU/USD', name: 'Gold futures · troy ounce', type: 'commodity' },
  { symbol: 'SI=F', pair: 'XAG/USD', name: 'Silver', type: 'commodity' },
  { symbol: 'EURUSD=X', pair: 'EUR/USD', name: 'Euro / Dollar', type: 'forex' },
  { symbol: 'GBPUSD=X', pair: 'GBP/USD', name: 'Pound / Dollar', type: 'forex' },
  { symbol: '^DJI', pair: 'DOW JONES', name: 'Dow Jones', type: 'index' },
  { symbol: '^IXIC', pair: 'NASDAQ', name: 'Nasdaq', type: 'index' }
];

const USD_IQD = {
  symbol: 'USD/IQD',
  name: 'Iraq local market · 100 USD',
  type: 'iraq',
  marketKind: 'local',
  quoteAmount: 100
};
const MARKET_FETCH_TIMEOUT_MS = 3500;
const FRESH_CACHE_TTL = 60;
const LAST_GOOD_TTL = 7 * 24 * 60 * 60;
const LAST_GOOD_MAX_AGE_MS = LAST_GOOD_TTL * 1000;

function round(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

async function withTimeout(operation, timeoutMs = MARKET_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('market source timeout'), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readTextLimited(response, stopWhen = () => false, maxBytes = 768 * 1024) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      text += decoder.decode();
      return text;
    }

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel('response too large');
      throw new Error('market source response too large');
    }

    text += decoder.decode(value, { stream: true });
    if (stopWhen(text)) {
      await reader.cancel('required market data received');
      return text;
    }
  }
}

function stripMarkup(value = '') {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return stripMarkup(match?.[1] || '');
}

function marketNumber(value) {
  const number = Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(number) && number >= 100000 && number <= 250000 ? number : null;
}

function extractNumber(text, pattern, group = 1) {
  return marketNumber(text.match(pattern)?.[group]);
}

function rateStatus(changePct) {
  return changePct > 0.1 ? 'bullish' : changePct < -0.1 ? 'bearish' : 'neutral';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function fetchYahoo(symbol) {
  return withTimeout(async signal => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, {
      signal,
      headers: { 'user-agent': 'Mozilla/5.0 HawaliAburi/2.0' },
      cf: { cacheTtl: 60 }
    });
    if (!res.ok) throw new Error('Yahoo Finance ' + res.status);
    const raw = await readTextLimited(res, () => false, 256 * 1024);
    const json = JSON.parse(raw);
    const meta = json.chart?.result?.[0]?.meta || {};
    const price = Number(meta.regularMarketPrice ?? meta.previousClose);
    const previous = Number(meta.previousClose ?? meta.chartPreviousClose ?? price);
    if (!Number.isFinite(price)) throw new Error('Yahoo Finance returned no price');
    const changePct = Number.isFinite(previous) && previous ? ((price - previous) / previous) * 100 : 0;
    return { price, changePct, updatedAt: Number.isFinite(meta.regularMarketTime) ? new Date(meta.regularMarketTime * 1000).toISOString() : null };
  });
}

export function parseShafaqReports(xml, now = Date.now()) {
  const reports = (xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || []).map(block => ({
    title:xmlValue(block,'title'), text:xmlValue(block,'description') + ' ' + xmlValue(block,'content:encoded'),
    sourceUrl:xmlValue(block,'link'), time:Date.parse(xmlValue(block,'pubDate'))
  })).filter(r => /dollar|USD\/IQD/i.test(r.title) && Number.isFinite(r.time) && r.time <= now+300000 && now-r.time <= 7*86400000)
    .sort((a,b)=>b.time-a.time);
  const cities = {}, history = [];
  for (const report of reports) {
    for (const city of RATE_CITIES) {
      const quote = parseCityRate(report.text,city);
      if (!quote) continue;
      const record = {...quote, source:'Shafaq News local market', sourceUrl:report.sourceUrl,
        updatedAt:new Date(report.time).toISOString(), marketKind:'local'};
      if (!cities[city]) cities[city] = record;
      for (const side of ['buy','sell']) if (positive(quote[side])) history.push({city,side,price:quote[side],at:record.updatedAt,source:record.source,sourceUrl:record.sourceUrl});
    }
  }
  const selectedCity = ['erbil','baghdad','sulaymaniyah'].find(city=>cities[city]);
  if (!selectedCity) throw new Error('no dated city USD/IQD quote in available reports');
  const q = cities[selectedCity];
  return {...USD_IQD, ...cities, price:q.sell || q.buy, buyPrice:q.buy, sellPrice:q.sell,
    quoteCity:selectedCity, changePct:null, status:'neutral', source:q.source, sourceUrl:q.sourceUrl,
    updatedAt:q.updatedAt, history:history.slice(0,180)};
}
async function fetchShafaqUsdIqd() {
  return withTimeout(async signal => {
    const res = await fetch('https://shafaq.com/rss/en/Economy', {
      signal, headers:{'user-agent':'Mozilla/5.0 HawaliAburi/6.2'}, cf:{cacheTtl:60}
    });
    if (!res.ok) throw new Error(`Shafaq ${res.status}`);
    // Scan all available reports: a newer Erbil report must not hide an older Sulaymaniyah quote.
    return parseShafaqReports(await readTextLimited(res));
  });
}

async function fetchAlanChandUsdIqd() {
  return withTimeout(async signal => {
    const sourceUrl = 'https://alanchand.com/en/exchange-rates/usd-iqd';
    const res = await fetch(sourceUrl, {
      signal,
      headers: { 'user-agent': 'Mozilla/5.0 HawaliAburi/2.0' },
      cf: { cacheTtl: 300 }
    });
    if (!res.ok) throw new Error(`AlanChand ${res.status}`);

    const html = await readTextLimited(
      res,
      text => /id="inputCalcValue"[^>]*data-rate="[\d.]+"/i.test(text),
      256 * 1024
    );
    const perDollar = Number(html.match(/id="inputCalcValue"[^>]*data-rate="([\d.]+)"/i)?.[1]);
    if (!Number.isFinite(perDollar) || perDollar < 1000 || perDollar > 2500) {
      throw new Error('could not parse AlanChand USD/IQD price');
    }

    return {
      ...USD_IQD,
      price: round(perDollar * 100, 0),
      buyPrice: null,
      sellPrice: null,
      baghdad: null,
      erbil: null,
      changePct: 0,
      status: 'neutral',
      source: 'AlanChand local market',
      sourceUrl,
      updatedAt: null,
      fetchedAt: new Date().toISOString()
    };
  });
}

async function fetchUsdIqd(failures) {
  const sources = [
    ['Shafaq News', fetchShafaqUsdIqd],
    ['AlanChand', fetchAlanChandUsdIqd]
  ];
  const results = await Promise.allSettled(sources.map(([, load]) => load()));
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status === 'rejected') {
      failures.push({ symbol: USD_IQD.symbol, source: sources[index][0], error: errorMessage(result.reason) });
    }
  }
  const preferred = results.find(result => result.status === 'fulfilled');
  return preferred?.value || null;
}

function hasPrice(item) {
  return typeof item?.price === 'number' && Number.isFinite(item.price);
}

function isRecentLastGood(item, now = Date.now()) {
  const lastLiveTime = Date.parse(item?.lastLiveAt || '');
  const sourceTime = Date.parse(item?.updatedAt || '') || lastLiveTime;
  return hasPrice(item) && Number.isFinite(lastLiveTime) && now - sourceTime <= LAST_GOOD_MAX_AGE_MS;
}

function unavailableItem(descriptor) {
  return {
    ...descriptor,
    price: null,
    changePct: null,
    status: 'watch',
    dataStatus: 'unavailable',
    source: 'Unavailable',
    updatedAt: null,
    lastLiveAt: null
  };
}

function liveItem(item, now) {
  const state = quoteState(item);
  return { ...item, dataStatus: state === 'reported' ? 'live' : state, fetchedAt: now, checkedAt:now, lastLiveAt: now };
}

function staleItem(item) {
  const next={ ...item, dataStatus:'stale' };
  if(next.marketKind==='local') for(const city of RATE_CITIES){
    const stamp=Date.parse(next[city]?.updatedAt || next.updatedAt || '');
    if(!Number.isFinite(stamp) || Date.now()-stamp>7*86400000) next[city]=null;
  }
  return next;
}

function cacheKeyFor(url, kind) {
  const cacheUrl = new URL(url.origin + url.pathname);
  cacheUrl.searchParams.set('__hawali_cache', `markets-${kind}-v5`);
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

function withHeader(response, name, value) {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function cachedJson(cache, key) {
  if (!cache) return null;
  const response = await cache.match(key);
  if (!response) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return Response.json({ ok: false, error: 'GET only', items: [] }, {
      status: 405,
      headers: { 'Allow': 'GET', 'Cache-Control': 'no-store' }
    });
  }

  const startedAt = Date.now();
  const requestUrl = new URL(context.request.url);
  const cache = globalThis.caches?.default;
  const freshKey = cache ? cacheKeyFor(requestUrl, 'fresh') : null;
  const lastGoodKey = cache ? cacheKeyFor(requestUrl, 'last-good') : null;
  if (cache && freshKey) {
    const cached = await cache.match(freshKey);
    if (cached) return withHeader(cached, 'X-Markets-Cache', 'HIT');
  }

  const now = new Date().toISOString();
  const previousPayload = lastGoodKey ? await cachedJson(cache, lastGoodKey) : null;
  const previousItems = new Map(
    (Array.isArray(previousPayload?.items) ? previousPayload.items : [])
      .filter(item => isRecentLastGood(item))
      .map(item => [item.symbol, item])
  );
  const failures = [];
  const localPromise = fetchUsdIqd(failures);
  const cbiPromise = fetchCbi().catch(error => { failures.push({ symbol:'CBI USD/IQD', source:'CBI', error:errorMessage(error) }); return null; });
  const yahooResults = await Promise.all(SYMBOLS.map(async descriptor => {
    try {
      const quote = await fetchYahoo(descriptor.symbol);
      return liveItem({
        symbol: descriptor.pair,
        name: descriptor.name,
        type: descriptor.type,
        price: round(quote.price, quote.price < 10 ? 4 : 2),
        changePct: round(quote.changePct, 2),
        status: rateStatus(quote.changePct),
        source: 'Yahoo Finance',
        updatedAt: quote.updatedAt,
        sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(descriptor.symbol)}/`,
        quoteType: descriptor.type === 'commodity' ? 'futures' : descriptor.type
      }, now);
    } catch (error) {
      failures.push({ symbol: descriptor.pair, source: 'Yahoo Finance', error: errorMessage(error) });
      return null;
    }
  }));

  const [usdIqd, cbi] = await Promise.all([localPromise, cbiPromise]);
  const descriptors = [...SYMBOLS.map((descriptor, index) => ({ descriptor, item: yahooResults[index] })), { descriptor: USD_IQD, item: usdIqd ? liveItem(usdIqd, now) : null }];
  const items = descriptors.map(({ descriptor, item }) => {
    if (item) return item.symbol === USD_IQD.symbol ? mergeCityRates(item, previousItems.get(USD_IQD.symbol)) : item;
    const symbol = descriptor.pair || descriptor.symbol;
    const previous = previousItems.get(symbol);
    return previous ? staleItem(previous) : unavailableItem({
      symbol,
      name: descriptor.name,
      type: descriptor.type,
      ...(descriptor.marketKind ? { marketKind: descriptor.marketKind, quoteAmount: descriptor.quoteAmount } : {})
    });
  });
  items.push(cbi ? liveItem(cbi, now) : previousItems.has('CBI USD/IQD') ? staleItem(previousItems.get('CBI USD/IQD')) : unavailableItem({ symbol:'CBI USD/IQD', name:'CBI reference · 1 USD', marketKind:'official', quoteAmount:1 }));
  for (const item of items) {
    item.checkedAt = now;
    if (item.marketKind === 'local') for (const city of RATE_CITIES) if (item[city]) item[city].checkedAt = now;
  }
  const usdIndex = items.findIndex(item => item.symbol === USD_IQD.symbol);
  if (usdIndex > 0) items.unshift(items.splice(usdIndex, 1)[0]);

  const liveCount = items.filter(item => item.dataStatus === 'live').length;
  const staleCount = items.filter(item => item.dataStatus === 'stale').length;
  const unavailableCount = items.filter(item => item.dataStatus === 'unavailable').length;
  const dataStatus = unavailableCount || staleCount || items.some(item => item.dataStatus === 'undated') ? (liveCount ? 'partial' : staleCount ? 'stale' : 'unavailable') : 'live';
  if (failures.length) {
    console.warn(JSON.stringify({ event: 'market_sources_incomplete', failed: failures.length, failures }));
  }

  const payload = {
    updatedAt: now,
    checkedAt: now,
    dataStatus,
    counts: { live: liveCount, stale: staleCount, unavailable: unavailableCount, undated:items.filter(item => item.dataStatus === 'undated').length },
    failures,
    items
  };
  const response = Response.json(payload, { headers: {
    'Cache-Control': `public, max-age=${FRESH_CACHE_TTL}`,
    'X-Markets-Cache': 'MISS',
    'Server-Timing': `markets;dur=${Date.now() - startedAt}`
  }});

  if (cache && freshKey && lastGoodKey) {
    const writes = [cache.put(freshKey, response.clone())];
    const lastGoodItems = items.filter(item => isRecentLastGood(item));
    if (lastGoodItems.length) {
      writes.push(cache.put(lastGoodKey, Response.json({ updatedAt: now, items: lastGoodItems }, {
        headers: { 'Cache-Control': `public, max-age=${LAST_GOOD_TTL}` }
      })));
    }
    const cacheWrite = Promise.all(writes).catch(error => {
      console.warn(JSON.stringify({ event: 'market_cache_write_failed', error: errorMessage(error) }));
    });
    if (context.waitUntil) context.waitUntil(cacheWrite);
    else await cacheWrite;
  }

  return response;
}


export function parseCityRate(text, city) {
  const names = { erbil:'Erbil', baghdad:'Baghdad|Iraqi capital', sulaymaniyah:'Sulaymaniyah|Sulaimaniyah|Sulaimani|Sulaymaniya|Sulaimaniya' };
  for (const match of text.matchAll(new RegExp(names[city], 'gi'))) {
    const rest = text.slice(match.index + match[0].length);
    const next = rest.search(/Erbil|Baghdad|Iraqi capital|Sulaymaniyah|Sulaimaniyah|Sulaimani|Sulaymaniya|Sulaimaniya/i);
    const chunk = rest.slice(0, next < 0 ? 500 : next);
    const sell = extractNumber(chunk, /(?:sell(?:ing)?|sold)[^.]{0,100}?([\d,]{5,})\s*(?:Iraqi )?dinars/i);
    const buy = extractNumber(chunk, /(?:buy(?:ing)?|bought)[^.]{0,100}?([\d,]{5,})\s*(?:Iraqi )?dinars/i);
    if (sell || buy) return {sell,buy};
  }
  return null;
}
export function parseCbiRate(html) {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => stripMarkup(match[1]));
    const index = cells.findIndex(cell => cell === 'USD');
    if (index < 0) continue;
    const value = Number(cells[index + 1]?.replace(/,/g, ''));
    if (value >= 500 && value <= 5000) return value;
  }
  throw new Error('CBI USD reference not found');
}
async function fetchCbi() {
  return withTimeout(async signal => {
    const sourceUrl = 'https://cbi.iq/';
    const response = await fetch(sourceUrl, { signal, cf:{ cacheTtl:3600 } });
    if (!response.ok) throw new Error(`CBI ${response.status}`);
    const html = await readTextLimited(response);
    return { symbol:'CBI USD/IQD', name:'CBI published reference · 1 USD', marketKind:'official', quoteAmount:1, price:parseCbiRate(html), changePct:null, source:'Central Bank of Iraq', sourceUrl, updatedAt:null };
  });
}

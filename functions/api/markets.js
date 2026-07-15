const SYMBOLS = [
  { symbol: 'GC=F', pair: 'XAU/USD', name: 'Gold', type: 'commodity' },
  { symbol: 'CL=F', pair: 'WTI', name: 'Crude Oil', type: 'commodity' },
  { symbol: 'BTC-USD', pair: 'BTC/USD', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH-USD', pair: 'ETH/USD', name: 'Ethereum', type: 'crypto' },
  { symbol: 'EURUSD=X', pair: 'EUR/USD', name: 'Euro / Dollar', type: 'forex' },
  { symbol: 'GBPUSD=X', pair: 'GBP/USD', name: 'Pound / Dollar', type: 'forex' },
  { symbol: 'JPY=X', pair: 'USD/JPY', name: 'Dollar / Yen', type: 'forex' },
  { symbol: 'DX-Y.NYB', pair: 'DXY', name: 'Dollar Index', type: 'index' },
  { symbol: '^GSPC', pair: 'US500', name: 'S&P 500', type: 'index' },
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
const LAST_GOOD_TTL = 24 * 60 * 60;
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
    return { price, changePct };
  });
}

async function fetchShafaqUsdIqd() {
  return withTimeout(async signal => {
    const sourceUrl = 'https://shafaq.com/rss/en/Economy';
    const res = await fetch(sourceUrl, {
      signal,
      headers: { 'user-agent': 'Mozilla/5.0 HawaliAburi/2.0' },
      cf: { cacheTtl: 300 }
    });
    if (!res.ok) throw new Error(`Shafaq ${res.status}`);

    const xml = await readTextLimited(
      res,
      text => /<item>[\s\S]*?<title>[\s\S]*?(?:dollar|USD\/IQD)[\s\S]*?<\/title>[\s\S]*?<\/item>/i.test(text)
    );
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const block = blocks.find(item => /(?:dollar|USD\/IQD)/i.test(xmlValue(item, 'title')));
    if (!block) throw new Error('no recent USD/IQD local-market report');

    const description = xmlValue(block, 'description');
    const publishedTime = Date.parse(xmlValue(block, 'pubDate'));
    if (!Number.isFinite(publishedTime) || Date.now() - publishedTime > 4 * 24 * 60 * 60 * 1000) {
      throw new Error('USD/IQD local-market report is stale');
    }

    const baghdadMarket = extractNumber(description, /Baghdad(?:'s)?[^.]{0,260}?exchanges?\s+at\s*([\d,]{5,})\s*dinars/i);
    const baghdadSell = extractNumber(description, /Iraqi capital[^.]{0,280}?sold the dollar at\s*([\d,]{5,})\s*dinars/i);
    const baghdadBuy = extractNumber(description, /Iraqi capital[^.]{0,360}?bought it at\s*([\d,]{5,})\s*dinars/i);
    const erbilSell = extractNumber(description, /Erbil[^.]{0,280}?selling\s+prices?\s*(?:stood\s*)?at\s*([\d,]{5,})\s*dinars/i);
    const erbilBuy = extractNumber(description, /Erbil[^.]{0,360}?buying\s+prices?\s*(?:stood\s*)?at\s*([\d,]{5,})\s*dinars/i);
    const previous = extractNumber(description, /(?:down|up)\s+from[^0-9]{0,100}([\d,]{5,})\s*dinars/i);
    const price = erbilSell || baghdadSell || baghdadMarket;
    if (!price) throw new Error('could not parse local USD/IQD price');

    const benchmark = baghdadMarket || price;
    const changePct = previous ? round(((benchmark - previous) / previous) * 100, 2) : 0;
    return {
      ...USD_IQD,
      price,
      buyPrice: erbilBuy || baghdadBuy || null,
      sellPrice: erbilSell || baghdadSell || price,
      baghdad: baghdadSell || baghdadBuy || baghdadMarket
        ? { market: baghdadMarket, sell: baghdadSell, buy: baghdadBuy }
        : null,
      erbil: erbilSell || erbilBuy ? { sell: erbilSell, buy: erbilBuy } : null,
      changePct,
      status: rateStatus(changePct),
      source: 'Shafaq News local market',
      sourceUrl: xmlValue(block, 'link'),
      updatedAt: new Date(publishedTime).toISOString()
    };
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
      updatedAt: new Date().toISOString()
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
  return hasPrice(item) && Number.isFinite(lastLiveTime) && now - lastLiveTime <= LAST_GOOD_MAX_AGE_MS;
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
  return { ...item, dataStatus: 'live', lastLiveAt: now };
}

function staleItem(item) {
  return { ...item, dataStatus: 'stale' };
}

function cacheKeyFor(url, kind) {
  const cacheUrl = new URL(url.origin + url.pathname);
  cacheUrl.searchParams.set('__hawali_cache', `markets-${kind}-v2`);
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
        updatedAt: now
      }, now);
    } catch (error) {
      failures.push({ symbol: descriptor.pair, source: 'Yahoo Finance', error: errorMessage(error) });
      return null;
    }
  }));

  const usdIqd = await fetchUsdIqd(failures);
  const descriptors = [...SYMBOLS.map((descriptor, index) => ({ descriptor, item: yahooResults[index] })), { descriptor: USD_IQD, item: usdIqd ? liveItem(usdIqd, now) : null }];
  const items = descriptors.map(({ descriptor, item }) => {
    if (item) return item;
    const symbol = descriptor.pair || descriptor.symbol;
    const previous = previousItems.get(symbol);
    return previous ? staleItem(previous) : unavailableItem({
      symbol,
      name: descriptor.name,
      type: descriptor.type,
      ...(descriptor.marketKind ? { marketKind: descriptor.marketKind, quoteAmount: descriptor.quoteAmount } : {})
    });
  });
  const usdIndex = items.findIndex(item => item.symbol === USD_IQD.symbol);
  if (usdIndex > 2) items.splice(2, 0, items.splice(usdIndex, 1)[0]);

  const liveCount = items.filter(item => item.dataStatus === 'live').length;
  const staleCount = items.filter(item => item.dataStatus === 'stale').length;
  const unavailableCount = items.length - liveCount - staleCount;
  const dataStatus = unavailableCount || staleCount ? (liveCount ? 'partial' : staleCount ? 'stale' : 'unavailable') : 'live';
  if (failures.length) {
    console.warn(JSON.stringify({ event: 'market_sources_incomplete', failed: failures.length, failures }));
  }

  const payload = {
    updatedAt: now,
    dataStatus,
    counts: { live: liveCount, stale: staleCount, unavailable: unavailableCount },
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

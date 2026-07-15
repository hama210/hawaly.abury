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

function logMarketSourceFailure(source, error) {
  console.warn(JSON.stringify({
    event: 'usd_iqd_source_failed',
    source,
    message: error instanceof Error ? error.message : String(error)
  }));
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
  const raw = await readTextLimited(res, () => false, 256 * 1024);
  const json = JSON.parse(raw);
  const result = json.chart?.result?.[0];
  const meta = result?.meta || {};
  const price = meta.regularMarketPrice || meta.previousClose;
  const prev = meta.previousClose || meta.chartPreviousClose || price;
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;
  return { price, changePct };
}
async function fetchShafaqUsdIqd() {
  const sourceUrl = 'https://shafaq.com/rss/en/Economy';
  const res = await fetch(sourceUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 HawaliAburi/1.0' },
    cf: { cacheTtl: 300 }
  });
  if (!res.ok) throw new Error(`Shafaq ${res.status}`);

  const xml = await readTextLimited(
    res,
    text => /<item>[\s\S]*?<title>[\s\S]*?(?:dollar|USD\/IQD)[\s\S]*?<\/title>[\s\S]*?<\/item>/i.test(text)
  );
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const block = blocks.find(item => /(?:dollar|USD\/IQD)/i.test(xmlValue(item, 'title')));
  if (!block) throw new Error('no recent USD/IQD market report');

  const description = xmlValue(block, 'description');
  const publishedAt = xmlValue(block, 'pubDate');
  const publishedTime = Date.parse(publishedAt);
  if (!Number.isFinite(publishedTime) || Date.now() - publishedTime > 4 * 24 * 60 * 60 * 1000) {
    throw new Error('USD/IQD market report is stale');
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
    symbol: 'USD/IQD',
    name: 'Iraq local market · 100 USD',
    type: 'iraq',
    marketKind: 'local',
    quoteAmount: 100,
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
}

async function fetchAlanChandUsdIqd() {
  const sourceUrl = 'https://alanchand.com/en/exchange-rates/usd-iqd';
  const res = await fetch(sourceUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 HawaliAburi/1.0' },
    cf: { cacheTtl: 900 }
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
    symbol: 'USD/IQD',
    name: 'Iraq local market · 100 USD',
    type: 'iraq',
    marketKind: 'local',
    quoteAmount: 100,
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
}

async function fetchOfficialUsdIqd() {
  const sourceUrl = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetch(sourceUrl, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new Error(`official FX ${res.status}`);
  const raw = await readTextLimited(res, () => false, 128 * 1024);
  const data = JSON.parse(raw);
  const perDollar = Number(data.rates?.IQD);
  if (!Number.isFinite(perDollar)) throw new Error('no official IQD rate');
  return {
    symbol: 'USD/IQD',
    name: 'Official reference · 100 USD',
    type: 'iraq',
    marketKind: 'official',
    quoteAmount: 100,
    price: round(perDollar * 100, 0),
    perDollar: round(perDollar, 2),
    changePct: 0,
    status: 'neutral',
    source: 'Official FX reference',
    sourceUrl,
    updatedAt: new Date().toISOString()
  };
}

async function fetchUsdIqd() {
  try {
    return await fetchShafaqUsdIqd();
  } catch (error) {
    logMarketSourceFailure('Shafaq News', error);
  }

  try {
    return await fetchAlanChandUsdIqd();
  } catch (error) {
    logMarketSourceFailure('AlanChand', error);
  }

  try {
    return await fetchOfficialUsdIqd();
  } catch (error) {
    logMarketSourceFailure('Official FX reference', error);
    return {
      symbol: 'USD/IQD', name: 'Official fallback · 100 USD', type: 'iraq', marketKind: 'official', quoteAmount: 100,
      price: 131000, changePct: 0, status: 'neutral', source: 'Official fallback', updatedAt: new Date().toISOString()
    };
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
  items.splice(2, 0, await fetchUsdIqd());
  return Response.json({ updatedAt: new Date().toISOString(), items }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}

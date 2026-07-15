import { analyzeArticle } from '../utils/intelligence.js';

const image = {
  markets: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  oil: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=80',
  iraq: 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?auto=format&fit=crop&w=1200&q=80',
  crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1200&q=80',
  stocks: 'https://images.unsplash.com/photo-1642790551116-18e150f248e0?auto=format&fit=crop&w=1200&q=80',
  forex: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  geopolitics: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80'
};

const fallbackSeeds = [
  ['Federal Reserve signals cautious approach on interest rates','Reuters','Central Banks','https://www.reuters.com/markets/','markets'],
  ['Oil prices watch Middle East risk and OPEC supply signals','OilPrice','Oil','https://oilprice.com/','oil'],
  ['Iraq economy focus turns to budget, banking and oil revenue','Iraq Business News','Iraq','https://www.iraq-businessnews.com/','iraq'],
  ['Bitcoin traders monitor risk sentiment and ETF flows','CoinDesk','Crypto','https://www.coindesk.com/','crypto'],
  ['Global markets track inflation, dollar strength and bond yields','MarketWatch','Stocks','https://www.marketwatch.com/','stocks'],
  ['Gold remains sensitive to dollar moves and geopolitical risk','Reuters Markets','Markets','https://www.reuters.com/markets/','markets'],
  ['Iraq dinar and CBI banking reforms stay in focus','Central Bank of Iraq','Iraq','https://cbi.iq/','iraq'],
  ['Kurdistan oil and budget talks remain important for Iraq outlook','Rudaw Economy','Iraq','https://www.rudaw.net/english','iraq'],
  ['Forex traders watch EUR/USD and US data this week','FXStreet','Forex','https://www.fxstreet.com/','forex'],
  ['OPEC supply signals keep oil markets on alert','OilPrice','Oil','https://oilprice.com/','oil'],
  ['US stocks react to earnings, inflation and Fed expectations','Yahoo Finance','Stocks','https://finance.yahoo.com/','stocks'],
  ['Middle East headlines keep investors cautious on risk assets','Al Jazeera','Geopolitics','https://www.aljazeera.com/','geopolitics'],
  ['Iran-US war updates focus on strikes, shipping and the Strait of Hormuz','Iran-US War Live','Geopolitics','https://news.google.com/search?q=Iran%20US%20war%20strikes%20Strait%20of%20Hormuz','geopolitics'],
  ['Iraq banking, salaries and budget news remain market-moving locally','Shafaq Economy','Iraq','https://shafaq.com/en','iraq'],
  ['Crypto market watches ETF demand and broader risk appetite','Cointelegraph','Crypto','https://cointelegraph.com/','crypto'],
  ['China growth data affects oil, commodities and global stocks','Global Economy','Markets','https://news.google.com/search?q=global%20economy','markets'],
  ['Red Sea shipping risks can affect oil, trade and inflation','Global Conflict','Geopolitics','https://news.google.com/search?q=Red%20Sea%20shipping%20oil','geopolitics']
];

const fallback = fallbackSeeds.map(([title, source, category, link, kind], index) => ({
  title,
  titleEn: title,
  summary: 'Market-moving update from trusted public sources.',
  summaryEn: 'Market-moving update from trusted public sources.',
  source,
  category,
  link,
  image: image[kind] || image.markets,
  publishedAt: new Date(Date.now() - index * 900000).toISOString()
}));

function withIntelligence(items, prefix = 'news') {
  return items.map((item, index) => ({
    id: item.id || `${prefix}-${index}-${item.title}`,
    ...item,
    intelligence: item.intelligence || analyzeArticle(item)
  }));
}

function mergeUnique(primary = [], backup = []) {
  const seen = new Set();
  const output = [];
  for (const item of [...primary, ...backup]) {
    const key = String(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

async function fetchBatch(batch) {
  try {
    const res = await fetch(`/api/news?phase=4&limit=120&batch=${batch}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchNews() {
  try {
    const payloads = await Promise.all([0, 1].map(fetchBatch));
    const batchCount = Math.max(1, ...payloads.map(data => Number(data?.batchCount) || 1));
    if (batchCount > payloads.length) {
      const remaining = Array.from({ length: batchCount - payloads.length }, (_, index) => index + payloads.length);
      payloads.push(...await Promise.all(remaining.map(fetchBatch)));
    }
    const combined = payloads.flatMap(data => Array.isArray(data?.items) ? data.items : []);
    const liveItems = mergeUnique([], combined)
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .slice(0, 120);
    const items = liveItems.length >= 10 ? liveItems : mergeUnique(liveItems, fallback);
    return withIntelligence(items, liveItems.length ? 'live' : 'fallback');
  } catch {
    return withIntelligence(fallback, 'fallback');
  }
}

import { analyzeArticle } from '../utils/intelligence.js';

const image = {
  markets: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  iraq: 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?auto=format&fit=crop&w=1200&q=80',
  metals: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
  indices: 'https://images.unsplash.com/photo-1642790551116-18e150f248e0?auto=format&fit=crop&w=1200&q=80',
  forex: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  geopolitics: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80'
};

const fallbackSeeds = [
  ['Federal Reserve policy moves currencies, metals and US indices','Reuters Markets','markets','https://www.reuters.com/markets/','markets'],
  ['Iraq dinar and CBI banking reforms stay in focus','Central Bank of Iraq','iraq','https://cbi.iq/','iraq'],
  ['Iraq budget, banking and oil revenue affect the local dollar market','Iraq Business News','iraq','https://www.iraq-businessnews.com/','iraq'],
  ['EUR/USD traders monitor ECB policy and euro-area data','Reuters Forex','forex','https://www.reuters.com/markets/currencies/','forex'],
  ['GBP/USD traders monitor Bank of England policy','FXStreet','forex','https://www.fxstreet.com/','forex'],
  ['Gold reacts to dollar moves, rates and geopolitical risk','Reuters Metals','metals','https://www.reuters.com/markets/commodities/','metals'],
  ['Silver follows precious-metal demand and industrial expectations','Reuters Metals','metals','https://www.reuters.com/markets/commodities/','metals'],
  ['Dow Jones and Nasdaq track rates, earnings and risk appetite','CNBC Markets','indices','https://www.cnbc.com/markets/','indices'],
  ['Middle East war risk can move USD/IQD, gold and US indices','Reuters Global Conflict','geopolitics','https://www.reuters.com/world/middle-east/','geopolitics'],
  ['Ukraine and global sanctions remain important for market risk','AP Global Conflict','geopolitics','https://apnews.com/hub/russia-ukraine','geopolitics']
];

const fallback = fallbackSeeds.map(([title, source, category, link, kind], index) => ({
  title,
  titleEn: title,
  summary: 'Focused market-moving update from a trusted source.',
  summaryEn: 'Focused market-moving update from a trusted source.',
  content: 'Focused market-moving update from a trusted source.',
  contentEn: 'Focused market-moving update from a trusted source.',
  source,
  category,
  link,
  image: image[kind] || image.markets,
  publishedAt: new Date(Date.now() - index * 900000).toISOString()
}));

const NEWS_CACHE_KEY = 'hawali-aburi-news-v3-trusted';
const NEWS_CACHE_MAX_AGE = 30 * 60 * 1000;
const NEWS_LIMIT = 120;

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

function newestFirst(items = []) {
  return [...items].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

function readCachedNews() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.items) || Date.now() - Number(saved.savedAt || 0) > NEWS_CACHE_MAX_AGE) return [];
    return saved.items;
  } catch {
    return [];
  }
}

function saveCachedNews(items) {
  if (typeof localStorage === 'undefined' || !items.length) return;
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items: items.slice(0, NEWS_LIMIT) }));
  } catch {}
}

function prepareNews(primary = [], backup = []) {
  const liveItems = newestFirst(mergeUnique(primary, backup)).slice(0, NEWS_LIMIT);
  const items = liveItems.length >= 10 ? liveItems : mergeUnique(liveItems, fallback).slice(0, NEWS_LIMIT);
  return withIntelligence(items, liveItems.length ? 'live' : 'fallback');
}

export function getInitialNews() {
  const cached = readCachedNews();
  return prepareNews(cached.length ? cached : fallback);
}

async function fetchPayload(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchBatch(batch) {
  return fetchPayload(`/api/news?mode=full&limit=${NEWS_LIMIT}&batch=${batch}`);
}

export async function fetchNews(onUpdate) {
  const cached = readCachedNews();
  let fastItems = [];
  let fullItems = [];
  let latest = prepareNews(cached.length ? cached : fallback);

  const publish = () => {
    latest = prepareNews(fullItems, mergeUnique(fastItems, cached));
    saveCachedNews(latest);
    if (typeof onUpdate === 'function') onUpdate(latest);
  };

  try {
    const fast = await fetchPayload('/api/news?mode=fast&limit=48');
    fastItems = Array.isArray(fast?.items) ? fast.items : [];
    if (fastItems.length) publish();

    const firstPayload = await fetchBatch(0);
    const payloads = [firstPayload];
    if (Array.isArray(firstPayload?.items) && firstPayload.items.length) {
      fullItems = mergeUnique(fullItems, firstPayload.items);
      publish();
    }
    const batchCount = Math.max(1, Number(firstPayload?.batchCount) || 1);
    if (batchCount > 1) {
      const remaining = Array.from({ length: batchCount - 1 }, (_, index) => index + 1);
      payloads.push(...await Promise.all(remaining.map(async batch => {
        const payload = await fetchBatch(batch);
        if (Array.isArray(payload?.items) && payload.items.length) {
          fullItems = mergeUnique(fullItems, payload.items);
          publish();
        }
        return payload;
      })));
    }
    return latest;
  } catch {
    return latest;
  }
}

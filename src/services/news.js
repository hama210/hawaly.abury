import { analyzeArticle } from '../utils/intelligence.js';

const NEWS_CACHE_KEY = 'hawali-aburi-news-v7-middle-east';
const NEWS_CACHE_MAX_AGE = 5 * 60 * 1000;
const NEWS_DISPLAY_MAX_AGE = 3 * 24 * 60 * 60 * 1000;
const NEWS_MAX_FUTURE_AGE = 10 * 60 * 1000;
const NEWS_LIMIT = 120;
const TIER_WEIGHT = { official:36, major:32, local:28, specialist:22, curated:17 };

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

function strengthScore(item) {
  if (Number.isFinite(Number(item.strengthScore))) return Number(item.strengthScore);
  const ageHours = Math.max(0, (Date.now() - new Date(item.publishedAt || 0).getTime()) / 3600000);
  const recency = Math.max(0, 40 - ageHours * 1.5);
  const impact = item.intelligence?.impact === 'high' ? 20 : item.intelligence?.impact === 'medium' ? 9 : 0;
  const effects = Math.min(15, new Set((item.intelligence?.effects || []).map(effect => effect.asset)).size * 3);
  const complete = String(item.content || item.summary || '').length >= 240 ? 4 : 0;
  const localFocus = item.intelligence?.iraqImpact ? 5 : 0;
  return Math.max(0, Math.round((TIER_WEIGHT[item.sourceTier] || 14) + recency + impact + effects + complete + localFocus));
}

function isFreshLiveItem(item, now = Date.now()) {
  const publishedAt = Date.parse(item?.publishedAt);
  return !item?.isFallback
    && Number.isFinite(publishedAt)
    && publishedAt >= now - NEWS_DISPLAY_MAX_AGE
    && publishedAt <= now + NEWS_MAX_FUTURE_AGE;
}

function latestFirst(items = []) {
  return [...items]
    .filter(item => isFreshLiveItem(item))
    .map(item => ({ ...item, strengthScore: strengthScore(item) }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.strengthScore - a.strengthScore);
}

function readCachedNews() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.items) || Date.now() - Number(saved.savedAt || 0) > NEWS_CACHE_MAX_AGE) {
      localStorage.removeItem(NEWS_CACHE_KEY);
      return [];
    }
    return latestFirst(saved.items);
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
  return withIntelligence(latestFirst(mergeUnique(primary, backup)).slice(0, NEWS_LIMIT), 'live');
}

export function getInitialNews() {
  const cached = readCachedNews();
  return prepareNews(cached);
}

async function fetchPayload(path, force = false) {
  try {
    const separator = path.includes('?') ? '&' : '?';
    const requestUrl = `${path}${separator}client_ts=${Date.now()}${force ? '&refresh=1' : ''}`;
    const res = await fetch(requestUrl, { cache:'no-store', headers:{ 'Cache-Control':'no-cache' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchBatch(batch, force) {
  return fetchPayload(`/api/news?mode=full&limit=${NEWS_LIMIT}&batch=${batch}`, force);
}

export async function fetchNews(onUpdate, { force = false } = {}) {
  const cached = readCachedNews();
  let fastItems = [];
  let fullItems = [];
  let latest = prepareNews(cached);

  const publish = () => {
    latest = prepareNews(fullItems, mergeUnique(fastItems, cached));
    saveCachedNews(latest);
    if (typeof onUpdate === 'function') onUpdate(latest);
  };

  try {
    const fast = await fetchPayload('/api/news?mode=fast&limit=48', force);
    fastItems = Array.isArray(fast?.items) ? fast.items : [];
    if (fastItems.length) publish();

    const firstPayload = await fetchBatch(0, force);
    const payloads = [firstPayload];
    if (Array.isArray(firstPayload?.items) && firstPayload.items.length) {
      fullItems = mergeUnique(fullItems, firstPayload.items);
      publish();
    }
    const batchCount = Math.max(1, Number(firstPayload?.batchCount) || 1);
    if (batchCount > 1) {
      const remaining = Array.from({ length: batchCount - 1 }, (_, index) => index + 1);
      payloads.push(...await Promise.all(remaining.map(async batch => {
        const payload = await fetchBatch(batch, force);
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

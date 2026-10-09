import { analyzeArticle } from '../utils/intelligence.js';

const NEWS_CACHE_KEY = 'hawali-aburi-news-v13-news-images';
// Keep the last verified live response visible while a fresh background request
// is running. Individual stories are still removed after NEWS_DISPLAY_MAX_AGE.
const NEWS_CACHE_MAX_AGE = 12 * 60 * 60 * 1000;
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
  const sourceWindowMs = Math.min(30, Math.max(3, Number(item?.displayMaxAgeDays) || 3)) * 24 * 60 * 60 * 1000;
  return !item?.isFallback
    && Number.isFinite(publishedAt)
    && publishedAt >= now - Math.max(NEWS_DISPLAY_MAX_AGE, sourceWindowMs)
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
  const all = latestFirst(mergeUnique(primary, backup));
  // Preserve a few high-interest headlines across high-volume RSS batches.
  // Final presentation remains strictly latest-first with genuine timestamps.
  const priorities = [
    /^(Trump White House|Trump Reuters|Trump Announcements)$/,
    /^(Saudi War Updates|Reuters Saudi War)$/,
    /^(Iraq Dollar Live|Iraq Dollar Reaction|Shafaq USD-IQD)$/
  ];
  const mustShow = priorities.flatMap(group => all.filter(item => group.test(item.sourceGroup || '')).slice(0, 5));
  const selected = mergeUnique(mustShow, all).slice(0, NEWS_LIMIT);
  return withIntelligence(latestFirst(selected), 'live');
}

export function getInitialNews() {
  const cached = readCachedNews();
  return prepareNews(cached);
}

async function fetchPayload(path, force = false, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('news request timeout'), timeoutMs);
  try {
    const separator = path.includes('?') ? '&' : '?';
    const requestUrl = `${path}${separator}client_ts=${Date.now()}${force ? '&refresh=1' : ''}`;
    const res = await fetch(requestUrl, { cache:'no-store', headers:{ 'Cache-Control':'no-cache' }, signal:controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBatch(batch, force) {
  return fetchPayload(`/api/news?mode=full&limit=${NEWS_LIMIT}&batch=${batch}`, force, 32000);
}

// Hawal currently has three feed batches (22 feeds per batch). Launch all three
// independently, so an unavailable first response never hides the other feeds.
const MINIMUM_BATCH_COUNT = 3;

export async function fetchNews(onUpdate, { force = false, onHealth } = {}) {
  const cached = readCachedNews();
  let fastItems = [];
  let fullItems = [];
  let latest = prepareNews(cached);
  let discoveredBatchCount = MINIMUM_BATCH_COUNT;

  const publish = () => {
    latest = prepareNews(fullItems, mergeUnique(fastItems, cached));
    saveCachedNews(latest);
    if (typeof onUpdate === 'function') onUpdate(latest);
  };

  const handle = (payload, mode) => {
    if (!payload || !Array.isArray(payload.items)) return;
    discoveredBatchCount = Math.max(discoveredBatchCount, Number(payload.batchCount) || 0);
    if (typeof onHealth === 'function' && payload.feedStats) onHealth(payload.feedStats, mode, payload.batch);
    if (!payload.items.length) return;
    if (mode === 'fast') fastItems = mergeUnique(fastItems, payload.items);
    else fullItems = mergeUnique(fullItems, payload.items);
    publish();
  };

  // Independent promises update the visible news immediately when any batch arrives.
  const fastRequest = fetchPayload('/api/news?mode=fast&limit=48', force, 18000)
    .then(payload => handle(payload, 'fast'));
  const batchRequest = batch => fetchBatch(batch, force)
    .then(payload => handle(payload, 'full'));

  await Promise.allSettled([
    fastRequest,
    ...Array.from({ length: MINIMUM_BATCH_COUNT }, (_, batch) => batchRequest(batch))
  ]);

  // If the API grows beyond three batches, load the additional batches too.
  if (discoveredBatchCount > MINIMUM_BATCH_COUNT) {
    await Promise.allSettled(
      Array.from({ length: Math.min(discoveredBatchCount, 12) - MINIMUM_BATCH_COUNT },
        (_, index) => batchRequest(index + MINIMUM_BATCH_COUNT))
    );
  }
  return latest;
}

import { positive, quoteState, safeUrl } from './market-tools.js';

export const HISTORY_KEY = 'hawall-market-observations-v2';
export const ALERTS_KEY = 'hawall-notification-settings-v1';
export const DAYS = [7, 30, 90];
const DAY = 86400000;

const topicTerms = {
  'USD/IQD': /(?:\b(?:iraq|iqd|dinar|cbi|baghdad|erbil|kurdistan|sulaymaniyah|exchange rate)\b|عێراق|دینار|دۆلار|هەولێر|کوردستان|عراق|الدينار|الدولار|أربيل)/iu,
  'XAU/USD': /(?:\b(?:gold|xau|bullion|precious metals|federal reserve|fed|inflation)\b|زێڕ|الذهب|تضخم)/iu,
  'XAG/USD': /(?:\b(?:silver|xag|precious metals)\b|زیو|الفضة)/iu,
  'EUR/USD': /(?:\b(?:euro|eur|ecb|eurozone|european central bank)\b|یۆرۆ|اليورو)/iu,
  'BRENT/USD': /(?:\b(?:oil|brent|crude|opec|somo|petroleum)\b|نەوت|نفط|النفط)/iu,
  'NASDAQ': /(?:\b(?:nasdaq|tech stocks|technology shares|wall street)\b|ناسداك)/iu
};
const topics = Object.keys(topicTerms);
export const TOPICS = topics;

export function marketStoryMatches(item, symbol) {
  if (!topicTerms[symbol] || !safeUrl(item?.link) || item?.isFallback) return false;
  const published = Date.parse(item.publishedAt || '');
  if (!Number.isFinite(published) || published > Date.now() + 600000 || Date.now() - published > 4 * DAY) return false;
  const text = [item.title, item.titleEn, item.titleKu, item.titleAr, item.summary, item.summaryEn, item.summaryKu, item.summaryAr].filter(Boolean).join(' ');
  return topicTerms[symbol].test(text);
}

export function marketStories(news = [], symbol) {
  return news.filter(item => marketStoryMatches(item, symbol))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 4);
}

export function sourceAssessment(item) {
  if (!safeUrl(item?.link) || item?.isFallback || !item?.source || !Number.isFinite(Date.parse(item?.publishedAt))) return 'unconfirmed';
  // An official publication is evidence of what that institution announced, NOT an independent fact check.
  return item.sourceTier === 'official' ? 'official' : 'reported';
}

const stopWords = new Set('a an and are as at be by for from has have in into is it of on or that the their this to was were will with you your than about after amid says said report reports markets market today recent breaking price prices new how why what where when هل من إلى على في أن عن مع التي الذي هذا هذه كان هو هي ذلك بعد قبل الى الى ما سعر أسعار خبر الأخبار عاجل لە و بۆ کە بە لەسەر ئەم ئەو هەواڵ نرخ'.split(/\s+/u));
export function claimWords(text) {
  return [...new Set(String(text || '').normalize('NFKC').toLocaleLowerCase()
    .match(/[\p{L}\p{N}]{3,}/gu) || [])].filter(word => !stopWords.has(word));
}
export function findRelatedReports(claim, news = []) {
  const words = claimWords(claim);
  if (words.length < 2) return [];
  return news.map(item => {
    if (!safeUrl(item?.link) || item.isFallback || !Number.isFinite(Date.parse(item.publishedAt))) return null;
    const searchable = new Set(claimWords([item.title, item.titleEn, item.titleKu, item.titleAr, item.summary, item.summaryEn, item.summaryKu, item.summaryAr].join(' ')));
    const matched = words.filter(word => searchable.has(word));
    return matched.length >= 2 && matched.length / words.length >= 0.25 ? { item, matched: matched.length } : null;
  }).filter(Boolean).sort((a, b) => b.matched - a.matched || Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt)).slice(0, 5).map(result => result.item);
}

export function normalizeHistory(points, now = Date.now()) {
  if (!Array.isArray(points)) return [];
  const unique = new Map();
  for (const item of points) {
    if (!['erbil','sulaymaniyah','baghdad'].includes(item?.city) || !['buy','sell'].includes(item?.side)) continue;
    const stamp = Date.parse(item?.at || '');
    if (!positive(Number(item.price)) || !Number.isFinite(stamp) || stamp > now + 300000 || stamp < now - 90 * DAY) continue;
    const entry = { city:item.city, side:item.side, price:Number(item.price), at:new Date(stamp).toISOString(), source:String(item.source || '').slice(0,120), sourceUrl:safeUrl(item.sourceUrl) };
    unique.set([entry.city,entry.side,entry.at].join(':'), entry);
  }
  return [...unique.values()].sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).slice(-1800);
}

export function collectRates(markets = [], now = Date.now()) {
  const local = markets.find(item => item.symbol === 'USD/IQD');
  if (!local || quoteState(local, now) !== 'reported' || !safeUrl(local.sourceUrl)) return [];
  const time = Date.parse(local.updatedAt || '');
  if (!Number.isFinite(time)) return [];
  const points = [];
  for (const city of ['erbil','sulaymaniyah','baghdad']) {
    for (const side of ['buy','sell']) {
      if (positive(local?.[city]?.[side])) {
        points.push({ city, side, price:local[city][side], at:local.updatedAt, source:local.source, sourceUrl:local.sourceUrl });
      }
    }
  }
  return points;
}

export function historyFor(points, city = 'erbil', side = 'sell', days = 7, now = Date.now()) {
  return normalizeHistory(points, now).filter(p => p.city === city && p.side === side && Date.parse(p.at) >= now - days * DAY);
}

export function chartCoordinates(points, width = 640, height = 180) {
  if (points.length < 2) return [];
  const times = points.map(p => Date.parse(p.at)), values = points.map(p => p.price);
  const loTime = Math.min(...times), hiTime = Math.max(...times);
  if (hiTime <= loTime) return [];
  const lo = Math.min(...values), hi = Math.max(...values), padding = Math.max(10, (hi - lo) * 0.1);
  const bottom = lo - padding, top = hi + padding;
  return points.map((p,i) => ({
    x: 15 + ((times[i] - loTime) / (hiTime - loTime)) * (width - 30),
    y: 12 + (1 - (values[i] - bottom) / (top - bottom)) * (height - 24)
  }));
}

export function marketSnapshot(markets = [], news = [], now = Date.now()) {
  const local = markets.find(q => q.symbol === 'USD/IQD');
  const gold = markets.find(q => q.symbol === 'XAU/USD');
  const quotes = {};
  if (local && quoteState(local, now) === 'reported' && safeUrl(local.sourceUrl)) {
    for (const city of ['erbil','sulaymaniyah','baghdad']) {
      const price = local?.[city]?.sell;
      if (positive(price)) quotes[city] = { price, at:local.updatedAt, sourceUrl:local.sourceUrl };
    }
  }
  if (gold && quoteState(gold, now) === 'reported' && safeUrl(gold.sourceUrl)) quotes.gold = { price:gold.price, at:gold.updatedAt, sourceUrl:gold.sourceUrl };
  const breaking = news.filter(item => item?.intelligence?.impact === 'high' && safeUrl(item.link) && !item.isFallback &&
    Number.isFinite(Date.parse(item.publishedAt)) && Date.parse(item.publishedAt) <= now + 600000 &&
    now - Date.parse(item.publishedAt) <= 6 * 3600000)
    .map(item => ({ id:String(item.id || item.link), title:item.title || item.titleEn || '', link:item.link, at:item.publishedAt, source:item.source }));
  return { quotes, breaking };
}

export function calculateAlerts(previous, current, settings, seen = []) {
  if (!settings?.enabled) return [];
  const alerts = [];
  const city = ['erbil','sulaymaniyah','baghdad'].includes(settings.city) ? settings.city : 'erbil';
  const before = previous?.quotes?.[city], after = current?.quotes?.[city];
  const diff = after && before ? after.price - before.price : 0;
  const threshold = Number(settings.threshold);
  if (before && after && before.sourceUrl === after.sourceUrl &&
      Date.parse(after.at) > Date.parse(before.at) && Number.isFinite(threshold) && threshold > 0 &&
      Math.abs(diff) >= threshold) {
    alerts.push({ id:'rate:'+city+':'+after.at, type:'rate', diff, price:after.price, city, url:after.sourceUrl });
  }
  const priorGold = previous?.quotes?.gold, latestGold = current?.quotes?.gold;
  const goldThreshold = Number(settings.goldThreshold);
  if (settings.goldEnabled && priorGold && latestGold && priorGold.sourceUrl === latestGold.sourceUrl &&
      Date.parse(latestGold.at) > Date.parse(priorGold.at) && positive(priorGold.price) &&
      Number.isFinite(goldThreshold) && goldThreshold > 0) {
    const pct = (latestGold.price / priorGold.price - 1) * 100;
    if (Math.abs(pct) >= goldThreshold) alerts.push({ id:'gold:'+latestGold.at, type:'gold', pct, price:latestGold.price, url:latestGold.sourceUrl });
  }
  if (settings.breakingEnabled) {
    const previousIds = new Set([...(previous?.breaking || []).map(item => item.id), ...seen]);
    for (const item of current?.breaking || []) if (!previousIds.has(item.id)) alerts.push({ ...item, type:'breaking' });
  }
  return alerts;
}

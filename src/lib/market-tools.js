export const TROY_OUNCE_GRAMS = 31.1034768;
export const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function quoteState(item, now = Date.now()) {
  if (!positive(item?.price)) return 'unavailable';
  if (item.dataStatus === 'stale') return 'stale';
  const stamp = Date.parse(item.updatedAt || '');
  if (!Number.isFinite(stamp)) return 'undated';
  const maxAge = item.marketKind === 'local' || item.marketKind === 'official' ? 86400000 : 1800000;
  return now - stamp > maxAge || stamp > now + 300000 ? 'stale' : 'reported';
}
export function cityQuote(markets, city, side = 'sell') {
  const local = markets.find(item => item.symbol === 'USD/IQD');
  const value = local?.[city]?.[side];
  return positive(value) ? value / 100 : null;
}
export function currencyValue(amount, from, to, usdValues) {
  const input = Number(amount);
  if (amount === '' || !Number.isFinite(input) || input < 0) return null;
  if (from === to) return input;
  if (!positive(usdValues[from]) || !positive(usdValues[to])) return null;
  const result=input * usdValues[from] / usdValues[to];
  return Number.isFinite(result)?result:null;
}
export function goldValue(ounceUsd, grams, karat, iqdPerUsd = 1) {
  if (![ounceUsd, grams, karat, iqdPerUsd].every(positive) || karat > 24) return null;
  return ounceUsd / TROY_OUNCE_GRAMS * grams * (karat / 24) * iqdPerUsd;
}
export function baghdadDate(value = Date.now()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Baghdad', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
}
export const localeFor = lang => lang === 'ku' || lang === 'ckb' ? 'ckb-IQ' : lang === 'ar' ? 'ar-IQ' : 'en-US';
export function formatNumber(value, lang = 'en', options = {}) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits:2, ...options }).format(value) : '';
}
const kurdishMonths = ['کانوونی دووەم','شوبات','ئازار','نیسان','ئایار','حوزەیران','تەممووز','ئاب','ئەیلوول','تشرینی یەکەم','تشرینی دووەم','کانوونی یەکەم'];
export function timestamp(value, lang = 'en') {
  const date = new Date(value || NaN);
  if (!Number.isFinite(date.getTime())) return '';
  const options = { timeZone:'Asia/Baghdad', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false };
  if (lang === 'ku' || lang === 'ckb') {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { ...options, month:'numeric' }).formatToParts(date).map(p=>[p.type,p.value]));
    return `${formatNumber(Number(parts.day),lang)} ${kurdishMonths[Number(parts.month)-1]} ${formatNumber(Number(parts.year),lang,{useGrouping:false})}، ${formatNumber(Number(parts.hour),lang,{minimumIntegerDigits:2})}:${formatNumber(Number(parts.minute),lang,{minimumIntegerDigits:2})} (بەغدا)`;
  }
  return new Intl.DateTimeFormat(localeFor(lang), options).format(date) + (lang === 'ar' ? ' (بغداد)' : ' (Baghdad)');
}
export const RATE_CITIES = ['erbil','sulaymaniyah','baghdad'];
export function cityRecord(markets, city) {
  if (city === 'official') return markets.find(q => q.marketKind === 'official') || null;
  const local = markets.find(q => q.symbol === 'USD/IQD');
  const rate = local?.[city];
  if (!rate || (!positive(rate.sell) && !positive(rate.buy))) return null;
  return { source:local.source, sourceUrl:local.sourceUrl, updatedAt:local.updatedAt,
    fetchedAt:local.fetchedAt, checkedAt:local.checkedAt, dataStatus:local.dataStatus,
    ...rate, marketKind:'local', price:positive(rate.sell) ? rate.sell : rate.buy,
    ...(local.dataStatus === 'stale' ? {dataStatus:'stale'} : {}) };
}
// A missing city may retain only its own dated, attributed quote for seven days.
export function mergeCityRates(current, previous, now = Date.now()) {
  if (!current) return current;
  const merged = {...current};
  for (const city of RATE_CITIES) {
    if (positive(current[city]?.buy) || positive(current[city]?.sell)) {
      const age=now-Date.parse(current[city].updatedAt || current.updatedAt || '');
      if(!Number.isFinite(age) || age<=7*86400000) continue;
      merged[city]=null;
    }
    const old = cityRecord(previous ? [previous] : [], city);
    const age = now - Date.parse(old?.updatedAt || '');
    if (old && safeUrl(old.sourceUrl) && age >= -300000 && age <= 7 * 86400000) {
      merged[city] = {...old, dataStatus:'stale', checkedAt:current.checkedAt || current.fetchedAt};
    }
  }
  return merged;
}
export function matchingRates(markets, query) {
  const term = String(query || '').trim().normalize('NFKC').toLowerCase();
  if (!term) return [];
  const aliases = {erbil:'Erbil Hewler هەولێر أربيل اربيل', sulaymaniyah:'Sulaymaniyah Sulaimani Slemani سلێمانی السليمانية سليمانية', baghdad:'Baghdad بەغدا بغداد', official:'CBI central bank بانکی ناوەندی البنك المركزي'};
  const common = /^(usd|iqd|usd\s*[/↔]\s*iqd|dollar|dinar|دۆلار|دینار|الدولار|الدينار|دولار)$/i.test(term);
  return [...RATE_CITIES,'official'].filter(key=>common || aliases[key].toLowerCase().includes(term)).map(city=>({city,quote:cityRecord(markets,city)}));
}
export function safeUrl(value, fallback = '') {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : fallback; } catch { return fallback; }
}
export function pageRoute(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const lang = ['ar','en'].includes(segments[0]) ? segments.shift() : 'ku';
  if (segments[0] === 'ckb') segments.shift();
  return { lang, page:segments[0] || 'home', valid:segments.length <= 1 && (!segments[0] || ['about','contact'].includes(segments[0])) };
}
export function pagePath(lang, page = 'home') { return `${lang === 'ku' ? '' : '/' + lang}${page === 'home' ? '/' : '/' + page}`; }

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
  return input * usdValues[from] / usdValues[to];
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
export function timestamp(value, lang = 'en') {
  const date = new Date(value || NaN);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ku' ? 'ar-IQ' : lang, { timeZone:'Asia/Baghdad', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(date) + ' (Baghdad)';
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

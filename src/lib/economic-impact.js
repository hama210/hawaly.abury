// Rule-based, deliberately cautious context: never an automated trade signal.
const EMPTY = new Set(['', '-', '—', 'n/a', 'na', 'null', 'pending']);
const NEGATIVE_GOOD = /unemployment rate|jobless claims|unemployment claims|continuing claims|initial claims|claimant count|layoffs|redundanc|unemployed persons/i;
const INFLATION = /\bcpi\b|\bpce\b|\bppi\b|consumer price|producer price|inflation|price index|import prices|wage growth|average hourly earnings/i;
const POLICY = /rate decision|interest rate decision|federal funds rate|fed funds|policy rate|official bank rate|cash rate target|deposit facility rate|main refinancing rate|overnight rate/i;
const GROWTH = /non.?farm payroll|payroll|employment change|employment growth|gross domestic product|\bgdp\b|retail sales|industrial production|manufacturing production|trade balance|consumer confidence|business confidence|pmi|building permits|housing starts|durable goods|factory orders|job openings|jolts/i;

export function parseEconomicValue(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const text = String(raw).trim().replace(/\u2212/g, '-');
  if (EMPTY.has(text.toLowerCase())) return null;
  const match = text.match(/^\(?\s*([+-]?)\s*[$€£¥]?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(%|[kmbt])?\s*\)?$/i);
  if (!match) return null;
  const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  const suffix = (match[3] || '').toLowerCase();
  const number = Number(match[2].replace(/,/g, ''));
  const negative = match[1] === '-' || /^\(/.test(text);
  const value = (negative ? -number : number) * (scale[suffix] || 1);
  return Number.isFinite(value) ? { value, unit: suffix === '%' ? 'percent' : 'number' } : null;
}

export function indicatorKind(title) {
  const input = String(title || '');
  if (NEGATIVE_GOOD.test(input)) return 'inverse';
  if (POLICY.test(input)) return 'policy';
  if (INFLATION.test(input)) return 'inflation';
  if (GROWTH.test(input)) return 'growth';
  return 'unknown';
}

export function analyzeCalendarEvent(event) {
  const actual = parseEconomicValue(event?.actual);
  const forecast = parseEconomicValue(event?.forecast);
  const kind = indicatorKind(event?.title);
  const currency = String(event?.currency || '').toUpperCase();
  const base = { status: 'unknown', direction: 'unknown', kind, currency, difference: null, note: 'not_comparable', markets: [] };
  if (!actual) return { ...base, status: 'pending', note: 'awaiting_actual' };
  if (!forecast) return { ...base, status: 'unknown', note: 'no_forecast' };
  if (actual.unit !== forecast.unit) return { ...base, status: 'unknown', note: 'incompatible_units' };
  const difference = actual.value - forecast.value;
  if (Math.abs(difference) <= 1e-9 * Math.max(1, Math.abs(actual.value), Math.abs(forecast.value))) {
    return { ...base, status: 'equal', direction: 'neutral', difference: 0, note: 'matched' };
  }
  if (kind === 'unknown') return { ...base, difference, note: 'unsupported_indicator' };
  let direction = difference > 0 ? 'up' : 'down';
  if (kind === 'inverse') direction = direction === 'up' ? 'down' : 'up';
  const markets = [{ asset: currency, direction }];
  if (currency === 'USD') {
    const inverseDirection = direction === 'up' ? 'down' : 'up';
    markets.push({ asset: 'XAUUSD', direction: inverseDirection });
    markets.push({ asset: 'XAGUSD', direction: inverseDirection });
  }
  return { ...base, status: 'surprise', direction, difference, note: kind === 'inflation' ? 'rate_expectations' : kind === 'policy' ? 'policy_expectations' : 'conditional', markets };
}

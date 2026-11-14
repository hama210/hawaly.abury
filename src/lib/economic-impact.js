// Rule-based, deliberately cautious context: never an automated trade signal.
const EMPTY = new Set(['', '-', '—', 'n/a', 'na', 'null', 'pending']);
const NEGATIVE_GOOD = /unemployment rate|jobless claims|unemployment claims|continuing claims|initial claims|claimant count|layoffs|redundanc|unemployed persons/i;
const INFLATION = /\bcpi\b|\bpce\b|\bppi\b|consumer price|producer price|inflation|price index|import prices|wage growth|average hourly earnings/i;
const POLICY = /rate decision|interest rate decision|federal funds rate|fed funds|policy rate|official bank rate|cash rate target|deposit facility rate|main refinancing rate|overnight rate/i;
const GROWTH = /non.?farm payroll|payroll|employment change|employment growth|gross domestic product|\bgdp\b|retail sales|industrial production|manufacturing production|trade balance|consumer confidence|business confidence|pmi|building permits|housing starts|home sales|durable goods|factory orders|job openings|jolts/i;

export function parseEconomicValue(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const text = String(raw).trim().replace(/\u2212/g, '-');
  if (EMPTY.has(text.toLowerCase())) return null;
  // Some providers write `¥-956B` / `$-6.18B`, while others write
  // `-$956B`. Both indicate negative values; never silently read
  // signed amounts as positive, and reject contradictory double signs.
  const match = text.match(/^(\()?\s*([+-]?)\s*[$€£¥]?\s*([+-]?)\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(%|[kmbt])?\s*(\))?$/i);
  if (!match || Boolean(match[1]) !== Boolean(match[6]) ||
      (match[2] && match[3]) || (match[1] && (match[2] || match[3]))) return null;
  const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  const suffix = (match[5] || '').toLowerCase();
  const number = Number(match[4].replace(/,/g, ''));
  const negative = match[2] === '-' || match[3] === '-' || Boolean(match[1]);
  const value = (negative ? -number : number) * (scale[suffix] || 1);
  return Number.isFinite(value) ? { value, unit: suffix === '%' ? 'percent' : 'number' } : null;
}

export function hasPublishedCalendarActual(event){
  return parseEconomicValue(event?.actual) !== null;
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
  // Minor USD releases rarely establish a meaningful metals bias on their own.
  if (currency === 'USD' && event?.impact !== 'low' && event?.impact !== 'holiday' && event?.impact !== 'unknown') {
    const inverseDirection = direction === 'up' ? 'down' : 'up';
    markets.push({ asset: 'XAUUSD', direction: inverseDirection });
    markets.push({ asset: 'XAGUSD', direction: inverseDirection });
  }
  return { ...base, status: 'surprise', direction, difference, note: kind === 'inflation' ? 'rate_expectations' : kind === 'policy' ? 'policy_expectations' : 'conditional', markets };
}

// Hypothetical cases only: never populate the event's actual or forecast fields.
export function calendarScenarios(event) {
  if (parseEconomicValue(event?.actual) !== null) return null;
  if (indicatorKind(event?.title) === 'unknown') return { note:'unsupported_indicator', cases:[] };
  if (parseEconomicValue(event?.forecast) === null) return { note:'no_forecast', cases:[] };
  const kind = indicatorKind(event.title);
  const currency = String(event.currency || '').toUpperCase();
  const cases = ['higher','lower'].map(comparison => {
    const up = (comparison === 'higher') !== (kind === 'inverse');
    const markets = [{ asset:currency, direction:up ? 'up' : 'down' }];
    if (currency === 'USD' && event?.impact !== 'low' && event?.impact !== 'holiday' && event?.impact !== 'unknown')
      markets.push(...['XAUUSD','XAGUSD'].map(asset => ({ asset, direction:up ? 'down' : 'up' })));
    return { comparison, markets };
  });
  return { note:kind === 'inflation' ? 'rate_expectations' : kind === 'policy' ? 'policy_expectations' : 'conditional', cases };
}

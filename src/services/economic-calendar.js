// Public no-key endpoint. Provider documentation says CORS is enabled and responses are cached ~15m.
export const CALENDAR_SOURCE_URL = 'https://showmytrades.com/tools/economic-calendar';
export const CALENDAR_API_URL = 'https://showmytrades.com/api/public/calendar/v1?days=7&impact=all';

function cleanEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const time = typeof raw.time === 'string' && Number.isFinite(Date.parse(raw.time))
    ? raw.time
    : Number.isFinite(raw.ts) ? new Date(raw.ts * 1000).toISOString() : null;
  if (!time || !/^[A-Z]{3}$/.test(String(raw.currency || ''))) return null;
  const safe = value => typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 160) : '';
  const title = safe(raw.title);
  if (!title) return null;
  return {
    id: safe(raw.id) || String(raw.currency) + '-' + time + '-' + title,
    time,
    currency: String(raw.currency),
    impact: ['high','medium','low','holiday'].includes(raw.impact) ? raw.impact : 'low',
    title,
    forecast: safe(raw.forecast),
    actual: safe(raw.actual),
    previous: safe(raw.previous),
    period: safe(raw.period),
    status: ['scheduled','moved','tentative'].includes(raw.status) ? raw.status : 'scheduled',
    confidence: ['official','sources_agree','single_source','sources_disagree'].includes(raw.confidence) ? raw.confidence : '',
    movedFrom: safe(raw.moved_from)
  };
}

export function normalizeCalendarPayload(payload) {
  if (!payload || !Array.isArray(payload.events)) throw new Error('Invalid economic calendar response');
  const events = payload.events.map(cleanEvent).filter(Boolean)
    .sort((a,b) => Date.parse(a.time) - Date.parse(b.time));
  const publishedAt = typeof payload.generated_at === 'string' && Number.isFinite(Date.parse(payload.generated_at))
    ? payload.generated_at : null;
  return { events, publishedAt, sourceUrl: CALENDAR_SOURCE_URL };
}

export async function fetchEconomicCalendar(signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once:true });
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(CALENDAR_API_URL, {
      signal:controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store'
    });
    if (!response.ok) throw new Error('Calendar API HTTP ' + response.status);
    return normalizeCalendarPayload(await response.json());
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

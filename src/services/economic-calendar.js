// Public no-key endpoint. Provider documentation says CORS is enabled and responses are cached ~15m.
export const CALENDAR_SOURCE_URL = 'https://showmytrades.com/tools/economic-calendar';
export const CALENDAR_API_URL = 'https://showmytrades.com/api/public/calendar/v1?days=7&impact=all';
export const CALENDAR_HISTORY_URL = '/data/economic-calendar-history.json';

function cleanEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // The provider supplies UTC ISO times and Unix seconds. Never interpret
  // timezone-less timestamps as the viewer's browser timezone.
  const hasZone=typeof raw.time==='string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw.time);
  const timeDate=hasZone?Date.parse(raw.time):NaN;
  const unix=typeof raw.ts==='number'&&Number.isInteger(raw.ts)&&raw.ts>=946684800&&raw.ts<=4102444800
    ?new Date(raw.ts*1000).toISOString():null;
  const time=Number.isFinite(timeDate)?new Date(timeDate).toISOString():unix;
  if (!time || !/^[A-Z]{3}$/.test(String(raw.currency || ''))) return null;
  const safe = value => typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 160) : '';
  const title = safe(raw.title);
  if (!title) return null;
  return {
    id: safe(raw.id) || String(raw.currency) + '-' + time + '-' + title,
    time,
    currency: String(raw.currency),
    // Unknown provider impact must not be misrepresented as a "low" event.
    impact: ['high','medium','low','holiday'].includes(raw.impact) ? raw.impact : 'unknown',
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


// Static, shared, source-backed archive. GitHub Actions updates this JSON
// several times a day. The provider itself has no older-events endpoint.
export function normalizeCalendarHistory(payload) {
  if (!payload || !Array.isArray(payload.events)) throw new Error('Invalid calendar history');
  const events = normalizeCalendarPayload({events:payload.events}).events;
  const updatedAt = typeof payload.updatedAt === 'string'
    && Number.isFinite(Date.parse(payload.updatedAt)) ? payload.updatedAt : null;
  return { events, updatedAt };
}

export async function fetchCalendarHistory(signal) {
  const response = await fetch(CALENDAR_HISTORY_URL, {
    signal, headers:{ Accept:'application/json' }, cache:'no-store'
  });
  if (!response.ok) throw new Error('Calendar history HTTP ' + response.status);
  return normalizeCalendarHistory(await response.json());
}

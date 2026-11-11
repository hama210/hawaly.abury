// Economic release dates are grouped by the reader's fixed Iraq time zone.
export const CALENDAR_TIME_ZONE = 'Asia/Baghdad';
export const HISTORY_RETENTION_DAYS = 90;
const DAY_MS = 86400000;

export function calendarDayKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:CALENDAR_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value || '';
  return [part('year'),part('month'),part('day')].join('-');
}

export function shiftCalendarDay(key, amount) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isInteger(amount)) return '';
  const date = new Date(key + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== key) return '';
  return new Date(date.getTime() + amount * DAY_MS).toISOString().slice(0,10);
}

export function mondayOfCalendarWeek(key) {
  const day = new Date(key + 'T00:00:00Z');
  if (!Number.isFinite(day.getTime())) return '';
  const weekday = day.getUTCDay(); // Monday = first day of the market week.
  return shiftCalendarDay(key, -(weekday === 0 ? 6 : weekday - 1));
}

export function matchesCalendarView(time, view, now = Date.now(), { historyDays = 7, historyDate = '' } = {}) {
  const day = calendarDayKey(time);
  const today = calendarDayKey(now);
  if (!day || !today) return false;
  switch (view) {
    case 'yesterday': return day === shiftCalendarDay(today,-1);
    case 'today': return day === today;
    case 'tomorrow': return day === shiftCalendarDay(today,1);
    case 'week': {
      const monday = mondayOfCalendarWeek(today);
      return day >= monday && day < shiftCalendarDay(monday,7);
    }
    case 'history': {
      const days = [7,30,90].includes(Number(historyDays)) ? Number(historyDays) : 7;
      return day <= today && Date.parse(time) <= new Date(now).getTime()
        && day >= shiftCalendarDay(today,1-days)
        && (!historyDate || day === historyDate);
    }
    default: return false;
  }
}

const isValid = event => event && typeof event === 'object'
  && typeof event.id === 'string' && Boolean(event.id)
  && typeof event.title === 'string' && Boolean(event.title)
  && /^[A-Z]{3}$/.test(String(event.currency || ''))
  && Number.isFinite(Date.parse(event.time || ''));

const preserveValues = ['actual','forecast','previous','period','confidence'];
export function mergeCalendarEvents(older = [], newer = []) {
  const merged = new Map();
  for (const event of [...older,...newer]) {
    if (!isValid(event)) continue;
    const saved = merged.get(event.id);
    if (!saved) { merged.set(event.id, { ...event }); continue; }
    const next = { ...saved, ...event };
    // The provider's 6-hour window can omit fields; do not erase a captured result.
    for (const name of preserveValues) {
      if ((event[name] === null || event[name] === undefined || String(event[name]).trim() === '')
          && saved[name] !== null && saved[name] !== undefined) next[name] = saved[name];
    }
    merged.set(event.id,next);
  }
  return [...merged.values()].sort((a,b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id));
}

export function archivePastCalendarEvents(previous = [], incoming = [], now = Date.now()) {
  const oldest = now - HISTORY_RETENTION_DAYS * DAY_MS;
  return mergeCalendarEvents(previous,incoming).filter(event => {
    const at = Date.parse(event.time);
    return at <= now && at >= oldest;
  });
}

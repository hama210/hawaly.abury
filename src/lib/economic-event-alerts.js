// Local, opt-in economic event reminders. No backend push and no invented events.
export const ECONOMIC_ALERTS_SETTINGS_KEY = 'hawal_economic_alerts_v1';
export const ECONOMIC_ALERTS_SENT_KEY = 'hawal_economic_alerts_sent_v1';
export const ECONOMIC_ALERTS_TOPICS = ['cpi','nfp','fed','other'];
export const ECONOMIC_ALERTS_MINUTES = [5,15,30,60];
export const ECONOMIC_ALERTS_DEFAULTS = Object.freeze({
  enabled:false, minutesBefore:15,
  topics:{cpi:true,nfp:true,fed:true,other:false}
});

export function classifyEconomicEvent(event) {
  const title = String(event?.title || '');
  if (/\b(?:core\s+)?cpi\b|consumer price index|consumer prices/i.test(title)) return 'cpi';
  if (/\b(?:nfp|non.?farm payrolls?|nonfarm employment)\b/i.test(title)) return 'nfp';
  if (event?.currency === 'USD' &&
    /\bfomc\b|federal reserve|fed funds|fed chair|interest rate decision/i.test(title)) return 'fed';
  return 'other';
}

export function normalizeEconomicAlertSettings(value) {
  const options = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const selected = options.topics && typeof options.topics === 'object' ? options.topics : {};
  return {
    enabled:options.enabled === true,
    minutesBefore:ECONOMIC_ALERTS_MINUTES.includes(Number(options.minutesBefore))
      ? Number(options.minutesBefore) : 15,
    topics:Object.fromEntries(ECONOMIC_ALERTS_TOPICS.map(topic => [
      topic,typeof selected[topic] === 'boolean' ? selected[topic] : ECONOMIC_ALERTS_DEFAULTS.topics[topic]
    ]))
  };
}

export function economicAlertKey(event) {
  const time = Date.parse(event?.time || '');
  if (!Number.isFinite(time) || !event?.id) return '';
  return String(event.id).slice(0,180) + ':' + new Date(time).toISOString();
}

export function upcomingEconomicEvents(events, settings, now = Date.now(), count = 5) {
  return (Array.isArray(events) ? events : [])
    .filter(event => {
      const time = Date.parse(event?.time || '');
      return event?.impact === 'high' && event?.status !== 'moved'
        && Number.isFinite(time) && time > now
        && settings?.topics?.[classifyEconomicEvent(event)] === true;
    })
    .sort((a,b) => Date.parse(a.time) - Date.parse(b.time))
    .slice(0,count);
}

export function dueEconomicAlerts(events, settings, delivered = {}, now = Date.now()) {
  if (!settings?.enabled) return [];
  const minutes = Number(settings.minutesBefore);
  if (!ECONOMIC_ALERTS_MINUTES.includes(minutes)) return [];
  const from = now, until = now + minutes * 60000;
  return upcomingEconomicEvents(events, settings, now, 200)
    .filter(event => {
      const stamp = Date.parse(event.time);
      const key = economicAlertKey(event);
      return Boolean(key) && stamp > from && stamp <= until && !Object.hasOwn(delivered,key);
    })
    .map(event => ({ key:economicAlertKey(event), event, triggeredAt:now }));
}

export function pruneEconomicAlertDelivery(delivered, now = Date.now()) {
  const entries = Object.entries(delivered && typeof delivered === 'object' && !Array.isArray(delivered) ? delivered : {})
    .filter(([key,stamp]) => key.length < 400 && Number.isFinite(stamp)
      && stamp <= now && now - stamp < 14 * 86400000)
    .sort((a,b) => b[1]-a[1]).slice(0,300);
  return Object.fromEntries(entries);
}

export function formatEconomicCountdown(eventTime, now = Date.now(), lang = 'en') {
  const ms = Date.parse(eventTime) - now;
  const c = lang==='ku' ? {day:'ڕۆژ',hour:'کاتژمێر',minute:'خولەک',soon:'ئێستا'} :
    lang==='ar' ? {day:'يوم',hour:'ساعة',minute:'دقيقة',soon:'الآن'} :
    {day:'d',hour:'h',minute:'m',soon:'Now'};
  if (!Number.isFinite(ms) || ms <= 0) return c.soon;
  const mins = Math.ceil(ms/60000);
  const days = Math.floor(mins/1440);
  if (days) return days + ' ' + c.day + ' · ' + Math.ceil((mins%1440)/60) + ' ' + c.hour;
  const hours = Math.floor(mins/60);
  return hours ? hours + ' ' + c.hour + ' · ' + mins%60 + ' ' + c.minute : mins + ' ' + c.minute;
}

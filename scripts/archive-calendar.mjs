// GitHub Actions captures real released events before the provider's six-hour
// lookback expires. No estimates, invented actuals, or paid API are used.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeCalendarPayload, CALENDAR_API_URL } from '../src/services/economic-calendar.js';
import { archivePastCalendarEvents } from '../src/lib/calendar-history.js';

const archiveFile = 'public/data/economic-calendar-history.json';
const now = Date.now();
const response = await fetch(CALENDAR_API_URL, {
  headers:{ Accept:'application/json', 'User-Agent':'HAWAL-calendar-history/1.0' },
  signal:AbortSignal.timeout(20000)
});
if (!response.ok) throw new Error('Calendar provider returned HTTP ' + response.status);
const live = normalizeCalendarPayload(await response.json());
const previous = JSON.parse(await readFile(archiveFile,'utf8'));
if (!Array.isArray(previous.events)) throw new Error('History archive must contain an events array');
const events = archivePastCalendarEvents(previous.events,live.events,now);
if (JSON.stringify(events) === JSON.stringify(previous.events)) {
  console.log('Economic calendar archive unchanged (' + events.length + ' events)');
} else {
  await mkdir(dirname(archiveFile),{recursive:true});
  await writeFile(archiveFile,JSON.stringify({
    updatedAt:new Date(now).toISOString(),
    events
  },null,2)+'\n');
  console.log('Economic calendar archive updated (' + events.length + ' events)');
}

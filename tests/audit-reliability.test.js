import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { renderPage } from '../src/lib/server-page.js';
import { calendarText } from '../src/lib/calendar-i18n.js';

test('offline service worker never hijacks live calendar archive or no-store requests', () => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const handlers = {};
  runInNewContext(source, {
    self: {
      location: { origin:'https://hawaly-aburyy.pages.dev' },
      addEventListener(name, handler) { handlers[name] = handler; }
    },
    URL, Response, caches:{}, fetch:() => Promise.reject(new Error('network not expected'))
  });
  let intercepted = 0;
  const check = (path, cache = 'default') => handlers.fetch({
    request: {
      url: 'https://hawaly-aburyy.pages.dev' + path,
      method: 'GET', mode: 'cors', destination: '', cache
    },
    respondWith() { intercepted++; },
    waitUntil() {}
  });
  check('/data/economic-calendar-history.json');
  check('/data/other-source-data.json');
  check('/api/news?mode=fast');
  check('/news-covers/metals.svg', 'no-store');
  assert.equal(intercepted, 0, 'live data and no-store requests must reach the network');
});

test('economic calendar is separately indexable, with real descriptions in all site languages', () => {
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for (const lang of ['ku','ar','en']) {
    const rendered = renderPage(html,{lang,page:'calendar',news:[],markets:[]});
    const content = calendarText(lang);
    assert.ok(rendered.includes(content.title), lang + ' has a calendar title');
    assert.ok(rendered.includes(content.lead), lang + ' has calendar summary');
    assert.ok(rendered.includes('https://showmytrades.com/tools/economic-calendar'), lang + ' cites source');
    assert.ok(rendered.includes('href="' + (lang === 'ku' ? '/calendar' : '/' + lang + '/calendar') + '"'));
    assert.ok(!rendered.includes('Report a broken link or pricing issue'), 'calendar is not SSR contact page');
    assert.match(rendered, /<meta name="description" content="[^"]+"/);
  }
});

test('live and archive calendar loading run separately without blocking one another', () => {
  const source = readFileSync(new URL('../src/components/EconomicCalendar.jsx',import.meta.url),'utf8');
  assert.match(source, /fetchEconomicCalendar\(controller\.signal\)\s*\.then\(/);
  assert.match(source, /fetchCalendarHistory\(controller\.signal\)\s*\.then\(/);
  assert.doesNotMatch(source, /Promise\.allSettled\(\[fetchEconomicCalendar/);
  assert.match(source, /selectedDataPending/);
  assert.match(source, /selectedDataSettled/);
});

test('deployed static archive bypasses Cloudflare Page functions', () => {
  const routes = JSON.parse(readFileSync(new URL('../public/_routes.json',import.meta.url),'utf8'));
  assert.ok(routes.exclude.includes('/data/*'));
  const script = readFileSync(new URL('../src/services/economic-calendar.js',import.meta.url),'utf8');
  assert.match(script, /cache:'no-store'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FEEDS, onRequest } from '../functions/api/news.js';
import { fetchNews } from '../src/services/news.js';
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js';

const fed = 'https://www.federalreserve.gov';
const item = (title, link, pubDate, description = title) =>
  '<item><title>' + title + '</title><link>' + link + '</link><description>' + description +
  '</description><pubDate>' + pubDate + '</pubDate></item>';
const rss = (...items) => '<rss><channel>' + items.join('') + '</channel></rss>';
const daysAgo = days => new Date(Date.now() - days * 86400000).toUTCString();

test('Hawal registers the official Fed press, speech, and Warsh-only feeds', () => {
  const sources = Object.fromEntries(FEEDS.map(feed => [feed.source, feed]));
  assert.equal(sources['Federal Reserve News'].url, fed + '/feeds/press_all.xml');
  assert.equal(sources['Federal Reserve News'].tier, 'official');
  assert.equal(sources['Federal Reserve Speeches'].url, fed + '/feeds/speeches.xml');
  assert.equal(sources['Chairman Warsh Speeches'].url, fed + '/feeds/speeches.xml');
  assert.equal(sources['Chairman Warsh Testimony'].url, fed + '/feeds/testimony.xml');
  assert.equal(sources['Chairman Warsh Speeches'].format, 'fed-warsh');
  assert.equal(sources['Chairman Warsh Speeches'].maxAgeDays, 120);
  assert.equal(sources['Chairman Warsh Testimony'].maxAgeDays, 120);
});

test('official Fed news is included while Warsh feeds exclude unrelated officials', async () => {
  const cache = replaceGlobal('caches', { default:new MemoryCache() });
  const warnings = silenceWarnings();
  const releases = rss(item(
    'Federal Reserve Board publishes new monetary policy guidance',
    fed + '/newsevents/pressreleases/monetary20261029a.htm', daysAgo(0)
  ));
  const speeches = rss(
    item('Bowman, Supervisory Modernization', fed + '/newsevents/speech/bowman20261014a.htm', daysAgo(15)),
    item('Warsh, In Our Time', fed + '/newsevents/speech/warsh20260828a.htm', daysAgo(62),
      'Chairman Kevin Warsh discusses inflation and monetary policy.')
  );
  const testimony = rss(
    item('Bowman, Supervision and Regulation', fed + '/newsevents/testimony/bowman20260604a.htm', daysAgo(100)),
    item('Warsh, Semiannual Monetary Policy Report', fed + '/newsevents/testimony/warsh20260714a.htm', daysAgo(105),
      'Chairman Kevin Warsh provides testimony on monetary policy.')
  );
  const restore = replaceGlobal('fetch', async url => {
    const source = String(url);
    if(source === fed + '/feeds/press_all.xml') return new Response(releases, { status:200 });
    if(source === fed + '/feeds/speeches.xml') return new Response(speeches, { status:200 });
    if(source === fed + '/feeds/testimony.xml') return new Response(testimony, { status:200 });
    return new Response('offline', { status:503 });
  });
  try {
    const call = requestContext('https://example.com/api/news?mode=fast&limit=48&refresh=1');
    const response = await onRequest(call.context);
    const payload = await response.json();
    await call.settle();
    assert.equal(response.status, 200);
    const press = payload.items.find(row => row.sourceGroup === 'Federal Reserve News');
    assert.ok(press, 'official Fed news must appear');
    assert.equal(press.sourceTier, 'official');
    assert.equal(press.link, fed + '/newsevents/pressreleases/monetary20261029a.htm');

    const warsh = payload.items.filter(row => row.sourceGroup === 'Chairman Warsh Speeches');
    assert.equal(warsh.length, 1);
    assert.equal(warsh[0].title, 'Warsh, In Our Time');
    assert.equal(warsh[0].displayMaxAgeDays, 120);
    assert.equal(warsh[0].link, fed + '/newsevents/speech/warsh20260828a.htm');

    const testified = payload.items.filter(row => row.sourceGroup === 'Chairman Warsh Testimony');
    assert.equal(testified.length, 1);
    assert.match(testified[0].title, /Warsh/);
    assert.equal(payload.items.some(row => row.title === 'Bowman, Supervisory Modernization'), false);
    assert.equal(payload.items.some(row => row.title === 'Bowman, Supervision and Regulation'), false);
  } finally {
    restore(); warnings(); cache();
  }
});

test('client retains older Warsh remarks and prefers the dedicated attribution', async () => {
  const headline = 'Warsh, In Our Time';
  const general = { id:'general',title:headline,source:'Federal Reserve Speeches',sourceGroup:'Federal Reserve Speeches',
    sourceTier:'official',category:'markets',publishedAt:daysAgo(62),displayMaxAgeDays:120 };
  const dedicated = { ...general,id:'warsh',source:'Chairman Warsh Speeches',sourceGroup:'Chairman Warsh Speeches' };
  const restore = replaceGlobal('fetch', async url => {
    const target = String(url);
    if(target.includes('mode=fast')) return Response.json({items:[dedicated],batchCount:3});
    if(target.includes('batch=0')) return Response.json({items:[general],batchCount:3});
    return Response.json({items:[],batchCount:3});
  });
  try {
    const actual = await fetchNews();
    assert.equal(actual.length, 1);
    assert.equal(actual[0].sourceGroup, 'Chairman Warsh Speeches');
    assert.equal(actual[0].id, 'warsh');
  } finally {
    restore();
  }
});

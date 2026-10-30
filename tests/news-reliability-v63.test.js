import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest, FEEDS } from '../functions/api/news.js';
import { fetchNews } from '../src/services/news.js';
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js';

test('small RSS batches cover the entire configured feed catalogue', async () => {
  const restoreCaches = replaceGlobal('caches', { default: new MemoryCache() });
  const restoreFetch = replaceGlobal('fetch', async () => new Response('offline', { status:503 }));
  const restoreWarnings = silenceWarnings();
  try {
    const initial = requestContext('https://example.com/api/news?mode=full&batch=0');
    const first = await (await onRequest(initial.context)).json();
    await initial.settle();
    assert.ok(first.feedStats.requested <= 12);
    assert.equal(first.batchCount, Math.ceil(FEEDS.length / 12));
    let checked = first.feedStats.requested;
    for (let batch = 1; batch < first.batchCount; batch++) {
      const q = requestContext(`https://example.com/api/news?mode=full&batch=${batch}`);
      const data = await (await onRequest(q.context)).json();
      await q.settle();
      assert.ok(data.feedStats.requested <= 12);
      checked += data.feedStats.requested;
    }
    assert.equal(checked, FEEDS.length);
  } finally {
    restoreWarnings();
    restoreFetch();
    restoreCaches();
  }
});

test('browser reaches final batch even when fast and first batch fail, and reports health', async () => {
  const publishedAt = new Date().toISOString();
  const requests = [];
  const restoreFetch = replaceGlobal('fetch', async url => {
    const path = String(url);
    requests.push(path);
    if (path.includes('mode=fast') || path.includes('batch=0')) return new Response('bad gateway', { status:502 });
    if (path.includes('batch=5')) return Response.json({
      batchCount:6, feedStats:{succeeded:1, sources:[]},
      items:[{id:'fresh-final-batch',title:'Iraq central bank announces new dinar banking policy',
        source:'Iraqi Business',sourceGroup:'Iraq Business News',category:'iraq',
        publishedAt,summary:'Current dollar and dinar update.'}]
    });
    return Response.json({batchCount:6,feedStats:{succeeded:0,sources:[]},items:[]});
  });
  try {
    const updates = [],statuses = [];
    const result = await fetchNews(items => updates.push(items),{onStatus:status => statuses.push(status)});
    assert.ok(requests.some(path => path.includes('batch=5')));
    assert.equal(result[0]?.id, 'fresh-final-batch');
    assert.ok(updates.length);
    assert.equal(statuses.at(-1)?.status,'live');
    assert.equal(statuses.at(-1)?.successfulFeeds,1);
  } finally {
    restoreFetch();
  }
});

test('v6.1 lead story remains first, with rates as a collapsible extra instead of dominating the landing page', () => {
  const app = fs.readFileSync('src/main.jsx', 'utf8');
  const css = fs.readFileSync('src/production.css', 'utf8');
  const redesign = fs.readFileSync('src/redesign.css', 'utf8');
  const mainHome = app.split('home-screen ')[1]?.split('markets-screen ')[0] || '';
  assert.match(mainHome, /home-stage/);
  assert.match(mainHome, /home-feature-main/);
  assert.match(mainHome, /home-market-aside/);
  assert.ok(mainHome.indexOf('home-feature-main') < mainHome.indexOf('home-rates-disclosure'));
  assert.match(mainHome, /<details className="home-rates-disclosure">/);
  assert.match(mainHome, /<Hero item={hero}/);
  assert.match(css,/home-rates-disclosure/);
  assert.doesNotMatch(css, /--muted:#abc0d8/);
  assert.match(redesign,/--bg:#020b19/);
});

import test from 'node:test'
import assert from 'node:assert/strict'
import { FEEDS, onRequest } from '../functions/api/news.js'
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js'

function rssItem(title, description, publishedAt){
  return `<item><title>${title}</title><link>https://example.com/story</link><description>${description}</description><pubDate>${publishedAt}</pubDate></item>`
}

test('news rejects server-side search and non-GET requests', async () => {
  const query = requestContext('https://example.com/api/news?q=oil')
  const queryResponse = await onRequest(query.context)
  assert.equal(queryResponse.status, 400)

  const post = requestContext('https://example.com/api/news', { method: 'POST' })
  const postResponse = await onRequest(post.context)
  assert.equal(postResponse.status, 405)
  assert.equal(postResponse.headers.get('allow'), 'GET')
})

test('news keeps recent Iraq stories, removes stale and unrelated feed results, and caches the batch', async () => {
  const cache = new MemoryCache()
  const restoreCaches = replaceGlobal('caches', { default: cache })
  const restoreWarn = silenceWarnings()
  const fresh = new Date().toUTCString()
  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toUTCString()
  const xml = `<rss><channel>
    ${rssItem('Iraq central bank updates dinar policy - Test Source', 'Iraq banking and budget reforms continue.', fresh)}
    ${rssItem('Old Iraq oil report - Test Source', 'Iraq oil exports.', old)}
    ${rssItem('Libya oil exports rise - MEES', 'Libya production and shipping update.', fresh)}
  </channel></rss>`
  let fetchCount = 0
  const restoreFetch = replaceGlobal('fetch', async url => {
    fetchCount += 1
    if(String(url).includes('Iraq%20OR%20Baghdad%20OR%20Kurdistan')){
      return new Response(xml, { status: 200, headers: { 'content-type': 'application/rss+xml' } })
    }
    return new Response('unavailable', { status: 503 })
  })

  try{
    const first = requestContext('https://example.com/api/news?mode=fast&limit=48')
    const firstResponse = await onRequest(first.context)
    const payload = await firstResponse.json()
    await first.settle()
    assert.equal(firstResponse.status, 200)
    assert.equal(firstResponse.headers.get('x-news-cache'), 'MISS')
    assert.deepEqual(payload.items.map(item => item.title), ['Iraq central bank updates dinar policy'])
    assert.equal(payload.items[0].content, 'Iraq banking and budget reforms continue.')
    assert.ok(payload.items[0].intelligence.effects.some(effect => effect.asset === 'USD/IQD'))
    assert.equal(payload.feedStats.succeeded, 1)
    assert.equal(payload.feedStats.failed, 5)

    const callsAfterFirst = fetchCount
    const second = requestContext('https://example.com/api/news?limit=48&mode=fast')
    const secondResponse = await onRequest(second.context)
    assert.equal(secondResponse.headers.get('x-news-cache'), 'HIT')
    assert.equal(fetchCount, callsAfterFirst)
  }finally{
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('news sources are curated around the focused markets and wars', () => {
  const names = FEEDS.map(feed => feed.source)
  assert.ok(FEEDS.length < 45)
  assert.ok(names.includes('Reuters Forex'))
  assert.ok(names.includes('Reuters Metals'))
  assert.ok(names.includes('Reuters US Indices'))
  assert.ok(names.includes('Shafaq Economy'))
  assert.ok(names.includes('Reuters Global Conflict'))
  assert.ok(!names.includes('Yahoo Finance'))
  assert.ok(!names.includes('CoinDesk'))
  assert.ok(!names.includes('Guardian World'))
})

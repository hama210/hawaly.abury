import test from 'node:test'
import assert from 'node:assert/strict'
import { FEEDS, conflictRegionFor, onRequest } from '../functions/api/news.js'
import { matchesCategory } from '../src/utils/categories.js'
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
  const fourDaysOld = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toUTCString()
  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toUTCString()
  const xml = `<rss><channel>
    ${rssItem('Dollar rises in Baghdad as Iraq central bank updates dinar policy', 'Iraq banking and budget reforms continue.', fresh)}
    ${rssItem('Four-day-old Iraq budget update', 'Iraq budget and banking update.', fourDaysOld)}
    ${rssItem('Old Iraq oil report - Test Source', 'Iraq oil exports.', old)}
    ${rssItem('Libya oil exports rise - MEES', 'Libya production and shipping update.', fresh)}
  </channel></rss>`
  let fetchCount = 0
  const restoreFetch = replaceGlobal('fetch', async url => {
    fetchCount += 1
    if(String(url).includes('shafaq.com/rss/en/Economy')){
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
    assert.deepEqual(payload.items.map(item => item.title), ['Dollar rises in Baghdad as Iraq central bank updates dinar policy'])
    assert.equal(payload.items[0].content, 'Iraq banking and budget reforms continue.')
    assert.ok(payload.items[0].intelligence.effects.some(effect => effect.asset === 'USD/IQD' && effect.direction === 'up'))
    assert.equal(payload.items[0].sourceTier, 'local')
    assert.ok(payload.items[0].strengthScore > 0)
    assert.equal(payload.feedStats.succeeded, 1)
    assert.equal(payload.feedStats.failed, payload.feedStats.requested - 1)

    const callsAfterFirst = fetchCount
    const second = requestContext('https://example.com/api/news?limit=48&mode=fast')
    const secondResponse = await onRequest(second.context)
    assert.equal(secondResponse.headers.get('x-news-cache'), 'HIT')
    assert.equal(fetchCount, callsAfterFirst)

    const forced = requestContext('https://example.com/api/news?mode=fast&limit=48&refresh=1')
    const forcedResponse = await onRequest(forced.context)
    await forced.settle()
    assert.equal(forcedResponse.headers.get('x-news-cache'), 'MISS')
    assert.ok(fetchCount > callsAfterFirst)
  }finally{
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('news is ordered by publication time even when an older story has a stronger impact score', async () => {
  const restoreCaches = replaceGlobal('caches', { default: new MemoryCache() })
  const restoreWarn = silenceWarnings()
  const newest = new Date().toUTCString()
  const older = new Date(Date.now() - 2 * 60 * 60 * 1000).toUTCString()
  const forex = `<rss><channel>${rssItem('EUR/USD holds steady in quiet trading', 'Euro currency markets remain stable.', newest)}</channel></rss>`
  const war = `<rss><channel>${rssItem('Iran war attack raises global market risk - Al Jazeera', 'Missile conflict and sanctions pressure world markets.', older)}</channel></rss>`
  const restoreFetch = replaceGlobal('fetch', async url => {
    if(String(url).includes('fxstreet.com/rss/news')) return new Response(forex, { status: 200 })
    if(String(url).includes('aljazeera.com')) return new Response(war, { status: 200 })
    return new Response('unavailable', { status: 503 })
  })

  try {
    const request = requestContext('https://example.com/api/news?mode=fast&limit=48')
    const response = await onRequest(request.context)
    const payload = await response.json()
    await request.settle()
    assert.equal(payload.order, 'latest-first')
    assert.equal(response.headers.get('x-news-order'), 'latest-first')
    assert.deepEqual(payload.items.map(item => item.title), [
      'EUR/USD holds steady in quiet trading',
      'Iran war attack raises global market risk - Al Jazeera'
    ])
    assert.ok(payload.items[0].strengthScore < payload.items[1].strengthScore)
  } finally {
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('news does not invent fresh fallback stories when every feed is unavailable', async () => {
  const restoreCaches = replaceGlobal('caches', { default: new MemoryCache() })
  const restoreWarn = silenceWarnings()
  const restoreFetch = replaceGlobal('fetch', async () => new Response('unavailable', { status: 503 }))
  try {
    const request = requestContext('https://example.com/api/news?mode=fast&limit=48')
    const response = await onRequest(request.context)
    const payload = await response.json()
    await request.settle()
    assert.equal(payload.status, 'unavailable')
    assert.deepEqual(payload.items, [])
  } finally {
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('news parses official Atom feeds and decodes numeric headline entities', async () => {
  const restoreCaches = replaceGlobal('caches', { default: new MemoryCache() })
  const restoreWarn = silenceWarnings()
  const published = new Date().toISOString()
  const atom = `<feed><entry><title>US payrolls rise &#x2014; Fed outlook in focus</title><link href="https://www.bls.gov/example"/><content>Official US employment and payrolls report.</content><published>${published}</published></entry></feed>`
  const restoreFetch = replaceGlobal('fetch', async url => String(url).includes('/feed/empsit.rss')
    ? new Response(atom, { status: 200, headers: { 'content-type':'application/atom+xml' } })
    : new Response('unavailable', { status: 503 }))

  try {
    const request = requestContext('https://example.com/api/news?mode=full&batch=0&limit=40')
    const response = await onRequest(request.context)
    const payload = await response.json()
    await request.settle()
    assert.equal(response.status, 200)
    assert.equal(payload.items[0].title, 'US payrolls rise — Fed outlook in focus')
    assert.equal(payload.items[0].source, 'US Employment (BLS)')
    assert.equal(payload.items[0].sourceTier, 'official')
    assert.equal(payload.items[0].link, 'https://www.bls.gov/example')
  } finally {
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('news parses current Treasury press releases from the official HTML listing', async () => {
  const restoreCaches = replaceGlobal('caches', { default: new MemoryCache() })
  const restoreWarn = silenceWarnings()
  const published = new Date().toISOString()
  const treasury = `<div><span class="date-format"><time datetime="${published}" class="datetime">Today</time></span><span></span><h3 class="featured-stories__headline"><a href="/news/press-releases/test-release" hreflang="en">Treasury Targets Weapons Network Supporting Terrorism</a></h3></div>`
  const restoreFetch = replaceGlobal('fetch', async url => String(url) === 'https://home.treasury.gov/news/press-releases'
    ? new Response(treasury, { status: 200, headers: { 'content-type':'text/html' } })
    : new Response('unavailable', { status: 503 }))

  try {
    const request = requestContext('https://example.com/api/news?mode=full&batch=1&limit=40')
    const response = await onRequest(request.context)
    const payload = await response.json()
    await request.settle()
    assert.equal(response.status, 200)
    assert.equal(payload.items[0].source, 'US Treasury Sanctions')
    assert.equal(payload.items[0].sourceTier, 'official')
    assert.equal(payload.items[0].link, 'https://home.treasury.gov/news/press-releases/test-release')
  } finally {
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('news parses the official CENTCOM press-release listing without Google News', async () => {
  const restoreCaches = replaceGlobal('caches', { default: new MemoryCache() })
  const restoreWarn = silenceWarnings()
  const published = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric', timeZone:'UTC' })
  const centcom = `<div class="item"><div class="info"><div class="info-bar"><span class="date">${published}</span></div><div class="title"><a href='/MEDIA/PUBLIC-RELEASES/Article/1234/test/'>CENTCOM reports missile strike near Iran</a></div></div></div>`
  const restoreFetch = replaceGlobal('fetch', async url => String(url).includes('centcom.mil/MEDIA/PUBLIC-RELEASES')
    ? new Response(centcom, { status: 200, headers: { 'content-type':'text/html' } })
    : new Response('unavailable', { status: 503 }))

  try {
    const request = requestContext('https://example.com/api/news?mode=full&batch=0&limit=40')
    const response = await onRequest(request.context)
    const payload = await response.json()
    await request.settle()
    const item = payload.items.find(entry => entry.source === 'CENTCOM Updates')
    assert.ok(item)
    assert.equal(item.sourceTier, 'official')
    assert.equal(item.displayMaxAgeDays, 14)
    assert.equal(item.link, 'https://www.centcom.mil/MEDIA/PUBLIC-RELEASES/Article/1234/test/')
  } finally {
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('news category filters use explicit categories and affected assets', () => {
  assert.equal(matchesCategory({ category:'iraq', intelligence:{ assets:['USD/IQD'] } }, 'iraq'), true)
  assert.equal(matchesCategory({ category:'forex', intelligence:{ assets:['EUR/USD'] } }, 'forex'), true)
  assert.equal(matchesCategory({ category:'metals', intelligence:{ assets:['XAU/USD'] } }, 'metals'), true)
  assert.equal(matchesCategory({ category:'indices', intelligence:{ assets:['NASDAQ'] } }, 'indices'), true)
  assert.equal(matchesCategory({ category:'geopolitics', title:'CENTCOM reports a missile strike' }, 'geopolitics'), true)
  assert.equal(matchesCategory({ category:'iraq', title:'Dollar rises in Baghdad' }, 'forex'), false)
})

test('news sources are curated around the focused markets and wars', () => {
  const names = FEEDS.map(feed => feed.source)
  assert.ok(FEEDS.length < 45)
  assert.ok(names.includes('Reuters Forex'))
  assert.ok(names.includes('Reuters Metals'))
  assert.ok(names.includes('Reuters US Indices'))
  assert.ok(names.includes('DW Business'))
  assert.ok(names.includes('Euronews Business'))
  assert.ok(names.includes('US Treasury Sanctions'))
  assert.ok(names.includes('Shafaq Economy'))
  assert.ok(names.includes('Reuters Global Conflict'))
  assert.ok(names.includes('Reuters Iran-US Conflict'))
  assert.ok(names.includes('Reuters Middle East Conflict'))
  assert.ok(names.includes('AP Middle East Conflict'))
  assert.ok(names.includes('BBC Middle East Conflict'))
  assert.ok(names.includes('FXStreet Metals'))
  assert.ok(names.includes('Financial Times Markets'))
  assert.ok(names.includes('US Inflation (BLS)'))
  assert.ok(names.includes('US Employment (BLS)'))
  assert.ok(names.includes('US Economy (BEA)'))
  assert.equal(FEEDS.find(feed => feed.source === 'Federal Reserve')?.url, 'https://www.federalreserve.gov/feeds/press_monetary.xml')
  assert.equal(FEEDS.find(feed => feed.source === 'European Central Bank')?.url, 'https://www.ecb.europa.eu/rss/press.html')
  assert.equal(FEEDS.find(feed => feed.source === 'Bank of England')?.url, 'https://www.bankofengland.co.uk/rss/news')
  assert.equal(FEEDS.find(feed => feed.source === 'US Treasury Sanctions')?.tier, 'official')
  assert.equal(FEEDS.find(feed => feed.source === 'US Treasury Sanctions')?.format, 'treasury-html')
  assert.equal(FEEDS.find(feed => feed.source === 'BBC War')?.url, 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml')
  assert.equal(FEEDS.find(feed => feed.source === 'Al Jazeera War')?.url, 'https://www.aljazeera.com/xml/rss/all.xml')
  assert.equal(FEEDS.find(feed => feed.source === 'CENTCOM Updates')?.format, 'centcom-html')
  assert.equal(FEEDS.find(feed => feed.source === 'CENTCOM Updates')?.url, 'https://www.centcom.mil/MEDIA/PUBLIC-RELEASES/')
  assert.equal(FEEDS.find(feed => feed.source === 'CENTCOM Updates')?.maxAgeDays, 14)
  assert.equal(FEEDS.find(feed => feed.source === 'DW Business')?.url, 'https://rss.dw.com/rdf/rss-en-bus')
  assert.equal(FEEDS.find(feed => feed.source === 'Euronews Business')?.url, 'https://www.euronews.com/rss?level=theme&name=business')
  assert.ok(!names.includes('Wall Street Journal Markets'))
  assert.ok(!names.includes('Gold and Silver'))
  assert.ok(!names.includes('Global Conflict'))
  assert.ok(!names.includes('Yahoo Finance'))
  assert.ok(!names.includes('CoinDesk'))
  assert.ok(!names.includes('Guardian World'))
})

test('Middle East conflict stories are classified without mixing in unrelated wars', () => {
  assert.equal(conflictRegionFor({ title:'US and Iran exchange missile strikes near Hormuz', summary:'CENTCOM reports military activity' }), 'usIran')
  assert.equal(conflictRegionFor({ title:'Houthi drone attack disrupts Red Sea shipping', summary:'Fighting continues near Yemen' }), 'redSea')
  assert.equal(conflictRegionFor({ title:'Ceasefire talks follow fighting in Gaza', summary:'Israel and Hamas discuss a truce' }), 'gazaIsrael')
  assert.equal(conflictRegionFor({ title:'Treasury sanctions Iranian airline network', summary:'Officials announced new financial restrictions' }), null)
  assert.equal(conflictRegionFor({ title:'Russia launches missiles at Ukraine', summary:'The war continues in Europe' }), null)
})

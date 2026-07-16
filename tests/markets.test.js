import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/api/markets.js'
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js'

function yahooPayload(){
  return { chart: { result: [{ meta: { regularMarketPrice: 2500, previousClose: 2475 } }] } }
}

function shafaqFeed(){
  const description = "Baghdad's exchanges at 152,800 dinars. Shops in the Iraqi capital sold the dollar at 153,250 dinars and bought it at 152,250 dinars. In Erbil, selling prices stood at 152,800 dinars and buying prices stood at 152,700 dinars."
  return `<rss><channel><item><title>Dollar prices in Baghdad and Erbil</title><link>https://shafaq.com/example</link><description><![CDATA[${description}]]></description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`
}

test('markets use verified quotes, then mark last-known-good values stale when sources fail', async () => {
  const cache = new MemoryCache()
  const restoreCaches = replaceGlobal('caches', { default: cache })
  const restoreWarn = silenceWarnings()
  let sourcesAreLive = true
  const restoreFetch = replaceGlobal('fetch', async url => {
    if(!sourcesAreLive) return new Response('unavailable', { status: 503 })
    const address = String(url)
    if(address.includes('query1.finance.yahoo.com')) return Response.json(yahooPayload())
    if(address.includes('shafaq.com')) return new Response(shafaqFeed(), { status: 200 })
    return new Response('unavailable', { status: 503 })
  })

  try{
    const first = requestContext('https://example.com/api/markets')
    const firstResponse = await onRequest(first.context)
    const firstPayload = await firstResponse.json()
    await first.settle()
    const usdLive = firstPayload.items.find(item => item.symbol === 'USD/IQD')
    assert.equal(firstResponse.headers.get('x-markets-cache'), 'MISS')
    assert.equal(usdLive.price, 152800)
    assert.equal(usdLive.quoteAmount, 100)
    assert.equal(usdLive.dataStatus, 'live')
    assert.equal(usdLive.source, 'Shafaq News local market')
    assert.ok(firstPayload.items.every(item => item.dataStatus === 'live'))

    cache.deleteWhere('markets-fresh-v3')
    sourcesAreLive = false
    const second = requestContext('https://example.com/api/markets')
    const secondResponse = await onRequest(second.context)
    const secondPayload = await secondResponse.json()
    const usdStale = secondPayload.items.find(item => item.symbol === 'USD/IQD')
    assert.equal(usdStale.price, 152800)
    assert.equal(usdStale.dataStatus, 'stale')
    assert.ok(secondPayload.items.every(item => item.dataStatus === 'stale'))
    assert.doesNotMatch(JSON.stringify(secondPayload), /Fallback market model|Official fallback/)
  }finally{
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('markets return unavailable values instead of invented prices when no verified quote exists', async () => {
  const cache = new MemoryCache()
  const restoreCaches = replaceGlobal('caches', { default: cache })
  const restoreWarn = silenceWarnings()
  const restoreFetch = replaceGlobal('fetch', async () => new Response('unavailable', { status: 503 }))
  try{
    const call = requestContext('https://example.com/api/markets')
    const response = await onRequest(call.context)
    const payload = await response.json()
    assert.equal(payload.dataStatus, 'unavailable')
    assert.ok(payload.items.every(item => item.price === null && item.dataStatus === 'unavailable'))
  }finally{
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

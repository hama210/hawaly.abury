import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest, parseShafaqRateFeed } from '../functions/api/markets.js'
import fs from 'node:fs'
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js'

function yahooPayload(){
  return { chart: { result: [{ meta: { regularMarketPrice: 2500, previousClose: 2475, regularMarketTime: Math.floor(Date.now()/1000) } }] } }
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
    if(address.includes('cbi.iq')) return new Response('<table><tr><td>U.S. dollar</td><td>USD</td><td>1310.000</td></tr></table>');
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
    assert.ok(firstPayload.items.every(item => item.dataStatus === 'live' || item.marketKind === 'official' && item.dataStatus === 'undated'))

    cache.deleteWhere('markets-fresh-v5-city-provenance')
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


function shafaqItem(title, description, publishedAt, path='USD-IQD-prices') {
  return '<item><title>'+title+'</title><link>https://shafaq.com/en/Economy/'+path+'</link>'+
    '<description><![CDATA['+description+']]></description><pubDate>'+publishedAt.toUTCString()+'</pubDate></item>';
}

test('Shafaq feed selects the most recent verified city price report, not the first dollar headline', () => {
  const now = Date.now();
  const realDescription =
    'According to a Shafaq News market survey, the dollar traded in Baghdad’s Al-Kifah and Al-Harithiya exchanges at 169,050 dinars per 100 dollars, up from the morning session’s 168,900 dinars. '+
    'In the Iraqi capital, exchange shops sold the dollar at 169,500 dinars and bought it at 168,500 dinars, while in Erbil, selling prices stood at 168,900 dinars and buying prices at 168,800 dinars.';
  const oldDescription =
    'Baghdad exchanges at 168,000 dinars. In the Iraqi capital, exchange shops sold the dollar at 168,500 dinars and bought it at 167,500 dinars. In Erbil, selling prices stood at 168,200 dinars and buying prices at 168,100 dinars.';
  const xml = '<rss><channel>'+
    shafaqItem('Dollar policy briefing, not cash exchange quotes','Central bank officials discussed trade policy without publishing a local cash-market quote.',new Date(now-60*1000),'dollar-policy')+
    shafaqItem('Dollar prices in Baghdad and Erbil',oldDescription,new Date(now-2*60*60*1000),'old-market')+
    shafaqItem('Dollar rises in Baghdad, slips in Erbil',realDescription,new Date(now-30*60*1000),'latest-market')+
    '</channel></rss>';
  const rate=parseShafaqRateFeed(xml,now);
  assert.equal(rate.price,168900);
  assert.equal(rate.quoteCity,'erbil');
  assert.equal(rate.erbil.sell,168900);
  assert.equal(rate.erbil.buy,168800);
  assert.equal(rate.baghdad.sell,169500);
  assert.equal(rate.baghdad.buy,168500);
  assert.equal(rate.baghdad.market,169050);
  assert.equal(rate.sulaymaniyah,null);
  assert.equal(rate.sourceUrl,'https://shafaq.com/en/Economy/latest-market');
  assert.ok(Date.parse(rate.updatedAt)>now-60*60*1000);
});

test('Shafaq feed rejects stale and unrelated headlines rather than fabricating city quotes',()=>{
  const now=Date.now();
  const noQuote=shafaqItem('Dollar deposits in Iraq','Banks discussed dollar settlements in the budget.',new Date(now));
  const oldQuote=shafaqItem('Dollar rates in Erbil','In Erbil, selling prices stood at 170,000 dinars and buying prices at 169,900 dinars.',new Date(now-5*86400000));
  const futureQuote=shafaqItem('Dollar rates in Erbil','In Erbil, selling prices stood at 170,000 dinars.',new Date(now+10*60*1000));
  assert.throws(()=>parseShafaqRateFeed('<rss>'+noQuote+oldQuote+futureQuote+'</rss>',now),/no recent verifiable/);
  const main=fs.readFileSync('src/main.jsx','utf8');
  assert.match(main,/localCopy\[market\.quoteCity\] \|\| localCopy\.iraq/);
  assert.doesNotMatch(main,/\{localCopy\.erbil\}<\/small>/);
});

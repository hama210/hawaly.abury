export async function onRequest() {
  const sources = [
    { name:'Reuters Markets', url:'https://www.reuters.com/markets/', tier:'Major Media', category:'markets' },
    { name:'CNBC Markets', url:'https://www.cnbc.com/markets/', tier:'Major Media', category:'markets' },
    { name:'MSN Money', url:'https://www.msn.com/en-us/money', tier:'Major Media', category:'markets' },
    { name:'Yahoo Finance', url:'https://finance.yahoo.com/', tier:'Major Media', category:'markets' },
    { name:'MarketWatch', url:'https://www.marketwatch.com/', tier:'Major Media', category:'stocks' },
    { name:'FXStreet', url:'https://www.fxstreet.com/news', tier:'Trader Source', category:'forex' },
    { name:'ForexLive', url:'https://www.forexlive.com/', tier:'Trader Source', category:'forex' },
    { name:'Federal Reserve', url:'https://www.federalreserve.gov/newsevents.htm', tier:'Official', category:'banks' },
    { name:'ECB', url:'https://www.ecb.europa.eu/press/html/index.en.html', tier:'Official', category:'banks' },
    { name:'Bank of England', url:'https://www.bankofengland.co.uk/news', tier:'Official', category:'banks' },
    { name:'Bank of Japan', url:'https://www.boj.or.jp/en/', tier:'Official', category:'banks' },
    { name:'IMF', url:'https://www.imf.org/en/News', tier:'Official', category:'world' },
    { name:'World Bank', url:'https://www.worldbank.org/en/news', tier:'Official', category:'world' },
    { name:'OPEC', url:'https://www.opec.org/opec_web/en/press_room/news.htm', tier:'Official', category:'oil' },
    { name:'EIA', url:'https://www.eia.gov/todayinenergy/', tier:'Official', category:'oil' },
    { name:'Central Bank of Iraq', url:'https://cbi.iq/', tier:'Iraq Official', category:'iraq' },
    { name:'Iraqi Ministry of Oil', url:'https://oil.gov.iq/', tier:'Iraq Official', category:'iraq' },
    { name:'Shafaq News', url:'https://shafaq.com/', tier:'Iraq/Kurdistan', category:'iraq' },
    { name:'Rudaw', url:'https://www.rudaw.net/', tier:'Iraq/Kurdistan', category:'iraq' },
    { name:'Kurdistan24', url:'https://www.kurdistan24.net/', tier:'Iraq/Kurdistan', category:'iraq' },
    { name:'Iraqi News Agency', url:'https://ina.iq/eng/', tier:'Iraq Official', category:'iraq' },
    { name:'Iraq Business News', url:'https://www.iraq-businessnews.com/', tier:'Iraq Business', category:'iraq' },
    { name:'CoinDesk', url:'https://www.coindesk.com/', tier:'Crypto', category:'crypto' },
    { name:'Cointelegraph', url:'https://cointelegraph.com/', tier:'Crypto', category:'crypto' },
    { name:'Truth Social', url:'https://truthsocial.com/', tier:'Public Statements', category:'geopolitics' }
  ]
  return Response.json({ updatedAt:new Date().toISOString(), sources }, { headers:{ 'Cache-Control':'public, max-age=60' } })
}

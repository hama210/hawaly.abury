export async function onRequest() {
  const sources = ['Reuters','CNBC','MSN','BBC Business','AP','Yahoo Finance','MarketWatch','FXStreet','ForexLive','TradingEconomics','Federal Reserve','ECB','IMF','World Bank','OPEC','EIA','Central Bank of Iraq','Iraqi News Agency','Shafaq News','Rudaw','Kurdistan24','Iraq Business News','CoinDesk','Cointelegraph','Truth Social']
  return Response.json({ ok: true, sources }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}

export async function onRequest() {
  return Response.json({ sources: [
    'Reuters Markets','CNBC Markets','Yahoo Finance','MarketWatch','FXStreet','ForexLive','OilPrice','CoinDesk','Cointelegraph','MSN Money','Truth Social monitoring','Shafaq News','Rudaw','Kurdistan24','Iraq Business News','Central Bank of Iraq monitoring'
  ] }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

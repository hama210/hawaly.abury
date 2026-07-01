export async function onRequest() {
  return Response.json({ sources: [
    'Reuters Markets',
    'Reuters Trump',
    'AP Trump',
    'MSN News',
    'MSN Money',
    'Daily Mail',
    'BBC Business',
    'CNBC Markets',
    'Yahoo Finance',
    'MarketWatch',
    'FXStreet',
    'ForexLive',
    'OilPrice',
    'CoinDesk',
    'Cointelegraph',
    'Shafaq News',
    'Rudaw',
    'Kurdistan24',
    'Iraq Business News',
    'Central Bank of Iraq monitoring',
    'Truth Social monitoring'
  ] }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
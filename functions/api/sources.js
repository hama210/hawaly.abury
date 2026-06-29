const sources = [
  ['Reuters Markets','Global financial news','https://www.reuters.com/markets/'],
  ['CNBC Markets','Markets and business news','https://www.cnbc.com/markets/'],
  ['MSN Money','Business and market aggregation','https://www.msn.com/en-us/money'],
  ['Yahoo Finance','Stocks, companies, macro news','https://finance.yahoo.com/news/'],
  ['MarketWatch','Markets and economy','https://www.marketwatch.com/'],
  ['FXStreet','Forex news and analysis','https://www.fxstreet.com/news'],
  ['ForexLive','Fast forex headlines','https://www.forexlive.com/'],
  ['OilPrice','Oil and energy news','https://oilprice.com/'],
  ['CoinDesk','Crypto market news','https://www.coindesk.com/'],
  ['Cointelegraph','Crypto news','https://cointelegraph.com/'],
  ['Federal Reserve','Official US central bank','https://www.federalreserve.gov/newsevents.htm'],
  ['ECB','European Central Bank','https://www.ecb.europa.eu/press/html/index.en.html'],
  ['OPEC','Oil policy and reports','https://www.opec.org/opec_web/en/press_room/28.htm'],
  ['EIA','US energy data','https://www.eia.gov/'],
  ['Central Bank of Iraq','Official Iraq monetary authority','https://cbi.iq/'],
  ['Iraq Business News','Iraq business and economy','https://www.iraq-businessnews.com/'],
  ['Shafaq News','Iraq and Kurdistan news','https://shafaq.com/en'],
  ['Rudaw','Kurdistan and Iraq news','https://www.rudaw.net/english'],
  ['Kurdistan24','Kurdistan and Iraq news','https://www.kurdistan24.net/en'],
  ['Iraqi News Agency','Official Iraqi news','https://ina.iq/eng/']
].map(([name,description,url])=>({name,description,url}));
export async function onRequestGet(){ return Response.json({ok:true,updatedAt:new Date().toISOString(),sources},{headers:{'Cache-Control':'public, max-age=3600'}}); }

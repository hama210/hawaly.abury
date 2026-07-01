const FEEDS = [
  { source: 'Reuters Markets', category: 'markets', url: 'https://news.google.com/rss/search?q=Reuters%20markets%20economy%20forex&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Reuters Trump', category: 'geopolitics', url: 'https://news.google.com/rss/search?q=Reuters%20Donald%20Trump%20economy%20tariffs%20markets&hl=en-US&gl=US&ceid=US:en' },
  { source: 'AP Trump', category: 'geopolitics', url: 'https://news.google.com/rss/search?q=Associated%20Press%20Donald%20Trump%20White%20House%20economy&hl=en-US&gl=US&ceid=US:en' },
  { source: 'MSN News', category: 'geopolitics', url: 'https://news.google.com/rss/search?q=site%3Amsn.com%20Donald%20Trump%20economy%20markets&hl=en-US&gl=US&ceid=US:en' },
  { source: 'MSN Money', category: 'markets', url: 'https://news.google.com/rss/search?q=site%3Amsn.com%20money%20markets%20economy%20stocks&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Daily Mail', category: 'geopolitics', url: 'https://news.google.com/rss/search?q=site%3Adailymail.co.uk%20Donald%20Trump%20US%20politics%20economy&hl=en-US&gl=US&ceid=US:en' },
  { source: 'BBC Business', category: 'markets', url: 'https://news.google.com/rss/search?q=BBC%20business%20markets%20economy&hl=en-US&gl=US&ceid=US:en' },
  { source: 'CNBC Markets', category: 'markets', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { source: 'Yahoo Finance', category: 'stocks', url: 'https://finance.yahoo.com/news/rssindex' },
  { source: 'MarketWatch', category: 'stocks', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { source: 'FXStreet', category: 'forex', url: 'https://www.fxstreet.com/rss/news' },
  { source: 'ForexLive', category: 'forex', url: 'https://www.forexlive.com/feed/news' },
  { source: 'OilPrice', category: 'oil', url: 'https://oilprice.com/rss/main' },
  { source: 'CoinDesk', category: 'crypto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { source: 'Cointelegraph', category: 'crypto', url: 'https://cointelegraph.com/rss' },

  // Iraq and Kurdistan coverage. Direct RSS + Google News fallback searches.
  { source: 'Iraq Latest', category: 'iraq', url: 'https://news.google.com/rss/search?q=Iraq%20OR%20Baghdad%20OR%20Kurdistan%20when%3A7d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Iraq Economy', category: 'iraq', url: 'https://news.google.com/rss/search?q=Iraq%20economy%20budget%20oil%20dinar%20banking%20when%3A14d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Iraq Oil', category: 'iraq', url: 'https://news.google.com/rss/search?q=Iraq%20oil%20exports%20OPEC%20Kurdistan%20pipeline%20when%3A14d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Iraq Dinar CBI', category: 'iraq', url: 'https://news.google.com/rss/search?q=Iraq%20dinar%20Central%20Bank%20of%20Iraq%20CBI%20dollar%20when%3A30d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Kurdistan Region', category: 'iraq', url: 'https://news.google.com/rss/search?q=Kurdistan%20Region%20Erbil%20Sulaimani%20Duhok%20when%3A14d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Rudaw Search', category: 'iraq', url: 'https://news.google.com/rss/search?q=site%3Arudaw.net%20Iraq%20OR%20Kurdistan%20when%3A14d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Shafaq Search', category: 'iraq', url: 'https://news.google.com/rss/search?q=site%3Ashafaq.com%20Iraq%20OR%20Baghdad%20OR%20Kurdistan%20when%3A14d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Iraqi News Search', category: 'iraq', url: 'https://news.google.com/rss/search?q=site%3Airaqinews.com%20Iraq%20economy%20politics%20when%3A30d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Iraq Business Search', category: 'iraq', url: 'https://news.google.com/rss/search?q=site%3Airaq-businessnews.com%20Iraq%20business%20oil%20banking%20when%3A30d&hl=en-US&gl=US&ceid=US:en' },
  { source: 'Shafaq News', category: 'iraq', url: 'https://www.shafaq.com/en/rss' },
  { source: 'Rudaw', category: 'iraq', url: 'https://www.rudaw.net/english/rss' },
  { source: 'Kurdistan24', category: 'iraq', url: 'https://www.kurdistan24.net/en/rss' },
  { source: 'Iraq Business News', category: 'iraq', url: 'https://www.iraq-businessnews.com/feed/' },
  { source: 'Central Bank of Iraq', category: 'iraq', url: 'https://news.google.com/rss/search?q=Central%20Bank%20of%20Iraq%20CBI%20dinar&hl=en-US&gl=US&ceid=US:en' },

  { source: 'Truth Social monitoring', category: 'geopolitics', url: 'https://news.google.com/rss/search?q=Truth%20Social%20Trump%20tariffs%20Fed%20oil%20markets&hl=en-US&gl=US&ceid=US:en' }
];

const fallbackImages = {
  iraq: 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?auto=format&fit=crop&w=1200&q=80',
  oil: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=80',
  crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1200&q=80',
  forex: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  stocks: 'https://images.unsplash.com/photo-1642790551116-18e150f248e0?auto=format&fit=crop&w=1200&q=80',
  markets: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  geopolitics: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80'
};

const highWords = ['fed','fomc','cpi','nfp','rate decision','interest rate','war','attack','sanction','opec','central bank','recession','inflation','gdp','oil exports','central bank of iraq','trump','tariff','white house','iraq','baghdad','kurdistan','dinar','cbi'];
const mediumWords = ['pmi','retail sales','speech','claims','forecast','budget','trade','earnings','inventory','election','lawsuit','pipeline','exports','banking'];
const assets = [
  ['USD',['fed','dollar','rate','fomc','treasury','cpi','nfp','trump','tariff','white house']],
  ['Gold',['gold','inflation','war','risk','safe haven']],
  ['Oil',['oil','brent','wti','opec','crude','eia','exports','pipeline']],
  ['IQD',['iraq','baghdad','kurdistan','dinar','iqd','cbi','central bank of iraq','budget','banking','erbil','sulaimani','duhok']],
  ['BTC',['bitcoin','btc','crypto']],
  ['Stocks',['stocks','nasdaq','s&p','dow','earnings','wall street']]
];

function analyze(item){
  const text = `${item.title} ${item.summary} ${item.source} ${item.category}`.toLowerCase();
  const found = assets.filter(([,w])=>w.some(x=>text.includes(x))).map(([a])=>a);
  return {
    impact: highWords.some(w=>text.includes(w)) ? 'high' : mediumWords.some(w=>text.includes(w)) ? 'medium' : 'low',
    sentiment: /(falls|drops|war|attack|weak|recession|sanction|tariff|lawsuit|clash|explosion|strike)/i.test(text) ? 'bearish' : /(rises|gains|strong|growth|beats|surges|deal|approval|agreement)/i.test(text) ? 'bullish' : 'neutral',
    assets: found.length ? found : ['Markets'],
    iraqImpact: /(iraq|baghdad|kurdistan|erbil|sulaimani|duhok|basra|mosul|iqd|dinar|central bank of iraq|cbi|shafaq|rudaw|kurdistan24|iraqi)/i.test(text)
  };
}
function decode(str=''){
  return str.replace(/<!\[CDATA\[(.*?)\]\]>/gs,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').trim();
}
function extractTag(xml, tag){
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decode(m?.[1] || '');
}
function extractImage(xml){
  return xml.match(/<media:content[^>]+url=["']([^"']+)/i)?.[1] || xml.match(/<enclosure[^>]+url=["']([^"']+)/i)?.[1] || xml.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || '';
}
function cleanGoogleTitle(title){
  return title.replace(/\s+-\s+[^-]{2,80}$/,'').trim();
}
function sourceFromGoogleTitle(title, fallback){
  const parts = title.split(' - ');
  return parts.length > 1 ? parts.at(-1).trim() : fallback;
}
async function fetchFeed(feed){
  try{
    const res = await fetch(feed.url, { cf: { cacheTtl: 60, cacheEverything: false }, headers: { 'user-agent': 'HawaliAburiBot/1.2' }});
    if(!res.ok) throw new Error(String(res.status));
    const xml = await res.text();
    const perFeedLimit = feed.category === 'iraq' ? 25 : 18;
    const entries = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0,perFeedLimit).map(m=>m[0]);
    return entries.map((entry, idx)=>{
      const rawTitle = extractTag(entry,'title');
      const title = cleanGoogleTitle(rawTitle);
      const link = extractTag(entry,'link') || extractTag(entry,'guid') || feed.url;
      const summary = extractTag(entry,'description') || extractTag(entry,'summary');
      const publishedAt = extractTag(entry,'pubDate') || extractTag(entry,'published') || new Date().toISOString();
      const image = extractImage(entry) || fallbackImages[feed.category] || fallbackImages.markets;
      const item = { id: `${feed.source}-${idx}-${title}`.slice(0,180), title, summary, source: sourceFromGoogleTitle(rawTitle, feed.source), sourceGroup: feed.source, category: feed.category, link, publishedAt, image };
      return { ...item, intelligence: analyze(item) };
    }).filter(i=>i.title);
  }catch(e){ return []; }
}
function fallback(){
  const base = [
    { title: 'Iraq latest economy, dinar, banking and oil updates', source: 'Iraq Latest', category: 'iraq', link: 'https://news.google.com/search?q=Iraq%20economy%20dinar%20oil%20banking', image: fallbackImages.iraq },
    { title: 'Kurdistan Region news from Erbil, Sulaimani and Duhok', source: 'Kurdistan Region', category: 'iraq', link: 'https://news.google.com/search?q=Kurdistan%20Region%20Erbil%20Sulaimani%20Duhok', image: fallbackImages.iraq },
    { title: 'Donald Trump economic policy and tariffs remain key for global markets', source: 'Trump monitoring', category: 'geopolitics', link: 'https://news.google.com/search?q=Donald%20Trump%20economy%20markets', image: fallbackImages.geopolitics },
    { title: 'Federal Reserve and inflation expectations remain key for global markets', source: 'Reuters Markets', category: 'markets', link: 'https://www.reuters.com/markets/', image: fallbackImages.markets },
    { title: 'Oil traders monitor OPEC supply signals and Middle East risk', source: 'OilPrice', category: 'oil', link: 'https://oilprice.com/', image: fallbackImages.oil },
    { title: 'Bitcoin and crypto sentiment follows risk appetite in global markets', source: 'CoinDesk', category: 'crypto', link: 'https://www.coindesk.com/', image: fallbackImages.crypto }
  ];
  return base.map((i,idx)=>({ id:`fallback-${idx}`, summary:'Market-moving update from trusted sources.', publishedAt:new Date(Date.now()-idx*900000).toISOString(), ...i, intelligence: analyze(i) }));
}
export async function onRequest({ request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get('limit') || 200), 250);
  const batches = await Promise.all(FEEDS.map(fetchFeed));
  const seen = new Set();
  let items = batches.flat().filter(i=>{
    const text = `${i.title} ${i.summary} ${i.source} ${i.sourceGroup || ''} ${i.category}`.toLowerCase();
    if(q && !text.includes(q)) return false;
    const key = i.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,110);
    if(seen.has(key)) return false; seen.add(key); return true;
  }).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,limit);
  if(!items.length) items = fallback();
  return Response.json({ updatedAt: new Date().toISOString(), count: items.length, items }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
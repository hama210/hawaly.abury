const FEEDS = [
  ['Reuters Markets','markets','https://news.google.com/rss/search?q=Reuters%20markets%20economy%20forex&hl=en-US&gl=US&ceid=US:en'],
  ['Reuters Trump','geopolitics','https://news.google.com/rss/search?q=Reuters%20Donald%20Trump%20economy%20tariffs%20markets&hl=en-US&gl=US&ceid=US:en'],
  ['AP Trump','geopolitics','https://news.google.com/rss/search?q=Associated%20Press%20Donald%20Trump%20White%20House%20economy&hl=en-US&gl=US&ceid=US:en'],
  ['MSN News','geopolitics','https://news.google.com/rss/search?q=site%3Amsn.com%20Donald%20Trump%20economy%20markets&hl=en-US&gl=US&ceid=US:en'],
  ['MSN Money','markets','https://news.google.com/rss/search?q=site%3Amsn.com%20money%20markets%20economy%20stocks&hl=en-US&gl=US&ceid=US:en'],
  ['Daily Mail','geopolitics','https://news.google.com/rss/search?q=site%3Adailymail.co.uk%20Donald%20Trump%20US%20politics%20economy&hl=en-US&gl=US&ceid=US:en'],
  ['BBC Business','markets','https://news.google.com/rss/search?q=BBC%20business%20markets%20economy&hl=en-US&gl=US&ceid=US:en'],
  ['CNBC Markets','markets','https://www.cnbc.com/id/100003114/device/rss/rss.html'],
  ['Yahoo Finance','stocks','https://finance.yahoo.com/news/rssindex'],
  ['MarketWatch','stocks','https://feeds.content.dowjones.io/public/rss/mw_topstories'],
  ['FXStreet','forex','https://www.fxstreet.com/rss/news'],
  ['ForexLive','forex','https://www.forexlive.com/feed/news'],
  ['OilPrice','oil','https://oilprice.com/rss/main'],
  ['CoinDesk','crypto','https://www.coindesk.com/arc/outboundfeeds/rss/'],
  ['Cointelegraph','crypto','https://cointelegraph.com/rss'],
  ['Iraq Latest','iraq','https://news.google.com/rss/search?q=Iraq%20OR%20Baghdad%20OR%20Kurdistan%20when%3A7d&hl=en-US&gl=US&ceid=US:en'],
  ['Iraq Economy','iraq','https://news.google.com/rss/search?q=Iraq%20economy%20budget%20oil%20dinar%20banking%20when%3A14d&hl=en-US&gl=US&ceid=US:en'],
  ['Iraq Oil','iraq','https://news.google.com/rss/search?q=Iraq%20oil%20exports%20OPEC%20Kurdistan%20pipeline%20when%3A14d&hl=en-US&gl=US&ceid=US:en'],
  ['Iraq Dinar CBI','iraq','https://news.google.com/rss/search?q=Iraq%20dinar%20Central%20Bank%20of%20Iraq%20CBI%20dollar%20when%3A30d&hl=en-US&gl=US&ceid=US:en'],
  ['Kurdistan Region','iraq','https://news.google.com/rss/search?q=Kurdistan%20Region%20Erbil%20Sulaimani%20Duhok%20when%3A14d&hl=en-US&gl=US&ceid=US:en'],
  ['Rudaw Search','iraq','https://news.google.com/rss/search?q=site%3Arudaw.net%20Iraq%20OR%20Kurdistan%20when%3A14d&hl=en-US&gl=US&ceid=US:en'],
  ['Shafaq Search','iraq','https://news.google.com/rss/search?q=site%3Ashafaq.com%20Iraq%20OR%20Baghdad%20OR%20Kurdistan%20when%3A14d&hl=en-US&gl=US&ceid=US:en'],
  ['Iraqi News Search','iraq','https://news.google.com/rss/search?q=site%3Airaqinews.com%20Iraq%20economy%20politics%20when%3A30d&hl=en-US&gl=US&ceid=US:en'],
  ['Iraq Business Search','iraq','https://news.google.com/rss/search?q=site%3Airaq-businessnews.com%20Iraq%20business%20oil%20banking%20when%3A30d&hl=en-US&gl=US&ceid=US:en'],
  ['Shafaq News','iraq','https://www.shafaq.com/en/rss'],
  ['Rudaw','iraq','https://www.rudaw.net/english/rss'],
  ['Kurdistan24','iraq','https://www.kurdistan24.net/en/rss'],
  ['Iraq Business News','iraq','https://www.iraq-businessnews.com/feed/'],
  ['Central Bank of Iraq','iraq','https://news.google.com/rss/search?q=Central%20Bank%20of%20Iraq%20CBI%20dinar&hl=en-US&gl=US&ceid=US:en'],
  ['Truth Social monitoring','geopolitics','https://news.google.com/rss/search?q=Truth%20Social%20Trump%20tariffs%20Fed%20oil%20markets&hl=en-US&gl=US&ceid=US:en']
].map(([source, category, url]) => ({ source, category, url }));

const fallbackImages = {
  iraq: 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?auto=format&fit=crop&w=1200&q=80',
  oil: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=80',
  crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1200&q=80',
  forex: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  stocks: 'https://images.unsplash.com/photo-1642790551116-18e150f248e0?auto=format&fit=crop&w=1200&q=80',
  markets: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  geopolitics: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80'
};

const translateCache = new Map();
const highWords = ['fed','fomc','cpi','nfp','rate decision','interest rate','war','attack','sanction','opec','central bank','recession','inflation','gdp','oil exports','central bank of iraq','trump','tariff','white house','iraq','baghdad','kurdistan','dinar','cbi'];
const mediumWords = ['pmi','retail sales','speech','claims','forecast','budget','trade','earnings','inventory','election','lawsuit','pipeline','exports','banking'];
const assetRules = [
  ['USD',['fed','dollar','rate','fomc','treasury','cpi','nfp','trump','tariff','white house']],
  ['Gold',['gold','inflation','war','risk','safe haven']],
  ['Oil',['oil','brent','wti','opec','crude','eia','exports','pipeline']],
  ['IQD',['iraq','baghdad','kurdistan','dinar','iqd','cbi','central bank of iraq','budget','banking','erbil','sulaimani','duhok']],
  ['BTC',['bitcoin','btc','crypto']],
  ['Stocks',['stocks','nasdaq','s&p','dow','earnings','wall street']]
];

const decode = (str='') => str.replace(/<!\[CDATA\[(.*?)\]\]>/gs,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').trim();
const extractTag = (xml, tag) => decode(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '');
const extractImage = xml => xml.match(/<media:content[^>]+url=["']([^"']+)/i)?.[1] || xml.match(/<enclosure[^>]+url=["']([^"']+)/i)?.[1] || xml.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || '';
const cleanGoogleTitle = title => title.replace(/\s+-\s+[^-]{2,80}$/,'').trim();
const sourceFromGoogleTitle = (title, fallback) => title.split(' - ').length > 1 ? title.split(' - ').at(-1).trim() : fallback;
const shortText = (text='', max=260) => String(text || '').replace(/\s+/g,' ').trim().slice(0, max);

function analyze(item){
  const text = `${item.title} ${item.summary} ${item.source} ${item.category}`.toLowerCase();
  const affected = assetRules.filter(([,w])=>w.some(x=>text.includes(x))).map(([a])=>a);
  const impact = highWords.some(w=>text.includes(w)) ? 'high' : mediumWords.some(w=>text.includes(w)) ? 'medium' : 'low';
  const sentiment = /(falls|drops|war|attack|weak|recession|sanction|tariff|lawsuit|clash|explosion|strike)/i.test(text) ? 'bearish' : /(rises|gains|strong|growth|beats|surges|deal|approval|agreement)/i.test(text) ? 'bullish' : 'neutral';
  const iraqImpact = /(iraq|baghdad|kurdistan|erbil|sulaimani|duhok|basra|mosul|iqd|dinar|central bank of iraq|cbi|shafaq|rudaw|kurdistan24|iraqi)/i.test(text);
  return { impact, sentiment, assets: affected.length ? affected : ['Markets'], iraqImpact };
}

async function translateText(text, target){
  const clean = shortText(text, target === 'ku' ? 180 : 220);
  if(!clean) return '';
  const googleTarget = target === 'ku' ? 'ckb' : target;
  const key = `${googleTarget}:${clean}`;
  if(translateCache.has(key)) return translateCache.get(key);
  try{
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(googleTarget) + '&dt=t&q=' + encodeURIComponent(clean);
    const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true }, headers: { 'user-agent': 'HawaliAburiBot/1.4' }});
    if(!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('').trim() : '';
    const result = translated && translated.toLowerCase() !== clean.toLowerCase() ? translated : clean;
    translateCache.set(key, result);
    return result;
  }catch(e){ return clean; }
}

async function addTranslations(item){
  const titleEn = item.title || '';
  const summaryEn = shortText(item.summary || 'Market-moving update from trusted sources.', 260);
  const whyEn = item.category === 'iraq'
    ? 'Important for Iraq, Kurdistan Region, IQD, oil, banking, or local market sentiment.'
    : 'Important for markets, currency, oil, crypto, stocks, or geopolitical risk.';
  const [titleKu, titleAr, summaryKu, summaryAr, whyKu, whyAr] = await Promise.all([
    translateText(titleEn, 'ku'), translateText(titleEn, 'ar'), translateText(summaryEn, 'ku'), translateText(summaryEn, 'ar'), translateText(whyEn, 'ku'), translateText(whyEn, 'ar')
  ]);
  return { ...item, titleEn, summaryEn, titleKu, titleAr, summaryKu, summaryAr, whyEn, whyKu, whyAr };
}

async function fetchFeed(feed){
  try{
    const res = await fetch(feed.url, { cf: { cacheTtl: 60, cacheEverything: false }, headers: { 'user-agent': 'HawaliAburiBot/1.4' }});
    if(!res.ok) throw new Error(String(res.status));
    const xml = await res.text();
    const perFeedLimit = feed.category === 'iraq' ? 25 : 18;
    return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0,perFeedLimit).map((m, idx)=>{
      const entry = m[0];
      const rawTitle = extractTag(entry,'title');
      const title = cleanGoogleTitle(rawTitle);
      const link = extractTag(entry,'link') || extractTag(entry,'guid') || feed.url;
      const summary = extractTag(entry,'description') || extractTag(entry,'summary');
      const publishedAt = extractTag(entry,'pubDate') || extractTag(entry,'published') || new Date().toISOString();
      const image = extractImage(entry) || fallbackImages[feed.category] || fallbackImages.markets;
      const base = { id: `${feed.source}-${idx}-${title}`.slice(0,180), title, summary, source: sourceFromGoogleTitle(rawTitle, feed.source), sourceGroup: feed.source, category: feed.category, link, publishedAt, image };
      const intel = analyze(base);
      return { ...base, intelligence: intel, impact: intel.impact, sentiment: intel.sentiment, affected: intel.assets, iraqImpact: intel.iraqImpact };
    }).filter(i=>i.title);
  }catch(e){ return []; }
}

async function fallback(){
  const base = [
    ['Iraq latest economy, dinar, banking and oil updates','Iraq Latest','iraq','https://news.google.com/search?q=Iraq%20economy%20dinar%20oil%20banking'],
    ['Kurdistan Region news from Erbil, Sulaimani and Duhok','Kurdistan Region','iraq','https://news.google.com/search?q=Kurdistan%20Region%20Erbil%20Sulaimani%20Duhok'],
    ['Donald Trump economic policy and tariffs remain key for global markets','Trump monitoring','geopolitics','https://news.google.com/search?q=Donald%20Trump%20economy%20markets'],
    ['Federal Reserve and inflation expectations remain key for global markets','Reuters Markets','markets','https://www.reuters.com/markets/'],
    ['Oil traders monitor OPEC supply signals and Middle East risk','OilPrice','oil','https://oilprice.com/'],
    ['Bitcoin and crypto sentiment follows risk appetite in global markets','CoinDesk','crypto','https://www.coindesk.com/']
  ].map(([title, source, category, link], idx)=>{
    const base = { id:`fallback-${idx}`, title, summary:'Market-moving update from trusted sources.', source, category, link, image:fallbackImages[category], publishedAt:new Date(Date.now()-idx*900000).toISOString() };
    const intel = analyze(base);
    return { ...base, intelligence: intel, impact: intel.impact, sentiment: intel.sentiment, affected: intel.assets, iraqImpact: intel.iraqImpact };
  });
  return Promise.all(base.map(addTranslations));
}

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get('limit') || 80), 120);
  const batches = await Promise.all(FEEDS.map(fetchFeed));
  const seen = new Set();
  const rawItems = batches.flat().filter(i=>{
    const text = `${i.title} ${i.summary} ${i.source} ${i.sourceGroup || ''} ${i.category}`.toLowerCase();
    if(q && !text.includes(q)) return false;
    const key = i.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,110);
    if(seen.has(key)) return false; seen.add(key); return true;
  }).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,limit);
  const items = rawItems.length ? await Promise.all(rawItems.map(addTranslations)) : await fallback();
  return Response.json({ updatedAt: new Date().toISOString(), count: items.length, translated: true, languages: ['en','ku','ar'], items }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
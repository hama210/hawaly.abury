const googleNewsFeed = query => `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

export const FEEDS = [
  ['Reuters Markets','markets',googleNewsFeed('site:reuters.com (markets OR Federal Reserve OR inflation) (dollar OR gold OR silver OR Nasdaq OR Dow) when:7d'),'major'],
  ['Reuters Forex','forex',googleNewsFeed('site:reuters.com (EUR/USD OR GBP/USD OR euro OR sterling OR dollar) when:7d'),'major'],
  ['Reuters Metals','metals',googleNewsFeed('site:reuters.com (gold OR silver OR XAU OR XAG) markets when:7d'),'major'],
  ['Reuters US Indices','indices',googleNewsFeed('site:reuters.com (Nasdaq OR "Dow Jones" OR "Wall Street") when:7d'),'major'],
  ['BBC Business','markets','https://feeds.bbci.co.uk/news/business/rss.xml','major'],
  ['CNBC Markets','indices','https://www.cnbc.com/id/100003114/device/rss/rss.html','major'],
  ['MarketWatch','indices','https://feeds.content.dowjones.io/public/rss/mw_topstories','major'],
  ['Financial Times Markets','indices','https://www.ft.com/markets?format=rss','major',8000],
  ['FXStreet','forex','https://www.fxstreet.com/rss/news','specialist'],
  ['ForexLive','forex','https://www.forexlive.com/feed/news','specialist'],
  ['Federal Reserve','markets','https://www.federalreserve.gov/feeds/press_monetary.xml','official',8000],
  ['European Central Bank','forex','https://www.ecb.europa.eu/rss/press.html','official',8000],
  ['Bank of England','forex','https://www.bankofengland.co.uk/rss/news','official',8000],
  ['US Inflation (BLS)','markets','https://www.bls.gov/feed/cpi.rss','official',11000],
  ['US Employment (BLS)','markets','https://www.bls.gov/feed/empsit.rss','official',11000],
  ['US Economy (BEA)','markets','https://apps.bea.gov/rss/rss.xml','official',11000],
  ['Reuters Global Conflict','geopolitics',googleNewsFeed('site:reuters.com (war OR strikes OR missile OR ceasefire OR sanctions) when:7d'),'major'],
  ['AP Global Conflict','geopolitics',googleNewsFeed('site:apnews.com (war OR strikes OR missile OR ceasefire OR sanctions) when:7d'),'major'],
  ['BBC War','geopolitics',googleNewsFeed('site:bbc.com/news (war OR strikes OR missile OR ceasefire) when:7d'),'major'],
  ['Al Jazeera War','geopolitics',googleNewsFeed('site:aljazeera.com (war OR strikes OR missile OR ceasefire) when:7d'),'major'],
  ['UN Conflict Updates','geopolitics',googleNewsFeed('site:news.un.org (war OR conflict OR ceasefire OR sanctions) when:14d'),'official'],
  ['Iran-US War Live','geopolitics',googleNewsFeed('Iran (US OR "United States") (war OR strikes OR missile OR blockade OR ceasefire OR Hormuz) when:3d'),'curated'],
  ['Middle East Conflict','geopolitics',googleNewsFeed('("Middle East" OR Iran OR Israel OR Gaza OR Lebanon) (war OR strikes OR ceasefire OR sanctions) when:7d'),'curated'],
  ['Ukraine War','geopolitics',googleNewsFeed('(Ukraine OR Russia) (war OR strikes OR sanctions OR ceasefire) when:7d'),'curated'],
  ['Red Sea and Hormuz Risk','geopolitics',googleNewsFeed('("Red Sea" OR Hormuz OR Houthi) (shipping OR blockade OR strike OR oil) when:14d'),'curated'],
  ['CENTCOM Updates','geopolitics',googleNewsFeed('site:centcom.mil (strike OR military OR missile OR Iran OR Houthi) when:14d'),'official'],
  ['Iraq Latest','iraq','https://news.google.com/rss/search?q=Iraq%20OR%20Baghdad%20OR%20Kurdistan%20when%3A7d&hl=en-US&gl=US&ceid=US:en','curated'],
  ['Iraq Economy','iraq',googleNewsFeed('Iraq (economy OR budget OR oil OR dinar OR banking OR salaries) when:14d'),'curated'],
  ['Iraq Dinar and CBI','iraq',googleNewsFeed('Iraq (dinar OR CBI OR "central bank" OR dollar market OR banking) when:14d'),'curated'],
  ['Reuters Iraq Economy','iraq',googleNewsFeed('site:reuters.com Iraq (economy OR oil OR budget OR dinar OR Kurdistan) when:30d'),'major'],
  ['AP Iraq Economy','iraq',googleNewsFeed('site:apnews.com Iraq (economy OR oil OR budget OR Kurdistan) when:30d'),'major'],
  ['INA Iraq Economy','iraq',googleNewsFeed('site:ina.iq/en Iraq (economy OR budget OR oil OR dinar OR investment) when:30d'),'official'],
  ['Shafaq Economy','iraq','https://shafaq.com/rss/en/Economy','local'],
  ['Rudaw Economy','iraq',googleNewsFeed('site:rudaw.net/english Iraq Kurdistan (economy OR oil OR budget OR salaries) when:30d'),'local'],
  ['Kurdistan24 Economy','iraq',googleNewsFeed('site:kurdistan24.net/en Iraq Kurdistan (economy OR oil OR budget OR salaries) when:30d'),'local'],
  ['Iraq Business News','iraq','https://www.iraq-businessnews.com/feed/','specialist'],
  ['Central Bank of Iraq','iraq',googleNewsFeed('site:cbi.iq (dinar OR banking OR monetary OR dollar) when:60d'),'official']
].map(([source, category, url, tier, timeoutMs]) => ({ source, category, url, tier, timeoutMs }));

const MAX_FEEDS_PER_REQUEST = 20;
const FETCH_CONCURRENCY = 6;
const BATCH_COUNT = Math.ceil(FEEDS.length / MAX_FEEDS_PER_REQUEST);
const FAST_FEED_SOURCES = [
  'Reuters Metals',
  'CNBC Markets',
  'FXStreet',
  'Shafaq Economy',
  'Iraq Business News',
  'Al Jazeera War'
];
const FAST_FEED_TIMEOUT_MS = 4500;
const FULL_FEED_TIMEOUT_MS = 4500;
const FAST_CACHE_TTL = 60;
const FULL_CACHE_TTL = 120;
const SOURCE_CACHE_TTL = 60;
const MAX_FEED_BYTES = 384 * 1024;
const NEWS_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const NEWS_MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
const IRAQ_TERMS = /\b(iraq|iraqi|baghdad|kurdistan|erbil|sulaimani|sulaymaniyah|duhok|dohuk|basra|mosul|dinar|iqd|cbi|somo|rafidain|rasheed|krg)\b|central bank of iraq|iraq business/i;
const fallbackImages = {
  iraq: 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?auto=format&fit=crop&w=1200&q=80',
  metals: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
  indices: 'https://images.unsplash.com/photo-1642790551116-18e150f248e0?auto=format&fit=crop&w=1200&q=80',
  forex: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  markets: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  geopolitics: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80'
};

const highWords = ['fed','fomc','cpi','nfp','rate decision','interest rate','war','attack','airstrike','strike','strikes','sanction','sanctions','missile','drone','ceasefire','invasion','conflict','blockade','strait of hormuz','centcom','irgc','opec','central bank','recession','inflation','gdp','oil exports','central bank of iraq','trump','tariff','white house','iraq','baghdad','kurdistan','dinar','cbi','somo','budget','salary','salaries','oil revenue','basra','ceyhan','rafidain','rasheed','ukraine','russia','israel','iran','tehran','gaza','lebanon','red sea','houthi','nato'];
const mediumWords = ['pmi','retail sales','speech','claims','forecast','budget','trade','earnings','inventory','election','lawsuit','pipeline','exports','banking','investment','customs','taxes','ports','development road','private sector','electricity','gas imports','defense','military','shipping','supply chain','security','diplomacy'];
const assetRules = [
  ['USD/IQD',['iraq','baghdad','kurdistan','dinar','iqd','cbi','central bank of iraq','budget','salary','salaries','banking','oil revenue','erbil','sulaimani','duhok']],
  ['EUR/USD',['eur/usd','euro','ecb','eurozone','european central bank']],
  ['GBP/USD',['gbp/usd','sterling','pound','bank of england','boe','uk economy','british economy']],
  ['XAU/USD',['gold','xau','bullion','safe haven']],
  ['XAG/USD',['silver','xag','precious metals']],
  ['DOW JONES',['dow','dow jones','djia','industrial average','wall street']],
  ['NASDAQ',['nasdaq','technology stocks','tech stocks','wall street']]
];
const WAR_TERMS = /\b(war|conflict|attack|airstrike|strike|strikes|missile|drone|invasion|ceasefire|truce|blockade|military|sanction|sanctions|houthi|nato|centcom|irgc)\b|strait of hormuz|red sea/i;
const FOCUS_MARKET_TERMS = /\b(iqd|dinar|cbi|iraq|baghdad|kurdistan|euro|ecb|sterling|pound|boe|gold|silver|xau|xag|bullion|nasdaq|dow|djia|stocks|equities|inflation|cpi|nfp|fomc|fed|rates|dollar|forex|tariff|recession|gdp|opec|pce|employment|payrolls)\b|eur\/usd|gbp\/usd|usd\/iqd|interest rate|central bank|wall street|oil revenue|federal reserve|bank of england|european central bank|personal income|trade deficit|economic growth|gross domestic product/i;
const TRUSTED_PUBLISHERS = /\b(reuters|associated press|ap news|bbc|al jazeera|bloomberg|cnbc|financial times|wall street journal|washington post|new york times|guardian|dw|france 24|cnn|nbc news|cbs news|abc news|npr|pbs|euronews|the national|shafaq|rudaw|kurdistan24|iraqi news agency|ina|iraq business news)\b/i;
const FOREX_TERMS = /\b(euro|ecb|eurozone|sterling|pound|boe|britain|british|uk economy)\b|eur\/usd|gbp\/usd|european central bank|bank of england/i;
const METAL_TERMS = /\b(gold|silver|xau|xag|bullion)\b|precious metals|safe haven/i;
const INDEX_TERMS = /\b(nasdaq|dow|djia|stocks|equities|earnings|wall street)\b|dow jones|industrial average|technology stocks/i;
const US_MACRO_TERMS = /\b(fed|fomc|inflation|cpi|ppi|payroll|payrolls|jobs|employment|unemployment|gdp|retail sales|treasury|tariff|recession)\b|federal reserve|interest rate|rate cut|rate hike/i;
const TIER_WEIGHT = { official:36, major:32, local:28, specialist:22, curated:17 };

const decode = (str='') => str.replace(/<!\[CDATA\[(.*?)\]\]>/gs,'$1').replace(/&#x([0-9a-f]+);/gi,(_,value)=>String.fromCodePoint(Number.parseInt(value,16))).replace(/&#(\d+);/g,(_,value)=>String.fromCodePoint(Number(value))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').trim();
const extractTag = (xml, tag) => decode(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '');
const extractLink = xml => extractTag(xml,'link') || decode(xml.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || '');
const extractImage = xml => xml.match(/<media:content[^>]+url=["']([^"']+)/i)?.[1] || xml.match(/<enclosure[^>]+url=["']([^"']+)/i)?.[1] || xml.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || '';
const cleanGoogleTitle = title => title.replace(/\s+-\s+[^-]{2,80}$/,'').trim();
const sourceFromGoogleTitle = (title, fallback) => title.split(' - ').length > 1 ? title.split(' - ').at(-1).trim() : fallback;

function analyze(item){
  const text = `${item.title} ${item.summary} ${item.source} ${item.category}`.toLowerCase();
  const impact = highWords.some(w=>text.includes(w)) ? 'high' : mediumWords.some(w=>text.includes(w)) ? 'medium' : 'low';
  const sentiment = /(falls|drops|war|attack|weak|recession|sanction|tariff|lawsuit|clash|explosion|strike|missile|drone|invasion|conflict|blockade)/i.test(text) ? 'bearish' : /(rises|gains|strong|growth|beats|surges|deal|approval|agreement|ceasefire|truce)/i.test(text) ? 'bullish' : 'neutral';
  const iraqImpact = /(iraq|baghdad|kurdistan|erbil|sulaimani|duhok|basra|mosul|iqd|dinar|central bank of iraq|cbi|shafaq|rudaw|kurdistan24|iraqi)/i.test(text);
  const effects = marketEffects(text, sentiment, iraqImpact);
  const affected = [...new Set([
    ...assetRules.filter(([,words])=>words.some(word=>text.includes(word))).map(([asset])=>asset),
    ...effects.map(effect=>effect.asset)
  ])];
  return { impact, sentiment, assets: affected.length ? affected : ['NASDAQ', 'DOW JONES'], effects, iraqImpact };
}

function marketEffects(text, sentiment, iraqImpact){
  const effects = [];
  const add = (asset, direction, reason) => {
    if(!effects.some(effect=>effect.asset === asset)) effects.push({ asset, direction, reason });
  };
  const relief = /ceasefire|truce|peace deal|de-escalation|deescalation/i.test(text);
  const conflict = WAR_TERMS.test(text);
  const regional = /iraq|iran|middle east|gulf|hormuz|red sea|houthi|israel|gaza|lebanon|syria/i.test(text);
  const hawkish = /rate hike|higher for longer|hawkish|hot inflation|inflation rises|strong jobs|strong payroll/i.test(text);
  const dovish = /rate cut|dovish|cooling inflation|inflation falls|weak jobs|weak payroll|economic slowdown/i.test(text);
  const positive = /rises?|gains?|strong|beats|surges?|record high|optimism|rally|climbs?|advances?|higher/i.test(text);
  const negative = /falls?|drops?|weak|slump|selloff|recession|cuts outlook|warning|loss|losses|lower|declines?|eases?|slides?/i.test(text);
  const localDollarUp = /(?:dollar|usd)[^.!?]{0,70}(?:rises?|gains?|higher|climbs?|surges?|edges? up)|(?:rises?|gains?|climbs?|surges?|edges? up)[^.!?]{0,70}(?:dollar|usd)/i.test(text);
  const localDollarDown = /(?:dollar|usd)[^.!?]{0,70}(?:falls?|drops?|lower|declines?|eases?|slides?|edges? lower)|(?:falls?|drops?|declines?|eases?|slides?|edges? lower)[^.!?]{0,70}(?:dollar|usd)/i.test(text);

  if(iraqImpact && (localDollarUp || localDollarDown)) add('USD/IQD', localDollarUp ? 'up' : 'down', 'iraqPolicy');
  if(conflict){
    add('XAU/USD', relief ? 'down' : 'up', relief ? 'deescalation' : 'safeHaven');
    add('XAG/USD', relief ? 'down' : 'up', relief ? 'deescalation' : 'safeHaven');
    add('NASDAQ', relief ? 'up' : 'down', relief ? 'deescalation' : 'riskOff');
    add('DOW JONES', relief ? 'up' : 'down', relief ? 'deescalation' : 'riskOff');
    if(regional || iraqImpact) add('USD/IQD', relief ? 'down' : 'up', relief ? 'deescalation' : 'regionalRisk');
  }
  if(hawkish || dovish){
    const dollarUp = hawkish && !dovish;
    add('EUR/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('GBP/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('XAU/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('XAG/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('NASDAQ', dollarUp ? 'down' : 'up', 'usRates');
  }
  if(/eur\/usd|euro|ecb|eurozone|european central bank/i.test(text)) add('EUR/USD', positive ? 'up' : negative ? 'down' : 'watch', 'euroPolicy');
  if(/gbp\/usd|sterling|pound|bank of england|\bboe\b|uk economy|british economy/i.test(text)) add('GBP/USD', positive ? 'up' : negative ? 'down' : 'watch', 'ukPolicy');
  if(/gold|xau|bullion/i.test(text)) add('XAU/USD', positive ? 'up' : negative ? 'down' : 'watch', 'preciousMetals');
  if(/silver|xag|precious metals/i.test(text)) add('XAG/USD', positive ? 'up' : negative ? 'down' : 'watch', 'preciousMetals');
  if(/nasdaq|technology stocks|tech stocks/i.test(text)) add('NASDAQ', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'indexNews');
  if(/dow|dow jones|djia|industrial average/i.test(text)) add('DOW JONES', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'indexNews');
  if(iraqImpact) add('USD/IQD', localDollarUp ? 'up' : localDollarDown ? 'down' : positive ? 'down' : negative ? 'up' : 'watch', 'iraqPolicy');
  if(!effects.length){
    add('NASDAQ', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'marketNews');
    add('DOW JONES', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'marketNews');
  }
  return effects.slice(0, 6);
}

function isIraqEconomy(item){
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const group = String(item.sourceGroup || item.source || '');
  const iraqRelated = IRAQ_TERMS.test(text) || /^(?:IraqiNews|Iraq Business News)$/i.test(group);
  const economyRelated = /\b(economy|economic|oil|gas|opec|somo|budget|salary|salaries|dinar|iqd|bank|banking|cbi|finance|financial|investment|trade|customs|tax|stock|isx|securities|exports|imports|pipeline|power|electricity|agriculture|wheat|water|development|project|port|railway|private sector|jobs|unemployment|revenue|payroll|deficit|loan|dollar)\b/i.test(text)
    || /Economy|Dinar|Budget|Oil|Business|Banking|Finance|Investment|Stock|Trade|Power|Gas|Agriculture|Private Sector|KRG Budget|SOMO|Ministry|EIA|MEES|Iraq Oil Report|Central Bank/i.test(group);
  return iraqRelated && economyRelated;
}

function isFreshNewsItem(item, now = Date.now()){
  const publishedTime = Date.parse(item.publishedAt);
  return Number.isFinite(publishedTime)
    && publishedTime >= now - NEWS_MAX_AGE_MS
    && publishedTime <= now + NEWS_MAX_FUTURE_MS;
}

function isRelevantToFeed(item, feed){
  const text = `${item.title} ${item.summary}`;
  if(feed.tier === 'curated' && feed.url.includes('news.google.com') && !TRUSTED_PUBLISHERS.test(item.source)) return false;
  if(feed.category === 'iraq') return isIraqEconomy(item);
  if(feed.category === 'geopolitics') return WAR_TERMS.test(text);
  if(feed.category === 'forex') return FOREX_TERMS.test(text) || US_MACRO_TERMS.test(text);
  if(feed.category === 'metals') return METAL_TERMS.test(text) || US_MACRO_TERMS.test(text) || WAR_TERMS.test(text);
  if(feed.category === 'indices') return INDEX_TERMS.test(text) || US_MACRO_TERMS.test(text) || WAR_TERMS.test(text);
  return FOCUS_MARKET_TERMS.test(text);
}

function itemKey(item){
  return item.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,110);
}

function dedupeItems(items, seen = new Set()){
  const output = [];
  for(const item of items){
    const key = itemKey(item);
    if(!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function storyStrength(item, now = Date.now()){
  const ageHours = Math.max(0, (now - Date.parse(item.publishedAt || 0)) / 3600000);
  const recency = Math.max(0, 40 - ageHours * 1.5);
  const impact = item.intelligence?.impact === 'high' ? 20 : item.intelligence?.impact === 'medium' ? 9 : 0;
  const effects = Math.min(15, new Set((item.intelligence?.effects || []).map(effect => effect.asset)).size * 3);
  const complete = String(item.content || item.summary || '').length >= 240 ? 4 : 0;
  const localFocus = item.intelligence?.iraqImpact ? 5 : 0;
  return Math.max(0, Math.round((TIER_WEIGHT[item.sourceTier] || 14) + recency + impact + effects + complete + localFocus));
}

function latestFirst(items){
  return [...items]
    .map(item => ({ ...item, strengthScore: storyStrength(item) }))
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt) || b.strengthScore-a.strengthScore);
}

async function readFeedBody(response, itemLimit){
  if(!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let total = 0;
  while(true){
    const { done, value } = await reader.read();
    if(done){
      text += decoder.decode();
      return text;
    }
    total += value.byteLength;
    if(total > MAX_FEED_BYTES){
      await reader.cancel('feed response too large');
      throw new Error('feed response too large');
    }
    text += decoder.decode(value, { stream: true });
    if((text.match(/<\/(?:item|entry)>/gi) || []).length >= itemLimit){
      await reader.cancel('enough feed items received');
      return text;
    }
  }
}

async function fetchFeed(feed, timeoutMs){
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(()=>controller.abort('feed timeout'), Math.max(timeoutMs, Number(feed.timeoutMs) || 0));
  try{
    const res = await fetch(feed.url, {
      signal: controller.signal,
      cf: { cacheTtl: SOURCE_CACHE_TTL, cacheEverything: false },
      headers: { 'user-agent': 'HawaliAburiBot/1.7' }
    });
    if(!res.ok) throw new Error(String(res.status));
    const perFeedLimit = feed.category === 'iraq' ? 12 : 8;
    const xml = await readFeedBody(res, perFeedLimit);
    const items = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].slice(0,perFeedLimit).map((m, idx)=>{
      const entry = m[0];
      const rawTitle = extractTag(entry,'title');
      const isGoogleFeed = feed.url.includes('news.google.com');
      const title = isGoogleFeed ? cleanGoogleTitle(rawTitle) : rawTitle;
      const link = extractLink(entry) || extractTag(entry,'guid') || extractTag(entry,'id') || feed.url;
      const description = extractTag(entry,'description') || extractTag(entry,'summary') || extractTag(entry,'content');
      const content = (extractTag(entry,'content:encoded') || description).replace(/\s+/g, ' ').trim().slice(0, 1600);
      const summary = (description || content).replace(/\s+/g, ' ').trim().slice(0, 900);
      const publishedAt = extractTag(entry,'pubDate') || extractTag(entry,'published') || extractTag(entry,'updated') || extractTag(entry,'dc:date');
      const image = extractImage(entry) || fallbackImages[feed.category] || fallbackImages.markets;
      const source = isGoogleFeed ? sourceFromGoogleTitle(rawTitle, feed.source) : feed.source;
      const base = { id: `${feed.source}-${idx}-${title}`.slice(0,180), title, titleEn: title, summary, summaryEn: summary, content, contentEn: content, source, sourceGroup: feed.source, sourceTier: feed.tier, category: feed.category, link, publishedAt, image };
      const intel = analyze(base);
      return { ...base, intelligence: intel, impact: intel.impact, sentiment: intel.sentiment, affected: intel.assets, iraqImpact: intel.iraqImpact };
    }).filter(i=>i.title && isFreshNewsItem(i)).filter(item=>isRelevantToFeed(item, feed));
    if(!items.length){
      return { source: feed.source, ok: false, items: [], durationMs: Date.now() - startedAt, error: 'no usable recent items' };
    }
    return { source: feed.source, ok: true, items, durationMs: Date.now() - startedAt };
  }catch(e){
    const message = e instanceof Error ? e.message : String(e);
    return { source: feed.source, ok: false, items: [], durationMs: Date.now() - startedAt, error: message || 'feed request failed' };
  }finally{
    clearTimeout(timeoutId);
  }
}

async function fetchFeeds(feeds, timeoutMs){
  const results = new Array(feeds.length);
  let cursor = 0;
  async function run(){
    while(cursor < feeds.length){
      const index = cursor++;
      results[index] = await fetchFeed(feeds[index], timeoutMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, feeds.length) }, run));
  return results;
}

function cacheKeyFor(url, mode, batch, limit){
  const cacheUrl = new URL(url.origin + url.pathname);
  cacheUrl.searchParams.set('version', 'fresh-latest-v3');
  cacheUrl.searchParams.set('mode', mode);
  if(mode === 'full') cacheUrl.searchParams.set('batch', String(batch));
  cacheUrl.searchParams.set('limit', String(limit));
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

function withHeader(response, name, value){
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) {
  const startedAt = Date.now();
  if(context.request.method !== 'GET'){
    return Response.json({ ok: false, error: 'GET only', items: [] }, {
      status: 405,
      headers: { 'Allow': 'GET', 'Cache-Control': 'no-store' }
    });
  }
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  if(q){
    return Response.json({ ok: false, error: 'News search is performed in the browser. Remove the q parameter.', items: [] }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
  const parsedLimit = Number(url.searchParams.get('limit'));
  const mode = url.searchParams.get('mode') === 'fast' ? 'fast' : 'full';
  const defaultLimit = mode === 'fast' ? 48 : 120;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 180) : defaultLimit;
  const requestedBatch = Number(url.searchParams.get('batch') || 0);
  const batch = Number.isInteger(requestedBatch) ? Math.max(0, Math.min(requestedBatch, BATCH_COUNT - 1)) : 0;
  const forceRefresh = url.searchParams.get('refresh') === '1';
  const cache = globalThis.caches?.default;
  const cacheKey = cache ? cacheKeyFor(url, mode, batch, limit) : null;
  if(cacheKey && !forceRefresh){
    const cached = await cache.match(cacheKey);
    if(cached) return withHeader(cached, 'X-News-Cache', 'HIT');
  }

  const selectedFeeds = (mode === 'fast'
    ? FAST_FEED_SOURCES.map(source => FEEDS.find(feed => feed.source === source)).filter(Boolean)
    : FEEDS.filter((_, index) => index % BATCH_COUNT === batch))
    .sort((a,b)=>(Number(b.timeoutMs) || 0) - (Number(a.timeoutMs) || 0));
  const feedResults = await fetchFeeds(selectedFeeds, mode === 'fast' ? FAST_FEED_TIMEOUT_MS : FULL_FEED_TIMEOUT_MS);
  const raw = feedResults.flatMap(result => result.items);
  const iraq = latestFirst(dedupeItems(raw.filter(isIraqEconomy)));
  const reserved = Math.min(iraq.length, Math.max(12, Math.ceil(limit * 0.28)));
  const seen = new Set(iraq.slice(0, reserved).map(itemKey));
  const others = latestFirst(dedupeItems(raw.filter(item => !seen.has(itemKey(item))), seen));
  const items = latestFirst([...iraq.slice(0, reserved), ...others.slice(0, Math.max(0, limit - reserved))]);
  const succeeded = feedResults.filter(result => result.ok).length;
  const failures = feedResults
    .filter(result => !result.ok)
    .map(({ source, error, durationMs }) => ({ source, error, durationMs }));
  if(failures.length){
    console.warn(JSON.stringify({
      event: 'news_feed_batch_incomplete',
      mode,
      batch: mode === 'fast' ? 'fast' : batch,
      requested: selectedFeeds.length,
      failed: failures.length,
      failures
    }));
  }
  const ttl = mode === 'fast' ? FAST_CACHE_TTL : FULL_CACHE_TTL;
  const response = Response.json({
    updatedAt: new Date().toISOString(),
    status: items.length ? 'live' : 'unavailable',
    order: 'latest-first',
    count: items.length,
    translated: false,
    mode,
    batch: mode === 'fast' ? 'fast' : batch,
    batchCount: BATCH_COUNT,
    feedStats: { total: FEEDS.length, requested: selectedFeeds.length, succeeded, failed: failures.length, failures },
    items
  }, { headers: {
    'Cache-Control': `public, max-age=${ttl}, must-revalidate`,
    'X-News-Cache': 'MISS',
    'X-News-Mode': mode,
    'X-News-Order': 'latest-first',
    'Server-Timing': `news;dur=${Date.now() - startedAt}`
  }});

  if(cacheKey){
    const cacheWrite = cache.put(cacheKey, response.clone()).catch(error => {
      console.warn(JSON.stringify({ event:'news_cache_write_failed', message:error instanceof Error ? error.message : String(error) }));
    });
    if(context.waitUntil) context.waitUntil(cacheWrite);
    else await cacheWrite;
  }
  return response;
}

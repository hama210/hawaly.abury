const CATEGORY_IMAGES = {
  breaking: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80',
  iraq: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80',
  forex: 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=80',
  oil: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=80',
  crypto: 'https://images.unsplash.com/photo-1621504450181-5d356f61d307?auto=format&fit=crop&w=1200&q=80',
  stocks: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  geopolitics: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  banks: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  economy: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'
};

const SOURCES = [
  { name:'Reuters Markets', category:'breaking', url:'https://news.google.com/rss/search?q=Reuters%20markets%20economy%20forex%20oil%20when:1d&hl=en-US&gl=US&ceid=US:en' },
  { name:'CNBC Markets', category:'stocks', url:'https://news.google.com/rss/search?q=CNBC%20markets%20economy%20forex%20when:1d&hl=en-US&gl=US&ceid=US:en' },
  { name:'MSN Money', category:'economy', url:'https://news.google.com/rss/search?q=MSN%20Money%20economy%20markets%20when:1d&hl=en-US&gl=US&ceid=US:en' },
  { name:'MarketWatch', category:'stocks', url:'https://news.google.com/rss/search?q=MarketWatch%20markets%20economy%20when:1d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Yahoo Finance', category:'stocks', url:'https://finance.yahoo.com/news/rssindex' },
  { name:'FXStreet', category:'forex', url:'https://www.fxstreet.com/rss/news' },
  { name:'ForexLive', category:'forex', url:'https://www.forexlive.com/feed/news' },
  { name:'OilPrice', category:'oil', url:'https://oilprice.com/rss/main' },
  { name:'CoinDesk', category:'crypto', url:'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name:'Cointelegraph', category:'crypto', url:'https://cointelegraph.com/rss' },
  { name:'Federal Reserve', category:'banks', url:'https://news.google.com/rss/search?q=Federal%20Reserve%20rates%20inflation%20when:2d&hl=en-US&gl=US&ceid=US:en' },
  { name:'ECB', category:'banks', url:'https://news.google.com/rss/search?q=ECB%20rates%20eurozone%20inflation%20when:2d&hl=en-US&gl=US&ceid=US:en' },
  { name:'OPEC', category:'oil', url:'https://news.google.com/rss/search?q=OPEC%20oil%20Iraq%20when:2d&hl=en-US&gl=US&ceid=US:en' },
  { name:'EIA', category:'oil', url:'https://news.google.com/rss/search?q=EIA%20oil%20inventories%20when:2d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Iraq Business News', category:'iraq', url:'https://news.google.com/rss/search?q=Iraq%20Business%20News%20economy%20oil%20banking%20when:7d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Shafaq News', category:'iraq', url:'https://news.google.com/rss/search?q=Shafaq%20News%20Iraq%20economy%20oil%20dinar%20when:7d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Rudaw', category:'iraq', url:'https://news.google.com/rss/search?q=Rudaw%20Iraq%20Kurdistan%20economy%20oil%20when:7d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Kurdistan24', category:'iraq', url:'https://news.google.com/rss/search?q=Kurdistan24%20Iraq%20economy%20oil%20when:7d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Iraqi News Agency', category:'iraq', url:'https://news.google.com/rss/search?q=Iraqi%20News%20Agency%20economy%20oil%20bank%20when:7d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Central Bank of Iraq', category:'iraq', url:'https://news.google.com/rss/search?q=Central%20Bank%20of%20Iraq%20dinar%20banking%20when:7d&hl=en-US&gl=US&ceid=US:en' },
  { name:'Truth Social', category:'geopolitics', url:'https://news.google.com/rss/search?q=Truth%20Social%20Trump%20tariffs%20oil%20Fed%20when:1d&hl=en-US&gl=US&ceid=US:en' }
];

const impactWords = ['fed','federal reserve','interest rate','cpi','inflation','nfp','jobs','opec','war','attack','tariff','central bank','recession','oil','iraq','dinar','banking','sanctions'];
const marketMap = [
  ['oil',['Oil','Brent','WTI','IQD']], ['opec',['Oil','Brent','WTI']], ['iraq',['IQD','USD/IQD','Oil']], ['dinar',['IQD','USD/IQD']],
  ['fed',['USD','Gold','EUR/USD']], ['inflation',['USD','Gold','Stocks']], ['cpi',['USD','Gold','Stocks']], ['ecb',['EUR','EUR/USD']],
  ['bitcoin',['BTC','ETH']], ['crypto',['BTC','ETH']], ['gold',['Gold','USD']], ['war',['Gold','Oil','USD']]
];
function decodeXml(v='') { return v.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim(); }
function stripHtml(v='') { return decodeXml(v).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
function getTag(item, tag) { const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')); return m ? decodeXml(m[1]) : ''; }
function imageFrom(item, category) { const enclosure = item.match(/<enclosure[^>]+url=["']([^"']+)["']/i); if (enclosure) return enclosure[1]; const media = item.match(/<media:content[^>]+url=["']([^"']+)["']/i) || item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i); if (media) return media[1]; const img = item.match(/<img[^>]+src=["']([^"']+)["']/i); if (img) return img[1]; return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.economy; }
function classifyImpact(title, desc) { const text = `${title} ${desc}`.toLowerCase(); const score = impactWords.reduce((n,w)=> n + (text.includes(w)?1:0), 0); return score >= 2 ? 'High' : score === 1 ? 'Medium' : 'Low'; }
function affectedMarkets(title, desc, category) { const text = `${title} ${desc}`.toLowerCase(); const set = new Set(category==='iraq' ? ['IQD'] : []); marketMap.forEach(([key, markets]) => { if (text.includes(key)) markets.forEach(m=>set.add(m)); }); if (!set.size) set.add(category==='forex' ? 'FX' : category==='oil' ? 'Oil' : category==='crypto' ? 'Crypto' : 'Markets'); return [...set].slice(0,5); }
function kurdishHint(title, category) { const t = title.toLowerCase(); if (category === 'iraq') return 'ئەم هەواڵە پەیوەندی بە عێراق، داهات، بانکی ناوەندی، نەوت یان دۆخی ئابووری ناوخۆییەوە هەیە.'; if (t.includes('fed') || t.includes('rate')) return 'ئەم بابەتە دەتوانێت کاریگەری لەسەر دۆلار، زێڕ و دراوە سەرەکییەکان هەبێت.'; if (t.includes('oil') || category === 'oil') return 'هەواڵی نەوت بۆ عێراق و بازاڕەکانی وزە گرنگە چونکە داهاتی نەوت کاریگەری لە بودجە و دراو هەیە.'; if (category === 'crypto') return 'ئەم هەواڵە پەیوەندی بە هەستی ڕیسک و بازاڕی کریپتۆوە هەیە.'; return 'ئەم هەواڵە لەوانەیە کاریگەری لە هەستی بازاڕ، دراوەکان، پشکەکان یان بڕیارە ئابوورییەکان هەبێت.'; }
async function fetchSource(src) {
  try {
    const res = await fetch(src.url, { headers: { 'User-Agent': 'HawaliAburi/2.0' }, cf: { cacheTtl: 60, cacheEverything: true } });
    if (!res.ok) throw new Error(`${res.status}`);
    const xml = await res.text();
    const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m=>m[0]).slice(0, 8);
    return blocks.map((item, i) => {
      const title = stripHtml(getTag(item, 'title'));
      const linkRaw = stripHtml(getTag(item, 'link')) || src.url;
      const desc = stripHtml(getTag(item, 'description')).slice(0, 260);
      const publishedAt = stripHtml(getTag(item, 'pubDate') || getTag(item, 'published'));
      const link = linkRaw.includes('news.google.com') ? linkRaw : linkRaw;
      const impact = classifyImpact(title, desc);
      return {
        id: `${src.name}-${i}-${title}`.replace(/\W+/g,'-').slice(0,110),
        source: src.name,
        category: src.category,
        impact,
        titleEn: title || src.name,
        titleKu: title || src.name,
        titleAr: title || src.name,
        summaryKu: kurdishHint(title, src.category),
        summaryAr: 'ملخص سريع: هذا الخبر قد يؤثر على الأسواق أو الاقتصاد حسب المصدر والتصنيف.',
        summaryEn: desc || 'Live source update from a monitored financial/news feed.',
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
        link,
        image: imageFrom(item, src.category),
        affected: affectedMarkets(title, desc, src.category),
        trust: src.category === 'iraq' ? 'Iraq source' : 'Market source'
      };
    }).filter(x => x.titleEn && x.link);
  } catch (e) { return []; }
}
function fallbackNews() {
  const now = new Date().toISOString();
  return [
    {id:'fallback-fed',source:'Market Monitor',category:'banks',impact:'High',titleEn:'Global markets monitor central bank signals',titleKu:'بازاڕە جیهانییەکان چاودێری ئاماژەکانی بانکە ناوەندییەکان دەکەن',titleAr:'الأسواق العالمية تراقب إشارات البنوك المركزية',summaryKu:'هەواڵەکانی سوود و تورم دەتوانن کاریگەری لەسەر دۆلار، زێڕ و فۆرێکس هەبێت.',summaryAr:'قرارات الفائدة والتضخم قد تؤثر على الدولار والذهب والفوركس.',summaryEn:'Fallback market brief while live feeds are loading.',publishedAt:now,link:'https://www.federalreserve.gov/newsevents.htm',image:CATEGORY_IMAGES.banks,affected:['USD','Gold','EUR/USD'],trust:'Fallback'},
    {id:'fallback-iraq',source:'Iraq Monitor',category:'iraq',impact:'High',titleEn:'Iraq economy watch: oil, banking and dinar remain key themes',titleKu:'چاودێری ئابووری عێراق: نەوت، بانک و دینار بابەتی سەرەکین',titleAr:'متابعة اقتصاد العراق: النفط والمصارف والدينار ملفات رئيسية',summaryKu:'نەوت و بڕیارەکانی بانکی ناوەندی عێراق دەتوانن کاریگەری لەسەر ئابووری ناوخۆیی هەبێت.',summaryAr:'النفط وقرارات البنك المركزي العراقي يمكن أن تؤثر على الاقتصاد المحلي.',summaryEn:'Fallback Iraq market brief while live feeds are loading.',publishedAt:now,link:'https://cbi.iq/',image:CATEGORY_IMAGES.iraq,affected:['IQD','USD/IQD','Oil'],trust:'Fallback'}
  ];
}
export async function onRequestGet() {
  const results = (await Promise.all(SOURCES.map(fetchSource))).flat();
  const seen = new Set();
  const items = results.filter(item => {
    const key = item.titleEn.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,80);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b)=> new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 80);
  return Response.json({ ok:true, updatedAt:new Date().toISOString(), count: items.length, items: items.length ? items : fallbackNews(), sources:SOURCES.map(s=>({name:s.name,category:s.category,url:s.url})) }, { headers: { 'Cache-Control':'public, max-age=60' } });
}

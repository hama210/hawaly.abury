const FEEDS = [
  { source:'Google News · Economy', category:'world', impact:'Medium', url:'https://news.google.com/rss/search?q=global+economy+OR+inflation+OR+GDP+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'Google News · Forex', category:'forex', impact:'High', url:'https://news.google.com/rss/search?q=forex+OR+EURUSD+OR+Federal+Reserve+OR+ECB+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'Google News · Oil', category:'oil', impact:'High', url:'https://news.google.com/rss/search?q=oil+prices+OR+OPEC+OR+EIA+OR+Iraq+oil+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'Google News · Iraq Economy', category:'iraq', impact:'High', url:'https://news.google.com/rss/search?q=Iraq+economy+OR+Iraqi+dinar+OR+Central+Bank+of+Iraq+OR+Iraq+oil+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'Google News · Stocks', category:'stocks', impact:'Medium', url:'https://news.google.com/rss/search?q=stock+market+OR+S%26P+500+OR+Nasdaq+OR+Dow+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'Google News · Crypto', category:'crypto', impact:'Medium', url:'https://news.google.com/rss/search?q=bitcoin+OR+ethereum+OR+crypto+market+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'Google News · Geopolitics', category:'geopolitics', impact:'High', url:'https://news.google.com/rss/search?q=war+OR+sanctions+OR+Middle+East+OR+Ukraine+markets+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'Google News · Central Banks', category:'banks', impact:'High', url:'https://news.google.com/rss/search?q=central+bank+OR+interest+rates+OR+Fed+OR+ECB+OR+BOE+OR+BOJ+when:1d&hl=en-US&gl=US&ceid=US:en' },
  { source:'MSN Money', category:'stocks', impact:'Medium', url:'https://www.msn.com/en-us/money/markets/rss' }
]

const FALLBACK_IMAGES = {
  iraq:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1400&q=80',
  forex:'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?auto=format&fit=crop&w=1400&q=80',
  oil:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1400&q=80',
  crypto:'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1400&q=80',
  stocks:'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1400&q=80',
  geopolitics:'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80',
  banks:'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80',
  world:'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80'
}

export async function onRequest() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8500)
  try {
    const batches = await Promise.allSettled(FEEDS.map(feed => fetchFeed(feed, controller.signal)))
    const items = batches.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    const deduped = dedupe(items).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,60)
    return Response.json({ updatedAt:new Date().toISOString(), items: deduped.length ? deduped : fallbackItems() }, { headers:{ 'Cache-Control':'public, max-age=60, stale-while-revalidate=120' } })
  } catch (error) {
    return Response.json({ updatedAt:new Date().toISOString(), items:fallbackItems(), error:String(error?.message||error) }, { headers:{ 'Cache-Control':'public, max-age=30' } })
  } finally { clearTimeout(timer) }
}

async function fetchFeed(feed, signal){
  const res = await fetch(feed.url, { signal, headers:{ 'User-Agent':'HawaliAburi/3.0' } })
  if(!res.ok) throw new Error(feed.source + ' ' + res.status)
  const xml = await res.text()
  return parseItems(xml).map((item, index) => normalize(item, feed, index))
}

function parseItems(xml){
  const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m=>m[0]).slice(0,12)
  return blocks.map(block => ({
    title: clean(readTag(block,'title')),
    link: clean(readTag(block,'link')) || clean(readTag(block,'guid')),
    description: clean(readTag(block,'description')),
    pubDate: clean(readTag(block,'pubDate')),
    image: extractImage(block)
  })).filter(x=>x.title && x.link)
}
function readTag(block, tag){ const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')); return m ? decode(m[1]) : '' }
function extractImage(block){
  const media = block.match(/<media:content[^>]+url=["']([^"']+)["']/i) || block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
  if(media) return decode(media[1])
  const img = block.match(/<img[^>]+src=["']([^"']+)["']/i)
  return img ? decode(img[1]) : ''
}
function clean(text=''){ return decode(text).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() }
function decode(text=''){ return text.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>') }
function normalize(item, feed, index){
  const title = item.title.replace(/ - [^-]+$/,'')
  const category = classify(title + ' ' + item.description, feed.category)
  const impact = scoreImpact(title + ' ' + item.description, feed.impact)
  const affected = affectedAssets(title + ' ' + item.description, category)
  return {
    id: slug(feed.source + '-' + title + '-' + index), source: feed.source, tier: tierFor(feed.source), category, impact, sentiment: sentiment(title),
    titleEn:title, titleKu:pseudoTranslate(title,'ku'), titleAr:pseudoTranslate(title,'ar'),
    summaryEn: item.description || impactSummary(category, 'en'), summaryKu: impactSummary(category, 'ku'), summaryAr: impactSummary(category, 'ar'),
    whyEn: why(category,'en'), whyKu: why(category,'ku'), whyAr: why(category,'ar'),
    publishedAt: validDate(item.pubDate), link: item.link, image: item.image || FALLBACK_IMAGES[category] || FALLBACK_IMAGES.world, affected
  }
}
function dedupe(items){ const seen = new Set(); return items.filter(item => { const key = item.titleEn.toLowerCase().replace(/[^a-z0-9]+/g,' ').slice(0,95); if(seen.has(key)) return false; seen.add(key); return true }) }
function classify(text, fallback){ const s=text.toLowerCase(); if(/iraq|iqd|dinar|baghdad|erbil|kurdistan|cbi|basra/.test(s)) return 'iraq'; if(/fed|ecb|boj|boe|central bank|interest rate|fomc/.test(s)) return 'banks'; if(/oil|opec|brent|wti|energy|crude/.test(s)) return 'oil'; if(/bitcoin|crypto|ethereum|btc|eth/.test(s)) return 'crypto'; if(/forex|eurusd|gbpusd|usd|currency|dollar|yen|euro/.test(s)) return 'forex'; if(/stock|nasdaq|dow|s&p|shares|earnings/.test(s)) return 'stocks'; if(/war|sanction|ukraine|middle east|iran|israel|china taiwan/.test(s)) return 'geopolitics'; return fallback || 'world' }
function scoreImpact(text, fallback){ const s=text.toLowerCase(); if(/fed|fomc|cpi|nfp|interest rate|war|opec|central bank of iraq|sanctions|oil prices|inflation/.test(s)) return 'High'; if(/gdp|pmi|retail sales|earnings|stocks|bitcoin/.test(s)) return 'Medium'; return fallback || 'Low' }
function affectedAssets(text, category){ const s=text.toLowerCase(); const a = new Set(); if(/fed|usd|dollar|inflation|cpi|nfp|rate/.test(s)) ['USD','Gold','EUR/USD'].forEach(x=>a.add(x)); if(/oil|opec|iraq/.test(s)) ['Oil','IQD'].forEach(x=>a.add(x)); if(/bitcoin|crypto|ethereum/.test(s)) ['BTC','ETH'].forEach(x=>a.add(x)); if(/stock|nasdaq|dow|s&p/.test(s)) ['US Stocks','Nasdaq'].forEach(x=>a.add(x)); if(category==='iraq') ['Iraq','IQD','Oil'].forEach(x=>a.add(x)); if(category==='forex') ['USD','EUR/USD','Gold'].forEach(x=>a.add(x)); return [...a].slice(0,6) }
function sentiment(text){ const s=text.toLowerCase(); if(/rise|gain|rally|strong|growth|record/.test(s)) return 'Bullish'; if(/fall|drop|weak|war|risk|sanction|cuts|slump/.test(s)) return 'Bearish'; return 'Neutral' }
function tierFor(source){ if(/fed|ecb|bank|opec|eia|imf|world bank|cbi|ministry/i.test(source)) return 'Official'; if(/iraq|shafaq|rudaw|kurdistan/i.test(source)) return 'Iraq'; if(/google|msn|reuters|cnbc|yahoo|marketwatch/i.test(source)) return 'Major Media'; return 'Source' }
function impactSummary(cat, lang){
  const map = {
    ku:{iraq:'ئەم هەواڵە دەتوانێت کاریگەری لەسەر ئابووری عێراق، دینار، نەوت و بڕیارە داراییەکان هەبێت.',forex:'هەواڵەکە پەیوەندی بە جووتە دراوەکان و هێزی دۆلارەوە هەیە.',oil:'نەوت و وزە دەتوانن کاریگەری لەسەر تورم و داهاتی وڵاتان بکەن.',crypto:'کریپتۆ بە هەواڵەکانی ڕیسک و سیاسەتی دارایی دەجوڵێت.',stocks:'بازاڕی پشکەکان بە هەواڵی کۆمپانیا و داتای ئابووری کاردەکات.',geopolitics:'ڕیسکە جیوپۆلیتیکییەکان زۆرجار زێڕ، نەوت و دۆلار دەجوڵێنن.',banks:'بڕیار و قسەکانی بانکە ناوەندییەکان کاریگەری ڕاستەوخۆ لەسەر فۆرێکس و زێڕ هەیە.',world:'هەواڵی ئابووری جیهانی دەتوانێت هەستی بازاڕ بگۆڕێت.'},
    ar:{iraq:'قد يؤثر هذا الخبر على اقتصاد العراق والدينار والنفط والقرارات المالية.',forex:'يرتبط الخبر بالعملات وقوة الدولار.',oil:'النفط والطاقة يؤثران على التضخم وإيرادات الدول.',crypto:'العملات الرقمية تتحرك مع أخبار المخاطر والسياسة المالية.',stocks:'الأسهم تتأثر بأخبار الشركات والبيانات الاقتصادية.',geopolitics:'المخاطر الجيوسياسية غالباً تحرك الذهب والنفط والدولار.',banks:'قرارات وتصريحات البنوك المركزية تؤثر مباشرة على الفوركس والذهب.',world:'الأخبار الاقتصادية العالمية قد تغير معنويات الأسواق.'},
    en:{iraq:'This story may affect Iraq, IQD, oil revenue, and financial decisions.',forex:'This story is connected to currency pairs and dollar strength.',oil:'Oil and energy headlines can affect inflation and national revenues.',crypto:'Crypto can move with risk sentiment and financial policy news.',stocks:'Stocks react to company headlines and economic data.',geopolitics:'Geopolitical risk often moves gold, oil, and USD.',banks:'Central-bank decisions directly affect FX and gold.',world:'Global economic news can shift market sentiment.'}
  }; return map[lang][cat] || map[lang].world
}
function why(cat, lang){ return impactSummary(cat, lang) }
function pseudoTranslate(title, lang){ if(lang==='en') return title; if(lang==='ar') return 'خبر مهم: ' + title; return 'هەواڵی گرنگ: ' + title }
function slug(x){ return x.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) }
function validDate(date){ const d = new Date(date); return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString() }
function fallbackItems(){
  const now=Date.now();
  return [
    {id:'fb1',source:'Federal Reserve',tier:'Official',category:'banks',impact:'High',sentiment:'Neutral',titleEn:'Markets watch central-bank policy and inflation data',titleKu:'بازاڕەکان چاوەڕێی سیاسەتی بانکە ناوەندییەکان و داتای تورمن',titleAr:'الأسواق تترقب سياسات البنوك المركزية وبيانات التضخم',summaryEn:impactSummary('banks','en'),summaryKu:impactSummary('banks','ku'),summaryAr:impactSummary('banks','ar'),whyEn:why('banks','en'),whyKu:why('banks','ku'),whyAr:why('banks','ar'),publishedAt:new Date(now-8*60000).toISOString(),link:'https://www.federalreserve.gov/newsevents.htm',image:FALLBACK_IMAGES.banks,affected:['USD','Gold','EUR/USD']},
    {id:'fb2',source:'Iraq Economy Monitor',tier:'Iraq',category:'iraq',impact:'High',sentiment:'Neutral',titleEn:'Oil and budget news remain important for Iraq',titleKu:'نەوت و بودجە هێشتا گرنگن بۆ ئابووری عێراق',titleAr:'أخبار النفط والموازنة تبقى مهمة لاقتصاد العراق',summaryEn:impactSummary('iraq','en'),summaryKu:impactSummary('iraq','ku'),summaryAr:impactSummary('iraq','ar'),whyEn:why('iraq','en'),whyKu:why('iraq','ku'),whyAr:why('iraq','ar'),publishedAt:new Date(now-18*60000).toISOString(),link:'https://oil.gov.iq/',image:FALLBACK_IMAGES.iraq,affected:['Oil','IQD','Iraq']}
  ]
}

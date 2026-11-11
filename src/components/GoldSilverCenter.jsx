import React,{useEffect,useMemo,useState} from 'react';
import { marketStories } from '../lib/hawal-features.js';
import { getTitle,getSummary } from '../utils/news.js';
import { safeUrl,timestamp } from '../lib/market-tools.js';
import { fetchEconomicCalendar } from '../services/economic-calendar.js';
import { calendarEventTitle } from '../lib/calendar-i18n.js';
import { pagePath } from '../lib/market-tools.js';
import { METALS,METALS_HISTORY_URL,cleanMetalHistory,metalQuote,
  recentMetalHistory,metalChartPoints,selectMetalEvents } from '../lib/metals-center.js';

const L={
  ku:{
    headline:'سەنتەری زێڕ و زیو',intro:'نرخی سەرچاوەداری گرێبەستە داهاتووەکانی زێڕ و زیو، چارت، هەواڵ و ڕووداوە ئابوورییەکان',
    gold:'زێڕ',silver:'زیو',unit:'دۆلار / ئۆنسی ترۆی',futures:'گرێبەستی داهاتوو',basis:'نرخی گرێبەستی داهاتووە، نەک نرخی Spot یان بازاڕی زێڕفرۆشەکانی هەولێر.',
    previous:'گۆڕان لە داخستنی پێشووەوە',reported:'نرخی تازەی سەرچاوەدار',stale:'نرخی کۆن',undated:'کاتی نرخ دیار نییە',unavailable:'نرخ بەردەست نییە',
    asof:'کاتی نرخ',source:'سەرچاوە',chart:'چارتی گۆڕانی نرخ',range:'ماوە',days7:'٧ ڕۆژ',days30:'٣٠ ڕۆژ',daily:'نرخە ڕۆژانەیە تۆمارکراوەکان',missingChart:'داتای مێژوویی بەردەست نییە؛ چارتێکی ساختە نیشان نادرێت.',
    chartLoading:'داتای مێژوویی دەخوێندرێتەوە...',chartFallback:'سەرچاوەی چارتی مێژوویی وەڵامی نەدایەوە.',chartNote:'چارتەکە لە داتای ڕۆژانەی سەرچاوە پێکهاتووە؛ نرخی ڕاستەوخۆی Spot نییە.',
    historyChange:'گۆڕان لە ماوەی پیشاندراودا',news:'هەواڵە پەیوەندیدارەکان',noNews:'هێشتا هەواڵی نوێی سەرچاوەدار نییە.',original:'سەرچاوەی ڕەسەن',
    events:'هەواڵە ئابوورییە گرنگەکانی داهاتوو',eventNote:'هەواڵەکانی USD دەتوانن زێڕ و زیو بجوڵێنن، بەڵام ئاراستەی جوڵانەوە دڵنیا نییە.',
    noEvents:'هەواڵی بەردەستی داهاتوو نییە.',eventsError:'داتای کاڵەندەر نوێ نەبووەوە.',calendar:'کاڵەندەری ئابووری',
    context:'چۆن بازاڕ بخوێنینەوە؟',drivers:'USD، سوودی بۆند، بڕیارەکانی Fed و مەترسیی جیهانی لەوانەیە کاریگەریان هەبێت. هیچ هەواڵێک بە تەنها هۆکاری سەلمێنراوی جوڵانی نرخ نییە.',
    disclaimer:'ئەم زانیارییانە بۆ ئاگاداریی بازاڕن، نەک ڕاوێژی وەبەرهێنان. ئەنجامی بازاڕ دڵنیا نییە.',updated:'دوایین نوێکردنەوەی داتا'
  },
  ar:{
    headline:'مركز الذهب والفضة',intro:'أسعار عقود الذهب والفضة الآجلة بمصادر واضحة، رسوم تاريخية وأخبار وبيانات اقتصادية',
    gold:'الذهب',silver:'الفضة',unit:'دولار / أونصة ترويسية',futures:'عقود آجلة',basis:'أسعار العقود الآجلة وليست السعر الفوري (Spot) أو أسعار محلات الذهب المحلية.',
    previous:'التغير عن الإغلاق السابق',reported:'سعر حديث بمصدر',stale:'سعر قديم',undated:'توقيت السعر غير معروف',unavailable:'السعر غير متاح',
    asof:'وقت السعر',source:'المصدر',chart:'رسم بياني للأسعار',range:'الفترة',days7:'7 أيام',days30:'30 يوماً',daily:'ملاحظات سعرية يومية منشورة',missingChart:'لا تتوفر بيانات تاريخية كافية؛ لا نعرض رسوماً افتراضية.',
    chartLoading:'تحميل الأسعار التاريخية...',chartFallback:'تعذر تحميل بيانات الرسم البياني.',chartNote:'يعرض الرسم بيانات يومية من المصدر، وليس سعراً فورياً حياً.',
    historyChange:'التغير خلال الفترة',news:'أخبار ذات صلة',noNews:'لا توجد أخبار حديثة موثقة المصدر.',original:'المصدر الأصلي',
    events:'أهم البيانات الاقتصادية القادمة',eventNote:'يمكن أن تؤثر بيانات الدولار على الذهب والفضة؛ ولا يمكن ضمان اتجاه السعر.',
    noEvents:'لا توجد أحداث قادمة متاحة.',eventsError:'تعذر تحديث التقويم.',calendar:'التقويم الاقتصادي',
    context:'كيف نفهم تحركات السوق؟',drivers:'قد تؤثر قوة الدولار وعوائد السندات وقرارات الفيدرالي والمخاطر العالمية. الخبر وحده لا يثبت سبب حركة السعر.',
    disclaimer:'للمعلومات فقط، وليست نصيحة استثمارية. اتجاه السوق غير مضمون.',updated:'آخر تحديث للمصدر'
  },
  en:{
    headline:'Gold & Silver Market Center',intro:'Source-attributed gold and silver futures quotes, historical charts, related reports and economic events',
    gold:'Gold',silver:'Silver',unit:'USD / troy oz',futures:'Futures',basis:'These are futures contracts, not live spot XAU/USD or XAG/USD prices or local jeweller quotes.',
    previous:'Change vs previous close',reported:'Fresh attributed quote',stale:'Stale quote',undated:'Undated quote',unavailable:'Quote unavailable',
    asof:'Quote time',source:'Source',chart:'Price history',range:'Range',days7:'7 days',days30:'30 days',daily:'Source-recorded daily observations',missingChart:'Not enough real history to draw a chart. No synthetic prices are shown.',
    chartLoading:'Loading price history...',chartFallback:'Historical chart provider is unavailable.',chartNote:'Daily provider observations, not a real-time spot price chart.',
    historyChange:'Change over selected period',news:'Related market reports',noNews:'No recent source-backed stories found.',original:'Original report',
    events:'Upcoming high-impact economic releases',eventNote:'USD releases may influence gold and silver, but neither the direction nor magnitude is guaranteed.',
    noEvents:'No upcoming events available.',eventsError:'Calendar data could not refresh.',calendar:'Economic Calendar',
    context:'What can move precious metals?',drivers:'USD movements, bond yields, Fed policy and geopolitical risk can matter. A headline alone does not establish what caused a price move.',
    disclaimer:'Market context only, not investment advice. Market reactions are uncertain.',updated:'Data last checked'
  }
};
const formatPrice=value=>typeof value==='number'&&Number.isFinite(value)?
  value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const formatPct=value=>typeof value==='number'&&Number.isFinite(value)?
  (value>0?'+':'')+value.toFixed(2)+'%':'—';
const initialMetal=()=>typeof window!=='undefined'&&window.location.hash==='#silver'?'silver':'gold';
function badgeState(state,c){return c[state]||c.unavailable;}
function MarketQuote({metal,markets,lang,c,active,onSelect,now}){
  const quote=metalQuote(markets,metal,now),item=METALS[metal];
  return <button type="button" className={'mc-quote'+(active?' active':'')}
    aria-pressed={active} onClick={()=>onSelect(metal)}>
    <span className="mc-quote-top"><span className="mc-name"><span className={'mc-dot mc-'+metal}/>{c[metal]} <small dir="ltr">{item.symbol}</small></span><span className="mc-futures">{c.futures}</span></span>
    <strong className="mc-price" dir="ltr">{quote.price!==null?'$'+formatPrice(quote.price):'—'}</strong>
    <span className="mc-quote-bottom"><span>{c.unit}</span><b dir="ltr" className={quote.change>0?'up':quote.change<0?'down':''}>{formatPct(quote.change)}</b></span>
    <span className={'mc-status mc-status-'+quote.state}>{badgeState(quote.state,c)}</span>
    {quote.timestamp && <small className="mc-time" dir="auto">{c.asof}: {timestamp(quote.timestamp,lang)}</small>}
  </button>;
}
function HistoryChart({points,metal,c,lang}){
  const coordinates=metalChartPoints(points);
  if(coordinates.length<2)return <p className="mc-message">{c.missingChart}</p>;
  const first=points[0],last=points[points.length-1],change=(last.close/first.close-1)*100;
  const min=Math.min(...points.map(p=>p.close)),max=Math.max(...points.map(p=>p.close));
  const line=coordinates.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const locale=lang==='ar'?'ar-IQ':'en-GB';
  const labelDate=value=>new Intl.DateTimeFormat(locale,{timeZone:'Asia/Baghdad',month:'short',day:'numeric'}).format(new Date(value));
  return <div className="mc-chart-wrap">
    <svg className={'mc-chart mc-chart-'+metal} viewBox="0 0 640 218" role="img"
      aria-label={c.chart+': '+formatPrice(first.close)+' → '+formatPrice(last.close)}>
      <title>{c.chart} · {METALS[metal].symbol} · {c.futures}</title>
      <desc>{formatPrice(first.close)} to {formatPrice(last.close)} USD per troy ounce; {points.length} source-recorded daily observations</desc>
      <path d="M38 15 V193 H625" className="mc-axis"/>
      <path d={line} className="mc-line" fill="none"/>
      <circle cx={coordinates[coordinates.length-1].x} cy={coordinates[coordinates.length-1].y} r="4" className="mc-endpoint"/>
      <text x="40" y="209" className="mc-chart-label">{labelDate(first.time)}</text>
      <text x="624" y="209" className="mc-chart-label" textAnchor="end">{labelDate(last.time)}</text>
      <text x="45" y="27" className="mc-chart-label">{formatPrice(max)}</text>
      <text x="45" y="182" className="mc-chart-label">{formatPrice(min)}</text>
    </svg>
    <div className="mc-chart-meta"><span>{c.historyChange}: <strong dir="ltr" className={change>0?'up':change<0?'down':''}>{formatPct(change)}</strong></span><span>{points.length} · {c.daily}</span></div>
  </div>;
}
export default function GoldSilverCenter({markets=[],news=[],lang='ku'}){
  const c=L[lang]||L.ku;
  const [metal,setMetal]=useState(initialMetal);
  const [range,setRange]=useState(30);
  const [history,setHistory]=useState({status:'loading',items:{},updatedAt:null,failures:[]});
  const [calendar,setCalendar]=useState({status:'loading',events:[]});
  const [now,setNow]=useState(Date.now());
  const select=key=>{
    if(!METALS[key])return;
    setMetal(key);
    window.history.replaceState(window.history.state,'',pagePath(lang,'metals')+'#'+key);
  };
  useEffect(()=>{
    const onHash=()=>setMetal(initialMetal());
    window.addEventListener('hashchange',onHash);
    return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  useEffect(()=>{
    const timer=setInterval(()=>setNow(Date.now()),60000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort('Metals history timeout'),9000);
    fetch(METALS_HISTORY_URL,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}})
      .then(res=>res.ok?res.json():Promise.reject(new Error('History unavailable')))
      .then(data=>setHistory({...cleanMetalHistory(data),status:'ready'}))
      .catch(()=>setHistory(previous=>({...previous,status:'error'})))
      .finally(()=>clearTimeout(timeout));
    return ()=>{controller.abort();clearTimeout(timeout);};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetchEconomicCalendar(controller.signal)
      .then(data=>setCalendar({status:'ready',events:data.events}))
      .catch(()=>{if(!controller.signal.aborted)setCalendar({status:'error',events:[]});});
    return ()=>controller.abort();
  },[]);
  const item=METALS[metal],quote=metalQuote(markets,metal,now);
  const points=useMemo(()=>recentMetalHistory(history.items[item.symbol],range,now),[history.items,item.symbol,range,now]);
  const related=useMemo(()=>marketStories(news,item.symbol),[news,item.symbol]);
  const events=useMemo(()=>selectMetalEvents(calendar.events,now),[calendar.events,now]);
  const sourceLink=quote.sourceUrl;
  return <main className="mc-page" dir={lang==='en'?'ltr':'rtl'}>
    <header className="mc-header">
      <div><p className="mc-kicker">HAWAL · PRECIOUS METALS</p><h1>{c.headline}</h1><p>{c.intro}</p></div>
      <span className="mc-header-mark" aria-hidden="true">Au / Ag</span>
    </header>
    <div className="mc-quote-grid" aria-label={c.headline}>
      {['gold','silver'].map(m=><MarketQuote key={m} metal={m} markets={markets} lang={lang} c={c} now={now} active={metal===m} onSelect={select}/>)}
    </div>
    <p className="mc-basis">{c.basis}</p>
    <section className="mc-panel" aria-labelledby="mc-chart-heading">
      <div className="mc-heading"><h2 id="mc-chart-heading">{c.chart} · {c[metal]} <span dir="ltr">{item.symbol}</span></h2>
        <div className="mc-range" role="group" aria-label={c.range}>
          {[7,30].map(days=><button key={days} type="button" aria-pressed={days===range} className={days===range?'active':''}
            onClick={()=>setRange(days)}>{days===7?c.days7:c.days30}</button>)}
        </div>
      </div>
      {history.status==='loading'&&<p className="mc-message" role="status">{c.chartLoading}</p>}
      {history.status==='error'&&<p className="mc-message" role="status">{c.chartFallback}</p>}
      {history.status==='ready'&&<HistoryChart points={points} metal={metal} c={c} lang={lang}/>}
      <p className="mc-note">{c.chartNote}</p>
      {history.updatedAt && <p className="mc-note">{c.updated}: {timestamp(history.updatedAt,lang)}</p>}
      <div className="mc-source-row">
        <span className={'mc-status mc-status-'+quote.state}>{badgeState(quote.state,c)}</span>
        <span>{c.previous}: <b dir="ltr">{formatPct(quote.change)}</b></span>
        {sourceLink && <a href={sourceLink} target="_blank" rel="noopener noreferrer">{c.source}: {quote.source||'Yahoo Finance'} ↗</a>}
        <a href={'https://finance.yahoo.com/quote/'+encodeURIComponent(item.yahooSymbol)+'/history/'} target="_blank" rel="noopener noreferrer">Yahoo {item.yahooSymbol} ↗</a>
      </div>
    </section>
    <div className="mc-bottom-grid">
      <section className="mc-panel" aria-labelledby="mc-news-heading">
        <div className="mc-heading"><h2 id="mc-news-heading">{c.news} · {c[metal]}</h2></div>
        {related.length?<div className="mc-news-list">{related.map(story=><article key={story.id||story.link}>
          <h3 dir="auto">{getTitle(story,lang)}</h3>
          {getSummary(story,lang) && <p dir="auto">{getSummary(story,lang).slice(0,220)}</p>}
          <div className="mc-news-meta"><span>{story.source}</span><time dateTime={story.publishedAt}>{timestamp(story.publishedAt,lang)}</time></div>
          <a href={safeUrl(story.link)} rel="noopener noreferrer" target="_blank">{c.original} ↗</a>
        </article>)}</div>:<p className="mc-message">{c.noNews}</p>}
      </section>
      <section className="mc-panel" aria-labelledby="mc-events-heading">
        <div className="mc-heading"><h2 id="mc-events-heading">{c.events}</h2><a href={pagePath(lang,'calendar')}>{c.calendar} ↗</a></div>
        <p className="mc-note">{c.eventNote}</p>
        {calendar.status==='loading'&&<p className="mc-message">{c.chartLoading}</p>}
        {calendar.status==='error'&&<p className="mc-message" role="status">{c.eventsError}</p>}
        {calendar.status==='ready'&&(events.length?<ul className="mc-event-list">
          {events.map(event=><li key={event.id+'-'+event.time}>
            <b dir="auto">{calendarEventTitle(event.title,lang)}</b>
            <span dir="ltr">{event.currency} · {timestamp(event.time,lang)}</span>
            <span className="mc-impact">● {event.impact.toUpperCase()}</span>
          </li>)}
        </ul>:<p className="mc-message">{c.noEvents}</p>)}
      </section>
    </div>
    <section className="mc-context"><h2>{c.context}</h2><p>{c.drivers}</p><small>{c.disclaimer}</small></section>
  </main>;
}

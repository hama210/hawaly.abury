import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { fetchNews, getInitialNews } from './services/news.js';
import { fetchMarkets } from './services/markets.js';
import { useClientTranslator } from './hooks/useClientTranslator.js';
import { LANGS, t } from './utils/i18n.js';
import { analyzeArticle, localizeSummary } from './utils/intelligence.js';
import { getSummary, getTitle } from './utils/news.js';

const nav = ['all','iraq','iran','geopolitics','forex','calendar','oil','stocks','crypto','central','intelligence'];
const categoryMap = {
  ku: { all:'هەموو', iraq:'عێراق', iran:'ئێران', geopolitics:'جەنگ و جیوپۆلیتیک', forex:'فۆرێکس', calendar:'ڕۆژژمێر', oil:'نەوت', stocks:'پشکەکان', crypto:'کریپتۆ', central:'بانک', intelligence:'AI' },
  ar: { all:'الكل', iraq:'العراق', iran:'إيران', geopolitics:'الحرب والجغرافيا السياسية', forex:'فوركس', calendar:'التقويم', oil:'النفط', stocks:'الأسهم', crypto:'كريبتو', central:'البنوك', intelligence:'AI' },
  en: { all:'All', iraq:'Iraq', iran:'Iran', geopolitics:'War & Geopolitics', forex:'Forex', calendar:'Calendar', oil:'Oil', stocks:'Stocks', crypto:'Crypto', central:'Banks', intelligence:'AI' }
};
const labels = {
  ku: {
    aiReady:'ئامادەی AI', riskMode:'دۆخی ڕیسک', marketSentiment:'هەستی بازاڕ', highImpact:'کاریگەری بەرز', iraqImpact:'کاریگەری عێراق', liveAssets:'دارایی زیندووەکان', critical:'هەواڵی گرنگ', localStories:'هەواڵی ئابوری ناوخۆ', trackedMarkets:'بازاڕی چاودێریکراو', mostImportant:'گرنگترین شت ئێستا', assetIntelligence:'زیرەکی دارایی', relatedStories:'هەواڵی پەیوەندیدار', highImpactLabel:'کاریگەری بەرز', normalRisk:'ڕیسکی ئاسایی', watch:'چاودێری', assistant:'یاریدەدەری زیرەکی بازاڕ', assistantHint:'پرسیار بکە، وەک: بۆچی زێڕ دەجووڵێت؟', assistantAnswer:'ئەم وەڵامە بە سیستەمی rule-based دروست دەکرێت. دواتر دەتوانین API key زیاد بکەین بۆ وەڵامی AI ڕاستەقینە.', aiIntro:'زیرەکی بازاڕ بە شێوازی rule-based کار دەکات؛ دواتر بە API key دەتوانرێت وەڵامی AI ڕاستەقینە زیاد بکرێت.', translating:'وەرگێڕانی هەواڵەکان...', allSources:'هەموو سەرچاوەکانی هەواڵ', loadingSources:'بارکردنی سەرچاوەکان', sourceNote:'ئەم ماڵپەڕە تەنها سەردێڕ، پوختە و لینکی هەواڵە گشتییەکان کۆدەکاتەوە. هەموو بابەت، وێنە و ڕاپۆرتەکان موڵکی سەرچاوە ڕەسەنەکانیانن.', contactNote:'بۆ داواکاری سەرچاوە یان لابردنەوە، پەیوەندی بە خاوەنی ماڵپەڕەوە بکە.', close:'داخستن', positive:'ئەرێنی', negative:'نەرێنی', flat:'بێگۆڕان', monitor:'چاودێری', active:'چالاک', sensitive:'هەستیار', neutral:'بێلایەن', usd:'دۆلار', gold:'زێڕ', oil:'نەوت', highAttention:'گرنگ', todayEvents:'ڕووداوە گرنگەکانی ئەمڕۆ'
  },
  ar: {
    aiReady:'جاهز للذكاء الاصطناعي', riskMode:'وضع المخاطر', marketSentiment:'معنويات السوق', highImpact:'تأثير مرتفع', iraqImpact:'تأثير العراق', liveAssets:'الأصول المباشرة', critical:'عناوين حرجة', localStories:'أخبار الاقتصاد المحلي', trackedMarkets:'أسواق مراقبة', mostImportant:'الأهم الآن', assetIntelligence:'ذكاء الأصول', relatedStories:'أخبار مرتبطة', highImpactLabel:'تأثير مرتفع', normalRisk:'مخاطر طبيعية', watch:'مراقبة', assistant:'مساعد ذكاء السوق', assistantHint:'اسأل مثل: لماذا يتحرك الذهب؟', assistantAnswer:'هذه إجابة مبنية على قواعد. يمكن إضافة API key لاحقاً لتفعيل إجابات ذكاء اصطناعي حقيقية.', aiIntro:'ذكاء السوق يعمل حالياً بنظام مبني على قواعد؛ ويمكن لاحقاً إضافة API key لتفعيل ذكاء اصطناعي حقيقي.', translating:'جاري ترجمة الأخبار...', allSources:'كل مصادر الأخبار', loadingSources:'تحميل المصادر', sourceNote:'هذا الموقع يجمع فقط عناوين الأخبار العامة وملخصات قصيرة وروابط المصادر الأصلية. كل المقالات والصور والتقارير تعود لأصحابها.', contactNote:'لطلب إضافة مصدر أو إزالة محتوى، تواصل مع مالك الموقع.', close:'إغلاق', positive:'إيجابي', negative:'سلبي', flat:'ثابت', monitor:'مراقبة', active:'نشط', sensitive:'حساس', neutral:'محايد', usd:'الدولار', gold:'الذهب', oil:'النفط', highAttention:'مهم', todayEvents:'أحداث اليوم المهمة'
  },
  en: {
    aiReady:'AI-ready', riskMode:'Risk Mode', marketSentiment:'Market Sentiment', highImpact:'High Impact', iraqImpact:'Iraq Impact', liveAssets:'Live Assets', critical:'critical headlines', localStories:'local economy stories', trackedMarkets:'tracked markets', mostImportant:'Most important now', assetIntelligence:'Asset Intelligence', relatedStories:'related stories', highImpactLabel:'high impact', normalRisk:'normal risk', watch:'Watch', assistant:'AI Market Assistant', assistantHint:'Ask: why is gold moving?', assistantAnswer:'This is a rule-based assistant answer. Add an API key later for real AI responses.', aiIntro:'AI-ready rule-based intelligence. Add an API key later to enable real AI.', translating:'Translating news...', allSources:'All news sources', loadingSources:'Loading sources', sourceNote:'This site only collects public news headlines, short summaries, and links to original publishers in one place. All articles, names, logos, images, and reporting belong to their owners.', contactNote:'For source or removal requests, contact the site owner.', close:'Close', positive:'Positive', negative:'Negative', flat:'Flat', monitor:'Monitor', active:'Active', sensitive:'Sensitive', neutral:'Neutral', usd:'USD', gold:'Gold', oil:'Oil', highAttention:'High attention', todayEvents:'Today’s key events'
  }
};
const tr = lang => labels[lang] || labels.ku;
const developerCopy = {
  ku: { developedBy:'گەشەپێدراوە لەلایەن', contact:'پەیوەندی', whatsapp:'واتساپ' },
  ar: { developedBy:'تطوير', contact:'اتصال', whatsapp:'واتساب' },
  en: { developedBy:'Developed by', contact:'Contact', whatsapp:'WhatsApp' }
};
const developer = { name:'Muhammad Muhsin', phone:'+9647763326510', whatsapp:'https://wa.me/9647763326510' };

function Icon({ name }) { return <span aria-hidden="true">{name}</span>; }
function timeAgo(value, lang) {
  const ts = new Date(value || Date.now()).getTime();
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return lang === 'en' ? `${min}m ago` : lang === 'ar' ? `قبل ${min} دقيقة` : `${min} خولەک لەمەوبەر`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === 'en' ? `${h}h ago` : lang === 'ar' ? `قبل ${h} ساعة` : `${h} کاتژمێر لەمەوبەر`;
  const d = Math.round(h / 24);
  return lang === 'en' ? `${d}d ago` : lang === 'ar' ? `قبل ${d} يوم` : `${d} ڕۆژ لەمەوبەر`;
}
function impactLabel(key, lang){ const dict=t[lang]; return key==='high'?dict.high:key==='medium'?dict.medium:dict.low; }
function sentimentLabel(key, lang){ const dict=t[lang]; return key==='bullish'?dict.bullish:key==='bearish'?dict.bearish:dict.neutral; }
function copyLink(url){ navigator.clipboard?.writeText(url || location.href); }
function translatedTitle(item, lang) { return getTitle(item || {}, lang) || item?.title || ''; }
function translatedSummary(item, lang) { return getSummary(item || {}, lang) || localizeSummary(item || {}, lang); }

function formatPrice(value) {
  if (value === null || value === undefined || value === '?') return '?';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 10) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function changeClass(v) { return Number(v) > 0 ? 'up' : Number(v) < 0 ? 'down' : 'flat'; }
function changeSymbol(v, lang) { const L = tr(lang); return Number(v) > 0 ? `▲ ${L.positive}` : Number(v) < 0 ? `▼ ${L.negative}` : `• ${L.flat}`; }

const localRateText = {
  ku: { local:'بازاڕی ناوخۆ', per100:'بۆ 100 دۆلار', buy:'کڕین', sell:'فرۆشتن', erbil:'هەولێر', baghdad:'بەغدا' },
  ar: { local:'السوق المحلي', per100:'لكل 100 دولار', buy:'شراء', sell:'بيع', erbil:'أربيل', baghdad:'بغداد' },
  en: { local:'Local market', per100:'per 100 USD', buy:'Buy', sell:'Sell', erbil:'Erbil', baghdad:'Baghdad' }
};
function marketSymbol(market) {
  return market?.quoteAmount === 100 ? `${market.symbol} · $100` : market?.symbol;
}
function marketName(market, lang) {
  if (market?.marketKind !== 'local') return market?.name;
  const copy = localRateText[lang] || localRateText.en;
  return `${copy.local} · ${copy.per100}`;
}
function LocalRateDetails({ market, lang }) {
  if (market?.marketKind !== 'local') return null;
  const copy = localRateText[lang] || localRateText.en;
  const rows = [
    [copy.erbil, market.erbil],
    [copy.baghdad, market.baghdad]
  ].filter(([, rate]) => rate?.sell || rate?.buy || rate?.market);
  if (!rows.length) return null;
  return <div className="local-rate-details">
    {rows.map(([place, rate]) => <div key={place}>
      <b>{place}</b>
      {rate.sell && <span>{copy.sell} {formatPrice(rate.sell)}</span>}
      {rate.buy && <span>{copy.buy} {formatPrice(rate.buy)}</span>}
      {!rate.sell && !rate.buy && rate.market && <span>{formatPrice(rate.market)}</span>}
    </div>)}
  </div>;
}

function MarketTicker({ markets, dict }) {
  const list = markets?.length ? markets : [];
  return <div className="market-ticker" aria-label={dict.marketTicker}>
    <div className="market-ticker-track">
      <b>📈 {dict.marketTicker}</b>
      {[...list, ...list].map((m, i) => <span className="market-tick" key={m.symbol + i}>
        <strong>{marketSymbol(m)}</strong> <em>{formatPrice(m.price)}</em> <small className={changeClass(m.changePct)}>{Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</small>
      </span>)}
    </div>
  </div>;
}
function MarketDashboard({ markets, dict, lang }) {
  const visible = markets.slice(0, 8);
  return <section>
    <div className="section-head"><h2>📊 {dict.markets}</h2><span className="muted">60s</span></div>
    <div className="market-grid">
      {visible.map((m, idx) => <div className={`market-card ${changeClass(m.changePct)}`} key={m.symbol}>
        <div className="market-card-top"><b>{marketSymbol(m)}</b><span>{marketName(m, lang)}</span></div>
        <div className="market-price">{formatPrice(m.price)}</div>
        <LocalRateDetails market={m} lang={lang} />
        <div className="market-change"><span>{changeSymbol(m.changePct, lang)} {Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</span><small>{m.source}</small></div>
        <svg className="spark" viewBox="0 0 120 34" preserveAspectRatio="none"><polyline points={sparkPoints(Number(m.changePct), idx)} /></svg>
      </div>)}
    </div>
  </section>;
}
function sparkPoints(change, seed) {
  const points = [];
  for (let i = 0; i < 9; i++) {
    const x = i * 15;
    const drift = change >= 0 ? -i * 1.2 : i * 1.2;
    const wave = Math.sin(i + seed) * 5;
    const y = 21 + drift + wave;
    points.push(`${x},${Math.max(5, Math.min(30, y)).toFixed(1)}`);
  }
  return points.join(' ');
}
function EconomicCalendar({ dict, lang }) {
  const events = [
    ['High', 'FOMC / Fed Speech', 'USD, Gold, Stocks'],
    ['High', 'US CPI / Inflation', 'USD, Gold, BTC'],
    ['Medium', 'OPEC / Oil Inventories', 'Oil, IQD'],
    ['Medium', 'ECB / BOE Updates', 'EUR/USD, GBP/USD'],
    ['Medium', 'Iraq Budget / CBI', 'IQD, Banking']
  ];
  return <section className="panel calendar-panel"><h3>🗓️ {dict.calendarEvents || tr(lang).todayEvents}</h3>{events.map(([impact, title, affected]) => <div className="calendar-row" key={title}><span>{impact}</span><b>{title}</b><small>{affected}</small></div>)}</section>;
}
function Heatmap({ markets, dict }) {
  return <section className="panel"><h3>🔥 {dict.heatmap}</h3><div className="heatmap">{markets.slice(0, 11).map(m => <button className={`heat ${changeClass(m.changePct)}`} key={m.symbol}><b>{marketSymbol(m)}</b><small>{Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</small></button>)}</div></section>;
}
function Watchlist({ markets, dict }) {
  const picks = ['XAU/USD', 'WTI', 'BTC/USD', 'EUR/USD', 'USD/IQD'];
  const rows = picks.map(p => markets.find(m => m.symbol === p)).filter(Boolean);
  return <section className="panel"><h3>⭐ {dict.watchlist}</h3>{rows.map(m => <div className="watch-row" key={m.symbol}><b>{marketSymbol(m)}</b><span>{formatPrice(m.price)}</span><small className={changeClass(m.changePct)}>{Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</small></div>)}</section>;
}

function countAssets(items) {
  const map = new Map();
  items.forEach(item => (item.intelligence?.assets || []).forEach(asset => map.set(asset, (map.get(asset) || 0) + 1)));
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([asset,count])=>({asset,count}));
}
function IntelligenceDashboard({ items, markets, lang, dict, onAsset }) {
  const L = tr(lang);
  const high = items.filter(i => i.intelligence?.impact === 'high');
  const iraq = items.filter(i => i.intelligence?.iraqImpact);
  const bullish = items.filter(i => i.intelligence?.sentiment === 'bullish').length;
  const bearish = items.filter(i => i.intelligence?.sentiment === 'bearish').length;
  const riskLevel = high.length >= 5 ? 'Critical' : high.length >= 2 ? 'Elevated' : 'Normal';
  const sentiment = bullish > bearish ? sentimentLabel('bullish', lang) : bearish > bullish ? sentimentLabel('bearish', lang) : sentimentLabel('neutral', lang);
  const assets = countAssets(items);
  const headline = high[0] || items[0];
  return <section className="ai-command panel">
    <div className="ai-head">
      <div><span className="eyebrow">🧠 AI INTELLIGENCE</span><h2>{dict.intelligence}</h2><p>{L.aiIntro}</p></div>
      <div className="ai-score"><b>{riskLevel}</b><small>{L.riskMode}</small></div>
    </div>
    <div className="ai-grid">
      <div className="ai-metric"><small>{L.marketSentiment}</small><b>{sentiment}</b><span className={bullish>=bearish?'up':'down'}>{bullish} bullish / {bearish} bearish</span></div>
      <div className="ai-metric"><small>{L.highImpact}</small><b>{high.length}</b><span>{L.critical}</span></div>
      <div className="ai-metric"><small>{L.iraqImpact}</small><b>{iraq.length}</b><span>{L.localStories}</span></div>
      <div className="ai-metric"><small>{L.liveAssets}</small><b>{markets.length}</b><span>{L.trackedMarkets}</span></div>
    </div>
    {headline && <div className="ai-brief">
      <h3>⭐ {L.mostImportant}</h3>
      <p>{translatedTitle(headline, lang)}</p>
      <div className="assets">{(headline.intelligence?.assets||[]).map(a=><button className="asset" key={a} onClick={()=>onAsset(a)}>{a}</button>)}</div>
      <small>{headline.intelligence?.why}</small>
    </div>}
    <div className="asset-cloud">
      {assets.map(a => <button key={a.asset} onClick={()=>onAsset(a.asset)}><b>{a.asset}</b><span>{a.count}</span></button>)}
    </div>
  </section>;
}
function AssetIntelligence({ items, markets, lang, onAsset }) {
  const L = tr(lang);
  const assets = countAssets(items);
  return <section><div className="section-head"><h2>💼 {L.assetIntelligence}</h2><span className="muted">{L.aiReady}</span></div><div className="asset-intel-grid">
    {assets.slice(0,6).map(a=>{
      const market = markets.find(m => m.symbol?.includes(a.asset) || m.name?.toLowerCase().includes(a.asset.toLowerCase()));
      const related = items.filter(i => (i.intelligence?.assets||[]).includes(a.asset));
      const high = related.filter(i=>i.intelligence?.impact==='high').length;
      return <button className="asset-intel-card" key={a.asset} onClick={()=>onAsset(a.asset)}>
        <div><b>{a.asset}</b><small>{a.count} {L.relatedStories}</small></div>
        <strong>{market ? formatPrice(market.price) : L.watch}</strong>
        <span className={high?'down':'up'}>{high ? `${high} ${L.highImpactLabel}` : L.normalRisk}</span>
      </button>
    })}
  </div></section>;
}
function AiAssistant({ items, lang }) {
  const L = tr(lang);
  const [q,setQ]=useState('');
  const [answer,setAnswer]=useState('');
  function ask(){
    const query=q.toLowerCase();
    const related=items.filter(i=>`${translatedTitle(i, lang)} ${i.title || ''} ${i.titleEn || ''} ${i.titleKu || ''} ${i.titleAr || ''} ${i.source} ${i.category} ${(i.intelligence?.assets||[]).join(' ')}`.toLowerCase().includes(query.split(' ')[0]||query)).slice(0,3);
    const base=related[0]||items[0];
    setAnswer(`${L.assistantAnswer}\n\n${base ? translatedTitle(base, lang) : ''}\n${base?.intelligence?.why || ''}`);
  }
  return <section className="panel assistant-panel"><h3>🤖 {L.assistant}</h3><div className="assistant-box"><input value={q} onChange={e=>setQ(e.target.value)} placeholder={L.assistantHint} onKeyDown={e=>{if(e.key==='Enter')ask()}}/><button className="btn gold" onClick={ask}>Ask</button></div>{answer && <pre>{answer}</pre>}</section>;
}

function Header({ lang, setLang, theme, setTheme, query, setQuery, dict }) {
  return <header className="topbar">
    <button className="iconbtn mobile-menu"><Icon name="☰" /></button>
    <label className="search"><Icon name="⌕" /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={dict.search} /></label>
    <select className="select" value={lang} onChange={e=>setLang(e.target.value)}>{Object.entries(LANGS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
    <button className="iconbtn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'☀️':'🌙'}</button>
    <button className="iconbtn">↻</button>
  </header>;
}
function Sidebar({ active, setActive, dict, lang }) {
  const names={ all:'📰 '+dict.latest, iraq:'🇮🇶 '+dict.iraq, iran:'🇮🇷 '+dict.iran, geopolitics:'⚠️ '+dict.geopolitics, forex:'💱 '+dict.forex, calendar:'📅 '+dict.calendar, oil:'🛢️ '+dict.oil, stocks:'📈 '+dict.stocks, crypto:'₿ '+dict.crypto, central:'🏦 '+dict.central, intelligence:'🧠 '+dict.intelligence };
  const L = tr(lang);
  return <aside className="sidebar">
    <div className="brand"><div className="logo">HA</div><div><h1>{dict.site}</h1><p>{dict.tagline}</p></div></div>
    <nav className="nav">{nav.map(n=><button key={n} className={active===n?'active':''} onClick={()=>setActive(n)}>{names[n]}</button>)}</nav>
    <div className="panel" style={{marginTop:22}}><h3>{dict.marketStatus}</h3><div className="status-grid"><Status label="Risk" value={L.neutral} /><Status label="USD" value={L.watch} /><Status label="Gold" value={L.active} /><Status label="Oil" value={L.sensitive} /></div></div>
  </aside>;
}
function Status({ label, value }){return <div className="status"><small>{label}</small><b>{value}</b></div>;}
function Ticker({ items, lang, dict }) {
  const top = items.filter(i=>i.intelligence?.impact==='high').slice(0,8);
  const list = top.length ? top : items.slice(0,8);
  return <div className="ticker"><div className="ticker-track"><b>⚡ {dict.breaking}</b>{[...list,...list].map((i,idx)=><span key={idx}> • {translatedTitle(i, lang)}</span>)}</div></div>;
}
function Hero({ item, lang, dict, onOpen }) {
  if (!item) return <div className="hero skeleton" />;
  const intel = item.intelligence || analyzeArticle(item);
  return <article className="hero" onClick={()=>onOpen(item)}>
    <img src={item.image} alt="" /><div className="shade" />
    <div className="hero-content">
      <div className="meta"><span className={`badge ${intel.impact}`}>{dict.impact}: {impactLabel(intel.impact, lang)}</span><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h2>{translatedTitle(item, lang)}</h2>
      <p className="summary">{translatedSummary(item, lang)}</p>
      <div className="assets">{intel.assets.map(a=><span className="asset" key={a}>{a}</span>)}{intel.iraqImpact && <span className="asset">🇮🇶 {dict.iraqImpact}</span>}</div>
      <div className="actions"><button className="btn gold">{dict.open}</button><button className="btn">{dict.why}</button></div>
    </div>
  </article>;
}
function IntelligencePanel({ items, lang, dict }) {
  const high = items.filter(i=>i.intelligence?.impact==='high').length;
  const iraq = items.filter(i=>i.intelligence?.iraqImpact).length;
  const bearish = items.filter(i=>i.intelligence?.sentiment==='bearish').length;
  const bullish = items.filter(i=>i.intelligence?.sentiment==='bullish').length;
  return <div className="side-stack">
    <section className="panel"><h3>🧠 {dict.intelligence}</h3><div className="status-grid"><Status label={dict.impact} value={`${high} ${dict.high}`} /><Status label={dict.iraqImpact} value={iraq} /><Status label={dict.sentiment} value={bullish>=bearish?sentimentLabel('bullish',lang):sentimentLabel('bearish',lang)} /><Status label={dict.risk} value={high>3?dict.high:dict.medium} /></div></section>
    <section className="panel"><h3>⚠️ {dict.highImpactToday}</h3>{items.filter(i=>i.intelligence?.impact==='high').slice(0,4).map(i=><div key={i.id} style={{padding:'10px 0',borderBottom:'1px solid var(--line)'}}><b style={{fontSize:13}}>{translatedTitle(i, lang)}</b><div className="meta"><span>{i.source}</span><span>{timeAgo(i.publishedAt,lang)}</span></div></div>)}</section>
  </div>;
}
function NewsCard({ item, lang, dict, onOpen, onAsset }) {
  const intel = item.intelligence || analyzeArticle(item);
  return <article className="card">
    <div className="thumb" onClick={()=>onOpen(item)}><img src={item.image} alt="" loading="lazy" /></div>
    <div className="card-body">
      <div className="meta"><span className={`badge ${intel.impact}`}>{impactLabel(intel.impact, lang)}</span><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h3 onClick={()=>onOpen(item)}>{translatedTitle(item, lang)}</h3>
      <p className="summary">{translatedSummary(item, lang)}</p>
      <div className="assets">{intel.assets.slice(0,4).map(a=><button className="asset" key={a} onClick={()=>onAsset(a)}>{a}</button>)}</div>
      <div className="actions"><button className="btn gold" onClick={()=>onOpen(item)}>{dict.open}</button><a className="btn" href={item.link} target="_blank" rel="noreferrer">{dict.original}</a><button className="btn" onClick={()=>copyLink(item.link)}>{dict.share}</button><button className="btn">☆</button></div>
    </div>
  </article>;
}
function IraqWidget({ dict, lang }) {
  const L = tr(lang);
  const cards=[['CBI','USD/IQD & banking'],[L.oil,'Exports and revenue'],['Budget','Government spending'],['Banking','Payments and cards'],['Risk','Regional headlines']];
  return <section><div className="section-head"><h2>🇮🇶 {dict.iraq}</h2></div><div className="iraq-grid">{cards.map(([a,b])=><div className="iraq-card" key={a}><b>{a}</b><span>{b}</span></div>)}</div></section>;
}
function ArticleModal({ item, lang, dict, onClose }) {
  if (!item) return null;
  const intel = item.intelligence || analyzeArticle(item);
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="modal-img"><img src={item.image} alt="" /></div>
    <div className="modal-content"><button className="btn close" onClick={onClose}>×</button><div className="meta"><span className={`badge ${intel.impact}`}>{dict.impact}: {impactLabel(intel.impact, lang)}</span><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span><span>{dict.sentiment}: {sentimentLabel(intel.sentiment,lang)}</span></div><h2 style={{fontSize:34,lineHeight:1.35}}>{translatedTitle(item, lang)}</h2><p className="summary">{translatedSummary(item, lang)}</p><h3>{dict.why}</h3><p className="summary">{intel.why}</p><h3>{dict.affected}</h3><div className="assets">{intel.assets.map(a=><span className="asset" key={a}>{a}</span>)}{intel.iraqImpact && <span className="asset">🇮🇶 {dict.iraqImpact}</span>}</div><div className="actions"><a className="btn gold" href={item.link} target="_blank" rel="noreferrer">{dict.original}</a><button className="btn" onClick={()=>copyLink(item.link)}>{dict.share}</button><button className="btn">☆ {dict.save}</button></div></div>
  </div></div>;
}

function SourcesDisclosure() {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const lang = localStorage.getItem('lang') || 'ku';
  const L = tr(lang);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sources')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Sources unavailable')))
      .then(data => { if (!cancelled && Array.isArray(data.sources)) setSources(data.sources.filter(Boolean)); })
      .catch(() => { if (!cancelled) setSources([]); });
    return () => { cancelled = true; };
  }, []);

  const countLabel = sources.length ? String(sources.length) : '...';
  return <aside className={`sources-corner ${open ? 'is-open' : ''}`} aria-label="News sources and attribution">
    {open && <div className="sources-panel" role="dialog" aria-label="All news sources">
      <div className="sources-head">
        <div><strong>{L.allSources}</strong><small>{sources.length ? `${sources.length} ${t[lang]?.sources || 'sources'}` : L.loadingSources}</small></div>
        <button type="button" onClick={() => setOpen(false)} aria-label={L.close}>×</button>
      </div>
      <p className="sources-note">{L.sourceNote}</p>
      <p className="sources-note compact">{L.contactNote} <a href={`tel:${developer.phone}`} dir="ltr">{developer.phone}</a></p>
      <div className="sources-list" aria-label="Source names">
        {sources.length ? sources.map(source => <span key={source}>{source}</span>) : <span>{L.loadingSources}...</span>}
      </div>
    </div>}
    <button className="sources-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span>Sources</span><b>{countLabel}</b>
    </button>
  </aside>;
}

function SiteFooter({ lang }) {
  const copy = developerCopy[lang] || developerCopy.en;
  return <footer className="site-footer">
    <div className="developer-credit"><span>{copy.developedBy}</span><strong>{developer.name}</strong></div>
    <div className="developer-contact">
      <a href={`tel:${developer.phone}`} aria-label={`${copy.contact} ${developer.phone}`} dir="ltr">☎ {developer.phone}</a>
      <a href={developer.whatsapp} target="_blank" rel="noreferrer">{copy.whatsapp} ↗</a>
    </div>
  </footer>;
}

function App(){
  const [lang,setLang]=useState(localStorage.getItem('lang')||'ku');
  const [theme,setTheme]=useState(localStorage.getItem('theme')||'dark');
  const [active,setActive]=useState('all');
  const [query,setQuery]=useState('');
  const [news,setNews]=useState(getInitialNews);
  const [markets,setMarkets]=useState([]);
  const [selected,setSelected]=useState(null);
  const dict=t[lang] || t.ku;
  const { translatedNews, translating } = useClientTranslator(news, lang);
  const displayNews = translatedNews.length ? translatedNews : news;
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=LANGS[lang].dir;document.documentElement.dataset.theme=theme;localStorage.setItem('lang',lang);localStorage.setItem('theme',theme)},[lang,theme]);
  useEffect(()=>{let alive=true; const update=items=>{if(alive)setNews(items)}; const load=()=>fetchNews(update).then(update); load(); const id=setInterval(load,300000); return()=>{alive=false;clearInterval(id)}},[]);
  useEffect(()=>{let alive=true; const load=()=>fetchMarkets().then(items=>alive&&setMarkets(items)); load(); const id=setInterval(load,60000); return()=>{alive=false;clearInterval(id)}},[]);
  const filtered=useMemo(()=>displayNews.filter(i=>{const q=query.trim().toLowerCase(); const text=`${i.title || ''} ${i.titleEn || ''} ${i.titleKu || ''} ${i.titleAr || ''} ${i.summary || ''} ${i.summaryEn || ''} ${i.summaryKu || ''} ${i.summaryAr || ''} ${i.source} ${i.sourceGroup || ''} ${i.category} ${i.intelligence?.assets?.join(' ')}`.toLowerCase(); const activeOk=active==='all'||text.includes(active)||i.category?.toLowerCase().includes(active); return (!q||text.includes(q))&&activeOk;}),[displayNews,query,active]);
  const hero=filtered[0]||displayNews[0];
  const rest=filtered.filter(i=>i.id!==hero?.id);
  return <div className="app"><Sidebar active={active} setActive={setActive} dict={dict} lang={lang}/><main className="main"><Header lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} query={query} setQuery={setQuery} dict={dict}/><MarketTicker markets={markets} dict={dict}/><Ticker items={displayNews} lang={lang} dict={dict}/><section className="hero-grid"><Hero item={hero} lang={lang} dict={dict} onOpen={setSelected}/><div className="side-stack"><IntelligencePanel items={displayNews} lang={lang} dict={dict}/><Watchlist markets={markets} dict={dict}/></div></section><MarketDashboard markets={markets} dict={dict} lang={lang}/><section className="dash-two"><EconomicCalendar dict={dict} lang={lang}/><Heatmap markets={markets} dict={dict}/></section><IntelligenceDashboard items={displayNews} markets={markets} lang={lang} dict={dict} onAsset={(a)=>{setQuery(a);setActive('all')}}/><AssetIntelligence items={displayNews} markets={markets} lang={lang} onAsset={(a)=>{setQuery(a);setActive('all')}}/><IraqWidget dict={dict} lang={lang}/><AiAssistant items={displayNews} lang={lang}/><div className="section-head"><h2>{dict.latest}</h2>{translating && <span className="muted">{tr(lang).translating}</span>}<div className="filters">{nav.filter(n=>n!=='intelligence').map(n=><button key={n} className={active===n?'active':''} onClick={()=>setActive(n)}>{categoryMap[lang]?.[n]||n}</button>)}</div></div>{filtered.length===0?<div className="panel">{dict.noResults}</div>:<div className="news-grid">{rest.map(item=><NewsCard key={item.id} item={item} lang={lang} dict={dict} onOpen={setSelected} onAsset={(a)=>{setQuery(a);setActive('all')}} />)}</div>}<SiteFooter lang={lang}/><ArticleModal item={selected} lang={lang} dict={dict} onClose={()=>setSelected(null)}/></main></div>;
}

createRoot(document.getElementById('root')).render(<><App/><SourcesDisclosure /></>);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations?.().then(registrations => registrations.forEach(registration => registration.unregister())).catch(() => {});
      window.caches?.keys?.().then(keys => Promise.all(keys.filter(key => key.startsWith('hawali-aburi')).map(key => caches.delete(key)))).catch(() => {});
      return;
    }
    navigator.serviceWorker.register('/sw.js?v=20260715-developer-contact').catch(() => {});
  });
}

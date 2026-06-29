import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { fetchNews } from './services/news.js';
import { fetchMarkets } from './services/markets.js';
import { LANGS, t } from './utils/i18n.js';
import { analyzeArticle, localizeSummary } from './utils/intelligence.js';

const nav = ['all','iraq','forex','calendar','oil','stocks','crypto','central','geopolitics','intelligence'];
const categoryMap = {
  all: 'هەموو', iraq: 'عێراق', forex: 'فۆرێکس', calendar: 'ڕۆژنامە', oil: 'نەوت', stocks: 'پشک', crypto: 'کریپتۆ', central: 'بانک', geopolitics: 'جیوپۆلیتیک', intelligence: 'AI'
};

function Icon({ name }) { return <span aria-hidden="true">{name}</span>; }
function timeAgo(value, lang) {
  const ts = new Date(value || Date.now()).getTime();
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return lang === 'en' ? `${min}m ago` : lang === 'ar' ? `قبل ${min} د` : `${min} خولەک پێش ئێستا`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === 'en' ? `${h}h ago` : lang === 'ar' ? `قبل ${h} س` : `${h} کاتژمێر پێش ئێستا`;
  const d = Math.round(h / 24);
  return lang === 'en' ? `${d}d ago` : lang === 'ar' ? `قبل ${d} يوم` : `${d} ڕۆژ پێش ئێستا`;
}
function impactLabel(key, lang){ const dict=t[lang]; return key==='high'?dict.high:key==='medium'?dict.medium:dict.low; }
function sentimentLabel(key, lang){ const dict=t[lang]; return key==='bullish'?dict.bullish:key==='bearish'?dict.bearish:dict.neutral; }
function copyLink(url){ navigator.clipboard?.writeText(url || location.href); }

function formatPrice(value) {
  if (value === null || value === undefined || value === '—') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 10) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function changeClass(v) { return Number(v) > 0 ? 'up' : Number(v) < 0 ? 'down' : 'flat'; }
function MarketTicker({ markets, dict }) {
  const list = markets?.length ? markets : [];
  return <div className="market-ticker" aria-label={dict.marketTicker}>
    <div className="market-ticker-track">
      <b>📈 {dict.marketTicker}</b>
      {[...list, ...list].map((m, i) => <span className="market-tick" key={m.symbol + i}>
        <strong>{m.symbol}</strong> <em>{formatPrice(m.price)}</em> <small className={changeClass(m.changePct)}>{Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</small>
      </span>)}
    </div>
  </div>;
}
function MarketDashboard({ markets, dict }) {
  const visible = markets.slice(0, 8);
  return <section>
    <div className="section-head"><h2>📊 {dict.markets}</h2><span className="muted">60s</span></div>
    <div className="market-grid">
      {visible.map((m, idx) => <div className={`market-card ${changeClass(m.changePct)}`} key={m.symbol}>
        <div className="market-card-top"><b>{m.symbol}</b><span>{m.name}</span></div>
        <div className="market-price">{formatPrice(m.price)}</div>
        <div className="market-change"><span>{Number(m.changePct) > 0 ? '▲' : Number(m.changePct) < 0 ? '▼' : '◆'} {Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</span><small>{m.source}</small></div>
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
function EconomicCalendar({ dict }) {
  const events = [
    ['🔴', 'FOMC / Fed Speech', 'USD, Gold, Stocks'],
    ['🔴', 'US CPI / Inflation', 'USD, Gold, BTC'],
    ['🟠', 'OPEC / Oil Inventories', 'Oil, IQD'],
    ['🟠', 'ECB / BOE Updates', 'EUR/USD, GBP/USD'],
    ['🟡', 'Iraq Budget / CBI', 'IQD, Banking']
  ];
  return <section className="panel calendar-panel"><h3>📅 {dict.calendarEvents}</h3>{events.map(([impact, title, affected]) => <div className="calendar-row" key={title}><span>{impact}</span><b>{title}</b><small>{affected}</small></div>)}</section>;
}
function Heatmap({ markets, dict }) {
  return <section className="panel"><h3>🧭 {dict.heatmap}</h3><div className="heatmap">{markets.slice(0, 11).map(m => <button className={`heat ${changeClass(m.changePct)}`} key={m.symbol}><b>{m.symbol}</b><small>{Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</small></button>)}</div></section>;
}
function Watchlist({ markets, dict }) {
  const picks = ['XAU/USD', 'WTI', 'BTC/USD', 'EUR/USD', 'USD/IQD'];
  const rows = picks.map(p => markets.find(m => m.symbol === p)).filter(Boolean);
  return <section className="panel"><h3>⭐ {dict.watchlist}</h3>{rows.map(m => <div className="watch-row" key={m.symbol}><b>{m.symbol}</b><span>{formatPrice(m.price)}</span><small className={changeClass(m.changePct)}>{Number(m.changePct) > 0 ? '+' : ''}{m.changePct ?? 0}%</small></div>)}</section>;
}



function countAssets(items) {
  const map = new Map();
  items.forEach(item => (item.intelligence?.assets || []).forEach(asset => map.set(asset, (map.get(asset) || 0) + 1)));
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([asset,count])=>({asset,count}));
}
function IntelligenceDashboard({ items, markets, lang, dict, onAsset }) {
  const high = items.filter(i => i.intelligence?.impact === 'high');
  const iraq = items.filter(i => i.intelligence?.iraqImpact);
  const bullish = items.filter(i => i.intelligence?.sentiment === 'bullish').length;
  const bearish = items.filter(i => i.intelligence?.sentiment === 'bearish').length;
  const riskLevel = high.length >= 5 ? 'Critical' : high.length >= 2 ? 'Elevated' : 'Normal';
  const sentiment = bullish > bearish ? 'Bullish' : bearish > bullish ? 'Bearish' : 'Neutral';
  const assets = countAssets(items);
  const headline = high[0] || items[0];
  return <section className="ai-command panel">
    <div className="ai-head">
      <div><span className="eyebrow">🤖 AI INTELLIGENCE</span><h2>{dict.intelligence}</h2><p>{lang==='ku'?'زیرەکی بازاڕ بە شێوەی rule-based؛ کاتێک API key زیاد بکەیت دەبێتە AI ڕاستەقینە.':lang==='ar'?'تحليل ذكي مبدئي؛ عند إضافة مفتاح API سيتحول إلى ذكاء اصطناعي حقيقي.':'AI-ready rule-based intelligence. Add an API key later to enable real AI.'}</p></div>
      <div className="ai-score"><b>{riskLevel}</b><small>Risk Mode</small></div>
    </div>
    <div className="ai-grid">
      <div className="ai-metric"><small>Market Sentiment</small><b>{sentiment}</b><span className={bullish>=bearish?'up':'down'}>{bullish} bullish / {bearish} bearish</span></div>
      <div className="ai-metric"><small>High Impact</small><b>{high.length}</b><span>critical headlines</span></div>
      <div className="ai-metric"><small>Iraq Impact</small><b>{iraq.length}</b><span>local economy stories</span></div>
      <div className="ai-metric"><small>Live Assets</small><b>{markets.length}</b><span>tracked markets</span></div>
    </div>
    {headline && <div className="ai-brief">
      <h3>🔥 {lang==='ku'?'گرنگترین شت لە ئێستادا':lang==='ar'?'الأهم الآن':'Most important now'}</h3>
      <p>{headline.title}</p>
      <div className="assets">{(headline.intelligence?.assets||[]).map(a=><button className="asset" key={a} onClick={()=>onAsset(a)}>{a}</button>)}</div>
      <small>{headline.intelligence?.why}</small>
    </div>}
    <div className="asset-cloud">
      {assets.map(a => <button key={a.asset} onClick={()=>onAsset(a.asset)}><b>{a.asset}</b><span>{a.count}</span></button>)}
    </div>
  </section>;
}
function AssetIntelligence({ items, markets, dict, onAsset }) {
  const assets = countAssets(items);
  return <section><div className="section-head"><h2>🧠 Asset Intelligence</h2><span className="muted">AI-ready</span></div><div className="asset-intel-grid">
    {assets.slice(0,6).map(a=>{
      const market = markets.find(m => m.symbol?.includes(a.asset) || m.name?.toLowerCase().includes(a.asset.toLowerCase()));
      const related = items.filter(i => (i.intelligence?.assets||[]).includes(a.asset));
      const high = related.filter(i=>i.intelligence?.impact==='high').length;
      return <button className="asset-intel-card" key={a.asset} onClick={()=>onAsset(a.asset)}>
        <div><b>{a.asset}</b><small>{a.count} related stories</small></div>
        <strong>{market ? formatPrice(market.price) : 'Watch'}</strong>
        <span className={high?'down':'up'}>{high ? `${high} high impact` : 'normal risk'}</span>
      </button>
    })}
  </div></section>
}
function AiAssistant({ items, lang }) {
  const [q,setQ]=useState('');
  const [answer,setAnswer]=useState('');
  function ask(){
    const query=q.toLowerCase();
    const related=items.filter(i=>`${i.title} ${i.source} ${i.category} ${(i.intelligence?.assets||[]).join(' ')}`.toLowerCase().includes(query.split(' ')[0]||query)).slice(0,3);
    const base=related[0]||items[0];
    const ku='ئەم وەڵامە بە شێوەی rule-based دروستکراوە. بۆ AI ڕاستەقینە پێویستە API key زیاد بکرێت.';
    const ar='هذه إجابة rule-based مؤقتة. لتفعيل الذكاء الاصطناعي الحقيقي أضف API key لاحقاً.';
    const en='This is a rule-based assistant answer. Add an API key later for real AI responses.';
    setAnswer(`${lang==='ku'?ku:lang==='ar'?ar:en}\n\n${base ? base.title : ''}\n${base?.intelligence?.why || ''}`);
  }
  return <section className="panel assistant-panel"><h3>💬 AI Market Assistant</h3><div className="assistant-box"><input value={q} onChange={e=>setQ(e.target.value)} placeholder={lang==='ku'?'بپرسە: بۆچی زێڕ دەجوڵێت؟':lang==='ar'?'اسأل: لماذا يتحرك الذهب؟':'Ask: why is gold moving?'} onKeyDown={e=>{if(e.key==='Enter')ask()}}/><button className="btn gold" onClick={ask}>Ask</button></div>{answer && <pre>{answer}</pre>}</section>
}

function Header({ lang, setLang, theme, setTheme, query, setQuery, dict }) {
  return <header className="topbar">
    <button className="iconbtn mobile-menu"><Icon name="☰" /></button>
    <label className="search"><Icon name="⌕" /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={dict.search} /></label>
    <select className="select" value={lang} onChange={e=>setLang(e.target.value)}>{Object.entries(LANGS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
    <button className="iconbtn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'☀️':'🌙'}</button>
    <button className="iconbtn">🔔</button>
  </header>
}
function Sidebar({ active, setActive, dict }) {
  const names={ all:'🏠 '+dict.latest, iraq:'🇮🇶 '+dict.iraq, forex:'💱 '+dict.forex, calendar:'📅 '+dict.calendar, oil:'🛢 '+dict.oil, stocks:'📈 '+dict.stocks, crypto:'₿ '+dict.crypto, central:'🏦 '+dict.central, geopolitics:'⚔️ '+dict.geopolitics, intelligence:'🤖 '+dict.intelligence };
  return <aside className="sidebar">
    <div className="brand"><div className="logo">HA</div><div><h1>{dict.site}</h1><p>{dict.tagline}</p></div></div>
    <nav className="nav">{nav.map(n=><button key={n} className={active===n?'active':''} onClick={()=>setActive(n)}>{names[n]}</button>)}</nav>
    <div className="panel" style={{marginTop:22}}><h3>{dict.marketStatus}</h3><div className="status-grid"><Status label="Risk" value="Neutral" /><Status label="USD" value="Watch" /><Status label="Gold" value="Active" /><Status label="Oil" value="Sensitive" /></div></div>
  </aside>
}
function Status({ label, value }){return <div className="status"><small>{label}</small><b>{value}</b></div>}
function Ticker({ items, dict }) {
  const top = items.filter(i=>i.intelligence?.impact==='high').slice(0,8);
  const list = top.length ? top : items.slice(0,8);
  return <div className="ticker"><div className="ticker-track"><b>● {dict.breaking}</b>{[...list,...list].map((i,idx)=><span key={idx}> — {i.title}</span>)}</div></div>
}
function Hero({ item, lang, dict, onOpen }) {
  if (!item) return <div className="hero skeleton" />;
  const intel = item.intelligence || analyzeArticle(item);
  return <article className="hero" onClick={()=>onOpen(item)}>
    <img src={item.image} alt="" /><div className="shade" />
    <div className="hero-content">
      <div className="meta"><span className={`badge ${intel.impact}`}>{dict.impact}: {impactLabel(intel.impact, lang)}</span><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h2>{item.title}</h2>
      <p className="summary">{localizeSummary(item, lang)}</p>
      <div className="assets">{intel.assets.map(a=><span className="asset" key={a}>{a}</span>)}{intel.iraqImpact && <span className="asset">🇮🇶 {dict.iraqImpact}</span>}</div>
      <div className="actions"><button className="btn gold">{dict.open}</button><button className="btn">{dict.why}</button></div>
    </div>
  </article>
}
function IntelligencePanel({ items, lang, dict }) {
  const high = items.filter(i=>i.intelligence?.impact==='high').length;
  const iraq = items.filter(i=>i.intelligence?.iraqImpact).length;
  const bearish = items.filter(i=>i.intelligence?.sentiment==='bearish').length;
  const bullish = items.filter(i=>i.intelligence?.sentiment==='bullish').length;
  return <div className="side-stack">
    <section className="panel"><h3>🤖 {dict.intelligence}</h3><div className="status-grid"><Status label={dict.impact} value={`${high} ${dict.high}`} /><Status label={dict.iraqImpact} value={iraq} /><Status label={dict.sentiment} value={bullish>=bearish?sentimentLabel('bullish',lang):sentimentLabel('bearish',lang)} /><Status label={dict.risk} value={high>3?dict.high:dict.medium} /></div></section>
    <section className="panel"><h3>⚠️ {dict.highImpactToday}</h3>{items.filter(i=>i.intelligence?.impact==='high').slice(0,4).map(i=><div key={i.id} style={{padding:'10px 0',borderBottom:'1px solid var(--line)'}}><b style={{fontSize:13}}>{i.title}</b><div className="meta"><span>{i.source}</span><span>{timeAgo(i.publishedAt,lang)}</span></div></div>)}</section>
  </div>
}
function NewsCard({ item, lang, dict, onOpen, onAsset }) {
  const intel = item.intelligence || analyzeArticle(item);
  return <article className="card">
    <div className="thumb" onClick={()=>onOpen(item)}><img src={item.image} alt="" loading="lazy" /></div>
    <div className="card-body">
      <div className="meta"><span className={`badge ${intel.impact}`}>{impactLabel(intel.impact, lang)}</span><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h3 onClick={()=>onOpen(item)}>{item.title}</h3>
      <p className="summary">{localizeSummary(item, lang)}</p>
      <div className="assets">{intel.assets.slice(0,4).map(a=><button className="asset" key={a} onClick={()=>onAsset(a)}>{a}</button>)}</div>
      <div className="actions"><button className="btn gold" onClick={()=>onOpen(item)}>{dict.open}</button><a className="btn" href={item.link} target="_blank" rel="noreferrer">{dict.original}</a><button className="btn" onClick={()=>copyLink(item.link)}>{dict.share}</button><button className="btn">⭐</button></div>
    </div>
  </article>
}
function IraqWidget({ dict }) {
  const cards=[['CBI','USD/IQD & banking'],['Oil','Exports and revenue'],['Budget','Government spending'],['Banking','Payments and cards'],['Risk','Regional headlines']];
  return <section><div className="section-head"><h2>🇮🇶 {dict.iraq}</h2></div><div className="iraq-grid">{cards.map(([a,b])=><div className="iraq-card" key={a}><b>{a}</b><span>{b}</span></div>)}</div></section>
}
function ArticleModal({ item, lang, dict, onClose }) {
  if (!item) return null;
  const intel = item.intelligence || analyzeArticle(item);
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="modal-img"><img src={item.image} alt="" /></div>
    <div className="modal-content"><button className="btn close" onClick={onClose}>✕</button><div className="meta"><span className={`badge ${intel.impact}`}>{dict.impact}: {impactLabel(intel.impact, lang)}</span><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span><span>{dict.sentiment}: {sentimentLabel(intel.sentiment,lang)}</span></div><h2 style={{fontSize:34,lineHeight:1.35}}>{item.title}</h2><p className="summary">{localizeSummary(item, lang)}</p><h3>{dict.why}</h3><p className="summary">{intel.why}</p><h3>{dict.affected}</h3><div className="assets">{intel.assets.map(a=><span className="asset" key={a}>{a}</span>)}{intel.iraqImpact && <span className="asset">🇮🇶 {dict.iraqImpact}</span>}</div><div className="actions"><a className="btn gold" href={item.link} target="_blank" rel="noreferrer">{dict.original}</a><button className="btn" onClick={()=>copyLink(item.link)}>{dict.share}</button><button className="btn">⭐ {dict.save}</button></div></div>
  </div></div>
}
function App(){
  const [lang,setLang]=useState(localStorage.getItem('lang')||'ku');
  const [theme,setTheme]=useState(localStorage.getItem('theme')||'dark');
  const [active,setActive]=useState('all');
  const [query,setQuery]=useState('');
  const [news,setNews]=useState([]);
  const [markets,setMarkets]=useState([]);
  const [selected,setSelected]=useState(null);
  const dict=t[lang];
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=LANGS[lang].dir;document.documentElement.dataset.theme=theme;localStorage.setItem('lang',lang);localStorage.setItem('theme',theme)},[lang,theme]);
  useEffect(()=>{let alive=true; const load=()=>fetchNews().then(items=>alive&&setNews(items)); load(); const id=setInterval(load,60000); return()=>{alive=false;clearInterval(id)}},[]);
  useEffect(()=>{let alive=true; const load=()=>fetchMarkets().then(items=>alive&&setMarkets(items)); load(); const id=setInterval(load,60000); return()=>{alive=false;clearInterval(id)}},[]);
  const filtered=useMemo(()=>news.filter(i=>{const q=query.toLowerCase(); const text=`${i.title} ${i.source} ${i.category} ${i.intelligence?.assets?.join(' ')}`.toLowerCase(); const activeOk=active==='all'||text.includes(active)||i.category?.toLowerCase().includes(active); return (!q||text.includes(q))&&activeOk;}),[news,query,active]);
  const hero=filtered[0]||news[0];
  const rest=filtered.filter(i=>i.id!==hero?.id);
  return <div className="app"><Sidebar active={active} setActive={setActive} dict={dict}/><main className="main"><Header lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} query={query} setQuery={setQuery} dict={dict}/><MarketTicker markets={markets} dict={dict}/><Ticker items={news} dict={dict}/><section className="hero-grid"><Hero item={hero} lang={lang} dict={dict} onOpen={setSelected}/><div className="side-stack"><IntelligencePanel items={news} lang={lang} dict={dict}/><Watchlist markets={markets} dict={dict}/></div></section><MarketDashboard markets={markets} dict={dict}/><section className="dash-two"><EconomicCalendar dict={dict}/><Heatmap markets={markets} dict={dict}/></section><IntelligenceDashboard items={news} markets={markets} lang={lang} dict={dict} onAsset={(a)=>{setQuery(a);setActive('all')}}/><AssetIntelligence items={news} markets={markets} dict={dict} onAsset={(a)=>{setQuery(a);setActive('all')}}/><IraqWidget dict={dict}/><AiAssistant items={news} lang={lang}/><div className="section-head"><h2>{dict.latest}</h2><div className="filters">{nav.slice(0,8).map(n=><button key={n} className={active===n?'active':''} onClick={()=>setActive(n)}>{categoryMap[n]||n}</button>)}</div></div>{filtered.length===0?<div className="panel">{dict.noResults}</div>:<div className="news-grid">{rest.map(item=><NewsCard key={item.id} item={item} lang={lang} dict={dict} onOpen={setSelected} onAsset={(a)=>{setQuery(a);setActive('all')}} />)}</div>}<div style={{height:40}}/><ArticleModal item={selected} lang={lang} dict={dict} onClose={()=>setSelected(null)}/></main></div>
}

createRoot(document.getElementById('root')).render(<App/>);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

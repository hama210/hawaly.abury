import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { fetchNews } from './services/news.js';
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
  const [selected,setSelected]=useState(null);
  const dict=t[lang];
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=LANGS[lang].dir;document.documentElement.dataset.theme=theme;localStorage.setItem('lang',lang);localStorage.setItem('theme',theme)},[lang,theme]);
  useEffect(()=>{let alive=true; const load=()=>fetchNews().then(items=>alive&&setNews(items)); load(); const id=setInterval(load,60000); return()=>{alive=false;clearInterval(id)}},[]);
  const filtered=useMemo(()=>news.filter(i=>{const q=query.toLowerCase(); const text=`${i.title} ${i.source} ${i.category} ${i.intelligence?.assets?.join(' ')}`.toLowerCase(); const activeOk=active==='all'||text.includes(active)||i.category?.toLowerCase().includes(active); return (!q||text.includes(q))&&activeOk;}),[news,query,active]);
  const hero=filtered[0]||news[0];
  const rest=filtered.filter(i=>i.id!==hero?.id);
  return <div className="app"><Sidebar active={active} setActive={setActive} dict={dict}/><main className="main"><Header lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} query={query} setQuery={setQuery} dict={dict}/><Ticker items={news} dict={dict}/><section className="hero-grid"><Hero item={hero} lang={lang} dict={dict} onOpen={setSelected}/><IntelligencePanel items={news} lang={lang} dict={dict}/></section><IraqWidget dict={dict}/><div className="section-head"><h2>{dict.latest}</h2><div className="filters">{nav.slice(0,8).map(n=><button key={n} className={active===n?'active':''} onClick={()=>setActive(n)}>{categoryMap[n]||n}</button>)}</div></div>{filtered.length===0?<div className="panel">{dict.noResults}</div>:<div className="news-grid">{rest.map(item=><NewsCard key={item.id} item={item} lang={lang} dict={dict} onOpen={setSelected} onAsset={(a)=>{setQuery(a);setActive('all')}} />)}</div>}<div style={{height:40}}/><ArticleModal item={selected} lang={lang} dict={dict} onClose={()=>setSelected(null)}/></main></div>
}

createRoot(document.getElementById('root')).render(<App/>);

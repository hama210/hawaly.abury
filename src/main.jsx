import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Search, Globe2, RefreshCcw, Flame, BarChart3, CalendarDays, Share2, Bookmark, ExternalLink, Newspaper, ShieldAlert, Fuel, Bitcoin, Building2, Landmark } from 'lucide-react'
import './styles.css'

const translations = {
  ku: { name:'هەواڵی ئابوری', tagline:'سەکۆی هەواڵ و زیرەکی بازاڕ', search:'گەڕان لە هەواڵەکان...', breaking:'هەواڵی گەرم', latest:'دوایین هەواڵ', highImpact:'کاریگەری بەرز', calendar:'ڕۆژژمێری ئابوری', iraq:'عێراق', forex:'فۆرێکس', oil:'نەوت و وزە', crypto:'کریپتۆ', stocks:'بازاڕی پشکەکان', geopolitics:'جیوپۆلیتیک', banks:'بانکە ناوەندییەکان', ai:'زیرەکی بازاڕ', sources:'سەرچاوەکان', read:'سەرچاوە', saved:'هەڵگرتن', share:'هاوبەشکردن', impact:'کاریگەری', markets:'بازاڕە کاریگەرەکان', updated:'نوێکرایەوە', all:'هەموو', loading:'هەواڵەکان دێن...', noNews:'هیچ هەواڵێک نەدۆزرایەوە' },
  ar: { name:'أخبار الاقتصاد', tagline:'منصة أخبار وذكاء الأسواق', search:'ابحث في الأخبار...', breaking:'أخبار عاجلة', latest:'آخر الأخبار', highImpact:'تأثير عالٍ', calendar:'التقويم الاقتصادي', iraq:'العراق', forex:'الفوركس', oil:'النفط والطاقة', crypto:'العملات الرقمية', stocks:'الأسهم', geopolitics:'الجغرافيا السياسية', banks:'البنوك المركزية', ai:'ذكاء السوق', sources:'المصادر', read:'المصدر', saved:'حفظ', share:'مشاركة', impact:'التأثير', markets:'الأسواق المتأثرة', updated:'آخر تحديث', all:'الكل', loading:'جاري تحميل الأخبار...', noNews:'لا توجد أخبار' },
  en: { name:'Economic News', tagline:'Market news and intelligence platform', search:'Search news...', breaking:'Breaking News', latest:'Latest News', highImpact:'High Impact', calendar:'Economic Calendar', iraq:'Iraq', forex:'Forex', oil:'Oil & Energy', crypto:'Crypto', stocks:'Stocks', geopolitics:'Geopolitics', banks:'Central Banks', ai:'Market Intelligence', sources:'Sources', read:'Source', saved:'Save', share:'Share', impact:'Impact', markets:'Affected markets', updated:'Updated', all:'All', loading:'Loading live news...', noNews:'No news found' }
}
const categories = ['iraq','forex','oil','crypto','stocks','geopolitics','banks']
const fallback = [{ id:'local1', source:'Market Monitor', category:'banks', impact:'High', titleKu:'بانکە ناوەندییەکان و داتای تورم کاریگەری لە بازاڕەکان دەکەن', titleAr:'البنوك المركزية وبيانات التضخم تؤثر في الأسواق', titleEn:'Central banks and inflation data drive markets', summaryKu:'هەواڵەکانی سوود و تورم دەتوانن کاریگەری لەسەر دۆلار، زێڕ و فۆرێکس هەبێت.', summaryAr:'قرارات الفائدة والتضخم قد تؤثر على الدولار والذهب والفوركس.', summaryEn:'Central-bank and inflation headlines remain key market drivers.', publishedAt:new Date().toISOString(), link:'https://www.federalreserve.gov/newsevents.htm', image:'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80', affected:['USD','Gold','EUR/USD']}]
function titleOf(n, lang){ return lang==='ku' ? (n.titleKu || n.titleEn) : lang==='ar' ? (n.titleAr || n.titleEn) : n.titleEn }
function summaryOf(n, lang){ return lang==='ku' ? (n.summaryKu || n.summaryEn) : lang==='ar' ? (n.summaryAr || n.summaryEn) : n.summaryEn }
function timeAgo(date, lang){ const d = new Date(date); if(isNaN(d)) return ''; const min = Math.max(1, Math.round((Date.now()-d.getTime())/60000)); if(min<60) return lang==='en'?`${min}m ago`:lang==='ar'?`قبل ${min} د`:`${min} خولەک پێش ئێستا`; const h=Math.round(min/60); if(h<24) return lang==='en'?`${h}h ago`:lang==='ar'?`قبل ${h} س`:`${h} کاتژمێر پێش ئێستا`; const days=Math.round(h/24); return lang==='en'?`${days}d ago`:lang==='ar'?`قبل ${days} يوم`:`${days} ڕۆژ پێش ئێستا`; }
function categoryIcon(cat){ const map={iraq:<Landmark/>,forex:<BarChart3/>,oil:<Fuel/>,crypto:<Bitcoin/>,stocks:<TrendingIcon/>,geopolitics:<ShieldAlert/>,banks:<Building2/>}; return map[cat] || <Newspaper/> }
function TrendingIcon(){ return <BarChart3/> }
function App(){
  const [lang,setLang] = useState(localStorage.getItem('lang') || 'ku')
  const [query,setQuery] = useState('')
  const [active,setActive] = useState('all')
  const [news,setNews] = useState(fallback)
  const [sources,setSources] = useState([])
  const [updated,setUpdated] = useState(null)
  const [loading,setLoading] = useState(true)
  const t = translations[lang]
  const rtl = lang !== 'en'
  useEffect(()=>{ localStorage.setItem('lang', lang); document.documentElement.lang = lang; document.documentElement.dir = rtl ? 'rtl' : 'ltr' },[lang,rtl])
  const loadNews = async () => {
    try { setLoading(true); const res = await fetch('/api/news?ts=' + Date.now()); const data = await res.json(); if(data.items?.length) setNews(data.items); setUpdated(data.updatedAt); }
    catch(e){ console.error(e) } finally { setLoading(false) }
  }
  useEffect(()=>{ loadNews(); fetch('/api/sources').then(r=>r.json()).then(d=>setSources(d.sources||[])).catch(()=>{}); const id=setInterval(loadNews,60000); return()=>clearInterval(id) },[])
  const filtered = useMemo(()=> news.filter(n => (active==='all'||n.category===active) && `${n.titleKu} ${n.titleAr} ${n.titleEn} ${n.source}`.toLowerCase().includes(query.toLowerCase())), [news,active,query])
  const hero = filtered[0] || news[0] || fallback[0]
  const high = filtered.filter(n=>n.impact==='High').slice(0,4)
  return <main className="app">
    <header className="topbar">
      <div className="brand"><div className="logo">هـ</div><div><h1>{t.name}</h1><p>{t.tagline}</p></div></div>
      <div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div>
      <div className="lang"><Globe2 size={16}/><button onClick={()=>setLang('ku')} className={lang==='ku'?'on':''}>KU</button><button onClick={()=>setLang('ar')} className={lang==='ar'?'on':''}>AR</button><button onClick={()=>setLang('en')} className={lang==='en'?'on':''}>EN</button><button className="refresh" onClick={loadNews}><RefreshCcw size={15}/></button></div>
    </header>
    <section className="ticker"><Flame size={18}/><span>{t.breaking}</span><marquee>{filtered.slice(0,8).map(n=>titleOf(n,lang)).join('  •  ')}</marquee></section>
    <nav className="nav"><button onClick={()=>setActive('all')} className={active==='all'?'on':''}>{t.all}</button>{categories.map(k=><button key={k} onClick={()=>setActive(k)} className={active===k?'on':''}>{t[k]}</button>)}</nav>
    <section className="hero">
      <div className="heroImage" style={{backgroundImage:`url(${hero.image})`}} />
      <div className="heroContent"><span className={`badge ${hero.impact==='High'?'high':hero.impact==='Medium'?'medium':'low'}`}>● {hero.impact}</span><h2>{titleOf(hero,lang)}</h2><h3>{hero.titleEn}</h3><p>{summaryOf(hero,lang)}</p><div className="meta"><span>{hero.source}</span><span>{timeAgo(hero.publishedAt,lang)}</span><span>{t.markets}: {(hero.affected||[]).join(', ')}</span></div><div className="actions"><a href={hero.link} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{t.read}</a><button><Share2 size={16}/>{t.share}</button><button><Bookmark size={16}/>{t.saved}</button></div></div>
    </section>
    <section className="grid2">
      <Panel title={t.ai} icon={<BarChart3/>}><div className="intelligence"><div><b>Risk Mood</b><span className="green">Live Watch</span></div><div><b>Iraq</b><span className="orange">Oil / IQD</span></div><div><b>Breaking</b><span>{high.length} High</span></div><div><b>{t.updated}</b><span>{updated ? timeAgo(updated,lang) : '—'}</span></div></div></Panel>
      <Panel title={t.highImpact} icon={<ShieldAlert/>}><ul className="events">{high.length?high.map(n=><li key={n.id}><b>{titleOf(n,lang)}</b><span>{n.source}</span></li>):<li><b>{t.loading}</b><span>API</span></li>}</ul></Panel>
    </section>
    <section className="sectionHead"><h2>{t.latest}</h2><p>{loading ? t.loading : `${filtered.length} articles`}</p></section>
    <section className="newsGrid">{filtered.length ? filtered.map(n=><article className="card" key={n.id}><img src={n.image} onError={e=>{e.currentTarget.src='https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80'}}/><div><span className={`badge ${n.impact==='High'?'high':n.impact==='Medium'?'medium':'low'}`}>{n.impact}</span><h3>{titleOf(n,lang)}</h3><p className="english">{n.titleEn}</p><p>{summaryOf(n,lang)}</p><div className="tags">{(n.affected||[]).slice(0,4).map(a=><small key={a}>{a}</small>)}</div><div className="cardFoot"><span>{n.source} · {timeAgo(n.publishedAt,lang)}</span><a href={n.link} target="_blank" rel="noreferrer">{t.read}</a></div></div></article>) : <div className="empty">{t.noNews}</div>}</section>
    <section className="sources"><h2>{t.sources}</h2><div>{sources.slice(0,24).map(s=><a key={s.name} href={s.url} target="_blank" rel="noreferrer">{s.name}</a>)}</div></section>
    <footer><b>{t.name}</b><span>Reuters • CNBC • MSN • BBC • AP • FXStreet • ForexLive • CBI • Shafaq • Rudaw • Kurdistan24 • OPEC • EIA</span></footer>
  </main>
}
function Panel({title,icon,children}){return <section className="panel"><div className="panelTitle">{React.cloneElement(icon,{size:18})}<h2>{title}</h2></div>{children}</section>}
createRoot(document.getElementById('root')).render(<App />)

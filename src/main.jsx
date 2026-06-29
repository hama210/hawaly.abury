import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Search, Globe2, Bell, Menu, X, TrendingUp, Newspaper, ShieldAlert, Building2, CalendarDays, Flame, BarChart3, Oil, Bitcoin, Landmark, Share2, Bookmark } from 'lucide-react'
import './styles.css'

const translations = {
  ku: {
    name: 'هەواڵی ئابوری', tagline: 'سەکۆی زیرەکی ئابوری و بازاڕ', search: 'گەڕان لە هەواڵەکان...', breaking: 'هەواڵی گەرم', latest: 'دوایین هەواڵ', highImpact: 'کاریگەری بەرز', calendar: 'ڕۆژژمێری ئابوری', iraq: 'عێراق', forex: 'فۆرێکس', oil: 'نەوت و وزە', crypto: 'کریپتۆ', stocks: 'بازاڕی پشکەکان', geopolitics: 'جیوپۆلیتیک', banks: 'بانکە ناوەندییەکان', ai: 'AI Intelligence', sources: 'سەرچاوەکان', read: 'سەرچاوە بخوێنەوە', saved: 'هەڵگرتن', share: 'هاوبەشکردن', impact: 'کاریگەری', markets: 'بازاڕە کاریگەرەکان', why: 'بۆچی گرنگە؟', heroTitle: 'چاوەڕوانی بڕیارەکانی بانکە ناوەندییەکان بازاڕە جیهانییەکان دەجوڵێنێت', heroEnglish: 'Central bank decisions keep global markets on edge', heroSummary: 'وەبەرهێنەران چاوەڕوانی زانیاری نوێن لەسەر نرخەکانی سوود، تورم و دۆخی نەوت؛ ئەم بابەتانە کاریگەرییان لەسەر دۆلار، زێڕ، نەوت و دراوەکانی ناوچەکە دەبێت.'
  },
  ar: {
    name: 'أخبار الاقتصاد', tagline: 'منصة ذكاء اقتصادي وأسواق', search: 'ابحث في الأخبار...', breaking: 'أخبار عاجلة', latest: 'آخر الأخبار', highImpact: 'تأثير عالٍ', calendar: 'التقويم الاقتصادي', iraq: 'العراق', forex: 'الفوركس', oil: 'النفط والطاقة', crypto: 'العملات الرقمية', stocks: 'الأسهم', geopolitics: 'الجغرافيا السياسية', banks: 'البنوك المركزية', ai: 'ذكاء السوق', sources: 'المصادر', read: 'اقرأ المصدر', saved: 'حفظ', share: 'مشاركة', impact: 'التأثير', markets: 'الأسواق المتأثرة', why: 'لماذا يهم؟', heroTitle: 'قرارات البنوك المركزية تبقي الأسواق العالمية في حالة ترقب', heroEnglish: 'Central bank decisions keep global markets on edge', heroSummary: 'يراقب المستثمرون بيانات الفائدة والتضخم والنفط لأنها قد تؤثر على الدولار والذهب والنفط وعملات المنطقة.'
  },
  en: {
    name: 'Economic News', tagline: 'Financial intelligence and market news platform', search: 'Search news...', breaking: 'Breaking News', latest: 'Latest News', highImpact: 'High Impact', calendar: 'Economic Calendar', iraq: 'Iraq', forex: 'Forex', oil: 'Oil & Energy', crypto: 'Crypto', stocks: 'Stocks', geopolitics: 'Geopolitics', banks: 'Central Banks', ai: 'AI Intelligence', sources: 'Sources', read: 'Read source', saved: 'Save', share: 'Share', impact: 'Impact', markets: 'Affected markets', why: 'Why it matters', heroTitle: 'Central bank decisions keep global markets on edge', heroEnglish: 'Central bank decisions keep global markets on edge', heroSummary: 'Investors are watching rates, inflation and oil headlines as they may affect the dollar, gold, oil and regional currencies.'
  }
}

const nav = ['latest','calendar','iraq','forex','oil','crypto','stocks','geopolitics','banks','ai','sources']

const sampleNews = [
  { id: 1, cat:'banks', impact:'High', source:'Federal Reserve', image:'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80', ku:'فیدڕاڵ ڕیزێرڤ وەڵامی نوێ دەداتەوە سەبارەت بە ڕێڕەوی نرخەکانی سوود', en:'Fed officials signal caution on future rate path', markets:['USD','Gold','EUR/USD'], why:'قەبارەی گۆڕانکاری نرخەکانی سوود کاریگەری ڕاستەوخۆی لەسەر دۆلار و زێڕ هەیە.' },
  { id: 2, cat:'iraq', impact:'High', source:'Central Bank of Iraq', image:'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80', ku:'بانکی ناوەندی عێراق ڕێنمایی نوێی بانکی ڕادەگەیەنێت', en:'Central Bank of Iraq announces updated banking guidance', markets:['IQD','USD/IQD','Banks'], why:'هەواڵی بانکی ناوەندی دەتوانێت کاریگەری لەسەر دراو و بازاڕی ناوخۆیی هەبێت.' },
  { id: 3, cat:'oil', impact:'Medium', source:'OPEC / EIA', image:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=80', ku:'بازاڕی نەوت لەژێر کاریگەری دابینکردن و داواکاری جیهانییە', en:'Oil market watches supply and global demand signals', markets:['WTI','Brent','IQD'], why:'نەوت گرنگترین داهاتی عێراقە و کاریگەری لە بودجە و دراوەکەی هەیە.' },
  { id: 4, cat:'geopolitics', impact:'High', source:'Reuters / AP', image:'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', ku:'مەترسییە جیوپۆلیتیکییەکان جارێکی تر نرخەکانی وزە و زێڕ دەجوڵێنن', en:'Geopolitical risk returns to energy and gold markets', markets:['Gold','Oil','USD'], why:'کێشەی سیاسی و ئەمنی زۆرجار هەستی ڕیسک لە بازاڕەکان دەگۆڕێت.' },
  { id: 5, cat:'forex', impact:'Medium', source:'FXStreet', image:'https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=80', ku:'دۆلار بەرامبەر دراوە سەرەکییەکان جێگیر دەمێنێتەوە پێش داتای تورم', en:'Dollar steadies before inflation data', markets:['DXY','EUR/USD','GBP/USD'], why:'داتای تورم دەتوانێت چاوەڕوانییەکانی نرخەکانی سوود بگۆڕێت.' },
  { id: 6, cat:'crypto', impact:'Medium', source:'CoinDesk', image:'https://images.unsplash.com/photo-1621504450181-5d356f61d307?auto=format&fit=crop&w=1200&q=80', ku:'بیتکۆین لەگەڵ گۆڕانی هەستی ڕیسک لە بازاڕەکاندا دەجوڵێت', en:'Bitcoin moves with broader market risk sentiment', markets:['BTC','ETH','NASDAQ'], why:'کریپتۆ زۆرجار بە گۆڕانی هەستی ڕیسک و پشکەکانی تەکنەلۆجیا دەجوڵێت.' }
]

function App(){
  const [lang,setLang] = useState(localStorage.getItem('lang') || 'ku')
  const [query,setQuery] = useState('')
  const [active,setActive] = useState('all')
  const t = translations[lang]
  const rtl = lang !== 'en'
  useEffect(()=>{ localStorage.setItem('lang', lang); document.documentElement.lang = lang; document.documentElement.dir = rtl ? 'rtl' : 'ltr' },[lang,rtl])
  const filtered = useMemo(()=> sampleNews.filter(n => (active==='all'||n.cat===active) && (n.ku+n.en+n.source).toLowerCase().includes(query.toLowerCase())), [active,query])
  const hero = filtered[0] || sampleNews[0]
  return <main className="app">
    <header className="topbar">
      <div className="brand"><div className="logo">هـ</div><div><h1>{t.name}</h1><p>{t.tagline}</p></div></div>
      <div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div>
      <div className="lang"><Globe2 size={16}/><button onClick={()=>setLang('ku')} className={lang==='ku'?'on':''}>KU</button><button onClick={()=>setLang('ar')} className={lang==='ar'?'on':''}>AR</button><button onClick={()=>setLang('en')} className={lang==='en'?'on':''}>EN</button></div>
    </header>
    <section className="ticker"><Flame size={18}/><span>{t.breaking}</span><marquee>{hero.ku} — {hero.en}</marquee></section>
    <nav className="nav"><button onClick={()=>setActive('all')} className={active==='all'?'on':''}>All</button>{nav.map(k=><button key={k} onClick={()=>setActive(k)} className={active===k?'on':''}>{t[k]}</button>)}</nav>
    <section className="hero">
      <div className="heroImage" style={{backgroundImage:`url(${hero.image})`}} />
      <div className="heroContent"><span className="badge high">🔴 {t.highImpact}</span><h2>{lang==='en'?hero.en:hero.ku}</h2><h3>{hero.en}</h3><p>{t.heroSummary}</p><div className="meta"><span>{hero.source}</span><span>{t.markets}: {hero.markets.join(', ')}</span></div><div className="actions"><button><Share2 size={16}/>{t.share}</button><button><Bookmark size={16}/>{t.saved}</button></div></div>
    </section>
    <section className="grid2">
      <Panel title={t.ai} icon={<BarChart3/>}><div className="intelligence"><div><b>Risk Mood</b><span className="green">Risk On</span></div><div><b>USD</b><span>Neutral</span></div><div><b>Gold</b><span className="green">Bullish</span></div><div><b>Oil</b><span className="orange">Volatile</span></div><div><b>Iraq</b><span className="red">High Watch</span></div></div></Panel>
      <Panel title={t.calendar} icon={<CalendarDays/>}><ul className="events"><li><b>US CPI</b><span>High Impact</span></li><li><b>Fed Speech</b><span>High Impact</span></li><li><b>Oil Inventories</b><span>Medium</span></li><li><b>CBI Statement</b><span>Iraq Impact</span></li></ul></Panel>
    </section>
    <section className="sectionHead"><h2>{t.latest}</h2><p>{filtered.length} articles</p></section>
    <section className="newsGrid">{filtered.map(n=><article className="card" key={n.id}><img src={n.image}/><div><span className={`badge ${n.impact==='High'?'high':'medium'}`}>{n.impact}</span><h3>{lang==='en'?n.en:n.ku}</h3><p className="english">{n.en}</p><p>{n.why}</p><div className="cardFoot"><span>{n.source}</span><button>{t.read}</button></div></div></article>)}</section>
    <footer><b>{t.name}</b><span>Reuters • CNBC • MSN • BBC • AP • FXStreet • ForexLive • CBI • Shafaq • Rudaw • Kurdistan24 • OPEC • EIA</span></footer>
  </main>
}
function Panel({title,icon,children}){return <section className="panel"><div className="panelTitle">{React.cloneElement(icon,{size:18})}<h2>{title}</h2></div>{children}</section>}
createRoot(document.getElementById('root')).render(<App />)

import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import BreakingTicker from './components/BreakingTicker.jsx'
import HeroNews from './components/HeroNews.jsx'
import IntelligencePanel from './components/IntelligencePanel.jsx'
import FilterBar from './components/FilterBar.jsx'
import NewsCard from './components/NewsCard.jsx'
import SourceStrip from './components/SourceStrip.jsx'
import Skeleton from './components/Skeleton.jsx'
import { dictionary, LANGS } from './data/i18n.js'
import { useFilteredNews, useNews } from './hooks/useNews.js'
import { timeAgo } from './utils/news.js'
import './styles.css'

export default function App(){
  const savedLang = localStorage.getItem('hawali-lang') || 'ku'
  const savedTheme = localStorage.getItem('hawali-theme') || 'dark'
  const [lang, setLang] = useState(savedLang)
  const [theme, setTheme] = useState(savedTheme)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [impact, setImpact] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { news, sources, loading, updatedAt, refresh } = useNews()
  const filtered = useFilteredNews(news, { query, category, impact })
  const high = filtered.filter(n => String(n.impact).toLowerCase() === 'high')
  const hero = filtered[0] || news[0]
  const t = dictionary[lang]
  const dir = LANGS.find(l=>l.code===lang)?.dir || 'rtl'

  useEffect(()=>{ document.documentElement.lang = lang; document.documentElement.dir = dir; localStorage.setItem('hawali-lang', lang) }, [lang, dir])
  useEffect(()=>{ document.documentElement.dataset.theme = theme; localStorage.setItem('hawali-theme', theme) }, [theme])

  const updatedLabel = useMemo(()=>updatedAt ? timeAgo(updatedAt, lang) : '—', [updatedAt, lang])

  return <div className="app-shell">
    <Sidebar t={t} open={sidebarOpen} setOpen={setSidebarOpen} activeCategory={category} setActiveCategory={setCategory}/>
    <div className="main-area">
      <Header t={t} lang={lang} setLang={setLang} query={query} setQuery={setQuery} theme={theme} setTheme={setTheme} refresh={refresh} toggleSidebar={()=>setSidebarOpen(true)}/>
      <BreakingTicker t={t} lang={lang} items={news}/>
      <FilterBar t={t} category={category} setCategory={setCategory} impact={impact} setImpact={setImpact}/>
      <HeroNews t={t} lang={lang} item={hero}/>
      <section className="dashboard-row">
        <IntelligencePanel t={t} highCount={high.length} updatedAt={updatedLabel}/>
        <section className="high-impact-board"><div className="board-title"><h2>{t.high}</h2><span>{t.today}</span></div>{high.slice(0,5).map(item=><a href={item.link} target="_blank" rel="noreferrer" key={item.id}><b>{lang==='en' ? item.titleEn : lang==='ar' ? item.titleAr : item.titleKu}</b><span>{item.source}</span></a>)}</section>
      </section>
      <section className="section-title"><div><h2>{t.latest}</h2><p>{loading ? t.loading : `${filtered.length} articles • ${t.updated}: ${updatedLabel}`}</p></div></section>
      {loading && filtered.length < 2 ? <Skeleton/> : <section className="news-grid-pro">{filtered.map(item => <NewsCard key={item.id} item={item} lang={lang} t={t}/>)}</section>}
      {!filtered.length && <div className="empty-state">{t.noNews}</div>}
      <SourceStrip t={t} sources={sources}/>
      <footer className="footer"><div><b>{t.site}</b><span>{t.tagline}</span></div><p>Phase 3 Sprint 1 • Premium dashboard UI • Cloudflare Pages</p></footer>
    </div>
  </div>
}

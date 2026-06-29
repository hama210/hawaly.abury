import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import BreakingTicker from './components/BreakingTicker.jsx'
import HeroNews from './components/HeroNews.jsx'
import IntelligencePanel from './components/IntelligencePanel.jsx'
import FilterBar from './components/FilterBar.jsx'
import AdvancedSearch from './components/AdvancedSearch.jsx'
import IraqIntelligence from './components/IraqIntelligence.jsx'
import ArticleModal from './components/ArticleModal.jsx'
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
  const savedBookmarks = JSON.parse(localStorage.getItem('hawali-saved') || '[]')
  const [lang, setLang] = useState(savedLang)
  const [theme, setTheme] = useState(savedTheme)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [impact, setImpact] = useState('all')
  const [advanced, setAdvanced] = useState({ source:'all', asset:'all', date:'all', country:'all' })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [bookmarks, setBookmarks] = useState(savedBookmarks)
  const { news, sources, loading, updatedAt, refresh } = useNews()
  const filtered = useFilteredNews(news, { query, category, impact, ...advanced })
  const high = filtered.filter(n => String(n.impact).toLowerCase() === 'high')
  const hero = filtered[0] || news[0]
  const t = dictionary[lang]
  const dir = LANGS.find(l=>l.code===lang)?.dir || 'rtl'

  useEffect(()=>{ document.documentElement.lang = lang; document.documentElement.dir = dir; localStorage.setItem('hawali-lang', lang) }, [lang, dir])
  useEffect(()=>{ document.documentElement.dataset.theme = theme; localStorage.setItem('hawali-theme', theme) }, [theme])
  useEffect(()=>{ localStorage.setItem('hawali-saved', JSON.stringify(bookmarks)) }, [bookmarks])

  const updatedLabel = useMemo(()=>updatedAt ? timeAgo(updatedAt, lang) : '—', [updatedAt, lang])
  const options = useMemo(()=>({
    sources:[...new Set(news.map(n=>n.source).filter(Boolean))].sort(),
    assets:[...new Set(news.flatMap(n=>n.affected || []).filter(Boolean))].sort()
  }), [news])
  const openArticle = item => setSelected({ ...item, related: news.filter(n => n.id !== item.id && (n.category === item.category || (n.affected||[]).some(a => (item.affected||[]).includes(a)))).slice(0,3).map(n => n.titleEn || n.titleKu) })
  const saveArticle = item => setBookmarks(prev => prev.includes(item.id) ? prev.filter(id=>id!==item.id) : [...prev, item.id])
  const shareArticle = async item => {
    const link = item.link || location.href
    try{
      if(navigator.share) await navigator.share({ title:item.titleEn || item.titleKu, url:link })
      else await navigator.clipboard.writeText(link)
    }catch{}
  }
  const selectAsset = asset => { setAdvanced(prev => ({ ...prev, asset })); window.scrollTo({ top: 0, behavior:'smooth' }) }

  return <div className="app-shell">
    <Sidebar t={t} open={sidebarOpen} setOpen={setSidebarOpen} activeCategory={category} setActiveCategory={setCategory}/>
    <div className="main-area">
      <Header t={t} lang={lang} setLang={setLang} query={query} setQuery={setQuery} theme={theme} setTheme={setTheme} refresh={refresh} toggleSidebar={()=>setSidebarOpen(true)}/>
      <BreakingTicker t={t} lang={lang} items={news}/>
      <FilterBar t={t} category={category} setCategory={setCategory} impact={impact} setImpact={setImpact}/>
      <AdvancedSearch t={t} filters={advanced} setFilters={setAdvanced} options={options}/>
      <HeroNews t={t} lang={lang} item={hero} onOpen={openArticle} onShare={shareArticle} onSave={saveArticle} saved={bookmarks.includes(hero?.id)} onAsset={selectAsset}/>
      <section className="dashboard-row">
        <IntelligencePanel t={t} highCount={high.length} updatedAt={updatedLabel}/>
        <section className="high-impact-board"><div className="board-title"><h2>{t.high}</h2><span>{t.today}</span></div>{high.slice(0,5).map(item=><button onClick={()=>openArticle(item)} key={item.id}><b>{lang==='en' ? item.titleEn : lang==='ar' ? item.titleAr : item.titleKu}</b><span>{item.source}</span></button>)}</section>
      </section>
      <IraqIntelligence t={t} lang={lang} items={news} onOpen={openArticle}/>
      <section className="section-title"><div><h2>{t.latest}</h2><p>{loading ? t.loading : `${filtered.length} articles • ${t.updated}: ${updatedLabel}`}</p></div></section>
      {loading && filtered.length < 2 ? <Skeleton/> : <section className="news-grid-pro">{filtered.map(item => <NewsCard key={item.id} item={item} lang={lang} t={t} onOpen={openArticle} onShare={shareArticle} onSave={saveArticle} saved={bookmarks.includes(item.id)} onAsset={selectAsset}/>)}</section>}
      {!filtered.length && <div className="empty-state">{t.noNews}</div>}
      <SourceStrip t={t} sources={sources}/>
      <footer className="footer"><div><b>{t.site}</b><span>{t.tagline}</span></div><p>Phase 3 Sprint 2 • Article modal • Advanced search • Iraq Intelligence</p></footer>
    </div>
    <ArticleModal item={selected} lang={lang} t={t} onClose={()=>setSelected(null)} saved={selected ? bookmarks.includes(selected.id) : false} onSave={saveArticle} onShare={shareArticle}/>
  </div>
}

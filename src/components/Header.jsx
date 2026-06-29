import { Bell, Globe2, Languages, Menu, Moon, RefreshCcw, Search, Sun } from 'lucide-react'
import { LANGS } from '../data/i18n.js'

export default function Header({ t, lang, setLang, query, setQuery, theme, setTheme, refresh, toggleSidebar }){
  return <header className="header-shell">
    <button className="icon-button mobile-menu" onClick={toggleSidebar} aria-label="menu"><Menu size={20}/></button>
    <div className="brand-lockup">
      <div className="brand-mark"><span>هـ</span><i /></div>
      <div><h1>{t.site}</h1><p>{t.tagline}</p></div>
    </div>
    <div className="global-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div>
    <div className="header-actions">
      <div className="language-switch"><Languages size={16}/>{LANGS.map(l=><button key={l.code} onClick={()=>setLang(l.code)} className={lang===l.code?'active':''}>{l.label}</button>)}</div>
      <button className="icon-button" onClick={()=>setTheme(theme==='dark'?'light':'dark')} title={t.theme}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button className="icon-button notification-dot" title={t.notifications}><Bell size={18}/></button>
      <button className="icon-button" onClick={refresh}><RefreshCcw size={18}/></button>
    </div>
  </header>
}

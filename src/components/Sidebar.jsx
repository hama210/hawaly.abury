import { BarChart3, Bitcoin, Brain, Building2, CalendarDays, Fuel, Home, Landmark, Newspaper, Settings, ShieldAlert, TrendingUp, X } from 'lucide-react'

const nav = [
  ['dashboard', Home], ['latest', Newspaper], ['iraq', Landmark], ['forex', BarChart3], ['calendar', CalendarDays], ['crypto', Bitcoin], ['oil', Fuel], ['stocks', TrendingUp], ['banks', Building2], ['ai', Brain], ['settings', Settings]
]

export default function Sidebar({ t, open, setOpen, activeCategory, setActiveCategory }){
  return <aside className={`sidebar ${open?'open':''}`}>
    <div className="sidebar-top"><div className="mini-logo">هـ</div><button className="icon-button close-sidebar" onClick={()=>setOpen(false)}><X size={18}/></button></div>
    <nav>
      {nav.map(([key, Icon]) => {
        const categoryMap = { dashboard:'all', latest:'all', iraq:'iraq', forex:'forex', calendar:'calendar', crypto:'crypto', oil:'oil', stocks:'stocks', banks:'banks', ai:'all' }
        const cat = categoryMap[key] || 'all'
        const active = activeCategory === cat && ['iraq','forex','calendar','crypto','oil','stocks','banks'].includes(key)
        return <button key={key} className={active?'active':''} onClick={()=>{setActiveCategory(cat); setOpen(false)}}><Icon size={19}/><span>{t[key] || key}</span></button>
      })}
    </nav>
    <div className="sidebar-card"><ShieldAlert size={20}/><b>{t.high}</b><p>Fed • CPI • OPEC • Iraq Oil • CBI</p></div>
  </aside>
}

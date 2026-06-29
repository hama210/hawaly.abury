import { Building2, Landmark, Newspaper, ShieldAlert } from 'lucide-react'
import { getTitle, timeAgo } from '../utils/news.js'

export default function IraqIntelligence({ t, lang, items, onOpen }){
  const iraqItems = items.filter(x => x.category === 'iraq' || /iraq|iqd|cbi|baghdad|kurdistan/i.test(`${x.source} ${x.titleEn} ${(x.affected||[]).join(' ')}`)).slice(0,4)
  const stats = [
    { icon:<Landmark size={18}/>, label:'CBI', value: iraqItems.some(x=>/cbi|central bank/i.test(`${x.source} ${x.titleEn}`)) ? 'Active' : 'Watch' },
    { icon:<Building2 size={18}/>, label:'Oil / Budget', value: iraqItems.some(x=>/oil|budget/i.test(`${x.titleEn} ${(x.affected||[]).join(' ')}`)) ? 'Moving' : 'Stable' },
    { icon:<ShieldAlert size={18}/>, label:'Iraq impact', value: iraqItems.length ? 'Detected' : 'Low' },
  ]
  return <section className="iraq-intelligence">
    <div className="iraq-head"><div><h2>{t.iraqIntel || 'Iraq Intelligence'}</h2><p>{t.iraqIntelText || 'CBI, oil, budget, banking and government economy watch.'}</p></div><span>🇮🇶</span></div>
    <div className="iraq-stats">{stats.map(s=><div key={s.label}>{s.icon}<small>{s.label}</small><b>{s.value}</b></div>)}</div>
    <div className="iraq-list">{iraqItems.length ? iraqItems.map(item=><button key={item.id} onClick={()=>onOpen(item)}><Newspaper size={16}/><span>{getTitle(item, lang)}</span><small>{timeAgo(item.publishedAt, lang)}</small></button>) : <p>{t.noNews}</p>}</div>
  </section>
}

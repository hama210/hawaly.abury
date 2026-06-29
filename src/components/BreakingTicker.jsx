import { Flame, Radio } from 'lucide-react'
import { getTitle } from '../utils/news.js'
export default function BreakingTicker({ t, lang, items }){
  const headlines = items.slice(0,10).map(n=>getTitle(n, lang)).join('  •  ')
  return <section className="breaking-ticker"><div><Flame size={18}/><b>{t.breaking}</b><span>{t.live}</span></div><marquee>{headlines}</marquee><Radio size={17}/></section>
}

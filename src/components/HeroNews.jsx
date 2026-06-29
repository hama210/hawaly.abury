import { Bookmark, ExternalLink, Share2, Sparkles } from 'lucide-react'
import { getSummary, getTitle, getWhy, safeImage, timeAgo } from '../utils/news.js'
import ImpactBadge from './ImpactBadge.jsx'

export default function HeroNews({ t, lang, item }){
  if(!item) return null
  return <section className="hero-premium">
    <div className="hero-visual" style={{backgroundImage:`url(${safeImage(item)})`}}><div className="hero-glow" /></div>
    <div className="hero-copy">
      <div className="hero-kicker"><ImpactBadge impact={item.impact}/><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h2>{getTitle(item, lang)}</h2>
      <h3>{item.titleEn}</h3>
      <p>{getSummary(item, lang)}</p>
      <div className="why-card"><Sparkles size={18}/><div><b>{t.why}</b><span>{getWhy(item, lang) || getSummary(item, lang)}</span></div></div>
      <div className="asset-row"><b>{t.affected}</b>{(item.affected || []).slice(0,6).map(asset=><small key={asset}>{asset}</small>)}</div>
      <div className="hero-actions"><a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{t.read}</a><button><Share2 size={17}/>{t.share}</button><button><Bookmark size={17}/>{t.save}</button></div>
    </div>
  </section>
}

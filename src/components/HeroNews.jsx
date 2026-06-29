import { Bookmark, ExternalLink, Share2, Sparkles } from 'lucide-react'
import { getSummary, getTitle, getWhy, safeImage, timeAgo } from '../utils/news.js'
import ImpactBadge from './ImpactBadge.jsx'

export default function HeroNews({ t, lang, item, onOpen, onShare, onSave, saved, onAsset }){
  if(!item) return null
  return <section className="hero-premium">
    <button className="hero-visual" onClick={()=>onOpen(item)} style={{backgroundImage:`url(${safeImage(item)})`}}><div className="hero-glow" /></button>
    <div className="hero-copy">
      <div className="hero-kicker"><ImpactBadge impact={item.impact}/><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h2 onClick={()=>onOpen(item)}>{getTitle(item, lang)}</h2>
      <h3>{item.titleEn}</h3>
      <p>{getSummary(item, lang)}</p>
      <button className="why-card" onClick={()=>onOpen(item)}><Sparkles size={18}/><div><b>{t.why}</b><span>{getWhy(item, lang) || getSummary(item, lang)}</span></div></button>
      <div className="asset-row"><b>{t.affected}</b>{(item.affected || []).slice(0,6).map(asset=><button key={asset} onClick={()=>onAsset?.(asset)}>{asset}</button>)}</div>
      <div className="hero-actions"><a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{t.read}</a><button onClick={()=>onShare(item)}><Share2 size={17}/>{t.share}</button><button onClick={()=>onSave(item)} className={saved?'saved':''}><Bookmark size={17}/>{saved ? (t.saved || 'Saved') : t.save}</button></div>
    </div>
  </section>
}

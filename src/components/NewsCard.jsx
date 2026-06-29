import { Bookmark, ExternalLink, Share2 } from 'lucide-react'
import { getSummary, getTitle, safeImage, sourceLogo, timeAgo } from '../utils/news.js'
import ImpactBadge from './ImpactBadge.jsx'

export default function NewsCard({ item, lang, t, onOpen, onShare, onSave, saved, onAsset }){
  return <article className="news-card-pro" onClick={()=>onOpen(item)}>
    <button className="card-image" onClick={()=>onOpen(item)}><img src={safeImage(item)} onError={e=>{e.currentTarget.src='https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80'}} alt=""/><span>{sourceLogo(item.source)}</span></button>
    <div className="card-body">
      <div className="card-meta"><ImpactBadge impact={item.impact}/><span>{item.category}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h3>{getTitle(item, lang)}</h3>
      <p className="original-title">{item.titleEn}</p>
      <p>{getSummary(item, lang)}</p>
      <div className="asset-row compact">{(item.affected || []).slice(0,4).map(asset=><button key={asset} onClick={(e)=>{e.stopPropagation(); onAsset?.(asset)}}>{asset}</button>)}</div>
      <div className="card-actions" onClick={e=>e.stopPropagation()}><a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{t.source}</a><button onClick={()=>onShare(item)}><Share2 size={15}/></button><button onClick={()=>onSave(item)} className={saved?'saved':''}><Bookmark size={15}/></button></div>
    </div>
  </article>
}

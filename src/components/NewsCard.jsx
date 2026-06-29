import { Bookmark, ExternalLink, Share2 } from 'lucide-react'
import { getSummary, getTitle, safeImage, sourceLogo, timeAgo } from '../utils/news.js'
import ImpactBadge from './ImpactBadge.jsx'

export default function NewsCard({ item, lang, t }){
  return <article className="news-card-pro">
    <a className="card-image" href={item.link} target="_blank" rel="noreferrer"><img src={safeImage(item)} onError={e=>{e.currentTarget.src='https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80'}} alt=""/><span>{sourceLogo(item.source)}</span></a>
    <div className="card-body">
      <div className="card-meta"><ImpactBadge impact={item.impact}/><span>{item.category}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <h3>{getTitle(item, lang)}</h3>
      <p className="original-title">{item.titleEn}</p>
      <p>{getSummary(item, lang)}</p>
      <div className="asset-row compact">{(item.affected || []).slice(0,4).map(asset=><small key={asset}>{asset}</small>)}</div>
      <div className="card-actions"><a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{t.source}</a><button><Share2 size={15}/></button><button><Bookmark size={15}/></button></div>
    </div>
  </article>
}

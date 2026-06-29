import { Bookmark, Check, Copy, ExternalLink, Share2, Sparkles, X } from 'lucide-react'
import { getSummary, getTitle, getWhy, safeImage, sourceLogo, timeAgo } from '../utils/news.js'
import ImpactBadge from './ImpactBadge.jsx'

export default function ArticleModal({ item, lang, t, onClose, saved, onSave, onShare }){
  if(!item) return null
  const related = item.related || []
  const title = getTitle(item, lang)
  const copied = item.__copied
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <article className="article-modal" onMouseDown={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="close"><X size={20}/></button>
      <div className="modal-image"><img src={safeImage(item)} onError={e=>{e.currentTarget.src='https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1600&q=80'}} alt=""/><span>{sourceLogo(item.source)}</span></div>
      <div className="modal-content">
        <div className="modal-kicker"><ImpactBadge impact={item.impact}/><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span><span>{item.category}</span></div>
        <h2>{title}</h2>
        <h3>{item.titleEn || item.title || title}</h3>
        <p className="modal-summary">{getSummary(item, lang)}</p>
        <section className="modal-insight">
          <Sparkles size={20}/>
          <div><b>{t.why}</b><p>{getWhy(item, lang) || getSummary(item, lang)}</p></div>
        </section>
        <div className="modal-assets"><b>{t.affected}</b>{(item.affected || []).map(asset=><button key={asset}>{asset}</button>)}</div>
        <div className="modal-actions">
          <a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{t.read}</a>
          <button onClick={()=>onShare(item)}>{copied ? <Check size={17}/> : <Share2 size={17}/>} {copied ? (t.copied || 'Copied') : t.share}</button>
          <button onClick={()=>onSave(item)} className={saved ? 'saved' : ''}><Bookmark size={17}/>{saved ? (t.saved || 'Saved') : t.save}</button>
        </div>
        <div className="related-box"><h4>{t.related}</h4><div>{related.length ? related.map(x=><span key={x}>{x}</span>) : (item.affected||[]).slice(0,4).map(x=><span key={x}>{x}</span>)}</div></div>
      </div>
    </article>
  </div>
}

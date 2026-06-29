import { useEffect, useMemo, useState } from 'react'
import { fallbackNews } from '../data/fallbackNews.js'

export function useNews(){
  const [news, setNews] = useState(fallbackNews)
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [error, setError] = useState(null)
  const loadNews = async () => {
    try{
      setError(null)
      const res = await fetch('/api/news?ts=' + Date.now(), { cache:'no-store' })
      if(!res.ok) throw new Error('News API failed')
      const data = await res.json()
      if(Array.isArray(data.items) && data.items.length) setNews(data.items)
      setUpdatedAt(data.updatedAt || new Date().toISOString())
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }
  const loadSources = async () => {
    try{ const res = await fetch('/api/sources?ts=' + Date.now(), { cache:'no-store' }); const data = await res.json(); setSources(data.sources || []) }catch{}
  }
  useEffect(()=>{ loadNews(); loadSources(); const id = setInterval(loadNews, 60_000); return()=>clearInterval(id) },[])
  return { news, sources, loading, updatedAt, error, refresh:loadNews }
}

export function useFilteredNews(news, {query, category, impact}){
  return useMemo(()=>{
    const q = query.trim().toLowerCase()
    return news.filter(item => {
      const categoryOk = category === 'all' || item.category === category
      const impactOk = impact === 'all' || String(item.impact).toLowerCase() === impact
      const text = `${item.titleKu} ${item.titleAr} ${item.titleEn} ${item.summaryKu} ${item.summaryAr} ${item.summaryEn} ${item.source} ${(item.affected||[]).join(' ')}`.toLowerCase()
      return categoryOk && impactOk && (!q || text.includes(q))
    })
  }, [news, query, category, impact])
}

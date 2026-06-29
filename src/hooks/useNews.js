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

function dateOk(value, filter){
  if(filter === 'all') return true
  const d = new Date(value)
  if(Number.isNaN(d.getTime())) return true
  const age = Date.now() - d.getTime()
  if(filter === 'today') return age <= 24*60*60*1000
  if(filter === 'week') return age <= 7*24*60*60*1000
  if(filter === 'month') return age <= 30*24*60*60*1000
  return true
}
function countryOk(item, country){
  if(country === 'all') return true
  const text = `${item.category} ${item.source} ${item.titleEn} ${item.titleKu} ${item.summaryEn} ${(item.affected||[]).join(' ')}`.toLowerCase()
  if(country === 'iraq') return /iraq|iqd|baghdad|kurdistan|cbi|dinar|عێراق|العراق/.test(text)
  if(country === 'usa') return /usa|u\.s\.|us |fed|federal|dollar|wall street|white house/.test(text)
  if(country === 'europe') return /europe|euro|ecb|eurozone|eu |eur/.test(text)
  if(country === 'china') return /china|chinese|yuan|beijing/.test(text)
  if(country === 'global') return !/iraq|iqd|baghdad|kurdistan|cbi/.test(text)
  return true
}

export function useFilteredNews(news, {query='', category='all', impact='all', source='all', asset='all', date='all', country='all'} = {}){
  return useMemo(()=>{
    const q = query.trim().toLowerCase()
    return news.filter(item => {
      const categoryOk = category === 'all' || item.category === category
      const impactOk = impact === 'all' || String(item.impact).toLowerCase() === impact
      const sourceOk = source === 'all' || item.source === source
      const assetOk = asset === 'all' || (item.affected || []).some(a => String(a).toLowerCase() === asset.toLowerCase())
      const text = `${item.titleKu} ${item.titleAr} ${item.titleEn} ${item.summaryKu} ${item.summaryAr} ${item.summaryEn} ${item.source} ${item.category} ${(item.affected||[]).join(' ')}`.toLowerCase()
      return categoryOk && impactOk && sourceOk && assetOk && dateOk(item.publishedAt, date) && countryOk(item, country) && (!q || text.includes(q))
    })
  }, [news, query, category, impact, source, asset, date, country])
}

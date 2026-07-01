export function getTitle(item, lang){
  const en = item.titleEn || item.title || ''
  return lang === 'ku' ? (item.titleKu || en) : lang === 'ar' ? (item.titleAr || en) : en
}
export function getSummary(item, lang){
  const en = item.summaryEn || item.summary || ''
  return lang === 'ku' ? (item.summaryKu || en) : lang === 'ar' ? (item.summaryAr || en) : en
}
export function getWhy(item, lang){
  const en = item.whyEn || ''
  return lang === 'ku' ? (item.whyKu || en) : lang === 'ar' ? (item.whyAr || en) : en
}
export function timeAgo(date, lang='en'){
  const d = new Date(date)
  if(Number.isNaN(d.getTime())) return ''
  const minutes = Math.max(1, Math.round((Date.now()-d.getTime())/60000))
  if(minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes/60)
  if(hours < 24) return `${hours}h ago`
  const days = Math.round(hours/24)
  return `${days}d ago`
}
export function toKu(value){ return String(value) }
export function impactClass(impact='Low'){ return impact.toLowerCase() === 'high' ? 'impact-high' : impact.toLowerCase() === 'medium' ? 'impact-medium' : 'impact-low' }
export function sourceLogo(source=''){ return source.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'N' }
export function safeImage(item){ return item?.image || categoryImage(item?.category) }
export function categoryImage(category='world'){
  const images = {
    iraq:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1400&q=80',
    forex:'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?auto=format&fit=crop&w=1400&q=80',
    oil:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1400&q=80',
    crypto:'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1400&q=80',
    stocks:'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1400&q=80',
    geopolitics:'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80',
    banks:'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80',
    calendar:'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1400&q=80'
  }
  return images[category] || images.geopolitics
}
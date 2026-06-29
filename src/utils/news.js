export function getTitle(item, lang){ return lang==='ku' ? (item.titleKu || item.titleEn || item.title) : lang==='ar' ? (item.titleAr || item.titleEn || item.title) : (item.titleEn || item.title) }
export function getSummary(item, lang){ return lang==='ku' ? (item.summaryKu || item.summaryEn || '') : lang==='ar' ? (item.summaryAr || item.summaryEn || '') : (item.summaryEn || '') }
export function getWhy(item, lang){ return lang==='ku' ? (item.whyKu || item.whyEn || '') : lang==='ar' ? (item.whyAr || item.whyEn || '') : (item.whyEn || '') }
export function timeAgo(date, lang='ku'){
  const d = new Date(date)
  if(Number.isNaN(d.getTime())) return ''
  const minutes = Math.max(1, Math.round((Date.now()-d.getTime())/60000))
  if(minutes < 60) return lang==='en' ? `${minutes}m ago` : lang==='ar' ? `قبل ${minutes} د` : `${toKu(minutes)} خولەک پێش ئێستا`
  const hours = Math.round(minutes/60)
  if(hours < 24) return lang==='en' ? `${hours}h ago` : lang==='ar' ? `قبل ${hours} س` : `${toKu(hours)} کاتژمێر پێش ئێستا`
  const days = Math.round(hours/24)
  return lang==='en' ? `${days}d ago` : lang==='ar' ? `قبل ${days} يوم` : `${toKu(days)} ڕۆژ پێش ئێستا`
}
export function toKu(value){ const map='٠١٢٣٤٥٦٧٨٩'; return String(value).replace(/\d/g,d=>map[Number(d)]) }
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

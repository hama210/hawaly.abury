import { imageForNews, coverForCategory } from '../lib/news-images.js';
import { localizedNewsField } from '../lib/translation-format.js';
export function getTitle(item,lang='en'){
  return localizedNewsField(item, 'title', lang);
}
export function getSummary(item,lang='en'){
  return localizedNewsField(item, 'summary', lang);
}
export function getWhy(item){
  return item?.whyEn || '';
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
export function safeImage(item){ return imageForNews(item) }
export function categoryImage(category='markets'){ return coverForCategory(category) }

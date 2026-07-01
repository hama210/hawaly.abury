function sameText(a='', b=''){
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
}

function smartKu(text=''){
  let out = String(text || '').trim()
  if(!out) return ''
  const phrases = [
    [/\bU\.S\.\b/gi,'ئەمریکا'], [/\bUS\b/g,'ئەمریکا'], [/\bUK\b/g,'بەریتانیا'], [/\bIraq\b/gi,'عێراق'], [/\bBaghdad\b/gi,'بەغدا'], [/\bKurdistan\b/gi,'کوردستان'], [/\bErbil\b/gi,'هەولێر'],
    [/\bmarket(s)?\b/gi,'بازار'], [/\bstock(s)?\b/gi,'پشکەکان'], [/\bshares\b/gi,'پشکەکان'], [/\boil\b/gi,'نەوت'], [/\bcrude\b/gi,'نەوتی خاو'], [/\bgold\b/gi,'زێڕ'], [/\bdollar\b/gi,'دۆلار'], [/\bdinar\b/gi,'دینار'], [/\bcrypto\b/gi,'کریپتۆ'], [/\bbitcoin\b/gi,'بیتکۆین'],
    [/\beconomy\b/gi,'ئابووری'], [/\beconomic\b/gi,'ئابووری'], [/\bbusiness\b/gi,'بازرگانی'], [/\bbank(s|ing)?\b/gi,'بانک'], [/\bcentral bank\b/gi,'بانکی ناوەندی'], [/\binflation\b/gi,'هەڵئاوسان'], [/\brate(s)?\b/gi,'ڕێژەکان'], [/\binterest\b/gi,'سوود'], [/\bfed\b/gi,'فیدڕاڵ'],
    [/\brise(s|n)?\b/gi,'بەرز دەبێتەوە'], [/\bgain(s|ed)?\b/gi,'زیاد دەکات'], [/\bsurge(s|d)?\b/gi,'بەرزبوونەوەی زۆر دەکات'], [/\bpop(s|ped)?\b/gi,'بەرز دەبێتەوە'], [/\bfall(s|en)?\b/gi,'دادەبەزێت'], [/\bdrop(s|ped)?\b/gi,'دادەبەزێت'], [/\bdecline(s|d)?\b/gi,'کەم دەبێتەوە'], [/\bpost(s|ed)?\b/gi,'تۆمار دەکات'],
    [/\bTrump\b/g,'ترامپ'], [/\bDonald Trump\b/g,'دۆناڵد ترامپ'], [/\bWhite House\b/gi,'کۆشکی سپی'], [/\btariff(s)?\b/gi,'باجی گومرکی'], [/\btrade\b/gi,'بازرگانی'], [/\bwar\b/gi,'جەنگ'], [/\battack\b/gi,'هێرش'], [/\bsanction(s)?\b/gi,'سزا'], [/\bdeal\b/gi,'ڕێککەوتن'], [/\bnews\b/gi,'هەواڵ'],
    [/\bcompany\b/gi,'کۆمپانیا'], [/\bcloud\b/gi,'کڵاود'], [/\bAI\b/g,'زیرەکی دەستکرد'], [/\bcompute\b/gi,'کۆمپیوت'], [/\bpower\b/gi,'هێز'], [/\bcapacity\b/gi,'توانا'], [/\basset(s)?\b/gi,'سامان'], [/\binventory|inventories\b/gi,'کۆگا'], [/\bmajor\b/gi,'گەورە'], [/\banother\b/gi,'یەکێکی تر'], [/\bassume(s|d)?\b/gi,'دەگرێتە ئەستۆ'], [/\boperator(ship)?\b/gi,'بەڕێوەبردن']
  ]
  phrases.forEach(([re, ku]) => { out = out.replace(re, ku) })
  if(/[a-zA-Z]{3,}/.test(out)) out = 'هەواڵ: ' + out
  return out
}

function pickKu(primary, english){
  if(primary && !sameText(primary, english)) return primary
  return smartKu(english || primary || '')
}

export function getTitle(item, lang){
  const en = item.titleEn || item.title || ''
  return lang==='ku' ? pickKu(item.titleKu, en) : lang==='ar' ? (item.titleAr || en) : en
}
export function getSummary(item, lang){
  const en = item.summaryEn || item.summary || ''
  return lang==='ku' ? pickKu(item.summaryKu, en) : lang==='ar' ? (item.summaryAr || en) : en
}
export function getWhy(item, lang){
  const en = item.whyEn || ''
  return lang==='ku' ? pickKu(item.whyKu, en) : lang==='ar' ? (item.whyAr || en) : en
}
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
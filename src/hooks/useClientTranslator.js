import { useEffect, useMemo, useState } from 'react'

const cache = new Map()
const GOOGLE_TARGET = { ku: 'ckb', ar: 'ar', en: 'en' }
const SEP = ' |||HAWALI||| '

function clean(value=''){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

async function translatePair(title, summary, lang){
  const target = GOOGLE_TARGET[lang] || 'en'
  const titleText = clean(title)
  const summaryText = clean(summary)
  if(!titleText && !summaryText) return { title:'', summary:'' }
  if(target === 'en') return { title:titleText, summary:summaryText }

  const cacheKey = `${target}:${titleText}:${summaryText}`
  if(cache.has(cacheKey)) return cache.get(cacheKey)

  const stored = localStorage.getItem('hawali-tr-' + cacheKey)
  if(stored){
    try{
      const parsed = JSON.parse(stored)
      cache.set(cacheKey, parsed)
      return parsed
    }catch{}
  }

  try{
    const q = `${titleText}${SEP}${summaryText}`
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(q)
    const res = await fetch(url)
    if(!res.ok) throw new Error('translate failed')
    const data = await res.json()
    const translated = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('') : ''
    const [translatedTitle, translatedSummary] = translated.split(SEP)
    const result = {
      title: clean(translatedTitle || translated || titleText),
      summary: clean(translatedSummary || summaryText)
    }
    cache.set(cacheKey, result)
    try{ localStorage.setItem('hawali-tr-' + cacheKey, JSON.stringify(result)) }catch{}
    return result
  }catch{
    return { title:titleText, summary:summaryText }
  }
}

async function translateInBatches(items, lang, onProgress){
  const output = [...items]
  const batchSize = 6
  for(let i = 0; i < items.length; i += batchSize){
    const batch = items.slice(i, i + batchSize)
    const translated = await Promise.all(batch.map(async item => {
      const titleEn = item.titleEn || item.title || ''
      const summaryEn = item.summaryEn || item.summary || ''
      const pair = await translatePair(titleEn, summaryEn, lang)
      return {
        ...item,
        titleEn,
        summaryEn,
        ...(lang === 'ku' ? { titleKu: pair.title, summaryKu: pair.summary } : {}),
        ...(lang === 'ar' ? { titleAr: pair.title, summaryAr: pair.summary } : {})
      }
    }))
    translated.forEach((item, idx) => { output[i + idx] = item })
    onProgress([...output])
  }
}

export function useClientTranslator(news, lang){
  const stableNews = useMemo(() => Array.isArray(news) ? news : [], [news])
  const [translatedNews, setTranslatedNews] = useState(stableNews)
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    let cancelled = false
    const base = stableNews.map(item => ({
      ...item,
      titleEn: item.titleEn || item.title || '',
      summaryEn: item.summaryEn || item.summary || ''
    }))

    if(lang === 'en'){
      setTranslatedNews(base)
      setTranslating(false)
      return
    }

    setTranslatedNews(base)
    setTranslating(true)
    translateInBatches(base, lang, partial => {
      if(!cancelled) setTranslatedNews(partial)
    }).finally(() => {
      if(!cancelled) setTranslating(false)
    })

    return () => { cancelled = true }
  }, [stableNews, lang])

  return { translatedNews, translating }
}

import { useEffect, useMemo, useState } from 'react'

const memory = new Map()
const CACHE_PREFIX = 'hawali_translate_v3_'

function clean(value = ''){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function comparable(value = ''){
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function usefulText(original, translated){
  const output = clean(translated)
  return output && comparable(output) !== comparable(original) ? output : ''
}

async function translateItem(item, lang){
  const titleEn = item.titleEn || item.title || ''
  const summaryEn = item.summaryEn || item.summary || ''
  if(lang === 'en') return { ...item, titleEn, summaryEn }

  const key = `${lang}:${titleEn}:${summaryEn}`
  if(memory.has(key)) return { ...item, titleEn, summaryEn, ...memory.get(key) }

  try{
    const saved = sessionStorage.getItem(CACHE_PREFIX + key)
    if(saved){
      const parsed = JSON.parse(saved)
      memory.set(key, parsed)
      return { ...item, titleEn, summaryEn, ...parsed }
    }
  }catch{}

  try{
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, texts: [clean(titleEn), clean(summaryEn)] })
    })
    if(!response.ok) throw new Error('bad response')
    const data = await response.json()
    if(data.ok === false || !Array.isArray(data.translated)) throw new Error(data.error || 'Translate failed')
    const title = usefulText(titleEn, data.translated?.[0])
    const summary = usefulText(summaryEn, data.translated?.[1])
    if(!title && !summary) throw new Error('No translated text')
    const fields = {}
    if(lang === 'ku'){
      if(title) fields.titleKu = title
      if(summary) fields.summaryKu = summary
    }else{
      if(title) fields.titleAr = title
      if(summary) fields.summaryAr = summary
    }
    memory.set(key, fields)
    try{ sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(fields)) }catch{}
    return { ...item, titleEn, summaryEn, ...fields }
  }catch{
    return { ...item, titleEn, summaryEn }
  }
}

async function translateList(items, lang, update){
  const output = [...items]
  for(let i = 0; i < items.length; i += 4){
    const part = items.slice(i, i + 4)
    const result = await Promise.all(part.map(item => translateItem(item, lang)))
    result.forEach((item, index) => { output[i + index] = item })
    update([...output])
  }
}

export function useClientTranslator(news, lang){
  const source = useMemo(() => Array.isArray(news) ? news : [], [news])
  const [translatedNews, setTranslatedNews] = useState(source)
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    let stopped = false
    const base = source.map(item => ({ ...item, titleEn: item.titleEn || item.title || '', summaryEn: item.summaryEn || item.summary || '' }))
    setTranslatedNews(base)
    if(lang === 'en'){
      setTranslating(false)
      return
    }
    setTranslating(true)
    translateList(base, lang, items => { if(!stopped) setTranslatedNews(items) })
      .finally(() => { if(!stopped) setTranslating(false) })
    return () => { stopped = true }
  }, [source, lang])

  return { translatedNews, translating }
}

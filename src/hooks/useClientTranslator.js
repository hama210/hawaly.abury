import { useEffect, useMemo, useState } from 'react'

const memory = new Map()
const CACHE_PREFIX = 'hawali_translate_v4_'
const ARTICLES_PER_REQUEST = 15

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

function itemKey(item, lang){
  return `${lang}:${item.titleEn || item.title || ''}:${item.summaryEn || item.summary || ''}`
}

function readSaved(key){
  if(memory.has(key)) return memory.get(key)
  try{
    const saved = sessionStorage.getItem(CACHE_PREFIX + key)
    if(!saved) return null
    const parsed = JSON.parse(saved)
    memory.set(key, parsed)
    return parsed
  }catch{
    return null
  }
}

function saveFields(key, fields){
  memory.set(key, fields)
  try{ sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(fields)) }catch{}
}

function translatedFields(item, lang, titleValue, summaryValue){
  const titleEn = item.titleEn || item.title || ''
  const summaryEn = item.summaryEn || item.summary || ''
  const title = usefulText(titleEn, titleValue)
  const summary = usefulText(summaryEn, summaryValue)
  const fields = {}
  if(lang === 'ku'){
    if(title) fields.titleKu = title
    if(summary) fields.summaryKu = summary
  }else{
    if(title) fields.titleAr = title
    if(summary) fields.summaryAr = summary
  }
  return fields
}

async function translateList(items, lang, update, signal){
  const output = items.map(item => ({
    ...item,
    titleEn: item.titleEn || item.title || '',
    summaryEn: item.summaryEn || item.summary || ''
  }))
  const pending = []

  output.forEach((item, index) => {
    const key = itemKey(item, lang)
    const saved = readSaved(key)
    if(saved) output[index] = { ...item, ...saved }
    else if(item.titleEn || item.summaryEn) pending.push({ index, item, key })
  })
  update([...output])

  for(let offset = 0; offset < pending.length; offset += ARTICLES_PER_REQUEST){
    if(signal.aborted) return
    const batch = pending.slice(offset, offset + ARTICLES_PER_REQUEST)
    const texts = batch.flatMap(({ item }) => [clean(item.titleEn), clean(item.summaryEn)])
    try{
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, texts }),
        signal
      })
      if(!response.ok) throw new Error('Translation request failed')
      const data = await response.json()
      if(data.ok === false || !Array.isArray(data.translated)) throw new Error(data.error || 'Translate failed')
      batch.forEach(({ index, item, key }, batchIndex) => {
        const fields = translatedFields(item, lang, data.translated[batchIndex * 2], data.translated[batchIndex * 2 + 1])
        if(Object.keys(fields).length){
          saveFields(key, fields)
          output[index] = { ...output[index], ...fields }
        }
      })
      update([...output])
    }catch(error){
      if(signal.aborted || error?.name === 'AbortError') return
      break
    }
  }
}

export function useClientTranslator(news, lang){
  const source = useMemo(() => Array.isArray(news) ? news : [], [news])
  const [translatedNews, setTranslatedNews] = useState(source)
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const base = source.map(item => ({ ...item, titleEn: item.titleEn || item.title || '', summaryEn: item.summaryEn || item.summary || '' }))
    setTranslatedNews(base)
    if(lang === 'en'){
      setTranslating(false)
      return () => controller.abort()
    }
    setTranslating(true)
    translateList(base, lang, items => {
      if(!controller.signal.aborted) setTranslatedNews(items)
    }, controller.signal).finally(() => {
      if(!controller.signal.aborted) setTranslating(false)
    })
    return () => controller.abort()
  }, [source, lang])

  return { translatedNews, translating }
}

import { useEffect, useMemo, useState } from 'react'

const memory = new Map()
const CACHE_PREFIX = 'hawali_translate_v6_'
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

// Translate headlines first to make the main news usable before summaries finish.
async function translateList(items,lang,update,signal){
  const output=items.map(item=>({...item,titleEn:item.titleEn||item.title||'',summaryEn:item.summaryEn||item.summary||''}))
  const titles=[], summaries=[]
  for(const [index,item] of output.entries()){
    const key=itemKey(item,lang)
    const saved=readSaved(key)
    if(saved) output[index]={...item,...saved}
    const titleField=lang==='ku'?'titleKu':'titleAr'
    const summaryField=lang==='ku'?'summaryKu':'summaryAr'
    if(!output[index][titleField] && clean(item.titleEn)) titles.push({index,item,key})
    if(!output[index][summaryField] && clean(item.summaryEn)) summaries.push({index,item,key})
  }
  update([...output])

  async function requestBatch(batch,field){
    const texts=batch.map(({item})=>clean(field==='title'?item.titleEn:item.summaryEn))
    const response=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang,texts}),signal})
    const data=await response.json().catch(()=>({}))
    if(!response.ok||data.ok===false||!Array.isArray(data.translated)||data.translated.length!==texts.length) throw new Error(data.error||'Translation unavailable')
    batch.forEach(({index,key},offset)=>{
      const value=usefulText(texts[offset],data.translated[offset])
      if(!value||((lang==='ku'||lang==='ar')&&!/[\u0600-\u06FF]/u.test(value)))return
      const fieldName=field==='title'?(lang==='ku'?'titleKu':'titleAr'):(lang==='ku'?'summaryKu':'summaryAr')
      const fields={...(readSaved(key)||{}),[fieldName]:value}
      saveFields(key,fields)
      output[index]={...output[index],...fields}
    })
    update([...output])
    return Array.isArray(data.sources)&&data.sources.every(status=>status==='unavailable'||status==='original')
  }

  async function phase(entries,field){
    const batches=[]
    for(let i=0;i<entries.length;i+=8)batches.push(entries.slice(i,i+8))
    let index=0,unavailable=false
    async function run(){
      while(index<batches.length&&!unavailable&&!signal.aborted){
        try{if(await requestBatch(batches[index++],field))unavailable=true}
        catch(error){if(signal.aborted||error?.name==='AbortError')return;unavailable=true}
      }
    }
    await Promise.all(Array.from({length:Math.min(3,batches.length)},run))
    return !unavailable
  }
  if(await phase(titles,'title')) if(!signal.aborted)await phase(summaries,'summary')
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

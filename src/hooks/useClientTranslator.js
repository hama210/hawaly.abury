import { useEffect, useMemo, useRef, useState } from 'react';

// Persistent, incremental translations survive each incoming RSS batch.
const memory=new Map();
const failedUntil=new Map();
const CACHE_PREFIX='hawali_translate_v7_';
const MAX_BATCH=5;
const CONCURRENCY=2;

function clean(value=''){return String(value||'').replace(/\s+/g,' ').trim();}
function comparable(value=''){return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function fieldKey(item,lang){return lang+':'+(item.titleEn||item.title||'')+':'+(item.summaryEn||item.summary||'');}
function textIsTranslated(original,output){
  return Boolean(clean(output)) && comparable(output)!==comparable(original) && /[\u0600-\u06FF]/u.test(output);
}
function savedFields(key){
  if(memory.has(key))return memory.get(key);
  try{
    const raw=sessionStorage.getItem(CACHE_PREFIX+key);
    if(!raw)return {};
    const saved=JSON.parse(raw);
    memory.set(key,saved);
    return saved;
  }catch{return {};}
}
function saveFields(key,fields){
  const value={...savedFields(key),...fields};
  memory.set(key,value);
  try{sessionStorage.setItem(CACHE_PREFIX+key,JSON.stringify(value));}catch{}
}
function newWorker(lang,updateVersion,setBusy){
  return {lang,queueTitles:[],queueSummaries:[],scheduled:new Set(),running:0,
    controller:new AbortController(),cancelled:false,pausedUntil:0,updateVersion,setBusy,pump:null};
}

export function useClientTranslator(news,lang,visibleLimit=24){
  const source=useMemo(()=>Array.isArray(news)?news:[],[news]);
  const [revision,setRevision]=useState(0);
  const [translating,setTranslating]=useState(false);
  const current=useRef(null);

  const translatedNews=useMemo(()=>source.map(item=>({
    ...item,
    titleEn:item.titleEn||item.title||'',
    summaryEn:item.summaryEn||item.summary||'',
    ...(lang==='en'?{}:savedFields(fieldKey(item,lang)))
  })),[source,lang,revision]);

  useEffect(()=>{
    let work=current.current;
    if(!work||work.lang!==lang){
      if(work){work.cancelled=true;work.controller.abort();}
      work=newWorker(lang,setRevision,setTranslating);
      current.current=work;
      setTranslating(false);
    }
    if(lang==='en')return;
    if(work.pausedUntil>Date.now())return;

    const limit=Math.max(1,Math.min(Number(visibleLimit)||24,source.length));
    const visible=source.slice(0,limit);
    const titleField=lang==='ku'?'titleKu':'titleAr';
    const summaryField=lang==='ku'?'summaryKu':'summaryAr';
    const now=Date.now();
    for(const item of visible){
      const key=fieldKey(item,lang),cached=savedFields(key);
      const title=clean(item.titleEn||item.title);
      const summary=clean(item.summaryEn||item.summary);
      for(const [field,text,destination,queue] of [
        ['title',title,titleField,work.queueTitles],
        ['summary',summary,summaryField,work.queueSummaries]
      ]){
        const taskId=key+':'+field;
        if(!text||cached[destination]||item[destination]||work.scheduled.has(taskId)||(failedUntil.get(taskId)||0)>now)continue;
        work.scheduled.add(taskId);
        queue.push({key,taskId,text,destination});
      }
    }

    if(!work.pump){
      work.pump=()=>{
        if(work.cancelled)return;
        while(work.running<CONCURRENCY && (work.queueTitles.length||work.queueSummaries.length) && work.pausedUntil<=Date.now()){
          const list=work.queueTitles.length?work.queueTitles:work.queueSummaries;
          const batch=list.splice(0,MAX_BATCH);
          work.running++;
          const body=JSON.stringify({lang:work.lang,texts:batch.map(job=>job.text)});
          fetch('/api/translate',{
            method:'POST',headers:{'Content-Type':'application/json'},body,
            signal:work.controller.signal
          }).then(async response=>{
            const result=await response.json().catch(()=>({}));
            if(!response.ok||!result.ok||!Array.isArray(result.translated)||result.translated.length!==batch.length)
              throw new Error('translation API unavailable');
            let changed=false,unavailable=0;
            batch.forEach((job,index)=>{
              const output=result.translated[index];
              if(textIsTranslated(job.text,output)){
                saveFields(job.key,{[job.destination]:clean(output)});
                changed=true;
              }else{
                unavailable++;
                failedUntil.set(job.taskId,Date.now()+5*60*1000);
              }
            });
            if(changed&&!work.cancelled)work.updateVersion(value=>value+1);
            if(unavailable===batch.length){
              // Don't send hundreds of requests when translation services are down.
              work.pausedUntil=Date.now()+2*60*1000;
              work.queueTitles.length=0;
              work.queueSummaries.length=0;
            }
          }).catch(error=>{
            if(work.cancelled||error?.name==='AbortError')return;
            work.pausedUntil=Date.now()+2*60*1000;
            work.queueTitles.length=0;
            work.queueSummaries.length=0;
          }).finally(()=>{
            work.running--;
            if(!work.cancelled)work.pump();
          });
        }
        work.setBusy(work.running>0||work.queueTitles.length>0||work.queueSummaries.length>0);
      };
    }
    work.pump();
  },[source,lang,visibleLimit]);

  useEffect(()=>()=>{if(current.current){current.current.cancelled=true;current.current.controller.abort();}},[]);
  return {translatedNews,translating};
}

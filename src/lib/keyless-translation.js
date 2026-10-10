import {alreadyInTargetLanguage,validateTranslation} from './translation-check.js';
import {googleTargets,requestGoogleTranslation,translationFailure,translationVersion} from './google-translate.js';

// Serialize requests across headlines, summaries and article readers. A second
// consumer of the same text reuses the first result instead of hitting Google.
export function createKeylessTranslator({fetcher=fetch,now=Date.now,storage=()=>globalThis.sessionStorage}={}){
  const cache=new Map();
  let tail=Promise.resolve();
  let browserUnavailableUntil=0;
  let serverUnavailableUntil=0;
  const ttl=24*60*60*1000;
  const prefix=translationVersion+':';

  function read(text,lang){
    const key=prefix+lang+':'+text;
    let value=cache.get(key);
    if(!value){
      try{value=JSON.parse(storage()?.getItem(key)||'null');}catch{}
    }
    if(!value||now()-value.savedAt>ttl)return null;
    const checked=validateTranslation(text,value.text,lang);
    if(!checked.ok)return null;
    cache.set(key,value);
    return {text:checked.text,translated:true,provider:'browser-cache'};
  }
  function save(text,lang,translated){
    const key=prefix+lang+':'+text;
    const value={text:translated,savedAt:now()};
    cache.set(key,value);
    try{storage()?.setItem(key,JSON.stringify(value));}catch{}
  }
  function serial(work){
    const result=tail.then(work);
    tail=result.catch(()=>{});
    return result;
  }

  return async function translatePassages(texts,lang,{signal}={}){
    if(!googleTargets[lang])throw new Error('Unsupported translation language');
    signal?.throwIfAborted();
    const result=await Promise.all(texts.map(raw=>serial(async()=>{
      signal?.throwIfAborted();
      const text=String(raw||'').replace(/\s+/gu,' ').trim();
      if(!text||alreadyInTargetLanguage(text,lang))
        return {text,translated:false,provider:'original-language',reason:null};
      const cached=read(text,lang);
      if(cached)return cached;
      if(now()<browserUnavailableUntil)
        return {text,translated:false,provider:'original',reason:'google-browser:cooldown'};
      try{
        const output=await requestGoogleTranslation(text,lang,{fetcher,signal});
        signal?.throwIfAborted();
        const checked=validateTranslation(text,output,lang);
        if(!checked.ok)return {text,translated:false,provider:'original',reason:'google-browser:'+checked.reason};
        save(text,lang,checked.text);
        return {text:checked.text,translated:true,provider:'google-browser'};
      }catch(error){
        signal?.throwIfAborted();
        const reason=translationFailure(error);
        // Stop a failed network route for a minute; never repeatedly send a
        // whole news feed into a rate limit or follow a verification redirect.
        browserUnavailableUntil=now()+60_000;
        return {text,translated:false,provider:'original',reason:'google-browser:'+reason};
      }
    })));
    signal?.throwIfAborted();
    const failed=result.map((row,index)=>({row,index})).filter(({row})=>row.reason);
    // The server still helps browsers where the Google cross-origin request
    // is unavailable. Its cache and cooldown prevent repeated provider floods.
    if(failed.length && now()>=serverUnavailableUntil){
      try{
        const response=await fetcher('/api/translate',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({lang,texts:failed.map(({row})=>row.text)}),
          signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15_000)])
        });
        const body=response.ok?await response.json():null;
        signal?.throwIfAborted();
        let recovered=false;
        for(let j=0;j<failed.length;j++){
          const {row,index}=failed[j];
          const checked=validateTranslation(row.text,body?.translated?.[j],lang);
          if(body?.ok && body?.translatedFlags?.[j] && checked.ok){
            save(row.text,lang,checked.text);
            result[index]={text:checked.text,translated:true,provider:body.sources?.[j]||'google-public'};
            recovered=true;
          }else if(body?.failureReasons?.[j])result[index].reason+=';'+body.failureReasons[j];
        }
        if(!recovered)serverUnavailableUntil=now()+60_000;
      }catch(error){
        signal?.throwIfAborted();
        serverUnavailableUntil=now()+60_000;
      }
    }
    return {
      ok:true,lang,translated:result.map(row=>row.text),
      translatedFlags:result.map(row=>row.translated),
      sources:result.map(row=>row.provider),
      failureReasons:result.map(row=>row.reason||null)
    };
  };
}

// Lazily acquire fetch so tests and browser startup use their current runtime.
let client;
export function translatePassages(texts,lang,options){
  client ||= createKeylessTranslator();
  return client(texts,lang,options);
}

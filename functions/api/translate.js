import {validateTranslation,alreadyInTargetLanguage} from '../../src/lib/translation-check.js';
import {googleTargets,requestGoogleTranslation,translationFailure,translationVersion} from '../../src/lib/google-translate.js';

const TRANSLATION_VERSION=translationVersion;
const TTL=24*60*60;
const REQUEST_LIMIT=10;
// The news feed retains summaries of up to 1,000 characters. Accept the
// entire summary so one long item cannot reject an otherwise valid batch.
const MAX_TEXT_CHARS=1000;
const MAX_BODY_BYTES=16000;
const targetCodes=googleTargets;

function headers(){return {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};}
function clean(value){return String(value||'').replace(/\s+/gu,' ').trim();}
async function googlePublic(text,target){
  return requestGoogleTranslation(text,target);
}
async function cacheKey(request,text,target){
  const payload=new TextEncoder().encode(TRANSLATION_VERSION+'\n'+target+'\n'+text);
  const digest=await crypto.subtle.digest('SHA-256',payload);
  const hex=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return new Request(new URL(request.url).origin+'/__translation_cache/'+TRANSLATION_VERSION+'/'+target+'/'+hex);
}
async function translateOne(text,target,request,context,state){
  if(!text)return {text,translated:false,provider:'original'};
  if(alreadyInTargetLanguage(text,target))return {text,translated:false,provider:'original-language'};
  const cache=globalThis.caches?.default;
  const key=cache?await cacheKey(request,text,target):null;
  if(cache && key){
    const cached=await cache.match(key);
    if(cached){
      const value=await cached.json().catch(()=>null);
      const checked=validateTranslation(text,value?.text,target);
      if(checked.ok)return {text:checked.text,translated:true,provider:'cache'};
    }
  }
  if(state.failure)return {text,translated:false,provider:'original',reason:state.failure};
  const providers=[['google-public',()=>googlePublic(text,target)]];
  const failures=[];
  for(const [name,provider] of providers){
    try{
      const result=await provider();
      const checked=validateTranslation(text,result,target);
      if(!checked.ok){
        failures.push(name+':'+checked.reason);
        continue;
      }
      if(cache && key){
        const put=cache.put(key,Response.json({text:checked.text},{headers:{'Cache-Control':'public,max-age='+TTL}})).catch(()=>{});
        context.waitUntil?.(put);
      }
      return {text:checked.text,translated:true,provider:name};
    }catch(error){
      // Keep provider errors observable in Cloudflare logs without logging
      // article text, request headers or secret API keys.
      const kind=translationFailure(error);
      failures.push(name+':'+kind);
      state.failure=failures.join(',');
      console.warn('[Hawal translator] '+name+':'+kind);
    }
  }
  return {text,translated:false,provider:'original',reason:failures.join(',')||'no-provider'};
}
async function mapBounded(values,concurrency,mapper){
  let cursor=0;
  const output=Array(values.length);
  await Promise.all(Array.from({length:Math.min(concurrency,values.length)},async()=>{
    while(cursor<values.length){
      const index=cursor++;
      output[index]=await mapper(values[index],index);
    }
  }));
  return output;
}

export async function onRequest(context){
  const request=context.request;
  const respond=(body,status=200)=>Response.json(body,{status,headers:headers()});
  if(request.method!=='POST')return respond({ok:false,error:'POST required'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)return respond({ok:false,error:'Origin not allowed'},403);
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>MAX_BODY_BYTES)return respond({ok:false,error:'Translation request too large'},413);
  let raw='';
  try{raw=await request.text();}catch{return respond({ok:false,error:'Unreadable request'},400);}
  if(new TextEncoder().encode(raw).length>MAX_BODY_BYTES)return respond({ok:false,error:'Translation request too large'},413);
  let body;
  try{body=JSON.parse(raw);}catch{return respond({ok:false,error:'Invalid JSON'},400);}
  const lang=body?.lang;
  if(!targetCodes[lang])return respond({ok:false,error:'Only Sorani and Arabic targets are supported'},400);
  if(!Array.isArray(body?.texts)||body.texts.length<1||body.texts.length>REQUEST_LIMIT||
    body.texts.some(value=>typeof value!=='string'||value.length>MAX_TEXT_CHARS))
      return respond({ok:false,error:'Expected 1-10 text passages of up to 1000 characters'},413);
  const originals=body.texts.map(clean);
  const state={failure:''};
  const result=await mapBounded(originals,1,txt=>translateOne(txt,lang,request,context,state));
  return respond({
    ok:true,
    lang,
    translated:result.map(row=>row.text),
    translatedFlags:result.map(row=>row.translated),
    sources:result.map(row=>row.provider),
    failureReasons:result.map(row=>row.translated?null:(row.reason||null))
  });
}

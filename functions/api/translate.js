import {validateTranslation,alreadyInTargetLanguage} from '../../src/lib/translation-check.js';

const TRANSLATION_VERSION='hawal-google-v1';
const TTL=24*60*60;
const REQUEST_LIMIT=10;
const MAX_TEXT_CHARS=950;
const MAX_BODY_BYTES=16000;
const TIMEOUT_MS=7000;
const targetCodes={ku:'ckb',ar:'ar'};

function headers(){return {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};}
function clean(value){return String(value||'').replace(/\s+/gu,' ').trim();}
function htmlDecode(value){
  return String(value||'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|#39);/gi,(_,code)=>{
    const name=code.toLowerCase();
    if(name==='amp')return '&';
    if(name==='lt')return '<';
    if(name==='gt')return '>';
    if(name==='quot')return '"';
    if(name==='apos'||name==='#39')return "'";
    const number=name.startsWith('#x')?parseInt(name.slice(2),16):parseInt(name.slice(1),10);
    return Number.isSafeInteger(number)&&number>0&&number<0x110000?String.fromCodePoint(number):'';
  });
}
async function fetchJson(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('translator timed out'),TIMEOUT_MS);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,redirect:'error'});
    if(!response.ok)throw new Error('translator status '+response.status);
    return await response.json();
  }finally{clearTimeout(timer);}
}
async function googleCloud(text,target,env){
  const key=env?.GOOGLE_TRANSLATE_API_KEY;
  if(!key)return '';
  const result=await fetchJson('https://translation.googleapis.com/language/translate/v2?key='+encodeURIComponent(key),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({q:[text],target:targetCodes[target],format:'text'})
  });
  return htmlDecode(clean(result?.data?.translations?.[0]?.translatedText));
}
async function googlePublic(text,target){
  // Unauthenticated Google web endpoint: best effort only, not a guaranteed API.
  // Prefer the supported Google Cloud Translation API when configured.
  const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+targetCodes[target]+'&dt=t&q='+encodeURIComponent(text);
  const result=await fetchJson(url,{headers:{'Accept':'application/json'}});
  return htmlDecode(clean((result?.[0]||[]).map(segment=>Array.isArray(segment)?segment[0]:'').join('')));
}
async function cacheKey(request,text,target){
  const payload=new TextEncoder().encode(TRANSLATION_VERSION+'\n'+target+'\n'+text);
  const digest=await crypto.subtle.digest('SHA-256',payload);
  const hex=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return new Request(new URL(request.url).origin+'/__translation_cache/'+TRANSLATION_VERSION+'/'+target+'/'+hex);
}
async function translateOne(text,target,request,context){
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
  const providers=[];
  if(context.env?.GOOGLE_TRANSLATE_API_KEY)providers.push(['google-cloud',()=>googleCloud(text,target,context.env)]);
  providers.push(['google-public',()=>googlePublic(text,target)]);
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
      const status=/translator status (\d+)/.exec(String(error?.message||''))?.[1];
      const kind=status?'http-'+status:error?.name==='AbortError'?'timeout':'network-error';
      failures.push(name+':'+kind);
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
      return respond({ok:false,error:'Expected 1-10 text passages of up to 950 characters'},413);
  const originals=body.texts.map(clean);
  const result=await mapBounded(originals,3,txt=>translateOne(txt,lang,request,context));
  return respond({
    ok:true,
    lang,
    translated:result.map(row=>row.text),
    translatedFlags:result.map(row=>row.translated),
    sources:result.map(row=>row.provider),
    failureReasons:result.map(row=>row.translated?null:(row.reason||null))
  });
}

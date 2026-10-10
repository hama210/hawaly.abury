// Safe, fixed-input diagnostic for verifying a configured translation
// provider actually works. No request text, credentials, or arbitrary
// translation parameters are accepted.
import { onRequest as translate } from './translate.js';

const SAMPLE='Gold prices fell in Baghdad today.';
const KEY_PATH='/__hawal_translation_health_v1';
const TTL=120;

export async function onRequest(context){
  if(context.request.method!=='GET')return Response.json({ok:false,error:'GET only'},{
    status:405,headers:{'Cache-Control':'no-store'}
  });
  const origin=new URL(context.request.url).origin;
  const cache=globalThis.caches?.default;
  const key=new Request(origin+KEY_PATH);
  if(cache){
    const hit=await cache.match(key).catch(()=>null);
    if(hit)return hit;
  }
  const request=new Request(origin+'/api/translate',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({lang:'ku',texts:[SAMPLE]})
  });
  try{
    const upstream=await translate({...context,request});
    const result=await upstream.json();
    const valid=upstream.ok && result?.ok===true && result?.translatedFlags?.[0]===true;
    // The only translated text that may be returned is the fixed, public sample.
    const body={
      ok:valid,
      revision:'hawal-translation-check-v1',
      sampleSource:SAMPLE,
      sampleTranslation:valid?String(result.translated?.[0]||''):null,
      provider:valid?result.sources?.[0]||'unknown':'unavailable',
      failure:valid?null:(result.failureReasons?.[0]||result.error||'unknown')
    };
    const response=Response.json(body,{
      status:200,
      headers:{'Cache-Control':'public,max-age='+TTL,
               'X-Content-Type-Options':'nosniff'}
    });
    if(cache&&typeof context.waitUntil==='function'){
      context.waitUntil(cache.put(key,response.clone()).catch(()=>{}));
    }
    return response;
  }catch{
    return Response.json({ok:false,revision:'hawal-translation-check-v1',provider:'unavailable',failure:'internal-error'},
      {status:200,headers:{'Cache-Control':'no-store'}});
  }
}

import { isProxyableNewsImage } from '../../src/lib/news-images.js';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const CACHE_SECONDS = 6 * 60 * 60;
const FETCH_TIMEOUT_MS = 5500;

async function limitedBytes(response){
  const length=Number(response.headers.get('content-length') || 0);
  if(length > MAX_IMAGE_BYTES) throw new Error('image too large');
  if(!response.body) throw new Error('empty image');
  const reader=response.body.getReader();
  const chunks=[];
  let total=0;
  for(;;){
    const part=await reader.read();
    if(part.done) break;
    total+=part.value.byteLength;
    if(total > MAX_IMAGE_BYTES){
      await reader.cancel('image too large');
      throw new Error('image too large');
    }
    chunks.push(part.value);
  }
  const bytes=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}

export async function onRequest(context){
  const request=context.request;
  if(request.method !== 'GET' && request.method !== 'HEAD') return new Response('GET only',{status:405});
  const url=new URL(request.url);
  const src=url.searchParams.get('src') || '';
  // Explicitly whitelist news media CDNs: never create an unrestricted URL proxy.
  if(!isProxyableNewsImage(src)) return new Response('Unsupported news image host',{status:400,headers:{'Cache-Control':'no-store'}});
  const cache=globalThis.caches?.default;
  const key=new Request(url.origin+url.pathname+'?src='+encodeURIComponent(src));
  if(cache){
    const saved=await cache.match(key);
    if(saved) return request.method === 'HEAD' ? new Response(null,{status:saved.status,headers:saved.headers}) : saved;
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort('image timeout'),FETCH_TIMEOUT_MS);
  try{
    const response=await fetch(src,{
      signal:controller.signal,redirect:'manual',
      headers:{'Accept':'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8'},
      cf:{cacheTtl:CACHE_SECONDS,cacheEverything:false}
    });
    if(!response.ok) throw new Error('image HTTP '+response.status);
    const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(type))
      throw new Error('not an image');
    const data=await limitedBytes(response);
    if(!data.length)throw new Error('empty image');
    const output=new Response(request.method==='HEAD'?null:data,{
      headers:{
        'Content-Type':type,
        'Cache-Control':'public, max-age='+CACHE_SECONDS,
        'X-Content-Type-Options':'nosniff'
      }
    });
    if(cache && request.method==='GET'){
      const promise=cache.put(key,output.clone()).catch(()=>{});
      if(context.waitUntil)context.waitUntil(promise);
      else await promise;
    }
    return output;
  }catch{
    return new Response('Publisher photo unavailable',{status:502,headers:{'Cache-Control':'public,max-age=60'}});
  }finally{clearTimeout(timeout);}
}

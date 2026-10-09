import { coverForCategory, extractOpenGraphImage, trustedArticleUrl, trustedRemoteImage } from '../../src/lib/news-images.js';

const MAX_HTML_BYTES=256*1024;
const MAX_IMAGE_BYTES=4*1024*1024;
const CACHE_SECONDS=6*60*60;

async function limitedBody(response,maxBytes){
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>maxBytes)throw new Error('response too large');
  if(!response.body)throw new Error('missing response body');
  const reader=response.body.getReader(),chunks=[];
  let size=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>maxBytes){
      await reader.cancel('size limit');
      break;
    }
    chunks.push(value);
  }
  const output=new Uint8Array(Math.min(size,maxBytes));
  let offset=0;
  for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}
  return output.subarray(0,offset);
}

function fallback(category){
  return Response.redirect(coverForCategory(category),302);
}

export async function onRequest(context){
  const request=context.request;
  if(request.method!=='GET')return new Response('GET only',{status:405});
  const url=new URL(request.url);
  const article=trustedArticleUrl(url.searchParams.get('article')||'');
  const category=url.searchParams.get('category')||'markets';
  if(!article)return fallback(category);
  const cache=globalThis.caches?.default;
  const key=new Request(url.origin+url.pathname+'?article='+encodeURIComponent(article)+'&category='+encodeURIComponent(category));
  if(cache){
    const previous=await cache.match(key);
    if(previous)return previous;
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort('publisher image timeout'),6500);
  let output;
  try{
    const source=await fetch(article,{
      signal:controller.signal,redirect:'manual',
      headers:{'Accept':'text/html,application/xhtml+xml'},
      cf:{cacheTtl:1800,cacheEverything:false}
    });
    if(!source.ok)throw new Error('publisher page unavailable');
    const type=source.headers.get('content-type')||'';
    if(type && !/html|xml/i.test(type))throw new Error('not article HTML');
    const html=new TextDecoder().decode(await limitedBody(source,MAX_HTML_BYTES));
    const picture=trustedRemoteImage(extractOpenGraphImage(html,article));
    if(!picture)throw new Error('no publisher image');
    const image=await fetch(picture,{
      signal:controller.signal,redirect:'manual',
      headers:{'Accept':'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8'},
      cf:{cacheTtl:CACHE_SECONDS,cacheEverything:false}
    });
    if(!image.ok)throw new Error('publisher media unavailable');
    const imageType=(image.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(imageType))
      throw new Error('unsupported photo');
    if(Number(image.headers.get('content-length')||0)>MAX_IMAGE_BYTES)throw new Error('photo too large');
    const bytes=await limitedBody(image,MAX_IMAGE_BYTES);
    if(!bytes.length)throw new Error('empty photo');
    output=new Response(bytes,{
      headers:{'Content-Type':imageType,'Cache-Control':'public,max-age='+CACHE_SECONDS,'X-Content-Type-Options':'nosniff'}
    });
  }catch{
    output=fallback(category);
  }finally{clearTimeout(timeout);}
  if(cache && output.ok){
    const cacheWrite=cache.put(key,output.clone()).catch(()=>{});
    if(context.waitUntil)context.waitUntil(cacheWrite);
    else await cacheWrite;
  }
  return output;
}

import { onRequest as loadNews } from './api/news.js';
import { onRequest as loadMarkets } from './api/markets.js';
import { pageRoute, pagePath } from '../src/lib/market-tools.js';
import { renderPage } from '../src/lib/server-page.js';

async function snapshot(context) {
 const origin = new URL(context.request.url).origin;
 const cache = globalThis.caches?.default;
 const key = new Request(origin + '/__hawall_snapshot_v1');
 const cached = cache && await cache.match(key);
 if (cached) { try { return await cached.json(); } catch {} }
 const call = async (handler,path) => { try { const response=await handler({...context, request:new Request(origin+path)}); return response.ok?await response.json():{}; } catch { return {}; } };
 const [news,markets]=await Promise.all([call(loadNews,'/api/news?mode=fast&limit=12'),call(loadMarkets,'/api/markets')]);
 const data={news:Array.isArray(news.items)?news.items:[],markets:Array.isArray(markets.items)?markets.items:[]};
 if (cache && (data.news.length || data.markets.some(q=>q.price))) context.waitUntil(cache.put(key,Response.json(data,{headers:{'Cache-Control':'public, max-age=120'}})).catch(()=>{}));
 return data;
}
export async function onRequest(context) {
 const url=new URL(context.request.url);
 if (!['GET','HEAD'].includes(context.request.method) || url.pathname.startsWith('/api/') || /\.[a-z0-9]+$/i.test(url.pathname)) return context.next();
 const route=pageRoute(url.pathname);
 if (!route.valid) return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 const canonical=pagePath(route.lang,route.page);
 if(url.pathname!==canonical) return Response.redirect(url.origin+canonical+url.search,308);
 const response=await context.next();
 if (!response.headers.get('content-type')?.includes('text/html')) return response;
 const data=route.page==='home'?await snapshot(context):{news:[],markets:[]};
 const html=renderPage(await response.text(),{...route,...data});
 const headers=new Headers(response.headers);
 headers.set('Content-Type','text/html; charset=utf-8');
 headers.set('Cache-Control','public, max-age=0, s-maxage=120, must-revalidate');
 headers.set('X-Hawall-Version','2026-10-market-desk');
 headers.delete('Content-Length'); headers.delete('ETag');
 return new Response(context.request.method==='HEAD'?null:html,{status:200,headers});
}

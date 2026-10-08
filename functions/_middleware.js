// Cloudflare Pages middleware: one source-backed SSR pipeline for crawlers and clients.
// The news API owns the RSS feed list; never override the React mount with a
// separate HTMLRewriter snapshot or fetch unconfigured, duplicate feeds.
import { onRequest as loadNews } from './api/news.js';
import { onRequest as loadMarkets } from './api/markets.js';
import { pageRoute, pagePath } from '../src/lib/market-tools.js';
import { renderPage } from '../src/lib/server-page.js';

const EDGE_VERSION = '2026-10-ssr-routes-v2';
const SNAPSHOT_SECONDS = 120;

async function snapshot(context) {
  const origin = new URL(context.request.url).origin;
  const cache = globalThis.caches?.default;
  const key = new Request(origin + '/__hawall_snapshot_v1');
  const cached = cache && await cache.match(key);
  if (cached) {
    try {
      const saved = await cached.json();
      if (Array.isArray(saved?.news) && Array.isArray(saved?.markets)) return saved;
    } catch { /* Invalid cache entry: reload safely. */ }
  }
  const call = async (handler, path) => {
    try {
      const response = await handler({ ...context, request:new Request(origin+path) });
      return response.ok ? await response.json() : {};
    } catch {
      return {};
    }
  };
  const [news, markets] = await Promise.all([
    call(loadNews, '/api/news?mode=fast&limit=12'),
    call(loadMarkets, '/api/markets')
  ]);
  const data = {
    news:Array.isArray(news.items) ? news.items : [],
    markets:Array.isArray(markets.items) ? markets.items : []
  };
  const hasPrice = data.markets.some(item=>typeof item?.price === 'number' && item.price > 0);
  if (cache && (data.news.length || hasPrice) && typeof context.waitUntil === 'function') {
    const entry = Response.json(data, { headers:{ 'Cache-Control':'public, max-age=' + SNAPSHOT_SECONDS } });
    context.waitUntil(cache.put(key, entry).catch(()=>{}));
  }
  return data;
}

function htmlHeaders(headers, status) {
  const next = new Headers(headers);
  next.set('Content-Type', 'text/html; charset=utf-8');
  next.set('X-Hawall-Version', EDGE_VERSION);
  next.set('X-SSR', status);
  next.set('Cache-Control', status === 'error'
    ? 'no-store'
    : 'public, max-age=0, s-maxage=120, must-revalidate');
  next.delete('Content-Length');
  next.delete('ETag');
  return next;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  // The API must remain JSON; hashed JS/CSS, feeds and static files must pass through.
  if (!['GET','HEAD'].includes(context.request.method)
      || url.pathname.startsWith('/api/')
      || /\.[a-z0-9]+$/i.test(url.pathname)) return context.next();
  const route = pageRoute(url.pathname);
  if (!route.valid) return new Response('Not found', {
    status:404, headers:{ 'Content-Type':'text/plain; charset=utf-8' }
  });
  const canonical = pagePath(route.lang, route.page);
  if (url.pathname !== canonical) return Response.redirect(url.origin + canonical + url.search, 308);

  const response = await context.next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;
  // Clone first, so SSR failure serves the original working app rather than a 500.
  const fallback = response.clone();
  try {
    const originalHtml = await response.text();
    const data = route.page === 'home' ? await snapshot(context) : { news:[], markets:[] };
    const rendered = renderPage(originalHtml, { ...route, ...data });
    const hasSnapshot = data.news.length || data.markets.some(item=>typeof item?.price==='number' && item.price > 0);
    const status = route.page !== 'home' || hasSnapshot ? 'ok' : 'empty';
    return new Response(context.request.method === 'HEAD' ? null : rendered, {
      status:response.status,
      statusText:response.statusText,
      headers:htmlHeaders(response.headers,status)
    });
  } catch(error) {
    console.warn('Hawall edge SSR failed; serving original HTML', error?.message || 'unknown error');
    return new Response(context.request.method === 'HEAD' ? null : fallback.body, {
      status:fallback.status,
      statusText:fallback.statusText,
      headers:htmlHeaders(fallback.headers,'error')
    });
  }
}

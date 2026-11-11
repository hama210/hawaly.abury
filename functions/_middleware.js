// Cloudflare Pages middleware: one source-backed SSR pipeline for crawlers and clients.
// The news API owns the RSS feed list; never override the React mount with a
// separate HTMLRewriter snapshot or fetch unconfigured, duplicate feeds.
import { onRequest as loadNews } from './api/news.js';
import { onRequest as loadMarkets } from './api/markets.js';
import { pageRoute, pagePath } from '../src/lib/market-tools.js';
import { renderPage } from '../src/lib/server-page.js';
import { ownerAuthorized, accessDenied, ownerResponseHeaders } from './lib/owner-auth.js';

const EDGE_VERSION = '2026-11-11-ssr-budget-v3';
const SNAPSHOT_WAIT_MS = 4000;
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

// When the edge's RSS or exchange-rate sources have a cold cache, serve the
// real React shell promptly and finish collecting a snapshot in the background.
// Never fabricate news or exchange-rate values when the deadline expires.
export async function snapshotWithinBudget(pending, budgetMs = SNAPSHOT_WAIT_MS) {
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => resolve({data:{news:[],markets:[]},deferred:true}),budgetMs);
  });
  try {
    return await Promise.race([
      Promise.resolve(pending).then(data => ({data,deferred:false})),
      deadline
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function htmlHeaders(headers, status) {
  const next = new Headers(headers);
  next.set('Content-Type', 'text/html; charset=utf-8');
  next.set('X-Hawall-Version', EDGE_VERSION);
  next.set('X-SSR', status);
  next.set('Cache-Control', ['error','empty','deferred'].includes(status)
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
      || url.pathname === '/owner-health/api'
      || /\.[a-z0-9]+$/i.test(url.pathname)) return context.next();
  const route = pageRoute(url.pathname);
  if (!route.valid) return new Response('Not found', {
    status:404, headers:{ 'Content-Type':'text/plain; charset=utf-8' }
  });
  // Fail closed even on direct/alternate-host requests. Access policy alone is not trusted.
  if (route.page === 'owner-health' && !await ownerAuthorized(context.request,context.env)) return accessDenied();
  const canonical = pagePath(route.lang, route.page);
  if (url.pathname !== canonical) return Response.redirect(url.origin + canonical + url.search, 308);

  const response = await context.next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;
  // Clone first, so SSR failure serves the original working app rather than a 500.
  const fallback = response.clone();
  try {
    const originalHtml = await response.text();
    let data = { news:[], markets:[] };
    let deferred = false;
    if (route.page === 'home') {
      const pending = snapshot(context);
      const result = await snapshotWithinBudget(pending);
      data = result.data;
      deferred = result.deferred;
      if (deferred && typeof context.waitUntil === 'function') {
        context.waitUntil(pending.catch(() => {}));
      }
    }
    const rendered = renderPage(originalHtml, { ...route, ...data });
    const hasSnapshot = data.news.length || data.markets.some(item=>typeof item?.price==='number' && item.price > 0);
    const status = deferred ? 'deferred' : route.page !== 'home' || hasSnapshot ? 'ok' : 'empty';
    return new Response(context.request.method === 'HEAD' ? null : rendered, {
      status:response.status,
      statusText:response.statusText,
      headers:route.page === 'owner-health'
        ? new Headers([...htmlHeaders(response.headers,status),...Object.entries(ownerResponseHeaders)])
        : htmlHeaders(response.headers,status)
    });
  } catch(error) {
    console.warn('Hawall edge SSR failed; serving original HTML', error?.message || 'unknown error');
    return new Response(context.request.method === 'HEAD' ? null : fallback.body, {
      status:fallback.status,
      statusText:fallback.statusText,
      headers:route.page === 'owner-health'
        ? new Headers([...htmlHeaders(fallback.headers,'error'),...Object.entries(ownerResponseHeaders)])
        : htmlHeaders(fallback.headers,'error')
    });
  }
}

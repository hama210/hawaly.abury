import { FEEDS } from './news.js';

export async function onRequest() {
  const sources = [...new Set(FEEDS.map(feed => feed.source).filter(Boolean))];
  const details = FEEDS.map(({ source, category, tier }) => ({ source, category, tier }));
  return Response.json({ sources, details, count: sources.length }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}

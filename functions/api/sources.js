import { FEEDS } from './news.js';

export async function onRequest() {
  const sources = [...new Set(FEEDS.map(feed => feed.source).filter(Boolean))];
  return Response.json({ sources, count: sources.length }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

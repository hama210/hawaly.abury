import { FEEDS } from './news.js';

export async function onRequest() {
  return Response.json({ sources: FEEDS.map(feed => feed.source) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

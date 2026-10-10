import { TRANSLATION_VERSION, TRANSLATION_LANGUAGES, MAX_TRANSLATION_TEXT, MAX_TRANSLATION_BATCH, MAX_TRANSLATION_CHARS } from '../../src/lib/translation-format.js';
import { translateNewsBatch } from '../lib/news-translator.js';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers });

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed' }, 403);
  if (!request.headers.get('Content-Type')?.includes('application/json')) return json({ error: 'JSON required' }, 415);
  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 65536) return json({ error: 'Request too large' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { language, texts } = body || {};
  if (!Object.hasOwn(TRANSLATION_LANGUAGES, language) || !Array.isArray(texts)
      || !texts.length || texts.length > MAX_TRANSLATION_BATCH
      || texts.some(text => typeof text !== 'string' || text.length > MAX_TRANSLATION_TEXT)
      || texts.reduce((size, text) => size + text.length, 0) > MAX_TRANSLATION_CHARS) {
    return json({ error: 'Invalid language or texts' }, 400);
  }
  const result = await translateNewsBatch(context, texts, language);
  const status = result.error === 'translation-not-configured' ? 503
    : ['daily-limit', 'service-busy'].includes(result.error) ? 429
      : result.error === 'service-unavailable' ? 503 : 200;
  return json({ version: TRANSLATION_VERSION, language, ...result }, status);
}

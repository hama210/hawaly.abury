import { TRANSLATION_VERSION, TRANSLATION_LANGUAGES } from '../../src/lib/translation-format.js';
import { TRANSLATION_MODELS } from '../lib/news-translator.js';
export function onRequest(context) {
  return Response.json({
    version: TRANSLATION_VERSION,
    languages: Object.keys(TRANSLATION_LANGUAGES),
    provider: 'cloudflare-workers-ai', models: TRANSLATION_MODELS,
    apiKeyRequired: false, configured: typeof context.env?.AI?.run === 'function',
    coverage: ['all-headlines', 'all-summaries', 'article-text-on-open']
  }, { headers: { 'Cache-Control': 'no-store' } });
}

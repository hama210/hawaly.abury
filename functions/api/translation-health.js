import { TRANSLATION_VERSION } from '../../src/lib/translation-format.js';
import { translateNewsBatch } from '../lib/news-translator.js';
export async function onRequest(context) {
  const source = 'Gold prices fell by 2% in Baghdad today.';
  const { results, error } = await translateNewsBatch(context, [source], 'ku');
  const result = results[0];
  return Response.json({
    ok: result.state === 'translated', version: TRANSLATION_VERSION,
    apiKeyRequired: false, sample: source, translation: result.text,
    ...(error || result.error ? { error: error || result.error } : {})
  }, { headers: { 'Cache-Control': 'no-store' } });
}

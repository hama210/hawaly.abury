import { TRANSLATION_VERSION } from '../../src/lib/translation-format.js';
import { translateNewsBatch } from '../lib/news-translator.js';
export async function onRequest(context) {
  const sources = [
    'Gold prices fell by 2% in Baghdad today.',
    'After airport strike, Trump considering whether to join fight against Houthis',
    'السعودية: ضربة ثانية تستهدف مطار الرياض'
  ];
  const probes = await Promise.all(sources.map(async source => {
    const started = Date.now();
    const { results, error } = await translateNewsBatch(context, [source], 'ku', { bypassCache:true });
    const result = results[0];
    return { source, translation:result.text, state:result.state, durationMs:Date.now()-started,
      ...(error || result.error ? { error:error || result.error } : {}),
      ...(result.providerCode ? { providerCode:result.providerCode } : {}) };
  }));
  const failure = probes.find(probe => probe.state !== 'translated');
  return Response.json({
    ok: !failure, version: TRANSLATION_VERSION,
    apiKeyRequired: false, freshInference:true, sample:sources[0], translation:probes[0].translation, probes,
    ...(failure?.error ? { error:failure.error } : {}),
    ...(failure?.providerCode ? { providerCode:failure.providerCode } : {})
  }, { headers: { 'Cache-Control': 'no-store' } });
}

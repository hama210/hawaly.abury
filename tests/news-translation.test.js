import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewsTranslator, translateNewsFeed } from '../src/lib/news-translation.js';
import { TRANSLATION_VERSION, checkTranslatedText, translationChunks, cleanTranslationText } from '../src/lib/translation-format.js';
import { getTitle, getSummary } from '../src/utils/news.js';
import { storyExcerpt } from '../src/lib/article-content.js';
import { onRequest } from '../functions/api/translate.js';
import { onRequest as status } from '../functions/api/translation-status.js';
import { onRequest as health } from '../functions/api/translation-health.js';
import { MemoryCache, replaceGlobal, requestContext } from './helpers.js';

const source = 'Dollar rises to 151,000 dinars in Iraq';
const sorani = 'دۆلار لە عێراق بۆ 151,000 دینار بەرز دەبێتەوە';
function post(texts, language = 'ku', env = {}) {
  const call = requestContext('https://hawal.example/api/translate', {
    method: 'POST', headers: { Origin: 'https://hawal.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, language })
  });
  call.context.env = env;
  return call;
}
function apiResponse(options, translate = () => sorani) {
  const body = JSON.parse(options.body);
  return Response.json({ version: TRANSLATION_VERSION, language: body.language,
    results: body.texts.map(text => ({ source: text, text: translate(text, body.language), state: 'translated' })) });
}
const responseModel = translations => ({ choices: [{ message: { content: JSON.stringify({ translations }) } }] });

test('feed entities are decoded before translation and numeric checks', () => {
  assert.equal(cleanTranslationText('Iraq&rsquo;s gold &amp; dollar&nbsp;markets'), 'Iraq’s gold & dollar markets');
  assert.equal(cleanTranslationText('&#x0632;&#1742;&#1685;'), 'زێڕ');
  assert.equal(cleanTranslationText('&#999999999;'), '&#999999999;');
});

test('server runs a Google model with an AI binding, without keys or external fetches', async () => {
  const restoreCache = replaceGlobal('caches', { default: new MemoryCache() });
  const restoreFetch = replaceGlobal('fetch', () => { throw new Error('Unexpected external fetch'); });
  let calls = 0;
  const env = { AI: { async run(model, input) {
    calls++;
    assert.equal(model, '@cf/google/gemma-4-26b-a4b-it');
    assert.match(input.messages[0].content, /Central Kurdish/);
    assert.deepEqual(JSON.parse(input.messages[1].content).texts, [{ id: 0, text: source }]);
    return responseModel([{ id: 0, text: sorani }]);
  } } };
  try {
    const first = post([source], 'ku', env);
    const result = await (await onRequest(first.context)).json();
    await first.settle();
    assert.equal(result.results[0].text, sorani);
    const second = post([source], 'ku', env);
    assert.equal((await (await onRequest(second.context)).json()).results[0].text, sorani);
    assert.equal(calls, 1);
  } finally { restoreFetch(); restoreCache(); }
});

test('server maps reordered IDs and refuses incomplete or duplicate output IDs', async () => {
  const env = { AI: { async run() { return responseModel([{ id: 1, text: 'نەوت' }, { id: 0, text: 'زێڕ' }]); } } };
  const call = post(['Gold', 'Oil'], 'ku', env);
  assert.deepEqual((await (await onRequest(call.context)).json()).results.map(row => row.text), ['زێڕ', 'نەوت']);
  env.AI.run = async () => responseModel([{ id: 0, text: 'زێڕ' }, { id: 0, text: 'نەوت' }]);
  const bad = post(['Gold', 'Oil'], 'ku', env);
  assert.ok((await (await onRequest(bad.context)).json()).results.every(row => row.state === 'failed'));
});

test('binding failure is an explicit error and retains originals', async () => {
  const response = await onRequest(post([source]).context);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, 'translation-not-configured');
  assert.equal(body.results[0].text, source);
  assert.equal(body.results[0].state, 'failed');
});

test('native Sorani, Arabic, and English do not require inference', async () => {
  for (const [language, text] of [['ku', 'نرخی زێڕ لە عێراق بەرز بوو'], ['ar', 'ارتفعت أسعار الذهب في العراق'], ['en', 'Gold rises in Iraq']]) {
    const response = await onRequest(post([text], language).context);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).results[0].state, 'original');
  }
});

test('Arabic news can be translated into English instead of bypassing the translator', async () => {
  const env = { AI: { async run(_model, input) {
    assert.match(input.messages[0].content, /into English/);
    return responseModel([{ id: 0, text: 'Gold rises in Iraq' }]);
  } } };
  const out = await (await onRequest(post(['ارتفعت أسعار الذهب في العراق'], 'en', env).context)).json();
  assert.equal(out.results[0].text, 'Gold rises in Iraq');
});

test('input validation enforces exact boundaries without truncating source text', async () => {
  for (const [texts, language] of [[['a'.repeat(1501)], 'ku'], [Array(9).fill('Gold'), 'ku'], [['Gold'], '__proto__'], [[null], 'ku']]) {
    assert.equal((await onRequest(post(texts, language).context)).status, 400);
  }
  const text = 'A'.repeat(1500);
  const response = await onRequest(post([text]).context);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).results[0].source, text);
  const foreign = post([source]);
  foreign.context.request = new Request('https://hawal.example/api/translate', {
    method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal((await onRequest(foreign.context)).status, 403);
});

test('changed figures, missing currency pairs, wrong scripts, and corrupt output are rejected', () => {
  assert.equal(checkTranslatedText(source, sorani, 'ku').ok, true);
  assert.equal(checkTranslatedText(source, sorani.replace('151,000', '152,000'), 'ku').error, 'changed-number');
  assert.equal(checkTranslatedText('USD/IQD rises 2%', 'دۆلار 2% بەرز دەبێتەوە', 'ku').error, 'changed-currency-pair');
  assert.equal(checkTranslatedText('Gold rises', 'ارتفعت أسعار الذهب في العراق', 'ku').error, 'wrong-language');
  assert.equal(checkTranslatedText('Gold rises', 'Gold rises', 'ar').ok, false);
  assert.equal(checkTranslatedText('Gold rises', '<script>oops</script>', 'ku').ok, false);
  assert.equal(checkTranslatedText('Gold rises', 'نەوت نەوت نەوت نەوت نەوت', 'ku').ok, false);
  assert.equal(checkTranslatedText('Gold rises', 'نرخی زێڕ لە بازاڕەکانی عێراقدا nothing بەرز دەبێتەوە', 'ku').error, 'mixed-language');
  assert.equal(checkTranslatedText('Gold rises', 'نرخی زێڕ لە بازاڕەکانی عێراقدا nistەکان بەرز دەبێتەوە', 'ku').error, 'mixed-language');
});

test('a rejected mixed translation gets one focused retry before publication', async () => {
  let calls = 0;
  const env = { AI: { async run(_model, input) {
    calls++;
    if (calls === 1) return responseModel([{ id: 0, text: 'نرخی زێڕ لە بازاڕەکانی عێراقدا nothing بەرز دەبێتەوە' }]);
    assert.match(input.messages[1].content, /Translate carefully/);
    return responseModel([{ id: 0, text: 'نرخی زێڕ لە عێراق بەرز دەبێتەوە' }]);
  } } };
  const out = await (await onRequest(post(['Gold rises in Iraq'], 'ku', env).context)).json();
  assert.equal(out.results[0].state, 'translated'); assert.equal(calls, 2);
});

test('the client batches, deduplicates readers, and caches by both source and language', async () => {
  let calls = 0;
  const client = createNewsTranslator({ storage: () => null, fetcher: async (url, options) => {
    assert.equal(url, '/api/translate'); calls++;
    return apiResponse(options, (_text, language) => language === 'ku' ? sorani : 'ارتفع الدولار في العراق إلى 151,000 دينار');
  } });
  const [a, b] = await Promise.all([client.translate(source, 'ku'), client.translate(source, 'ku')]);
  assert.equal(a.text, sorani); assert.equal(b.text, sorani); assert.equal(calls, 1);
  await client.translate(source, 'ku'); assert.equal(calls, 1);
  assert.match((await client.translate(source, 'ar')).text, /الدولار/); assert.equal(calls, 2);
});

test('translation covers every story past the former visible limit, including article content', async () => {
  const news = Array.from({ length: 75 }, (_, i) => ({ title: `Story ${i}`, summary: `Report ${i}`, content: `Details ${i}` }));
  const seen = new Set(); let last;
  const client = createNewsTranslator({ storage: () => null, fetcher: async (_url, options) => apiResponse(options, text => {
    seen.add(text); return `هەواڵی کوردی ${text.match(/\d+/)[0]}`;
  }) });
  await translateNewsFeed(news, 'ku', { client, onProgress: value => { last = value; } });
  assert.equal(seen.size, 225);
  assert.equal(last.completed, 225); assert.equal(last.failed, 0);
  assert.equal(client.peek(news[74].content, 'ku').state, 'translated');
});

test('long articles retain all chunks and show the complete original if a chunk fails', async () => {
  const text = 'Gold and dollar markets remained active today. '.repeat(120).trim();
  assert.equal(translationChunks(text).join(' '), text);
  let calls = 0;
  const client = createNewsTranslator({ storage: () => null, fetcher: async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.ok(body.texts.every(chunk => chunk.length <= 1500));
    return Response.json({ version: TRANSLATION_VERSION, language: body.language,
      results: body.texts.map((chunk, index) => ({ source: chunk, text: index ? chunk : 'زێڕ و دۆلار لە بازاڕەکانی عێراقدا چالاک بوون', state: index ? 'failed' : 'translated', error: 'service-busy' })) });
  } });
  const result = await client.translate(text, 'ku');
  assert.equal(result.state, 'failed'); assert.equal(result.text, text);
  assert.ok(calls >= 1); assert.equal(client.peek(text, 'ku'), null);
});

test('one cancelled reader cannot cancel another subscriber to the same translation', async () => {
  let release;
  const client = createNewsTranslator({ storage: () => null, fetcher: (_url, options) => new Promise(resolve => { release = () => resolve(apiResponse(options)); }) });
  const controller = new AbortController();
  const first = client.translate(source, 'ku', { signal: controller.signal });
  const second = client.translate(source, 'ku');
  await Promise.resolve(); await Promise.resolve();
  controller.abort(); release();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal((await second).text, sorani);
});

test('replacing a cancelled feed starts fresh work and cannot lose the new subscriber', async () => {
  const client = createNewsTranslator({ storage: () => null, fetcher: (_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    setTimeout(() => resolve(apiResponse(options)), 2);
  }) });
  const controller = new AbortController();
  const first = client.translate(source, 'ku', { signal: controller.signal });
  await Promise.resolve(); await Promise.resolve();
  controller.abort();
  const next = client.translate(source, 'ku');
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal((await next).text, sorani);
});

test('quota failure stops the rest of the queue and Retry resets that pause', async () => {
  let calls = 0, ready = false;
  const client = createNewsTranslator({ storage: () => null, fetcher: async (_url, options) => {
    calls++;
    if (ready) return apiResponse(options, text => `هەواڵی کوردی ${text.match(/\d+/)[0]}`);
    const body = JSON.parse(options.body);
    return Response.json({ version: TRANSLATION_VERSION, language: body.language, error: 'daily-limit',
      results: body.texts.map(text => ({ source: text, text, state: 'failed', error: 'daily-limit' })) }, { status: 429 });
  } });
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => client.translate(`Story ${i}`, 'ku')));
  assert.ok(results.every(row => row.state === 'failed')); assert.ok(calls <= 2);
  ready = true; client.retry();
  assert.equal((await client.translate('Story 42', 'ku')).state, 'translated');
});

test('old translation fields and translations for another language are ignored by cards and excerpts', () => {
  const item = { title: source, summary: 'Gold rises', titleKu: 'کۆن', summaryKu: 'کۆن', _hawalInlineVerified: true };
  assert.equal(getTitle(item, 'ku'), source); assert.equal(getSummary(item, 'ku'), item.summary);
  const fresh = { ...item, translation: { version: TRANSLATION_VERSION, language: 'ku', title: sorani, summary: 'نرخی زێڕ بەرز دەبێتەوە' } };
  assert.equal(getTitle(fresh, 'ku'), sorani); assert.equal(storyExcerpt(fresh, 'ku'), fresh.translation.summary);
  assert.equal(getTitle(fresh, 'ar'), source);
});

test('status and health inspect the actual binding without exposing environment secrets', async () => {
  const call = requestContext('https://hawal.example/api/translation-health');
  call.context.env = { unusedSecret: 'must-not-leak', AI: { async run() { return responseModel([{ id: 0, text: 'نرخی زێڕ ئەمڕۆ لە بەغدا بە 2% دابەزی.' }]); } } };
  assert.equal((await (await status(call.context)).json()).configured, true);
  const result = await (await health(call.context)).json();
  assert.equal(result.ok, true); assert.equal(result.apiKeyRequired, false);
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/);
});

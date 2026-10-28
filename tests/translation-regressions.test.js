import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTranslatedText, TRANSLATION_VERSION } from '../src/lib/translation-format.js';
import { protectSoraniCountries } from '../functions/lib/translation-entities.js';
import { onRequest } from '../functions/api/translate.js';
import { createNewsTranslator } from '../src/lib/news-translation.js';

test('financial validation rejects changed signs, percent units, scales and currencies', () => {
  for (const [source, output] of [
    ['Oil fell -2%.', 'انخفض النفط 2%.'],
    ['Oil rose +2%.', 'ارتفع النفط -2%.'],
    ['Oil rose 2%.', 'ارتفع النفط 2.'],
    ['Iraq paid $5 million.', 'دفع العراق 5 مليارات دولار.'],
    ['Iraq paid $5 million.', 'دفع العراق 5 ملايين يورو.'],
    ['Iraq paid $5 million and $7 billion.', 'دفع العراق 5 مليارات دولار و7 ملايين دولار.'],
  ]) assert.equal(checkTranslatedText(source, output, 'ar').ok, false, source);
});

test('financial validation accepts translated units, digit scripts, ranges and decimals', () => {
  for (const [source, output, language] of [
    ['Gold rose from $2,650.50 to $2,703.51, while oil fell 1.5%.', 'زێڕ لە ٢,٦٥٠.٥٠ دۆلارەوە بەرزبووەوە بۆ ٢,٧٠٣.٥١ دۆلار، نەوت بە ١.٥٪ دابەزی.', 'ku'],
    ['Iraq paid $5 million.', 'دفع العراق ٥ ملايين دولار.', 'ar'],
    ['Iraq paid $5 billion.', 'دفع العراق 5 مليارات دولار.', 'ar'],
    ['Oil fell -2%.', 'انخفض النفط −٢٪.', 'ar'],
    ['Iraq paid $236.8M.', 'عێراق ٢٣٦.٨ ملیۆن دۆلاری دا.', 'ku'],
    ['Markets in 2026-2027', 'بازاڕەکان لە ٢٠٢٦-٢٠٢٧', 'ku'],
    ['USD/IQD reaches 151,000.', 'نرخی USD/IQD گەیشتە ١٥١٬٠٠٠.', 'ku'],
  ]) assert.equal(checkTranslatedText(source, output, language).ok, true, source);
});

test('month and US dollar phrases survive Sorani entity restoration', () => {
  const protectedText = protectSoraniCountries(['US dollar holds in September, not January.']);
  const tokens = protectedText.texts[0].match(/\[\[.*?\]\]/g);
  assert.equal(tokens.length, 3);
  const output = protectedText.restore(0, `${tokens[0]} لە ${tokens[1]} جێگیرە، نەک ${tokens[2]}`);
  assert.equal(output, 'دۆلاری ئەمریکی لە ئەیلوول جێگیرە، نەک کانوونی دووەم');
  // Every occurrence keeps its own month identity through restoration.
  assert.equal(protectedText.restore(0, protectedText.texts[0]), 'دۆلاری ئەمریکی holds in ئەیلوول, not کانوونی دووەم.');
  assert.equal(protectedText.restore(0, tokens[0]), null);
});

test('server retries a corrupt monetary amount once then retains the complete original', async () => {
  const source = 'Iraq paid $5 million.';
  let calls = 0;
  const response = await onRequest({
    request: new Request('https://hawal.example/api/translate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({language:'ar', texts:[source]}) }),
    env: { AI: { async run() { calls++; return {response: JSON.stringify({translations:[{id:0, text:'دفع العراق 5 مليارات دولار.'}]})}; } } },
  });
  const body = await response.json();
  assert.equal(calls, 2);
  assert.equal(body.results[0].state, 'failed');
  assert.equal(body.results[0].error, 'changed-quantity');
  assert.equal(body.results[0].text, source);
});

test('reader retries only its failed chunk and never displays a partial translation', async () => {
  const source = Array.from({length:70}, (_,i) => `Market report ${i}: Gold rose today.`).join('\n');
  const seen = new Map();
  const client = createNewsTranslator({storage:()=>null, retryDelay:0, fetcher:async (_url, options) => {
    const {language, texts} = JSON.parse(options.body);
    return Response.json({version:TRANSLATION_VERSION, language, results:texts.map(text=>{
      const count = (seen.get(text) || 0) + 1; seen.set(text, count);
      if (text.includes('report 69') && count === 1) return {source:text,text,state:'failed',error:'invalid-output'};
      return {source:text,text:text.replace(/Market report (\d+): Gold rose today\./g, 'ڕاپۆرتی بازاڕ $1: زێڕ ئەمڕۆ بەرزبووەوە.'),state:'translated'};
    })});
  }});
  const result = await client.translate(source, 'ku');
  assert.equal(result.state,'translated');
  assert.ok(seen.size > 1);
  assert.equal([...seen.values()].filter(count=>count===2).length,1);
  assert.ok(result.text.includes('69'));
  assert.ok(!result.text.includes('Market report'));
});

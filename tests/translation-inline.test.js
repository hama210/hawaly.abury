import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onRequest} from '../functions/api/translate.js';
import {onRequest as checkTranslationHealth} from '../functions/api/translation-health.js';
import {onRequest as translationStatus} from '../functions/api/translation-status.js';
import {validateTranslation,alreadyInTargetLanguage} from '../src/lib/translation-check.js';
import {translateArticleBody,articleChunks} from '../src/lib/article-translation.js';
import {getTitle,getSummary} from '../src/utils/news.js';
import {MemoryCache,replaceGlobal,requestContext} from './helpers.js';

function post(texts,lang='ku'){
  return requestContext('https://hawal.example/api/translate',{
    method:'POST',headers:{Origin:'https://hawal.example','Content-Type':'application/json'},
    body:JSON.stringify({lang,texts})
  });
}
test('Central Kurdish financial phrases preserve figures and reject repeated gibberish',()=>{
  const src='Dollar rises to 151,000 dinars in Iraq';
  assert.equal(validateTranslation(src,'دۆلار بۆ ١٥١,٠٠٠ دینار لە عێراق بەرز دەبێتەوە','ku').ok,true);
  assert.equal(validateTranslation(src,'دۆلار بۆ ١٥٢,٠٠٠ دینار لە عێراق بەرز دەبێتەوە','ku').reason,'changed-number');
  assert.equal(validateTranslation(src,'گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی','ku').ok,false);
  assert.equal(alreadyInTargetLanguage('نرخی دۆلار لە عێراق','ku'),true);
  assert.equal(alreadyInTargetLanguage('Central bank of Iraq','ku'),false);
});
test('Google-only translator ignores old Microsoft secrets and caches Google results',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  let count=0;
  const restoreFetch=replaceGlobal('fetch',async url=>{
    count++;
    assert.match(String(url),/translate.googleapis.com\/translate_a\/single/);
    assert.match(String(url),/tl=ckb/);
    return Response.json([[['دۆلار بۆ ١٥١,٠٠٠ دینار لە عێراق بەرز دەبێتەوە','Dollar rises to 151,000 dinars in Iraq']]]);
  });
  try{
    const env={MICROSOFT_TRANSLATOR_KEY:'old-microsoft-secret',MICROSOFT_TRANSLATOR_REGION:'westeurope'};
    const a=post(['Dollar rises to 151,000 dinars in Iraq']);
    a.context.env=env;
    const first=await (await onRequest(a.context)).json();await a.settle();
    assert.deepEqual(first.translatedFlags,[true]);
    assert.deepEqual(first.sources,['google-public']);
    const b=post(['Dollar rises to 151,000 dinars in Iraq']);
    b.context.env=env;
    const second=await (await onRequest(b.context)).json();
    assert.deepEqual(second.sources,['cache']);
    assert.equal(count,1);
  }finally{restoreFetch();restoreCache();}
});
test('existing API secrets are ignored and every translation uses the keyless Google route',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreFetch=replaceGlobal('fetch',async(url,options)=>{
    assert.match(String(url),/translate.googleapis.com\/translate_a\/single/);
    assert.match(String(url),/tl=ckb/);
    assert.doesNotMatch(String(url),/secret|[?&]key=/);
    assert.equal(options.credentials,undefined);
    return Response.json([[['دۆلار بۆ ١٥١,٠٠٠ دینار لە عێراق بەرز دەبێتەوە']]]);
  });
  try{
    const call=post(['Dollar rises to 151,000 dinars in Iraq']);
    call.context.env={GOOGLE_TRANSLATE_API_KEY:'google-secret'};
    const result=await (await onRequest(call.context)).json();
    await call.settle();
    assert.equal(result.sources[0],'google-public');
    assert.equal(result.translatedFlags[0],true);
  }finally{restoreFetch();restoreCache();}
});
test('without keys, the Google public fallback works when available and retains English otherwise',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  let calls=0;
  const restoreFetch=replaceGlobal('fetch',async(url)=>{
    calls++;
    assert.match(String(url),/translate.googleapis.com/);
    assert.match(String(url),/tl=ckb/);
    return Response.json([[['نرخی دۆلار بۆ ١٥١,٠٠٠ دینار لە عێراق بەرز بوو','Dollar rises to 151,000 dinars in Iraq']]]);
  });
  try{
    const call=post(['Dollar rises to 151,000 dinars in Iraq']);
    const response=await (await onRequest(call.context)).json();
    assert.equal(response.sources[0],'google-public');
    assert.equal(response.translatedFlags[0],true);
    assert.equal(calls,1);
  }finally{restoreFetch();restoreCache();}
});
test('provider failure or broken text never replaces the original headline',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreFetch=replaceGlobal('fetch',async()=>new Response('blocked',{status:429}));
  try{
    const text='Gold XAU/USD rises 4%';
    const call=post([text]);
    const response=await (await onRequest(call.context)).json();
    assert.equal(response.translated[0],text);
    assert.equal(response.translatedFlags[0],false);
    assert.equal(response.sources[0],'original');
    assert.equal(response.failureReasons[0],'google-public:http-429');
  }finally{restoreFetch();restoreCache();}
});
test('inline translation does not trust old malformed translation fields',()=>{
  const old={title:'Iraq updates dollar rate',titleKu:'دەقی هەڵە',summary:'Dollar prices are steady',summaryKu:'کوردیی هەڵە'};
  assert.equal(getTitle(old,'ku'),old.title);
  assert.equal(getSummary(old,'ku'),old.summary);
  const validated={...old,_hawalInlineVerified:true,titleKu:'عێراق نرخی دۆلار نوێ دەکاتەوە',summaryKu:'نرخی دۆلار جێگیرە'};
  assert.equal(getTitle(validated,'ku'),validated.titleKu);
});
test('article translation retains full original when one of its paragraphs cannot be translated',async()=>{
  const text='Dollar rises to 151,000 dinars in Iraq. '.repeat(19);
  const chunks=articleChunks(text,120);
  assert.ok(chunks.length>=5);
  assert.equal(chunks.join(' '),text.trim());
  const result=await translateArticleBody(text,'ku',{fetcher:async()=>Response.json({
    ok:true,translated:chunks.map(()=> 'گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی'),
    translatedFlags:chunks.map(()=>true)
  })});
  assert.equal(result.translated,false);
  assert.equal(result.text,text.trim());
});
test('client never links out to Tradukka and real server translator is wired into article reader',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8');
  assert.doesNotMatch(main,/tradukka/i);
  assert.match(main,/useClientTranslator/);
  assert.match(main,/translateArticleBody/);
  assert.match(main,/translatedNews/);
  assert.match(main,/translation-inline-status/);
});

test('short real Sorani headlines are accepted and missing financial numbers are rejected',()=>{
  assert.equal(validateTranslation('Gold','زێڕ','ku').ok,true);
  assert.equal(validateTranslation('Gold rises in Iraq','نرخی زێڕ لە عێراق بەرز دەبێتەوە','ku').ok,true);
  const missing=validateTranslation('Dollar rises to 151,000 dinars in Iraq','نرخی دۆلار لە عێراق بەرز دەبێتەوە','ku');
  assert.equal(missing.reason,'changed-number');
});

test('article chunks are atomic: invalid second chunk keeps the complete original',async()=>{
  const text='Gold and dollar markets in Iraq remained active today. '.repeat(42).trim();
  const chunks=articleChunks(text);
  assert.ok(chunks.length>=2);
  const good='ڕاپۆرتی بازاڕی عێراق باس لە پەیوەندی نێوان نرخەکانی زێڕ و دۆلار دەکات، لە کاتێکدا چاودێرانی ئابووری گۆڕانکارییەکانی بازرگانی و مامەڵەکان بە وردی دەخوێننەوە.';
  assert.equal(validateTranslation(chunks[0],good,'ku').ok,true);
  const result=await translateArticleBody(text,'ku',{fetcher:async(_url,options)=>{
    const batch=JSON.parse(options.body).texts;
    return Response.json({
      ok:true,
      translated:batch.map((_,i)=>i===0?good:''),
      translatedFlags:batch.map(()=>true)
    });
  }});
  assert.equal(result.translated,false);
  assert.equal(result.text,text);
  assert.doesNotMatch(fs.readFileSync('src/lib/article-translation.js','utf8'),/\bsourceChunk\b/);
});

test('Vite development routes share the actual Pages translator contract',()=>{
  const vite=fs.readFileSync('vite.config.js','utf8');
  assert.match(vite,/onRequest as translateRequest/);
  assert.match(vite,/onRequest as translationStatusRequest/);
  assert.match(vite,/serveProductionHandler/);
  assert.doesNotMatch(vite,/fallbackTranslate|FALLBACKS/);
});

test('translation-health verifies Google Sorani translation and caches without leaking secrets',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  let calls=0;
  const restoreFetch=replaceGlobal('fetch',async url=>{
    calls++;
    assert.match(String(url),/translate.googleapis.com/);
    assert.match(String(url),/tl=ckb/);
    return Response.json([[['نرخی زێڕ ئەمڕۆ لە بەغدا دابەزی.','Gold prices fell in Baghdad today.']]]);
  });
  try{
    const check=requestContext('https://hawal.example/api/translation-health');
    check.context.env={MICROSOFT_TRANSLATOR_KEY:'legacy-secret'};
    const result=await (await checkTranslationHealth(check.context)).json();
    await check.settle();
    assert.equal(result.ok,true);
    assert.equal(result.provider,'google-public');
    assert.match(result.sampleTranslation,/زێڕ/);
    assert.doesNotMatch(JSON.stringify(result),/legacy-secret/);
    const second=requestContext('https://hawal.example/api/translation-health');
    second.context.env=check.context.env;
    assert.equal((await (await checkTranslationHealth(second.context)).json()).ok,true);
    assert.equal(calls,1);
  }finally{restoreFetch();restoreCache();}
});
test('translation-health reports safe Google HTTP failures, never key values',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreFetch=replaceGlobal('fetch',async url=>{
    assert.match(String(url),/translate.googleapis.com/);
    return new Response('rate limited',{status:429});
  });
  try{
    const check=requestContext('https://hawal.example/api/translation-health');
    check.context.env={MICROSOFT_TRANSLATOR_KEY:'legacy-secret'};
    const result=await (await checkTranslationHealth(check.context)).json();
    assert.equal(result.ok,false);
    assert.match(result.failure,/google-public:http-429/);
    assert.doesNotMatch(JSON.stringify(result),/legacy-secret/);
  }finally{restoreFetch();restoreCache();}
});
test('reader exposes recoverable errors instead of silently leaving all headlines untranslated',()=>{
  const hook=fs.readFileSync('src/hooks/useClientTranslator.js','utf8');
  const main=fs.readFileSync('src/main.jsx','utf8');
  assert.match(hook,/translationIssue/);
  assert.match(hook,/retryTranslations/);
  assert.match(main,/onClick=\{retryTranslations\}/);
});

test('status advertises only Google providers and Arabic requests use Google target ar',async()=>{
  const status=requestContext('https://hawal.example/api/translation-status');
  status.context.env={MICROSOFT_TRANSLATOR_KEY:'legacy-secret'};
  const snapshot=await (await translationStatus(status.context)).json();
  assert.equal(snapshot.preferredProvider,'google-browser');
  assert.equal(snapshot.apiKeyRequired,false);
  assert.equal(snapshot.microsoftConfigured,undefined);
  assert.doesNotMatch(JSON.stringify(snapshot),/microsoft/i);
  const restoreFetch=replaceGlobal('fetch',async url=>{
    assert.match(String(url),/tl=ar/);
    return Response.json([[['ارتفعت أسعار الذهب في بغداد','Gold prices rise in Baghdad']]]);
  });
  try{
    const call=post(['Gold prices rise in Baghdad'],'ar');
    call.context.env=status.context.env;
    const out=await (await onRequest(call.context)).json();
    assert.deepEqual(out.translatedFlags,[true]);
    assert.equal(out.translated[0],'ارتفعت أسعار الذهب في بغداد');
    assert.deepEqual(out.sources,['google-public']);
  }finally{restoreFetch();}
});

test('Google API credentials cannot select a billed or Microsoft endpoint',async()=>{
  const restoreFetch=replaceGlobal('fetch',async url=>{
    assert.match(String(url),/translate.googleapis.com/);
    return Response.json([[['نرخی زێڕ لە عێراق بەرز دەبێتەوە','Gold rises in Iraq']]]);
  });
  try{
    const call=post(['Gold rises in Iraq']);
    call.context.env={GOOGLE_TRANSLATE_API_KEY:'google-key',MICROSOFT_TRANSLATOR_KEY:'ignored'};
    const out=await (await onRequest(call.context)).json();
    assert.equal(out.translatedFlags[0],true);
    assert.equal(out.sources[0],'google-public');
  }finally{restoreFetch();}
});

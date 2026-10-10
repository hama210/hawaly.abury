import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onRequest} from '../functions/api/translate.js';
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
test('Microsoft Translator uses Central Kurdish code ku, region secret and caches results',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  let count=0;
  const restoreFetch=replaceGlobal('fetch',async (url,options)=>{
    count++;
    assert.match(String(url),/api.cognitive.microsofttranslator.com\/translate\?api-version=3.0&to=ku/);
    assert.equal(options.headers['Ocp-Apim-Subscription-Key'],'secret');
    assert.equal(options.headers['Ocp-Apim-Subscription-Region'],'westeurope');
    assert.equal(JSON.parse(options.body)[0].Text,'Dollar rises to 151,000 dinars in Iraq');
    return Response.json([{translations:[{to:'ku',text:'دۆلار بۆ ١٥١,٠٠٠ دینار لە عێراق بەرز دەبێتەوە'}]}]);
  });
  try{
    const a=post(['Dollar rises to 151,000 dinars in Iraq']);
    a.context.env={MICROSOFT_TRANSLATOR_KEY:'secret',MICROSOFT_TRANSLATOR_REGION:'westeurope'};
    const first=await (await onRequest(a.context)).json();await a.settle();
    assert.deepEqual(first.translatedFlags,[true]);
    assert.deepEqual(first.sources,['microsoft']);
    const b=post(['Dollar rises to 151,000 dinars in Iraq']);
    b.context.env=a.context.env;
    const second=await (await onRequest(b.context)).json();
    assert.deepEqual(second.sources,['cache']);
    assert.equal(count,1);
  }finally{restoreFetch();restoreCache();}
});
test('Google Cloud Translation uses Sorani ckb and handles encoded translation',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreFetch=replaceGlobal('fetch',async(url,options)=>{
    assert.match(String(url),/translation.googleapis.com\/language\/translate\/v2\?key=google-secret/);
    const body=JSON.parse(options.body);
    assert.equal(body.target,'ckb');
    assert.equal(body.format,'text');
    return Response.json({data:{translations:[{translatedText:'دۆلار بۆ ١٥١,٠٠٠ دینار لە عێراق بەرز دەبێتەوە'}]}});
  });
  try{
    const call=post(['Dollar rises to 151,000 dinars in Iraq']);
    call.context.env={GOOGLE_TRANSLATE_API_KEY:'google-secret'};
    const result=await (await onRequest(call.context)).json();
    await call.settle();
    assert.equal(result.sources[0],'google-cloud');
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

import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/api/translate.js'
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js'

function translationRequest(texts, options = {}){
  return requestContext('https://example.com/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': options.origin || 'https://example.com' },
    body: JSON.stringify({ lang: options.lang || 'ar', texts })
  })
}

test('translation batches work concurrently and reuse edge-cached text', async () => {
  const cache = new MemoryCache()
  const restoreCaches = replaceGlobal('caches', { default: cache })
  const restoreWarn = silenceWarnings()
  let calls = 0
  let active = 0
  let maxActive = 0
  const restoreFetch = replaceGlobal('fetch', async url => {
    calls += 1
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active -= 1
    const original = new URL(String(url)).searchParams.get('q')
    return Response.json([[[`تقرير اقتصادي عن الأسواق رقم ${original.match(/\d+$/)?.[0] ?? '0'}`]]])
  })

  try{
    const texts = Array.from({ length: 10 }, (_, index) => `Market story ${index}`)
    const first = translationRequest(texts)
    const firstResponse = await onRequest(first.context)
    const firstPayload = await firstResponse.json()
    await first.settle()
    assert.equal(firstPayload.ok, true)
    assert.ok(firstPayload.sources.every(source => source === 'live'))
    assert.equal(calls, texts.length)
    assert.ok(maxActive > 1)
    assert.ok(maxActive <= 6)

    const second = translationRequest(texts)
    const secondResponse = await onRequest(second.context)
    const secondPayload = await secondResponse.json()
    assert.ok(secondPayload.sources.every(source => source === 'cache'))
    assert.equal(calls, texts.length)
  }finally{
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('translation accepts only same-origin POST requests and enforces the body limit', async () => {
  const get = requestContext('https://example.com/api/translate')
  assert.equal((await onRequest(get.context)).status, 405)

  const crossOrigin = translationRequest(['hello'], { origin: 'https://attacker.example' })
  assert.equal((await onRequest(crossOrigin.context)).status, 403)

  const oversized = translationRequest(['x'.repeat(66_000)])
  assert.equal((await onRequest(oversized.context)).status, 413)

  const tooManyTexts = translationRequest(Array.from({ length: 11 }, (_, index) => `Story ${index}`))
  const tooManyResponse = await onRequest(tooManyTexts.context)
  const tooManyPayload = await tooManyResponse.json()
  assert.equal(tooManyResponse.status, 413)
  assert.match(tooManyPayload.error, /maximum of 10 texts/i)
})

test('translation preserves exact headlines when Google fails and uses a Sorani alternate only if available',async()=>{
  const restoreCaches=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreFetch=replaceGlobal('fetch',async url=>{
    if(String(url).includes('translate.googleapis.com')) return new Response('blocked',{status:503});
    if(String(url).includes('mymemory.translated.net')){
      const request=new URL(String(url));
      const original=request.searchParams.get('q');
      return Response.json({responseStatus:200,responseData:{translatedText:original.includes('first')?'نرخی دۆلار لە عێراق':'MYMEMORY WARNING: QUOTA EXCEEDED'}});
    }
    return new Response('Unavailable',{status:503});
  });
  try{
    const call=translationRequest(['first original headline','second original headline'],{lang:'ku'});
    const data=await (await onRequest(call.context)).json();await call.settle();
    assert.deepEqual(data.translated,['نرخی دۆلار لە عێراق','second original headline']);
    assert.deepEqual(data.sources,['alternate','unavailable']);
  }finally{restoreFetch();restoreCaches();}
});

test('Cloudflare AI binding translates Sorani headlines without depending on blocked public APIs',async()=>{
  const restoreCaches=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreFetch=replaceGlobal('fetch',async()=>{throw Error('No external translation provider should be used when AI works');});
  let model='', prompt='';
  try{
    const call=translationRequest(['Iraq central bank changes dollar trading rules'],{lang:'ku'});
    call.context.env={AI:{run:async(name,input)=>{
      model=name;
      prompt=input.messages[0].content;
      return {response:'بانکی ناوەندی عێراق یاساکانی مامەڵەکردن بە دۆلار دەگۆڕێت'};
    }}};
    const result=await (await onRequest(call.context)).json();
    await call.settle();
    assert.equal(result.sources[0],'workers-ai');
    assert.match(result.translated[0],/بانکی ناوەندی عێراق/);
    assert.match(model,/qwen3-30b-a3b-fp8/);
    assert.match(prompt,/Central Kurdish \(Sorani\)/);
  }finally{restoreFetch();restoreCaches();}
});

test('invalid Sorani translations must not corrupt names, rates or the translation cache',async()=>{
  const cache=new MemoryCache();
  const restoreCaches=replaceGlobal('caches',{default:cache});
  let googleCalls=0,alternateCalls=0;
  const restore=replaceGlobal('fetch',async url=>{
    const href=String(url);
    if(href.includes('translate.googleapis.com')){
      googleCalls++;
      const params=new URL(href).searchParams;
      assert.equal(params.get('sl'),'en');
      assert.equal(params.get('tl'),'ckb');
      return Response.json([[['وەزارەتی دارایی: دۆلار بۆ ١٥٢,٠٠٠ دینار بەرز دەبێتەوە']]]);
    }
    if(href.includes('mymemory.translated.net')){
      alternateCalls++;
      return Response.json({responseStatus:200,responseData:{translatedText:'دۆلار لە عێراق بۆ ١٥١,٠٠٠ دینار بەرز دەبێتەوە'}});
    }
    return new Response('unavailable',{status:503});
  });
  try{
    const first=translationRequest(['Dollar rises to 151,000 dinars in Iraq'],{lang:'ku'});
    const a=await (await onRequest(first.context)).json();
    await first.settle();
    assert.equal(a.sources[0],'alternate');
    assert.match(a.translated[0],/١٥١,٠٠٠/);
    assert.ok(!a.translated[0].includes('١٥٢,٠٠٠'));
    const second=translationRequest(['Dollar rises to 151,000 dinars in Iraq'],{lang:'ku'});
    const b=await (await onRequest(second.context)).json();
    assert.equal(b.sources[0],'cache');
    assert.equal(googleCalls,1);
    assert.equal(alternateCalls,1);
  }finally{restore();restoreCaches();}
});

test('context-aware Sorani translator uses publisher summary to disambiguate a headline without translating the summary',async()=>{
  const restoreCaches=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreFetch=replaceGlobal('fetch',async()=>{throw Error('External providers should not run with AI available')});
  let calls=0;
  try{
    const requestWithContext=contextText=>{
      const request=requestContext('https://example.com/api/translate',{
        method:'POST',
        headers:{'Content-Type':'application/json','Origin':'https://example.com'},
        body:JSON.stringify({
          lang:'ku',
          texts:['Trump says Iran talks may resume'],
          contexts:[contextText]
        })
      });
      request.context.env={AI:{run:async(model,args)=>{
        calls++;
        assert.match(model,/qwen3/);
        assert.match(args.messages[0].content,/COMPLETE meaning/);
        assert.match(args.messages[1].content,/SOURCE PASSAGE/);
        assert.ok(args.messages[1].content.includes(contextText));
        return {response:'ترامپ دەڵێت لەوانەیە دانوستانەکانی ئێران دەست پێبکەنەوە'};
      }}};
      return request;
    };
    const a=requestWithContext('Officials are discussing negotiations rather than military attacks.');
    const first=await (await onRequest(a.context)).json();await a.settle();
    assert.equal(first.sources[0],'workers-ai');
    assert.equal(first.translated[0],'ترامپ دەڵێت لەوانەیە دانوستانەکانی ئێران دەست پێبکەنەوە');
    const b=requestWithContext('Officials are discussing negotiations rather than military attacks.');
    const second=await (await onRequest(b.context)).json();
    assert.equal(second.sources[0],'cache');
    const d=requestWithContext('Diplomats describe a new round of indirect dialogue.');
    const third=await (await onRequest(d.context)).json();await d.settle();
    assert.equal(third.sources[0],'workers-ai');
    assert.equal(calls,2,'different story contexts must not share an unrelated cached result');
    const invalid=requestContext('https://example.com/api/translate',{
      method:'POST',
      headers:{'Content-Type':'application/json','Origin':'https://example.com'},
      body:JSON.stringify({lang:'ku',texts:['a','b'],contexts:['only one context']})
    });
    assert.equal((await onRequest(invalid.context)).status,400);
  }finally{restoreFetch();restoreCaches();}
});

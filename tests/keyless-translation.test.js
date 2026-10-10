import test from 'node:test';
import assert from 'node:assert/strict';
import {createKeylessTranslator} from '../src/lib/keyless-translation.js';
import {requestGoogleTranslation} from '../src/lib/google-translate.js';
import {onRequest} from '../functions/api/translate.js';
import {MemoryCache,replaceGlobal,requestContext} from './helpers.js';

const source='Gold prices rose 2% in Baghdad.';
const sorani='نرخی زێڕ ئەمڕۆ لە بەغدا 2% بەرز بووەوە.';
const google=value=>Response.json([[[value]]]);

test('headlines and article consumers share one Google request at a time and reuse duplicates',async()=>{
  let active=0,maxActive=0,calls=0;
  const translate=createKeylessTranslator({storage:()=>null,fetcher:async url=>{
    assert.match(String(url),/tl=ckb/);
    calls++;active++;maxActive=Math.max(active,maxActive);
    await new Promise(resolve=>setTimeout(resolve,5));
    active--;
    return google(sorani);
  }});
  const [a,b]=await Promise.all([translate([source,source],'ku'),translate([source],'ku')]);
  assert.deepEqual(a.translatedFlags,[true,true]);
  assert.deepEqual(b.translatedFlags,[true]);
  assert.equal(calls,1);
  assert.equal(maxActive,1);
  assert.equal(a.sources[0],'google-browser');
  assert.equal(b.sources[0],'browser-cache');
});

test('Google CORS failure uses the existing server contract and caches the validated result',async()=>{
  const urls=[];
  const translate=createKeylessTranslator({storage:()=>null,fetcher:async(url,options)=>{
    urls.push(String(url));
    if(String(url).startsWith('https:'))throw new TypeError('Failed to fetch');
    assert.deepEqual(JSON.parse(options.body),{lang:'ku',texts:[source]});
    return Response.json({ok:true,translated:[sorani],translatedFlags:[true],sources:['google-public']});
  }});
  const result=await translate([source],'ku');
  assert.equal(result.translated[0],sorani);
  assert.equal(result.translatedFlags[0],true);
  await translate([source],'ku');
  assert.equal(urls.length,2);
});

test('rate-limited browser and server routes cool down instead of flooding the feed',async()=>{
  let now=1000,googleCalls=0,serverCalls=0;
  const translate=createKeylessTranslator({storage:()=>null,now:()=>now,fetcher:async url=>{
    if(String(url).startsWith('https:'))googleCalls++;
    else serverCalls++;
    return new Response('rate limited',{status:429});
  }});
  const texts=[source,'Oil prices rose 4%.','Dollar prices fell 3%.'];
  const failed=await translate(texts,'ku');
  assert.deepEqual(failed.translated,texts);
  assert.deepEqual(failed.translatedFlags,[false,false,false]);
  await translate(texts,'ku');
  assert.equal(googleCalls,1);
  assert.equal(serverCalls,1);
  now+=61_000;
  await translate(texts,'ku');
  assert.equal(googleCalls,2);
  assert.equal(serverCalls,2);
});

test('a bad number from Google and an unverified fallback both leave the original unchanged',async()=>{
  const translate=createKeylessTranslator({storage:()=>null,fetcher:async url=>
    String(url).startsWith('https:')?google(sorani.replace('2%','3%')):
    Response.json({ok:true,translated:[sorani],translatedFlags:[false]})});
  const result=await translate([source],'ku');
  assert.equal(result.translated[0],source);
  assert.equal(result.translatedFlags[0],false);
  assert.match(result.failureReasons[0],/changed-number/);
});

test('aborting a language change cancels the active Google request and all queued passages',async()=>{
  let calls=0;
  const controller=new AbortController();
  const translate=createKeylessTranslator({storage:()=>null,fetcher:async(_url,options)=>{
    calls++;
    return new Promise((_resolve,reject)=>{
      options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
      queueMicrotask(()=>controller.abort());
    });
  }});
  await assert.rejects(translate([source,'Oil prices rose.'],'ku',{signal:controller.signal}),{name:'AbortError'});
  assert.equal(calls,1);
});

test('article and headline requests use Arabic and Sorani independently',async()=>{
  const arabic='ارتفعت أسعار الذهب بنسبة 2% في بغداد.';
  const translate=createKeylessTranslator({storage:()=>null,fetcher:async url=>
    google(new URL(url).searchParams.get('tl')==='ar'?arabic:sorani)});
  assert.equal((await translate([source],'ar')).translated[0],arabic);
  assert.equal((await translate([source],'ku')).translated[0],sorani);
});

test('Google segment parsing decodes entities, omits cookies and refuses redirect challenges',async()=>{
  const result=await requestGoogleTranslation(source,'ku',{fetcher:async(url,options)=>{
    assert.equal(options.credentials,'omit');
    assert.equal(options.redirect,'error');
    assert.equal(new URL(url).searchParams.get('q'),source);
    return Response.json([[['نرخی زێڕ &amp; '],['دۆلار 2%']]]);
  }});
  assert.equal(result,'نرخی زێڕ & دۆلار 2%');
});

test('Pages stops uncached requests after a provider rate limit but can still serve its cache',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  let calls=0;
  const restoreFetch=replaceGlobal('fetch',async()=>{calls++;return new Response('limited',{status:429});});
  try{
    const call=requestContext('https://hawal.example/api/translate',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({lang:'ku',texts:[source,'Oil prices rose.','Dollar prices fell.']})
    });
    const result=await (await onRequest(call.context)).json();
    assert.equal(calls,1);
    assert.deepEqual(result.translatedFlags,[false,false,false]);
  }finally{restoreFetch();restoreCache();}
});

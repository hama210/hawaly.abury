import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPage } from '../src/lib/server-page.js';
import { fetchNews } from '../src/services/news.js';
import { onRequest } from '../functions/api/news.js';
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js';

test('server summary does not flash on JavaScript page loads, but remains readable without JS',()=>{
  const template=fs.readFileSync('index.html','utf8');
  const html=renderPage(template,{lang:'ku',page:'home',siteUrl:'https://hawal.example',
    news:[{title:'Gold prices climb on fresh US inflation data',source:'Sample',link:'https://example.com/1',publishedAt:new Date().toISOString()}],markets:[]});
  assert.match(html, /html\.hawal-js #root>\.server-summary\{display:none!important\}/);
  assert.match(html, /document\.documentElement\.classList\.add\("hawal-js"\)/);
  assert.ok(html.indexOf('classList.add("hawal-js")') < html.indexOf('<div id="root">'));
  assert.match(html, /Gold prices climb/);
  assert.doesNotMatch(template,/classList\.add\("hawal-js"\)/);
});

test('fresh source data replaces stale local headlines rather than merging them',async()=>{
  const saved=JSON.stringify({savedAt:Date.now(),items:[{
    id:'cached',title:'Old-but-valid Iraq bank news',source:'Old publisher',category:'iraq',
    publishedAt:new Date(Date.now()-2*86400000).toISOString()}]});
  let stored=saved;
  const restoreStorage=replaceGlobal('localStorage',{
    getItem(){return stored;},setItem(k,v){stored=v;},removeItem(){stored=null;}
  });
  const restoreFetch=replaceGlobal('fetch',async url=>{
    const path=String(url);
    if(path.includes('mode=fast'))return Response.json({batchCount:6,
      feedStats:{succeeded:1,sources:[]},items:[{
        id:'new',title:'Iraq central bank releases a new update',source:'Latest publisher',
        category:'iraq',publishedAt:new Date().toISOString()
      }]});
    return Response.json({batchCount:6,items:[],feedStats:{succeeded:0,sources:[]}});
  });
  try{
    const states=[];
    const news=await fetchNews(null,{onStatus: s=>states.push(s)});
    assert.deepEqual(news.map(n=>n.id),['new']);
    assert.equal(states.at(-1).status,'live');
    assert.equal(states.at(-1).showingLastKnown,false);
  }finally{restoreFetch();restoreStorage();}
});

test('complete publisher outage does not create a cached empty API response',async()=>{
  const cache=new MemoryCache();
  const restoreCaches=replaceGlobal('caches',{default:cache});
  const restoreFetch=replaceGlobal('fetch',async()=>new Response('unavailable',{status:503}));
  const restoreWarnings=silenceWarnings();
  try{
    const request=requestContext('https://example.com/api/news?mode=fast');
    const response=await onRequest(request.context);
    await request.settle();
    const payload=await response.json();
    assert.equal(payload.items.length,0);
    assert.equal(payload.status,'unavailable');
    assert.equal(cache.entries.size,0);
    assert.equal(payload.recent24h,0);
    assert.equal(payload.newestPublishedAt,null);
  }finally{restoreWarnings();restoreFetch();restoreCaches();}
});

test('API reports actual publication freshness separately from fetch time',async()=>{
  const cache=new MemoryCache();
  const restoreCaches=replaceGlobal('caches',{default:cache});
  const publishedAt=new Date(Date.now()-3600000).toUTCString();
  const xml='<rss><channel><item><title>Dollar rises as Iraq central bank updates dinar banking policy</title>'+
    '<link>https://shafaq.com/en/Economy/real</link>'+
    '<description>Iraq dollar exchange markets and banking policy</description>'+
    '<pubDate>'+publishedAt+'</pubDate></item></channel></rss>';
  const restoreFetch=replaceGlobal('fetch',async url=>
    String(url).includes('shafaq.com/rss/en/Economy')?new Response(xml):new Response('blocked',{status:503}));
  const restoreWarnings=silenceWarnings();
  try{
    const request=requestContext('https://example.com/api/news?mode=fast&refresh=1');
    const response=await onRequest(request.context);
    await request.settle();
    const payload=await response.json();
    assert.equal(payload.recent24h,1);
    assert.equal(payload.newestPublishedAt,payload.items[0].publishedAt);
    assert.ok(Date.parse(payload.newestPublishedAt) < Date.parse(payload.updatedAt));
  }finally{restoreWarnings();restoreFetch();restoreCaches();}
});

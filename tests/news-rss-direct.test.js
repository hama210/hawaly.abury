import test from 'node:test';
import assert from 'node:assert/strict';
import { FEEDS, onRequest } from '../functions/api/news.js';
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js';

const published=()=>new Date().toUTCString();
const rss=(title,description)=>'<rss><channel><item><title>'+title+
  '</title><link>https://publisher.example/article</link>'+
  '<description>'+description+'</description><pubDate>'+published()+
  '</pubDate></item></channel></rss>';

test('fast mode reads genuine direct local/business publishers instead of mostly-failing Google search RSS',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarn=silenceWarnings();
  const requests=[];
  const restoreFetch=replaceGlobal('fetch',async url=>{
    const target=String(url);requests.push(target);
    if(target==='https://shafaq.com/rss/en/Economy') return new Response(rss(
      'Iraq central bank and dollar markets in Baghdad',
      'Iraq central bank officials and traders discussed exchange rates today.'
    ),{status:200,headers:{'Content-Type':'application/rss+xml'}});
    if(target==='https://www.iraq-businessnews.com/feed/')return new Response(rss(
      'Iraq oil exports and banking reforms advance',
      'Iraq investment and budget reform is shaping the economy.'
    ),{status:200,headers:{'Content-Type':'application/rss+xml'}});
    return new Response('unavailable',{status:503});
  });
  try{
    const request=requestContext('https://hawal.example/api/news?mode=fast&limit=20&refresh=1');
    const response=await onRequest(request.context);
    const payload=await response.json();
    await request.settle();
    assert.equal(response.status,200);
    assert.ok(payload.items.some(item=>item.sourceGroup==='Shafaq Economy'));
    assert.ok(payload.items.some(item=>item.sourceGroup==='Iraq Business News'));
    assert.ok(payload.feedStats.sources.some(s=>s.source==='Shafaq Economy'&&s.status==='active'));
    assert.ok(payload.feedStats.sources.some(s=>s.source==='Iraq Business News'&&s.status==='active'));
    assert.ok(requests.includes('https://shafaq.com/rss/en/Economy'));
    assert.ok(requests.includes('https://www.iraq-businessnews.com/feed/'));
    // Publisher-domain fallback can still attempt Google when a direct RSS fails.
    // But the curated *primary* Google News search feeds are no longer fast sources.
    assert.equal(payload.feedStats.sources.some(s=>s.source==='Iraq Dollar Live'),false);
    assert.equal(payload.feedStats.sources.some(s=>s.source==='Trump Reuters'),false);
    // The original Reuters, Trump and local search source references remain
    // configured for the full catalogue and may recover later.
    assert.ok(FEEDS.find(item=>item.source==='Iraq Dollar Live'));
    assert.ok(FEEDS.find(item=>item.source==='Reuters Metals'));
  }finally{restoreFetch();restoreWarn();restoreCache();}
});

test('HTML error pages returning status 200 are failed feeds, not quiet news publishers',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarn=silenceWarnings();
  const restoreFetch=replaceGlobal('fetch',async url=>{
    const target=String(url);
    if(target==='https://shafaq.com/rss/en/Economy')
      return new Response('<html><body>Automated request challenge</body></html>',{
        status:200,headers:{'Content-Type':'text/html'}});
    return new Response('unavailable',{status:503});
  });
  try{
    const request=requestContext('https://hawal.example/api/news?mode=fast&limit=12&refresh=1');
    const response=await onRequest(request.context);
    const payload=await response.json();
    await request.settle();
    const shafaq=payload.feedStats.sources.find(item=>item.source==='Shafaq Economy');
    assert.equal(shafaq.status,'failed');
    assert.match(shafaq.reason,/invalid RSS\/Atom document/);
  }finally{restoreFetch();restoreWarn();restoreCache();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFeeds, selectPrioritizedNews } from '../functions/api/news.js';

test('fast news batch cancels stalled publishers by its overall budget',async()=>{
  const original = globalThis.fetch;
  let aborted = 0;
  globalThis.fetch = (_url,{signal}) => new Promise((_resolve,reject)=>{
    if(signal.aborted){aborted++;reject(new DOMException('Aborted','AbortError'));return;}
    signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('Aborted','AbortError'));},{once:true});
  });
  try{
    const feeds=[
      {source:'Slow publisher A',url:'https://publisher-a.example/rss',category:'forex'},
      {source:'Slow publisher B',url:'https://publisher-b.example/rss',category:'forex'}
    ];
    const started=Date.now();
    const result=await fetchFeeds(feeds,5000,2,30);
    assert.equal(result.length,2);
    assert.ok(result.every(item=>!item.ok && item.items.length===0));
    assert.ok(aborted>=2,'all in-flight sources should be aborted');
    assert.ok(Date.now()-started<1500,'no slow publisher can indefinitely block the fast batch');
  } finally { globalThis.fetch=original; }
});

test('fast news selection still honors caller limits when no sources succeed',()=>{
  assert.deepEqual(selectPrioritizedNews([],5),[]);
});

test('hard batch deadline returns even when publisher fetch ignores AbortSignal',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=()=>new Promise(()=>{});
  try{
    const started=Date.now();
    const result=await fetchFeeds([
      {source:'Hung publisher',url:'https://slow-publisher.example/rss',category:'forex'}
    ],20000,1,40);
    assert.equal(result.length,1);
    assert.equal(result[0].ok,false);
    assert.match(result[0].error,/deadline/);
    assert.ok(Date.now()-started<1500,'hard deadline should not wait on a non-abortable fetch');
  } finally { globalThis.fetch=original; }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalNewsKey} from '../src/lib/news-key.js';
import {decodeNewsText,onRequest} from '../functions/api/news.js';
import {getInitialNews} from '../src/services/news.js';
import {MemoryCache,replaceGlobal,requestContext,silenceWarnings} from './helpers.js';

test('publisher headlines with Sorani/Arabic letters are not discarded by ASCII-only keys',()=>{
  assert.equal(canonicalNewsKey('نرخی دۆلار لە کوردستان بەرزبووەوە'),
    canonicalNewsKey('نرخی دۆلار لە كوردستان بەرزبووەوە'));
  assert.equal(canonicalNewsKey('نرخی ١٥٠،٠٠٠ دینار'),canonicalNewsKey('نرخی 150,000 دینار'));
  assert.ok(canonicalNewsKey('ارتفاع سعر الدولار في بغداد').length>5);
  assert.equal(canonicalNewsKey('!!'), '');
});
test('nested RSS typographic entities are decoded into readable headlines without changing words',()=>{
  assert.equal(decodeNewsText('Gold&amp;mdash;silver &amp;ldquo;outlook&amp;rdquo; &amp;hellip;'),
    'Gold—silver "outlook" …');
  assert.equal(decodeNewsText('Euro &euro; pound &pound; and markets &bull; trading'),
    'Euro € pound £ and markets • trading');
  assert.equal(decodeNewsText('نرخی دۆلار &laquo;هەولێر&raquo;'),
    'نرخی دۆلار «هەولێر»');
});
test('live Shafaq feed accepts genuine Kurdish and Arabic economy stories and deduplicates variants',async()=>{
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarn=silenceWarnings();
  const now=new Date().toUTCString();
  const item=(title,desc)=>'<item><title>'+title+'</title><link>https://shafaq.com/en/Economy/sample</link>'+
    '<description>'+desc+'</description><pubDate>'+now+'</pubDate></item>';
  const rss='<rss><channel>'+
    item('نرخی دۆلار لە کوردستان بەرزبووەوە','بازاڕی دراو لە کوردستان لە ئەمڕۆدا گۆڕانکارییەکی تازەی تۆمار کرد.')+
    item('نرخی دۆلار لە كوردستان بەرزبووەوە','بازاڕی دراو لە کوردستان لە ئەمڕۆدا گۆڕانکارییەکی تازەی تۆمار کرد.')+
    item('ارتفاع سعر الدولار في بغداد','أسواق العراق تتابع تطورات سعر الصرف الأجنبي في بغداد.')+
    '</channel></rss>';
  const restoreFetch=replaceGlobal('fetch',async url=>
    String(url).includes('shafaq.com/rss/en/Economy')?
      new Response(rss,{status:200,headers:{'content-type':'application/rss+xml'}}):
      new Response('unavailable',{status:503}));
  try{
    const ctx=requestContext('https://hawal.example/api/news?mode=fast&limit=48');
    const response=await onRequest(ctx.context);
    const data=await response.json();
    await ctx.settle();
    const local=data.items.filter(x=>x.source==='Shafaq Economy');
    assert.equal(local.length,2);
    assert.ok(local.some(x=>x.title==='نرخی دۆلار لە کوردستان بەرزبووەوە'));
    assert.ok(local.some(x=>x.title==='ارتفاع سعر الدولار في بغداد'));
    assert.ok(local.every(x=>x.contentStatus==='excerpt'));
    assert.ok(data.feedStats.sources.some(x=>x.source==='Shafaq Economy'&&x.status==='active'));
  }finally{restoreFetch();restoreWarn();restoreCache();}
});
test('browser combines cached publisher headlines without dropping Arabic/Kurdish or duplicating orthography',()=>{
  const now=Date.now();
  const title='نرخی دۆلار لە کوردستان';
  const items=[title,'نرخی دۆلار لە كوردستان','ارتفاع سعر الدولار في بغداد']
    .map((name,i)=>({id:'local-'+i,title:name,titleEn:name,sourceGroup:'Shafaq Economy',
      category:'iraq',summary:'',content:'',publishedAt:new Date(now-60000).toISOString(),
      intelligence:{impact:'low',effects:[],iraqImpact:false}}));
  const cache=new Map([['hawali-aburi-news-v14-publisher-originals',JSON.stringify({savedAt:now,items})]]);
  const local={
    getItem:key=>cache.get(key)||null,
    setItem:(key,value)=>cache.set(key,value),
    removeItem:key=>cache.delete(key),key:index=>[...cache.keys()][index],
    get length(){return cache.size;}
  };
  const restore=replaceGlobal('localStorage',local);
  try{
    const shown=getInitialNews();
    assert.equal(shown.length,2);
    assert.ok(shown.some(x=>x.title===title));
    assert.ok(shown.some(x=>x.title==='ارتفاع سعر الدولار في بغداد'));
  }finally{restore();}
});
test('translation queue prioritizes visible title and summary pairs instead of every title first',()=>{
  const source=fs.readFileSync('src/hooks/useClientTranslator.js','utf8');
  assert.match(source,/visibleJobs/);
  assert.match(source,/backgroundJobs/);
  assert.match(source,/meaningfulArticleText\(original\(item, 'summary'\), original\(item, 'title'\)\)/);
  assert.match(source,/work\.queue\.push\(\.\.\.visibleJobs, \.\.\.backgroundJobs\)/);
  assert.doesNotMatch(source,/work\.queue\.push\(\s*\.\.\.headlines,\s*\.\.\.summaries/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanArticleText,meaningfulArticleText} from '../src/lib/article-content.js';
import {translationJson} from '../src/lib/translation-request.js';
import {onRequest as markets} from '../functions/api/markets.js';
import {replaceGlobal,requestContext,silenceWarnings,MemoryCache} from './helpers.js';

test('RSS cleanup preserves boundaries, paragraphs and nested entities safely',()=>{
  assert.equal(cleanArticleText('<p>Baghdad &amp; Erbil</p><p>Prices &amp;nbsp; rose &rsquo;today&rsquo;.</p>'),"Baghdad & Erbil\n\nPrices rose ’today’.");
  assert.equal(cleanArticleText('a<b>bold</b>word &#999999999;'), 'a bold word');
  assert.equal(meaningfulArticleText('Dollar rises&amp;nbsp;&amp;nbsp;Reuters','Dollar rises','Reuters'),'');
});

test('translation deadline covers a stalled response body',async()=>{
  await assert.rejects(translationJson('/translate',{},async (_,options)=>({ok:true,status:200,json:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason)))}),15), /timed out/);
});
test('translation cancellation propagates from caller',async()=>{
  const controller=new AbortController(); controller.abort(new Error('reader closed'));
  await assert.rejects(translationJson('/translate',{signal:controller.signal},async(_,options)=>{options.signal.throwIfAborted();}),/reader closed/);
});
test('a non-rate dollar story does not hide the next valid market report',async()=>{
  const stamp=new Date().toUTCString();
  const rss=`<rss><channel><item><title>Dollar policy debate</title><description>No city quotes.</description><pubDate>${stamp}</pubDate></item><item><title>USD/IQD market prices</title><link>https://shafaq.com/report</link><description>In Erbil, selling prices stood at 150,500 dinars and buying prices stood at 150,400 dinars.</description><pubDate>${stamp}</pubDate></item></channel></rss>`;
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarn=silenceWarnings();
  const restoreFetch=replaceGlobal('fetch',async url=>String(url).includes('shafaq.com')?new Response(rss):new Response('unavailable',{status:503}));
  try{const call=requestContext('https://example.com/api/markets');const data=await(await markets(call.context)).json();await call.settle();const quote=data.items.find(x=>x.symbol==='USD/IQD');assert.equal(quote.erbil.sell,150500);assert.equal(quote.erbil.buy,150400);assert.equal(quote.sulaymaniyah,null);assert.equal(quote.sourceUrl,'https://shafaq.com/report');}finally{restoreCache();restoreFetch();restoreWarn();}
});

test('full syndicated text survives beyond 2400 characters and one URL is not duplicated',async()=>{
  const {onRequest:news}=await import('../functions/api/news.js');
  const body='Iraq central bank published a financial update for local banks. '.repeat(70);
  const stamp=new Date().toUTCString();
  const item=title=>`<item><title>${title}</title><link>https://shafaq.com/en/Economy/report</link><description>Iraq banking policy update.</description><content:encoded><![CDATA[<p>${body}</p>]]></content:encoded><pubDate>${stamp}</pubDate></item>`;
  const rss='<rss><channel>'+item('Iraq dollar policy update')+item('Iraq dollar policy update revised')+'</channel></rss>';
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarn=silenceWarnings();
  const restoreFetch=replaceGlobal('fetch',async url=>String(url).includes('shafaq.com/rss/en/Economy')?new Response(rss):new Response('unavailable',{status:503}));
  try{const call=requestContext('https://example.com/api/news?mode=fast&limit=30');const data=await(await news(call.context)).json();await call.settle();assert.equal(data.items.length,1);assert.equal(data.items[0].content,body.trim());}finally{restoreCache();restoreFetch();restoreWarn();}
});

 test('financial translation cannot move a decimal point or drop a currency pair',async()=>{
  const {validateTranslation}=await import('../src/lib/translation-check.js');
  assert.equal(validateTranslation('Dollar rose 1.25%', 'دۆلار ١٢٥% بەرز بووەوە','ku').reason,'changed-number');
  assert.equal(validateTranslation('USD/IQD rises 2%', 'دۆلار ٢% بەرز بووەوە','ku').reason,'changed-pair');
  assert.equal(validateTranslation('USD/IQD rises 1.25%', 'USD/IQD بە ڕێژەی ١٫٢٥% بەرز بووەوە','ku').ok,true);
 });

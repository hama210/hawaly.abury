import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cityQuote, currencyValue, goldValue, quoteState, baghdadDate, pageRoute } from '../src/lib/market-tools.js';
import { parseCityRate, parseCbiRate } from '../functions/api/markets.js';
import { renderPage } from '../src/lib/server-page.js';

test('city rates never borrow another city or side, and conversions use the correct direction', () => {
 const markets=[{symbol:'USD/IQD',price:150000,erbil:{sell:150000,buy:149000}}];
 assert.equal(cityQuote(markets,'erbil','sell'),1500);
 assert.equal(cityQuote(markets,'baghdad','sell'),null);
 assert.equal(cityQuote(markets,'sulaymaniyah','buy'),null);
 assert.equal(currencyValue(100,'USD','IQD',{USD:1,IQD:1/1500}),150000);
 assert.equal(currencyValue(150000,'IQD','USD',{USD:1,IQD:1/1500}),100);
 assert.equal(currencyValue(100,'EUR','USD',{EUR:1.1,USD:1}),110.00000000000001);
 assert.equal(currencyValue(100,'USD','IQD',{USD:1,IQD:null}),null);
 assert.equal(currencyValue(-1,'USD','USD',{USD:1}),null);
 assert.equal(currencyValue('', 'USD','USD',{USD:1}),null);
});
test('gold uses troy-ounce grams and purity; invalid input cannot produce a price',()=>{
 assert.equal(goldValue(3110.34768,5,24),500);
 assert.equal(goldValue(3110.34768,5,21),437.5);
 assert.equal(goldValue(3110.34768,5,21,1500),656250);
 assert.equal(goldValue(null,5,21),null);
 assert.equal(goldValue(3000,0,21),null);
 assert.equal(goldValue(3000,5,25),null);
});
test('missing source timestamp is not relabelled live; old and future quotes are stale',()=>{
 const now=Date.now();
 assert.equal(quoteState({price:1310,updatedAt:null},now),'undated');
 assert.equal(quoteState({price:150000,marketKind:'local',updatedAt:new Date(now-2*86400000).toISOString()},now),'stale');
 assert.equal(quoteState({price:1,updatedAt:new Date(now+86400000).toISOString()},now),'stale');
 assert.equal(quoteState({price:null},now),'unavailable');
});
test('Sulaymaniyah parser cannot capture the following city; CBI parses only the USD row',()=>{
 assert.deepEqual(parseCityRate('In Sulaymaniyah, selling prices stood at 151,000 dinars and buying prices stood at 150,000 dinars. In Erbil selling prices at 152,000 dinars.', 'sulaymaniyah'),{sell:151000,buy:150000});
 assert.equal(parseCityRate('In Sulaymaniyah shops were quiet. In Erbil selling prices at 152,000 dinars.', 'sulaymaniyah'),null);
 assert.equal(parseCbiRate('<table><tr><td>EUR</td><td>1550</td></tr><tr><td>U.S. dollar</td><td>USD</td><td>1310.000</td></tr></table>'),1310);
 assert.throws(()=>parseCbiRate('<table><tr><td>USD</td><td>0</td></tr></table>'));
});
test('daily date uses Baghdad midnight and language routes are explicit',()=>{
 assert.equal(baghdadDate('2026-10-07T22:30:00Z'),'2026-10-08');
 assert.deepEqual(pageRoute('/en/about'),{lang:'en',page:'about',valid:true});
 assert.equal(pageRoute('/missing').valid,false);
});
test('server HTML includes rates and headlines without JS, reciprocal language links, and escaped input',()=>{
 const html=renderPage(fs.readFileSync('index.html','utf8'),{lang:'ku',page:'home',markets:[{symbol:'USD/IQD',price:153000,erbil:{buy:152000,sell:153000},updatedAt:'2026-10-08T09:00:00Z',source:'Test feed',sourceUrl:'https://example.com/rate'}],news:[{title:'<script>alert(1)</script>',source:'Example',link:'https://example.com/story',publishedAt:'2026-10-08T09:00:00Z'}]});
 assert.match(html,/<html lang="ckb" dir="rtl">/);
 assert.match(html,/153,000/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>alert\(1\)/);
 assert.match(html,/hreflang="ar" href="https:\/\/hawaly-aburyy.pages.dev\/ar\/"/);
 assert.match(html,/og-image.png/);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert.match(html,/\\u003cscript>/);
 const en=renderPage(fs.readFileSync('index.html','utf8'),{lang:'en',page:'about'});
 assert.match(en,/<html lang="en" dir="ltr">/);
 assert.match(en,/independent of the publishers/);
 assert.match(en,/https:\/\/hawaly-aburyy.pages.dev\/en\/about/);
});

test('middleware preserves JSON/assets and renders correct language HTML at the edge', async()=>{
 const {onRequest}=await import('../functions/_middleware.js');
 const base={env:{},waitUntil(){},next:async()=>new Response(fs.readFileSync('index.html','utf8'),{headers:{'Content-Type':'text/html'}})};
 const response=await onRequest({...base,request:new Request('https://example.com/en/about')});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('X-Hawall-Version'),'2026-10-market-desk');
 assert.match(await response.text(),/lang="en" dir="ltr"/);
 const redirect=await onRequest({...base,request:new Request('https://example.com/ar')});
 assert.equal(redirect.status,308);
 assert.equal(redirect.headers.get('location'),'https://example.com/ar/');
 const missing=await onRequest({...base,request:new Request('https://example.com/random')});
 assert.equal(missing.status,404);
 const api=await onRequest({...base,request:new Request('https://example.com/api/news'),next:async()=>Response.json({ok:true})});
 assert.deepEqual(await api.json(),{ok:true});
});

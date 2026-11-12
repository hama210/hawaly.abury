import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXeIqdRates,mergeUsdIqdCities,cityMarketQuote } from '../src/lib/usd-iqd-cities.js';
import { onRequest,parseCbiRate } from '../functions/api/markets.js';
import { quoteState } from '../src/lib/market-tools.js';
import {collectRates,marketSnapshot} from '../src/lib/hawal-features.js';
import {renderPage} from '../src/lib/server-page.js';
import fs from 'node:fs';
import { MemoryCache,replaceGlobal,requestContext,silenceWarnings } from './helpers.js';

const inPast=(minutes=10)=>new Date(Date.now()-minutes*60000).toISOString();
function xeFixture(){
 return {base_currency:'IQD',updated_at:inPast(1),cities:[
  {slug:'baghdad',sides:[{side:'buy',usd_iqd_per_1:1688,usd_iqd_per_100:168800,updated_at:inPast(1500)},
    {side:'sell',usd_iqd_per_1:1693,usd_iqd_per_100:169300,updated_at:inPast(35)}]},
  {slug:'erbil',sides:[{side:'sell',usd_iqd_per_1:1692,usd_iqd_per_100:169200,updated_at:inPast(45)},
    {side:'buy',usd_iqd_per_1:1691,usd_iqd_per_100:169100,updated_at:inPast(46)},
    {side:null,usd_iqd_per_1:1700,usd_iqd_per_100:170000,updated_at:inPast(1)}]},
  {slug:'slemani',sides:[{side:'sell',usd_iqd_per_1:1693,usd_iqd_per_100:169300,updated_at:inPast(35)},
    {side:'buy',usd_iqd_per_1:1692.5,usd_iqd_per_100:169250,updated_at:inPast(35)}]}
 ]};
}
test('XEIQD parses independently dated buy/sell sides and never treats a bourse price as a sale',()=>{
 const parsed=parseXeIqdRates(xeFixture());
 assert.equal(parsed.cities.erbil.sell.price,169200);
 assert.equal(parsed.cities.erbil.buy.price,169100);
 assert.equal(parsed.cities.baghdad.buy,undefined,'Old Baghdad buy must not be marked as current');
 assert.equal(parsed.cities.sulaymaniyah.sell.price,169300);
 assert.equal(parsed.cities.sulaymaniyah.buy.price,169250);
 assert.equal(parsed.cities.sulaymaniyah.sell.sourceUrl,'https://xeiqd.com/en/usd/slemani');
 assert.equal(parsed.cities.erbil.sell.price===170000,false,'side:null is an untyped bourse quote, not sell');
});
test('Shafaq and XEIQD independently report each city/side with correct source and time',()=>{
 const xe=parseXeIqdRates(xeFixture());
 const shafaq={source:'Shafaq News local market',sourceUrl:'https://shafaq.com/en/Economy/dollar',
  updatedAt:inPast(10),quoteCity:'erbil',price:169400,
  erbil:{sell:169400,buy:169300},baghdad:{market:169450,sell:169500,buy:169000},
  sulaymaniyah:null,changePct:0.1};
 const combined=mergeUsdIqdCities(shafaq,xe);
 assert.equal(combined.quoteCity,'erbil');
 assert.equal(combined.price,169400);
 assert.equal(combined.erbil.sell,169400);
 assert.equal(combined.baghdad.buy,169000);
 assert.equal(combined.baghdad.market,169450);
 assert.equal(combined.sulaymaniyah.sell,169300);
 assert.equal(combined.sulaymaniyah.buy,169250);
 assert.equal(combined.sulaymaniyah.source,'XEIQD city market');
 assert.equal(combined.sulaymaniyah.sourceUrl,'https://xeiqd.com/en/usd/slemani');
 assert.equal(cityMarketQuote(combined,'sulaymaniyah','sell').updatedAt,
   xe.cities.sulaymaniyah.sell.updatedAt);
 assert.equal(cityMarketQuote(combined,'erbil','sell').source,'Shafaq News local market');
 assert.equal(cityMarketQuote(combined,'baghdad','buy').sourceUrl,'https://shafaq.com/en/Economy/dollar');
 assert.equal(cityMarketQuote(combined,'mosul','sell'),null);
});
test('When primary is down, XEIQD supplies independent city quotes without inventing missing sides',()=>{
 const result=mergeUsdIqdCities(null,parseXeIqdRates(xeFixture()));
 assert.equal(result.quoteCity,'erbil');
 assert.equal(result.erbil.sell,169200);
 assert.equal(result.baghdad.sell,169300);
 assert.equal(result.baghdad.buy,null);
 assert.equal(result.sulaymaniyah.sell,169300);
 assert.ok(result.updatedAt);
 assert.equal(result.source,'XEIQD city market');
});
test('Malformed, future and out-of-range city rates are discarded instead of made live',()=>{
 const bad=xeFixture();
 bad.cities.find(c=>c.slug==='slemani').sides[0].usd_iqd_per_100=95000;
 bad.cities.find(c=>c.slug==='slemani').sides[1].updated_at=
   new Date(Date.now()+3600*1000).toISOString();
 const result=parseXeIqdRates(bad);
 assert.equal(result.cities.sulaymaniyah,undefined);
 assert.throws(()=>parseXeIqdRates({base_currency:'EUR',cities:[]}),/schema/);
 assert.throws(()=>parseXeIqdRates({base_currency:'IQD',cities:[{slug:'slemani',sides:[
   {side:null,usd_iqd_per_100:169300,updated_at:inPast()}]}]}),/no recent/);
});
test('city snapshot metadata is not falsely refreshed by a newer quote from another city',()=>{
 const result=mergeUsdIqdCities(null,parseXeIqdRates(xeFixture()));
 const oldSlemani=cityMarketQuote(result,'sulaymaniyah','sell');
 const newErbil={...result,updatedAt:new Date().toISOString()};
 assert.equal(cityMarketQuote(newErbil,'sulaymaniyah','sell').updatedAt,oldSlemani.updatedAt);
 assert.equal(quoteState(oldSlemani),'reported');
 assert.equal(quoteState({...oldSlemani,updatedAt:inPast(1900)}),'stale');
});

test('public markets API combines Shafaq and XEIQD independently, while keeping CBI explicitly undated',async()=>{
 const cache=new MemoryCache(),restoreCache=replaceGlobal('caches',{default:cache});
 const restoreWarn=silenceWarnings();
 const recent=new Date().toUTCString();
 const rss='<rss><channel><item><title>Dollar prices in Baghdad and Erbil</title>'+
 '<link>https://shafaq.com/en/Economy/dollar</link>'+
 '<description><![CDATA[Shops in the Iraqi capital sold the dollar at 169,400 dinars and bought it at 169,200 dinars. In Erbil, selling prices stood at 169,350 dinars and buying prices stood at 169,250 dinars.]]></description>'+
 '<pubDate>'+recent+'</pubDate></item></channel></rss>';
 const restoreFetch=replaceGlobal('fetch',async url=>{
   const target=String(url);
   if(target.includes('shafaq.com'))return new Response(rss,{status:200});
   if(target.includes('xeiqd.com'))return Response.json(xeFixture());
   if(target.includes('cbi.iq'))return new Response('<table><tr><td>U.S. dollar</td><td>USD</td><td>1510.000</td></tr></table>',{status:200});
   if(target.includes('alanchand.com'))return new Response('offline',{status:503});
   if(target.includes('query1.finance.yahoo.com'))return Response.json({chart:{result:[{meta:{regularMarketPrice:3500,previousClose:3400,regularMarketTime:Math.floor(Date.now()/1000)}}]}});
   return new Response('offline',{status:503});
 });
 try{
   const ctx=requestContext('https://hawal.example/api/markets');
   const response=await onRequest(ctx.context);const payload=await response.json();await ctx.settle();
   const local=payload.items.find(x=>x.symbol==='USD/IQD');
   const cbi=payload.items.find(x=>x.symbol==='CBI USD/IQD');
   assert.equal(local.erbil.sell,169350);
   assert.equal(local.baghdad.sell,169400);
   assert.equal(local.sulaymaniyah.sell,169300);
   assert.equal(local.sulaymaniyah.buy,169250);
   assert.equal(local.sulaymaniyah.source,'XEIQD city market');
   assert.equal(local.source,'Shafaq News local market');
   assert.equal(local.dataStatus,'live');
   assert.equal(cbi.price,1510);
   assert.equal(cbi.dataStatus,'undated');
   assert.equal(cbi.rateType,'sale-to-banks');
   assert.equal(cbi.effectiveFrom,'2026-10-07');
   assert.ok(payload.failures.some(f=>f.source==='AlanChand'));
 }finally{restoreFetch();restoreWarn();restoreCache();}
});

test('history, watch snapshot and server HTML preserve independent Sulaymaniyah source and timestamps',()=>{
 const rates=mergeUsdIqdCities({
   source:'Shafaq News local market',sourceUrl:'https://shafaq.com/en/Economy/rate',
   updatedAt:inPast(15),erbil:{sell:169400,buy:169300},
   baghdad:{sell:169450,buy:169250},sulaymaniyah:null
 },parseXeIqdRates(xeFixture()));
 rates.dataStatus='live';
 const entries=collectRates([rates]);
 const slemani=entries.find(x=>x.city==='sulaymaniyah'&&x.side==='sell');
 const erbil=entries.find(x=>x.city==='erbil'&&x.side==='sell');
 assert.equal(slemani.source,'XEIQD city market');
 assert.equal(erbil.source,'Shafaq News local market');
 assert.equal(slemani.at,rates.sulaymaniyah.sideUpdatedAt.sell);
 assert.notEqual(slemani.at,erbil.at);
 const snap=marketSnapshot([rates],[]);
 assert.equal(snap.quotes.sulaymaniyah.sourceUrl,'https://xeiqd.com/en/usd/slemani');
 assert.equal(snap.quotes.sulaymaniyah.at,slemani.at);
 const html=renderPage(fs.readFileSync('index.html','utf8'),{
   lang:'en',page:'home',markets:[rates],news:[]});
 assert.match(html,/169,300/);
 assert.match(html,/XEIQD city market/);
 assert.match(html,/https:\/\/xeiqd\.com\/en\/usd\/slemani/);
});

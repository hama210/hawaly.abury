import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { parseShafaqReports, onRequest as marketsApi } from '../functions/api/markets.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { onRequest as translate } from '../functions/api/translate.js';
import { cityRecord, mergeCityRates, quoteState, timestamp, matchingRates, formatNumber } from '../src/lib/market-tools.js';
import { collectRates, marketSnapshot, calculateAlerts, normalizeHistory } from '../src/lib/hawal-features.js';
import { polishCopy } from '../src/lib/polish-copy.js';
import { renderPage, siteOrigin } from '../src/lib/server-page.js';
import { validateTranslation } from '../src/lib/translation-check.js';
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js';

const now=Date.now(), current=new Date(now).toISOString(), older=new Date(now-2*86400000).toISOString();
const report=(date,text,id)=>`<item><title>Dollar rates in Iraq</title><link>https://shafaq.com/en/Economy/${id}</link><description><![CDATA[${text}]]></description><pubDate>${date}</pubDate></item>`;
const erbil='In Erbil, selling prices at 150,000 dinars and buying prices at 149,000 dinars.';
const sula='In Sulaymaniyah, selling prices at 151,000 dinars and buying prices at 150,000 dinars.';
const fixture=[{symbol:'USD/IQD',marketKind:'local',price:150000,updatedAt:current,checkedAt:current,source:'Shafaq News local market',sourceUrl:'https://shafaq.com/current',erbil:{sell:150000,buy:149000}},
  {symbol:'CBI USD/IQD',marketKind:'official',price:1310,updatedAt:null,fetchedAt:current,checkedAt:current,source:'CBI',sourceUrl:'https://cbi.iq/'}];

test('scan all reports; city timestamps and source links remain independent',()=>{
  const q=parseShafaqReports('<rss>'+report(current,erbil,'new')+report(older,sula,'old')+'</rss>',now);
  assert.equal(q.erbil.sell,150000);assert.equal(q.sulaymaniyah.sell,151000);
  assert.equal(q.sulaymaniyah.updatedAt,older);assert.match(q.sulaymaniyah.sourceUrl,/\/old$/);
  assert.equal(quoteState(cityRecord([q],'sulaymaniyah'),now),'stale');
  assert.equal(quoteState(cityRecord([q],'erbil'),now),'reported');
  assert.equal(cityRecord([q],'baghdad'),null);assert.equal(q.history.length,4);
});
test('a report without rates does not conceal the next usable report',()=>{
  const q=parseShafaqReports(report(current,'Dollar demand increased.','empty')+report(new Date(now-60000).toISOString(),sula,'usable'),now);
  assert.equal(q.price,151000);assert.equal(q.quoteCity,'sulaymaniyah');
  assert.throws(()=>parseShafaqReports(report(new Date(now-8*86400000).toISOString(),sula,'expired'),now));
});
test('missing city retains only its own dated quote and expires after seven days',()=>{
  const old={...fixture[0],sulaymaniyah:{sell:151000,buy:150000,updatedAt:older,sourceUrl:'https://shafaq.com/old',source:'Shafaq'}};
  const merged=mergeCityRates(fixture[0],old,now);
  assert.equal(merged.sulaymaniyah.sell,151000);assert.equal(merged.sulaymaniyah.updatedAt,older);
  assert.equal(merged.sulaymaniyah.dataStatus,'stale');assert.equal(merged.baghdad,undefined);
  assert.equal(mergeCityRates(fixture[0],old,now+8*86400000).sulaymaniyah,undefined);
  assert.equal(mergeCityRates(old,undefined,now+8*86400000).sulaymaniyah,null);
});
test('API retains omitted city metadata through an independently fresh report',async()=>{
  const cache=new MemoryCache(), restores=[replaceGlobal('caches',{default:cache}),silenceWarnings()];
  let first=true;
  restores.push(replaceGlobal('fetch',async url=>String(url).includes('shafaq.com')?new Response(report(current,erbil+(first?sula:''),'report')):new Response('',{status:503})));
  try{
    const a=requestContext('https://hawal.example/api/markets');await (await marketsApi(a.context)).json();await a.settle();
    first=false;cache.deleteWhere('markets-fresh-v5');
    const b=requestContext('https://hawal.example/api/markets');const payload=await (await marketsApi(b.context)).json();await b.settle();
    const local=payload.items.find(q=>q.symbol==='USD/IQD');
    assert.equal(local.erbil.sell,150000);assert.equal(local.sulaymaniyah.sell,151000);
    assert.equal(cityRecord([local],'sulaymaniyah').dataStatus,'stale');assert.ok(payload.checkedAt);
  }finally{restores.reverse().forEach(fn=>fn());}
});
test('CBI observation history stays explicitly undated and input arrays are not mutated',()=>{
  const data=structuredClone(fixture);data[0].history=[];
  const points=collectRates(data,now);const official=points.filter(p=>p.city==='official');
  assert.equal(official.length,2);assert.equal(official[0].price,131000);assert.equal(official[0].observed,true);
  assert.equal(data[0].history.length,0);assert.equal(quoteState(data[1]),'undated');
  const repeated=collectRates([{...data[1],fetchedAt:new Date(now+60000).toISOString()}],now+60000);
  assert.equal(normalizeHistory([...points,...repeated],now+60000).filter(p=>p.city==='official').length,2);
});
test('rate alerts compare a publisher across different report URLs, not different cities',()=>{
  const a=marketSnapshot(fixture,[],now);
  const b=marketSnapshot([{...fixture[0],updatedAt:new Date(now+60000).toISOString(),sourceUrl:'https://shafaq.com/next',erbil:{sell:151000,buy:150000}}],[],now+60000);
  const alerts=calculateAlerts(a,b,{enabled:true,city:'erbil',threshold:500});
  assert.equal(alerts.length,1);assert.equal(alerts[0].diff,1000);
  assert.equal(calculateAlerts(a,b,{enabled:true,city:'baghdad',threshold:500}).length,0);
});
test('search finds cities and CBI in all languages; Kurdish dates use Kurdish months',()=>{
  for(const term of ['Sulaimani','سلێمانی','السليمانية'])assert.equal(matchingRates(fixture,term)[0].city,'sulaymaniyah');
  assert.equal(matchingRates(fixture,'CBI')[0].city,'official');
  assert.equal(matchingRates(fixture,'USD/IQD').length,4);
  assert.match(timestamp('2026-10-30T12:00:00Z','ku'),/تشرینی یەکەم.*بەغدا/);
  assert.match(timestamp('2026-10-30T12:00:00Z','ar'),/بغداد/);
});
test('all production messages have matching translation keys',()=>{
  for(const lang of ['ku','ar']){
    assert.deepEqual(Object.keys(polishCopy[lang]).sort(),Object.keys(polishCopy.en).sort());
    assert.ok(Object.values(polishCopy[lang]).every(s=>typeof s==='string'&&s.trim()));
  }
});
test('decimal changes cannot pass translation validation; English target preserves numbers',()=>{
  assert.equal(validateTranslation('Gold rose 1.5%','زێڕ بە ڕێژەی ١٥٪ بەرز بووەوە','ku').ok,false);
  assert.equal(validateTranslation('Gold rose 1,5%','زێڕ بە ڕێژەی ٠,٥٪ بەرز بووەوە','ku').ok,false);
  assert.equal(validateTranslation('سعر الدولار ١٥٠٠ دينار','The dollar price is 1500 dinars','en').ok,true);
});
test('English and ckb translation API targets are supported without Microsoft',async()=>{
  const restore=replaceGlobal('fetch',async url=>{
    const target=new URL(url).searchParams.get('tl');
    return Response.json([[[target==='en'?'The dollar price is 1500 dinars':'نرخی دۆلار ١٥٠٠ دینارە']]]);
  });
  try{
    for(const [lang,text] of [['en','سعر الدولار ١٥٠٠ دينار'],['ckb','The dollar price is 1500 dinars']]){
      const result=await (await translate({request:new Request('https://hawal.example/api/translate',{method:'POST',body:JSON.stringify({lang,texts:[text]})})})).json();
      assert.deepEqual(result.translatedFlags,[true]);assert.deepEqual(result.sources,['google-public']);
    }
  }finally{restore();}
});
test('custom domain metadata, sitemap and robots use the same configured origin',async()=>{
  const template=fs.readFileSync('index.html','utf8');
  assert.equal(siteOrigin('javascript:alert(1)','https://live.example/ar/'),'https://live.example');
  const html=renderPage(template,{siteUrl:'https://news.example',lang:'ar',page:'home',markets:fixture});
  assert.match(html,/rel="canonical" href="https:\/\/news.example\/ar\/"/);
  assert.match(html,/hreflang="ckb" href="https:\/\/news.example\/"/);
  assert.match(html,/https:\/\/news.example\/og-image.png/);assert.doesNotMatch(html,/pages\.dev/);
  const structured=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.ok(structured['@graph'].some(q=>q['@type']==='Dataset'));
  for(const path of ['/robots.txt','/sitemap.xml']){
    const result=await middleware({request:new Request('https://old.example'+path),env:{SITE_URL:'https://news.example'},next:()=>{throw Error('unexpected static fallback');}});
    const body=await result.text();assert.match(body,/https:\/\/news.example/);assert.doesNotMatch(body,/old.example|pages.dev/);
  }
});
test('actual React rate cards, converter, trust pages and language labels render in all locales',async()=>{
  const server=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {DollarRates}=await server.ssrLoadModule('/src/components/RateBoard.jsx');
    const {AboutPage}=await server.ssrLoadModule('/src/components/TrustPages.jsx');
    const {NewsLanguage}=await server.ssrLoadModule('/src/components/NewsLanguage.jsx');
    for(const lang of ['ku','ar','en']){
      const rates=renderToStaticMarkup(React.createElement(DollarRates,{markets:fixture,lang}));
      assert.ok(rates.includes(polishCopy[lang].emptyRate));assert.doesNotMatch(rates,/—/);
      assert.ok(rates.includes(formatNumber(149000,lang)),'USD customer sale must use dealer buy price');
      assert.ok(rates.includes(polishCopy[lang].converter));
      const about=renderToStaticMarkup(React.createElement(AboutPage,{lang,page:'about'}));
      assert.ok(about.includes(polishCopy[lang].corrections));assert.ok(about.includes(polishCopy[lang].timing));
      const contact=renderToStaticMarkup(React.createElement(AboutPage,{lang,page:'contact',contact:{email:'public@example.com'}}));
      assert.match(contact,/<form/);assert.match(contact,/mailto:public@example.com/);assert.ok(contact.includes(polishCopy[lang].reportNote));
      const badge=renderToStaticMarkup(React.createElement(NewsLanguage,{lang,item:{titleEn:'Original headline'}}));
      assert.ok(badge.includes(polishCopy[lang].originalLanguage));
    }
  }finally{await server.close();}
});

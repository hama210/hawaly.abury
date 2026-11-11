import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseYahooMetalChart,fetchYahooMetalHistory } from '../functions/api/metals-history.js';
import { pageRoute,pagePath } from '../src/lib/market-tools.js';
import { renderPage,escapeHtml } from '../src/lib/server-page.js';
import { marketStories } from '../src/lib/hawal-features.js';
import {
  METALS,metalQuote,cleanMetalHistory,recentMetalHistory,metalChartPoints,selectMetalEvents
} from '../src/lib/metals-center.js';
import { metalsPageCopy } from '../src/lib/metals-copy.js';

const now=Date.parse('2026-11-11T18:00:00Z');
const iso=value=>new Date(value).toISOString();
const gold={symbol:'XAU/USD',price:3777.5,changePct:1.25,updatedAt:iso(now-60000),
  source:'Yahoo Finance',sourceUrl:'https://finance.yahoo.com/quote/GC%3DF/',quoteType:'futures'};
const silver={symbol:'XAG/USD',price:44.22,changePct:-0.32,updatedAt:iso(now-900000),
  source:'Yahoo Finance',sourceUrl:'https://finance.yahoo.com/quote/SI%3DF/',quoteType:'futures'};

test('metals reuse real API quotes and label stale or unavailable values honestly',()=>{
  assert.deepEqual(Object.keys(METALS),['gold','silver']);
  const fresh=metalQuote([gold,silver],'gold',now);
  assert.equal(fresh.price,3777.5);
  assert.equal(fresh.change,1.25);
  assert.equal(fresh.state,'reported');
  assert.equal(fresh.instrument,'futures');
  assert.equal(metalQuote([gold,silver],'silver',now).change,-0.32);
  const stale=metalQuote([{...gold,updatedAt:iso(now-3600000)}],'gold',now);
  assert.equal(stale.state,'stale');
  assert.equal(stale.price,3777.5);
  assert.equal(metalQuote([], 'gold', now).price,null);
  assert.equal(metalQuote([{...gold,price:null}],'gold',now).state,'unavailable');
  assert.equal(metalQuote([{...gold,updatedAt:null}],'gold',now).state,'undated');
});

test('Yahoo daily chart parsing only accepts real positive dated observations',()=>{
  const payload={chart:{result:[{timestamp:[
    (now-3*86400000)/1000,(now-2*86400000)/1000,(now-86400000)/1000,
    (now+86400000)/1000
  ],indicators:{quote:[{close:[3000,3075,0,9999]}]}}]}};
  const parsed=parseYahooMetalChart(payload,'XAU/USD',now);
  assert.equal(parsed.points.length,2);
  assert.deepEqual(parsed.points.map(p=>p.close),[3000,3075]);
  assert.ok(parsed.points[0].time<parsed.points[1].time);
  assert.throws(()=>parseYahooMetalChart({chart:{result:[]}},'XAU/USD',now),/No Yahoo daily quotes/);
  assert.throws(()=>parseYahooMetalChart({chart:{result:[{timestamp:[now/1000],indicators:{quote:[{close:[null]}]}}]}},'XAU/USD',now),/No dated positive/);
});

test('upstream history fetch uses the actual Yahoo futures symbols, never invented charts',async()=>{
  let url,headers,signal;
  const fetchImpl=async(input,options)=>{
    url=input;headers=options.headers;signal=options.signal;
    return Response.json({chart:{result:[{timestamp:[(now-86400000)/1000,now/1000],
      indicators:{quote:[{close:[42.13,44.21]}]}}]}});
  };
  const points=await fetchYahooMetalHistory({symbol:'XAG/USD',yahooSymbol:'SI=F'},fetchImpl,now);
  assert.match(url,/SI%3DF\?range=1mo&interval=1d/);
  assert.equal(headers.Accept,'application/json');
  assert.equal(signal.aborted,false);
  assert.equal(points.points.length,2);
  assert.equal(points.points[1].close,44.21);
});

test('history is validated, sorted, filtered and no line is drawn with one real point',()=>{
  const payload={items:[{symbol:'XAU/USD',points:[
    {time:iso(now-8*86400000),close:3000},
    {time:iso(now-5*86400000),close:3010},
    {time:iso(now-2*86400000),close:3020},
    {time:'invalid',close:55},
    {time:iso(now-86400000),close:-1}
  ]},{symbol:'FAKE/USD',points:[{time:iso(now),close:999999}]}],source:'Yahoo Finance',updatedAt:iso(now)};
  const validated=cleanMetalHistory(payload,now);
  assert.equal(validated.items['XAU/USD'].length,3);
  assert.equal(validated.items['FAKE/USD'],undefined);
  assert.equal(recentMetalHistory(validated.items['XAU/USD'],7,now).length,2);
  assert.equal(recentMetalHistory(validated.items['XAU/USD'],30,now).length,3);
  assert.equal(metalChartPoints(validated.items['XAU/USD'].slice(0,1)).length,0);
  assert.equal(metalChartPoints(validated.items['XAU/USD']).length,3);
  const chart=metalChartPoints(validated.items['XAU/USD']);
  assert.ok(chart.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.throws(()=>cleanMetalHistory({items:null},now),/Invalid metals history/);
});

test('only USD high impact source calendar releases appear in metals events',()=>{
  const events=[
    {id:'a',title:'CPI',time:iso(now+60000),currency:'USD',impact:'high'},
    {id:'b',title:'EUR CPI',time:iso(now+60000),currency:'EUR',impact:'high'},
    {id:'c',title:'NFP',time:iso(now+3600000),currency:'USD',impact:'high',status:'moved'},
    {id:'d',title:'Policy',time:iso(now+3600000),currency:'USD',impact:'medium'},
    {id:'e',title:'FOMC',time:iso(now+86400000),currency:'USD',impact:'high'}
  ];
  assert.deepEqual(selectMetalEvents(events,now).map(e=>e.id),['a','e']);
});

test('real source-linked metal headlines are separate for gold and silver',()=>{
  const timestamp=iso(Date.now()-3600000);
  const stories=[
    {id:'g',title:'Gold bullion rises',publishedAt:timestamp,link:'https://example.com/gold'},
    {id:'s',title:'Silver bullion falls',publishedAt:timestamp,link:'https://example.com/silver'},
    {id:'f',title:'Spot price trend',publishedAt:timestamp,link:'javascript:alert(1)'}
  ];
  const goldNews=marketStories(stories,'XAU/USD');
  const silverNews=marketStories(stories,'XAG/USD');
  assert.ok(goldNews.some(s=>s.id==='g'));
  assert.ok(!silverNews.some(s=>s.id==='g'));
  assert.ok(silverNews.some(s=>s.id==='s'));
  assert.ok(!goldNews.some(s=>s.id==='f'));
});

test('new route and multilingual metadata are crawlable without changing existing routes',()=>{
  const html=readFileSync('index.html','utf8');
  for(const lang of ['ku','ar','en']){
    const url=pagePath(lang,'metals');
    assert.deepEqual(pageRoute(url),{lang,page:'metals',valid:true});
    const output=renderPage(html,{lang,page:'metals',news:[],markets:[]});
    assert.ok(output.includes(escapeHtml(metalsPageCopy[lang].title)));
    assert.ok(output.includes(escapeHtml(metalsPageCopy[lang].description)));
    assert.match(output,/<meta name="description" content="[^"]+"/);
    assert.match(output,/GC=F/);
    assert.match(output,/SI=F/);
    assert.ok(output.includes('rel="canonical" href="https://hawaly-aburyy.pages.dev'+url+'"'));
  }
  assert.equal(pageRoute('/en/calendar').valid,true);
  assert.equal(pageRoute('/ar/about').valid,true);
  assert.equal(pageRoute('/en/metals/gold').valid,false);
  const sitemap=readFileSync('public/sitemap.xml','utf8');
  for(const path of ['/metals','/ar/metals','/en/metals'])
    assert.ok(sitemap.includes('https://hawaly-aburyy.pages.dev'+path+'</loc>'));
});

test('the live React page exposes gold silver navigation, history and source links',()=>{
  const main=readFileSync('src/main.jsx','utf8');
  const center=readFileSync('src/components/GoldSilverCenter.jsx','utf8');
  const desktop=readFileSync('src/components/HawalDashboard.jsx','utf8');
  const css=readFileSync('src/metals-center.css','utf8');
  assert.match(main,/<GoldSilverCenter lang=\{lang\} markets=\{markets\} news=\{displayNews\}/);
  assert.match(main,/mc-entry-link/);
  assert.match(center,/marketStories\(news,item.symbol\)/);
  assert.match(center,/fetchEconomicCalendar\(controller.signal\)/);
  assert.match(center,/cleanMetalHistory\(data\)/);
  assert.match(center,/quote.state/);
  assert.match(center,/role="img"/);
  assert.match(desktop,/pagePath\(lang,'metals'\)/);
  assert.match(css,/--card/);
  assert.match(css,/@media\(max-width:400px\)/);
});

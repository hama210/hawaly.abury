import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TOPICS, sourceAssessment, claimWords, findRelatedReports, marketStories,
  normalizeHistory, collectRates, historyFor, chartCoordinates,
  marketSnapshot, calculateAlerts
} from '../src/lib/hawal-features.js';

const now = Date.now();
const iso = offset => new Date(now+offset).toISOString();
const site = 'https://example.com/source';
const realNews = (title, tier='major', offset=-5000) => ({id:title,title,source:'Example News',sourceTier:tier,link:site+'/story',publishedAt:iso(offset),intelligence:{impact:'high'}});

test('market intelligence selects only recent topic-related headlines with sources',()=>{
  const news=[realNews('Gold rises as inflation pushes bond yields'),realNews('Erbil dollar buying price rises'),realNews('Gold prices yesterday', 'major', -10*86400000),{title:'Gold rumor'}];
  assert.ok(TOPICS.includes('USD/IQD'));
  assert.deepEqual(marketStories(news,'XAU/USD').map(i=>i.title),['Gold rises as inflation pushes bond yields']);
  assert.deepEqual(marketStories(news,'USD/IQD').map(i=>i.title),['Erbil dollar buying price rises']);
});

test('rumor tool finds related reporting but never calls publisher reporting verified',()=>{
  const news=[realNews('Central Bank of Iraq adjusts official dollar rate','major'),realNews('Central Bank of Iraq discusses dollar rate','official'),realNews('Oil prices jump')];
  const matches=findRelatedReports('Iraq central bank dollar rate changed',news);
  assert.equal(matches.length,2);
  assert.equal(sourceAssessment(matches[0]),'reported');
  assert.equal(sourceAssessment(matches[1]),'official');
  assert.equal(sourceAssessment({sourceTier:'official',title:'A claim'}),'unconfirmed');
  assert.equal(findRelatedReports('???',news).length,0);
  assert.ok(claimWords('Iraq central bank dollar rate').length>=2);
});

test('history excludes unavailable, stale, undated and fabricated quotes',()=>{
  const sample={symbol:'USD/IQD',marketKind:'local',dataStatus:'live',price:153500,source:'Local desk',sourceUrl:site,updatedAt:iso(-3600000),erbil:{buy:153300,sell:153500},baghdad:null};
  const a=collectRates([sample],now);
  assert.equal(a.length,2);
  assert.equal(collectRates([{...sample,updatedAt:null}],now).length,0);
  assert.equal(collectRates([{...sample,dataStatus:'stale'}],now).length,0);
  assert.equal(collectRates([{...sample,sourceUrl:'javascript:alert(1)'}],now).length,0);
  const points=normalizeHistory([...a,...a,{...a[0],at:iso(-100*86400000)},{...a[0],price:-1}],now);
  assert.equal(points.length,2);
  assert.equal(historyFor(points,'erbil','sell',7,now).length,1);
  assert.deepEqual(chartCoordinates([points[0]]),[]);
});

test('alert engine avoids older quotes and changed sources; triggers on actual new observations',()=>{
  const prev={quotes:{erbil:{price:153000,at:iso(-600000),sourceUrl:site},gold:{price:4100,at:iso(-600000),sourceUrl:site}},breaking:[]};
  const next={quotes:{erbil:{price:153600,at:iso(-120000),sourceUrl:site},gold:{price:4150,at:iso(-120000),sourceUrl:site}},breaking:[]};
  const cfg={enabled:true,city:'erbil',threshold:500,goldEnabled:true,goldThreshold:1,breakingEnabled:false};
  assert.equal(calculateAlerts(prev,next,cfg).length,2);
  assert.equal(calculateAlerts(prev,next,{...cfg,enabled:false}).length,0);
  assert.equal(calculateAlerts(prev,{quotes:{erbil:{...next.quotes.erbil,sourceUrl:'https://other.example/source'}},breaking:[]},cfg).length,0);
  assert.equal(calculateAlerts(next,prev,cfg).length,0);
});

test('breaking alerts only appear for newly seen high-impact reports',()=>{
  const previous=marketSnapshot([], [realNews('Gold market strong')],now);
  const current=marketSnapshot([], [realNews('Gold market strong'),realNews('War risk changes currencies')],now);
  const cfg={enabled:true,breakingEnabled:true,threshold:500,city:'erbil'};
  assert.equal(calculateAlerts(previous,current,cfg).length,1);
  assert.equal(calculateAlerts(current,current,cfg).length,0);
  assert.equal(marketSnapshot([], [{...realNews('Rumor'),isFallback:true}],now).breaking.length,0);
});

test('responsive Hawal widgets are wired into the client and use real data',()=>{
  const source=fs.readFileSync('src/main.jsx','utf8');
  const css=fs.readFileSync('src/hawal-features.css','utf8');
  const ui=fs.readFileSync('src/components/HawalFeatures.jsx','utf8');
  for(const name of ['MarketIntelligence','VerificationDesk','DollarHistory','MarketAlerts']) {
    assert.match(source,new RegExp('<'+name+'\\b'));
    assert.match(ui,new RegExp('function '+name+'\\b'));
  }
  assert.match(css,/max-width:850px/);
  assert.match(ui,/collectRates\(markets\)/);
  assert.match(ui,/marketStories\(news,topic\)/);
  assert.match(ui,/calculateAlerts\(before,current/);
});

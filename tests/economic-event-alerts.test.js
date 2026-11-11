import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  classifyEconomicEvent, normalizeEconomicAlertSettings, upcomingEconomicEvents,
  dueEconomicAlerts, economicAlertKey, pruneEconomicAlertDelivery, formatEconomicCountdown
} from '../src/lib/economic-event-alerts.js';

const now=Date.parse('2026-11-11T18:00:00Z');
const event=(id,title,time,extras={})=>({
  id,title,time,currency:'USD',impact:'high',status:'scheduled',actual:'',...extras
});

test('detects CPI, NFP, and USD Fed events without confusing other central banks',()=>{
  assert.equal(classifyEconomicEvent(event('1','Core CPI MoM','2026-11-11T18:15:00Z')),'cpi');
  assert.equal(classifyEconomicEvent(event('2','Non-Farm Payrolls','2026-11-11T18:15:00Z')),'nfp');
  assert.equal(classifyEconomicEvent(event('3','FOMC Statement','2026-11-11T18:15:00Z')),'fed');
  assert.equal(classifyEconomicEvent(event('4','Interest Rate Decision','2026-11-11T18:15:00Z',{currency:'EUR'})),'other');
  assert.equal(classifyEconomicEvent(event('5','Oil Inventories','2026-11-11T18:15:00Z')),'other');
});

test('settings are opt-in, sanitized, and remember selected reminder and topics',()=>{
  assert.deepEqual(normalizeEconomicAlertSettings(null),{
    enabled:false,minutesBefore:15,
    topics:{cpi:true,nfp:true,fed:true,other:false}
  });
  const chosen=normalizeEconomicAlertSettings({enabled:true,minutesBefore:'30',topics:{cpi:false,nfp:true,fed:false,other:true}});
  assert.equal(chosen.enabled,true);
  assert.equal(chosen.minutesBefore,30);
  assert.equal(chosen.topics.other,true);
  assert.equal(chosen.topics.cpi,false);
  assert.equal(normalizeEconomicAlertSettings({enabled:'yes',minutesBefore:900}).enabled,false);
  assert.equal(normalizeEconomicAlertSettings({minutesBefore:900}).minutesBefore,15);
});

test('only published high-impact, selected future events are listed',()=>{
  const settings=normalizeEconomicAlertSettings({enabled:true,minutesBefore:15});
  const events=[
    event('cpi','CPI MoM','2026-11-11T18:15:00Z'),
    event('nfp','NFP','2026-11-11T18:30:00Z'),
    event('old','CPI MoM','2026-11-11T17:59:00Z'),
    event('low','CPI MoM','2026-11-11T18:05:00Z',{impact:'low'}),
    event('other','Oil Inventories','2026-11-11T18:05:00Z'),
    event('moved','CPI MoM','2026-11-11T18:05:00Z',{status:'moved'})
  ];
  assert.deepEqual(upcomingEconomicEvents(events,settings,now).map(e=>e.id),['cpi','nfp']);
});

test('reminders fire only within the selected window, once per id and release time',()=>{
  const settings=normalizeEconomicAlertSettings({enabled:true,minutesBefore:15});
  const events=[
    event('early','Core CPI MoM','2026-11-11T18:30:00Z'),
    event('in','Core CPI MoM','2026-11-11T18:12:00Z'),
    event('expired','Non-Farm Payrolls','2026-11-11T17:45:00Z'),
    event('notHigh','Core CPI MoM','2026-11-11T18:10:00Z',{impact:'medium'})
  ];
  assert.deepEqual(dueEconomicAlerts(events,settings,{},now).map(x=>x.event.id),['in']);
  const key=economicAlertKey(events[1]);
  assert.deepEqual(dueEconomicAlerts(events,settings,{[key]:now},now),[]);
  assert.equal(dueEconomicAlerts(events,{...settings,enabled:false},{},now).length,0);
  assert.notEqual(economicAlertKey({...events[1],time:'2026-11-11T19:12:00Z'}),key);
  assert.equal(dueEconomicAlerts(events,settings,{},now+30*60000).length,0);
  assert.equal(formatEconomicCountdown(events[1].time,now,'en'),'12 m');
});

test('delivered-alert history is bounded, prunes old entries and avoids duplicates after reload',()=>{
  const current=now-2*86400000;
  const data={'valid':current,'expired':now-16*86400000,'future':now+60000,'broken':'yesterday'};
  assert.deepEqual(pruneEconomicAlertDelivery(data,now),{valid:current});
});

test('calendar and More use the same localized alert panel without editing translation',()=>{
  const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  const calendar=readFileSync(new URL('../src/components/EconomicCalendar.jsx',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../src/components/EconomicEventAlerts.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/economic-event-alerts.css',import.meta.url),'utf8');
  assert.match(main, /<EconomicEventAlerts lang=\{lang\} visible=\{activeView==='more'\}/);
  assert.match(calendar, /<EconomicEventAlerts lang=\{lang\} events=\{data\.events\}/);
  assert.match(panel, /ku:\{/);
  assert.match(panel, /ar:\{/);
  assert.match(panel, /en:\{/);
  assert.match(panel, /Notification\.requestPermission\(\)/);
  assert.match(panel, /onlyOpen:/);
  assert.match(css, /var\(--card\)/);
  assert.match(css, /\.ea-toast/);
});

test('service worker opens local calendar when economic reminder notification is clicked',async()=>{
  const src=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  const handlers={};
  let opened='',closed=false,waited=null;
  const context={
    URL,Response,
    self:{
      location:{origin:'https://hawaly-aburyy.pages.dev'},
      addEventListener(name,callback){handlers[name]=callback;},
      clients:{matchAll:async()=>[],openWindow:async url=>{opened=url;return {url};}}
    }
  };
  runInNewContext(src,context);
  assert.equal(typeof handlers.notificationclick,'function');
  handlers.notificationclick({
    notification:{close(){closed=true;}},
    waitUntil(promise){waited=promise;}
  });
  await waited;
  assert.equal(closed,true);
  assert.equal(opened,'https://hawaly-aburyy.pages.dev/calendar');
});

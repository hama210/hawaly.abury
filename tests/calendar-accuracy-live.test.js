import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeCalendarEvent,calendarScenarios,parseEconomicValue,hasPublishedCalendarActual,
 indicatorKind} from '../src/lib/economic-impact.js';
import {normalizeCalendarPayload} from '../src/services/economic-calendar.js';
import {calendarDayKey} from '../src/lib/calendar-history.js';

test('parses provider values with minus AFTER currencies, including JPY and NZD deficits',()=>{
 assert.deepEqual(parseEconomicValue('¥-956B'),{value:-956e9,unit:'number'});
 assert.deepEqual(parseEconomicValue('$-6.18B'),{value:-6.18e9,unit:'number'});
 assert.deepEqual(parseEconomicValue('-$6.18B'),{value:-6.18e9,unit:'number'});
 assert.deepEqual(parseEconomicValue('€-143.9K'),{value:-143900,unit:'number'});
 assert.deepEqual(parseEconomicValue('($250K)'),{value:-250000,unit:'number'});
 assert.deepEqual(parseEconomicValue('−0.3%'),{value:-0.3,unit:'percent'});
 assert.deepEqual(parseEconomicValue('0%'),{value:0,unit:'percent'});
 for(const malformed of ['-$-5B','-€+5B','(−5K','-5K)','-','—','n/a','pending']){
   assert.equal(parseEconomicValue(malformed),null,malformed);
 }
});

test('provider event time must include timezone; known Unix time works without an ISO timezone',()=>{
 const time='2026-11-17T13:30:00Z',ts=Date.parse(time)/1000;
 const normalized=normalizeCalendarPayload({generated_at:'2026-11-14T14:00:00Z',events:[
  {id:'1',time,currency:'USD',title:'CPI MoM',impact:'high',
    forecast:'0.3%',actual:'',previous:'0.2%'},
  {id:'2',time:'2026-11-17T16:30:00+03:00',currency:'USD',title:'Core PCE',impact:'medium',ts},
  {id:'3',time:'2026-11-17T13:30:00',ts,currency:'GBP',title:'GDP',impact:'low'},
  {id:'4',time:'2026-11-17T13:30:00',currency:'USD',title:'Ambiguous timezone',impact:'high'},
  {id:'5',time,currency:'USD',title:'Unknown impact',impact:'unclassified'},
 ]});
 assert.equal(normalized.events.length,4);
 assert.ok(normalized.events.slice(0,3).every(e=>Date.parse(e.time)===Date.parse(time)));
 assert.equal(normalized.events.find(e=>e.id==='5').impact,'unknown');
 const cpi=normalized.events.find(e=>e.id==='1');
 assert.equal(cpi.actual,'');assert.equal(cpi.forecast,'0.3%');assert.equal(cpi.previous,'0.2%');
 assert.equal(calendarDayKey('2026-11-14T21:00:00Z'),'2026-11-15');
});

test('a missing/placeholder Actual does not falsely signal a published result',()=>{
 for(const actual of ['',null,'—','-', 'pending','N/A','word']){
  assert.equal(hasPublishedCalendarActual({actual}),false);
 }
 assert.equal(hasPublishedCalendarActual({actual:'0'}),true);
 assert.equal(hasPublishedCalendarActual({actual:'-0.3%'}),true);
 assert.equal(hasPublishedCalendarActual({actual:'$-6.18B'}),true);
});

test('USD gold and silver influence is explicitly conditional and not invented from minor events',()=>{
 const cpi={title:'Core CPI MoM',currency:'USD',impact:'high',actual:'0.4%',forecast:'0.3%'};
 const high=analyzeCalendarEvent(cpi);
 assert.deepEqual(high.markets.map(m=>[m.asset,m.direction]),
  [['USD','up'],['XAUUSD','down'],['XAGUSD','down']]);
 const claims=analyzeCalendarEvent({title:'Initial Jobless Claims',currency:'USD',impact:'medium',actual:'250K',forecast:'220K'});
 assert.deepEqual(claims.markets.map(m=>m.direction),['down','up','up']);
 const low=analyzeCalendarEvent({title:'Existing Home Sales MoM',currency:'USD',impact:'low',actual:'3.75M',forecast:'3.85M'});
 assert.equal(indicatorKind('Existing Home Sales MoM'),'growth');
 assert.deepEqual(low.markets,[{asset:'USD',direction:'down'}]);
 assert.deepEqual(calendarScenarios({title:'Existing Home Sales MoM',currency:'USD',impact:'low',actual:'',forecast:'3.85M'}).cases[0].markets,
  [{asset:'USD',direction:'up'}]);
 const deficit=analyzeCalendarEvent({title:'Trade Balance',currency:'JPY',impact:'medium',actual:'¥-956B',forecast:'¥-1000B'});
 assert.deepEqual(deficit.markets,[{asset:'JPY',direction:'up'}]);
 assert.deepEqual(analyzeCalendarEvent({title:'Fed Chair Speech',currency:'USD',impact:'high',actual:'',forecast:''}).markets,[]);
});

test('calendar UI never shows hypothetical pre-release arrows after the scheduled release',()=>{
 const text=readFileSync('src/components/EconomicCalendar.jsx','utf8');
 assert.match(text,/Date\.parse\(event\.time\) > now && !resultPublished && <BeforeRelease/);
 assert.match(text,/hasPublishedCalendarActual\(event\)/);
 assert.match(text,/event\.impact === 'unknown' \? c\.notAvailable/);
});

test('calendar archive commits deploy to Cloudflare instead of being skipped by CI',()=>{
 const text=readFileSync('.github/workflows/archive-calendar.yml','utf8');
 assert.match(text,/git commit -m "data: publish archived economic calendar releases"/);
 assert.doesNotMatch(text,/\[skip ci\]/);
 assert.match(text,/paths:\s*\n\s*- '\.github\/workflows\/archive-calendar\.yml'\s*\n\s*- 'scripts\/archive-calendar\.mjs'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  recentPublishedCalendarResults, mergeCalendarEvents, matchesCalendarView, archivePastCalendarEvents,
  calendarDayKey
} from '../src/lib/calendar-history.js';
import { normalizeCalendarHistory } from '../src/services/economic-calendar.js';

const now=Date.parse('2026-11-14T14:17:00Z'); // 17:17 Baghdad

test('recover 38 source-backed Actual values saved in existing public production archive',()=>{
 const raw=JSON.parse(readFileSync('public/data/economic-calendar-history.json','utf8'));
 const history=normalizeCalendarHistory(raw);
 const latest=recentPublishedCalendarResults(history.events,now,30);
 const sourcePublished=history.events.filter(event=>String(event.actual||'').trim());
 assert.ok(sourcePublished.length>=35,'A regression must never erase saved source Actual records');
 assert.equal(latest.length,sourcePublished.length);
 assert.ok(latest.every(event=>event.actual && Date.parse(event.time)<=now));
 assert.ok(latest.every((event,index,arr)=>index===0||Date.parse(arr[index-1].time)>=Date.parse(event.time)));
 assert.ok(latest.some(event=>event.currency==='USD'&&event.title.includes('Initial Jobless Claims')));
 assert.ok(latest.some(event=>event.currency==='EUR'));
 assert.equal(latest.filter(event=>event.currency==='USD').length,7);
});

test('Actual-only results view does not show unreleased or empty events',()=>{
 const events=[
  {id:'pending',title:'CPI',currency:'USD',time:'2026-11-13T13:30:00Z',actual:''},
  {id:'published',title:'NFP',currency:'USD',time:'2026-11-12T13:30:00Z',actual:'250K'},
  {id:'zero',title:'Rate decision',currency:'USD',time:'2026-11-11T13:30:00Z',actual:'0%'},
  {id:'future',title:'PCE',currency:'USD',time:'2026-11-16T13:30:00Z',actual:'0.4%'},
  {id:'bad',title:'CPI',currency:'USD',time:'2026-11-10T13:30:00Z',actual:'pending'}
 ];
 assert.deepEqual(recentPublishedCalendarResults(events,now,7).map(event=>event.id),['published','zero']);
 assert.deepEqual(recentPublishedCalendarResults(events,now,30).map(event=>event.id),['published','zero']);
 assert.equal(recentPublishedCalendarResults(null,now).length,0);
});

test('published Actual is preserved across provider updates that omit results',()=>{
 const archived=[{id:'usd-claims',title:'Initial Jobless Claims',currency:'USD',
  time:'2026-11-12T13:30:00Z',actual:'200K',forecast:'195K',previous:'189K',impact:'medium'}];
 const provider=[{...archived[0],actual:'',forecast:'',previous:''}];
 const merged=mergeCalendarEvents(archived,provider);
 assert.equal(merged[0].actual,'200K');
 assert.equal(merged[0].forecast,'195K');
 assert.equal(merged[0].previous,'189K');
 assert.equal(recentPublishedCalendarResults(merged,now).length,1);
});

test('visible results include past releases in Iraq time while week and upcoming stay separate',()=>{
 const release='2026-11-13T18:00:00Z';
 assert.equal(calendarDayKey(release),'2026-11-13');
 assert.equal(matchesCalendarView(release,'history',now,{historyDays:7}),true);
 assert.equal(matchesCalendarView('2026-11-16T13:30:00Z','history',now,{historyDays:7}),false);
});

test('calendar UI exposes a dedicated Actual results tab, preview and correct source archive loading',()=>{
 const source=readFileSync('src/components/EconomicCalendar.jsx','utf8');
 assert.match(source,/const tabs = \['yesterday','today','tomorrow','week','results','history'\]/);
 assert.match(source,/const latestActuals = useMemo\(\(\) => recentPublishedCalendarResults\(combined,now,30\)/);
 assert.match(source,/latestActuals\.slice\(0,3\)\.map/);
 assert.match(source,/windowDays === 'results' \?/);
 assert.match(source,/setCurrency\('all'\);setImpact\('all'\);setMetalsOnly\(false\);setSearch\(''\)/);
 assert.match(source,/fetchCalendarHistory\(controller\.signal\)/);
 assert.match(source,/\{c\.actual\}: \{event\.actual\}/);
 assert.match(source,/archiveFailed/);
 const css=readFileSync('src/economic-calendar.css','utf8');
 assert.match(css,/\.ec-latest-results-list/);
 assert.match(css,/@media\(max-width:720px\)/);
});

test('a fresh release stays visible before the shared archive catches up', () => {
  const release = {
    id: 'usd-cpi', title: 'CPI MoM', currency: 'USD', impact: 'high',
    time: '2026-11-16T13:30:00Z', actual: '0.4%', forecast: '0.3%', previous: '0.2%'
  };
  const publishedAt = Date.parse('2026-11-16T13:32:00Z');
  const captured = archivePastCalendarEvents([], [release], publishedAt);
  const placeholder = { ...release, actual: '—', forecast: '', previous: '' };
  const refreshed = mergeCalendarEvents(captured, [placeholder]);
  assert.deepEqual(recentPublishedCalendarResults(refreshed, publishedAt), [release]);

  const afterLookback = Date.parse('2026-11-16T20:30:00Z');
  const rolledOff = archivePastCalendarEvents(captured, [], afterLookback);
  assert.deepEqual(recentPublishedCalendarResults(rolledOff, afterLookback), [release]);
  assert.deepEqual(recentPublishedCalendarResults(mergeCalendarEvents(rolledOff, [
    { ...release, actual: '0.5%' }
  ]), afterLookback).map(event => event.actual), ['0.5%']);
});

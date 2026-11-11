import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCalendarEvent, parseEconomicValue, indicatorKind, calendarScenarios } from '../src/lib/economic-impact.js';
import { normalizeCalendarPayload, normalizeCalendarHistory } from '../src/services/economic-calendar.js';
import { calendarDayKey,shiftCalendarDay,mondayOfCalendarWeek,matchesCalendarView,mergeCalendarEvents,archivePastCalendarEvents } from '../src/lib/calendar-history.js';
import { calendarEventTitle, calendarText } from '../src/lib/calendar-i18n.js';
import { pageRoute, pagePath } from '../src/lib/market-tools.js';

test('parse units and percentage values, including negatives', () => {
  assert.deepEqual(parseEconomicValue('240K'), { value:240000, unit:'number' });
  assert.deepEqual(parseEconomicValue('1.5M'), { value:1500000, unit:'number' });
  assert.deepEqual(parseEconomicValue('-0.3%'), { value:-0.3, unit:'percent' });
  assert.deepEqual(parseEconomicValue('(250K)'), { value:-250000, unit:'number' });
  assert.equal(parseEconomicValue('—'), null);
  assert.equal(parseEconomicValue('Q3-2026'), null);
});

test('hot CPI suggests conditional currency strength and metal weakness', () => {
  const result = analyzeCalendarEvent({ title:'Core CPI MoM', currency:'USD', actual:'0.4%', forecast:'0.3%' });
  assert.equal(result.status, 'surprise');
  assert.equal(result.direction, 'up');
  assert.equal(result.note, 'rate_expectations');
  assert.deepEqual(result.markets.map(m => [m.asset,m.direction]), [
    ['USD','up'],['XAUUSD','down'],['XAGUSD','down']
  ]);
});

test('jobless claims reverse positive-surprise logic', () => {
  const result = analyzeCalendarEvent({ title:'Initial Jobless Claims', currency:'USD', actual:'250K', forecast:'220K' });
  assert.equal(result.direction, 'down');
  assert.equal(result.markets.find(m => m.asset === 'XAGUSD').direction, 'up');
});

test('strong payrolls mean possible currency strength', () => {
  const result = analyzeCalendarEvent({ title:'Non-Farm Payrolls', currency:'USD', actual:'250K', forecast:'200K' });
  assert.equal(result.direction, 'up');
  assert.equal(indicatorKind('Non-Farm Payrolls'), 'growth');
});

test('unreleased actual is pending, not a made-up trade direction', () => {
  const result = analyzeCalendarEvent({ title:'Core CPI YoY', currency:'USD', actual:'', forecast:'2.8%' });
  assert.equal(result.status, 'pending');
  assert.equal(result.markets.length, 0);
});

test('missing forecast never substitutes previous', () => {
  const result = analyzeCalendarEvent({ title:'CPI MoM', currency:'USD', actual:'0.5%', forecast:'', previous:'0.4%' });
  assert.equal(result.status, 'unknown');
  assert.equal(result.note, 'no_forecast');
});

test('incompatible units are never compared', () => {
  const result = analyzeCalendarEvent({ title:'CPI MoM', currency:'USD', actual:'0.5%', forecast:'0.4M' });
  assert.equal(result.status, 'unknown');
  assert.equal(result.note, 'incompatible_units');
});

test('speech events are not given mechanical market signals', () => {
  const result = analyzeCalendarEvent({ title:"Fed Chair Speech", currency:'USD', actual:'1.2', forecast:'1.0' });
  assert.equal(result.status,'unknown');
  assert.deepEqual(result.markets,[]);
});

test('matching forecast is neutral', () => {
  const result = analyzeCalendarEvent({ title:'Retail Sales MoM',currency:'USD',actual:'0.3%',forecast:'0.3%' });
  assert.equal(result.status,'equal');
  assert.equal(result.direction,'neutral');
});

test('normalizes provider data and rejects invalid events', () => {
  const result = normalizeCalendarPayload({ generated_at:'2026-11-10T12:00:00Z', events:[
    {time:'bad',currency:'USD',title:'Bad event'},
    {time:'2026-11-10T13:30:00Z',id:'cpi',currency:'USD',title:'CPI MoM',impact:'high',
      actual:'0.4%',forecast:'0.3%',previous:'0.2%',status:'scheduled'}
  ]});
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].id,'cpi');
  assert.equal(result.events[0].actual,'0.4%');
  assert.equal(result.publishedAt,'2026-11-10T12:00:00Z');
  assert.throws(() => normalizeCalendarPayload({events:null}), /Invalid/);
});

test('Sorani localized key releases; unknown names preserved', () => {
  assert.match(calendarEventTitle('Core CPI MoM','ku'),/بنەڕەتی/);
  assert.match(calendarEventTitle('Non-Farm Payrolls','ku'),/NFP/);
  assert.equal(calendarEventTitle('Unexpected indicator name','ku'),'Unexpected indicator name');
  assert.equal(calendarText('ku').actual,'ئەنجامی ڕاستەقینە');
});

test('localized calendar routes are accepted', () => {
  assert.equal(pageRoute('/calendar').valid, true);
  assert.equal(pageRoute('/ar/calendar').lang,'ar');
  assert.equal(pageRoute('/en/calendar').page,'calendar');
  assert.equal(pagePath('ku','calendar'),'/calendar');
});


test('pre-release scenarios show both directions without mutating provider values', () => {
  const event = {title:'Core CPI MoM',currency:'USD',actual:'',forecast:'0.3%'};
  const result = calendarScenarios(event);
  assert.deepEqual(result.cases.map(c => c.markets.map(m => m.direction)), [['up','down','down'],['down','up','up']]);
  assert.equal(result.note,'rate_expectations');
  assert.equal(event.actual,'');
  assert.equal(event.forecast,'0.3%');
});
test('pre-release unemployment reverses direction and non-USD events do not predict metals', () => {
  const result = calendarScenarios({title:'Unemployment Rate',currency:'GBP',forecast:'4%'});
  assert.deepEqual(result.cases.map(c => c.markets), [[{asset:'GBP',direction:'down'}],[{asset:'GBP',direction:'up'}]]);
});
test('no speculative cases after release, without forecast, or for unsupported events', () => {
  assert.equal(calendarScenarios({title:'CPI',actual:'0',forecast:'1'}),null);
  assert.equal(calendarScenarios({title:'CPI',actual:'—',forecast:''}).cases.length,0);
  assert.equal(calendarScenarios({title:'Fed speech',forecast:'1'}).note,'unsupported_indicator');
  assert.equal(calendarScenarios({title:'Retail Sales',currency:'USD',actual:'—',forecast:'0'}).cases.length,2);
});

test('Baghdad date tabs honor local midnight rather than browser time zone', () => {
  const now = Date.parse('2026-11-11T18:30:00Z'); // Wednesday at 21:30 Baghdad
  assert.equal(calendarDayKey(now),'2026-11-11');
  assert.equal(calendarDayKey('2026-11-10T21:00:00Z'),'2026-11-11');
  assert.equal(calendarDayKey('2026-11-11T20:59:59Z'),'2026-11-11');
  assert.equal(calendarDayKey('2026-11-11T21:00:00Z'),'2026-11-12');
  assert.equal(shiftCalendarDay('2026-11-11',-1),'2026-11-10');
  assert.equal(mondayOfCalendarWeek('2026-11-11'),'2026-11-09');
  assert.ok(matchesCalendarView('2026-11-10T11:00:00Z','yesterday',now));
  assert.ok(matchesCalendarView('2026-11-11T23:00:00Z','tomorrow',now));
  assert.ok(matchesCalendarView('2026-11-15T13:00:00Z','week',now));
  assert.equal(matchesCalendarView('2026-11-16T13:00:00Z','week',now),false);
});

test('history date windows include only past Baghdad dates and support a specific day', () => {
  const now = Date.parse('2026-11-11T18:30:00Z');
  const yesterday = '2026-11-10T13:30:00Z';
  assert.ok(matchesCalendarView(yesterday,'history',now,{historyDays:7}));
  assert.equal(matchesCalendarView('2026-11-11T13:30:00Z','history',now,{historyDays:7}),true);
  assert.equal(matchesCalendarView('2026-11-11T21:30:00Z','history',now,{historyDays:7}),false);
  assert.equal(matchesCalendarView('2026-11-03T13:30:00Z','history',now,{historyDays:7}),false);
  assert.ok(matchesCalendarView('2026-10-25T13:30:00Z','history',now,{historyDays:30}));
  assert.equal(matchesCalendarView(yesterday,'history',now,{historyDays:30,historyDate:'2026-11-09'}),false);
  assert.ok(matchesCalendarView(yesterday,'history',now,{historyDays:30,historyDate:'2026-11-10'}));
  assert.equal(matchesCalendarView('not a date','today',now),false);
});

test('historical merging keeps real captured results through empty later updates', () => {
  const old = [{ id:'cpi-1',time:'2026-11-10T13:30:00Z',title:'Core CPI MoM',currency:'USD',impact:'high',
    forecast:'0.3%',previous:'0.2%',actual:'0.4%',status:'scheduled' }];
  const fresh = [{...old[0],time:'2026-11-10T14:00:00Z',forecast:'',actual:'',previous:''}];
  const merged = mergeCalendarEvents(old,fresh);
  assert.equal(merged.length,1);
  assert.equal(merged[0].actual,'0.4%');
  assert.equal(merged[0].forecast,'0.3%');
  assert.equal(merged[0].previous,'0.2%');
  assert.equal(merged[0].time,'2026-11-10T14:00:00Z');
  assert.equal(old[0].time,'2026-11-10T13:30:00Z');
  assert.equal(fresh[0].actual,'');
});

test('archive records released events but never populates historical results with future releases', () => {
  const now=Date.parse('2026-11-11T12:00:00Z');
  const make=(id,time,actual='')=>({id,time,actual,title:'CPI MoM',currency:'USD'});
  const archived=archivePastCalendarEvents([
    make('ancient','2026-07-01T13:30:00Z','0.1%'),
    make('old','2026-11-10T13:30:00Z','0.4%')
  ],[
    make('new','2026-11-11T10:30:00Z','0.5%'),
    make('future','2026-11-12T13:30:00Z','')
  ],now);
  assert.deepEqual(archived.map(event=>event.id),['old','new']);
  assert.equal(archived[0].actual,'0.4%');
});

test('history payload is source-backed and rejects corrupt archives', () => {
  const item={id:'nfp-1',time:'2026-11-09T13:30:00Z',currency:'USD',impact:'high',
    title:'Non-Farm Payrolls',forecast:'100K',actual:'130K'};
  const result=normalizeCalendarHistory({updatedAt:'2026-11-11T13:00:00Z',events:[item]});
  assert.equal(result.events[0].actual,'130K');
  assert.equal(result.updatedAt,'2026-11-11T13:00:00Z');
  assert.throws(()=>normalizeCalendarHistory({events:'not an array'}),/Invalid calendar history/);
});

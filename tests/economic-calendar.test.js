import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeCalendarEvent, parseEconomicValue, indicatorKind, calendarScenarios, hasPublishedActual } from '../src/lib/economic-impact.js';
import { normalizeCalendarPayload, isCalendarSourceDelayed } from '../src/services/economic-calendar.js';
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


test('missing Actual placeholders do not masquerade as published results', () => {
  for (const value of ['', '—', '-', '--', 'N/A', 'pending', 'TBA', 'not released', 'awaiting']) {
    assert.equal(hasPublishedActual(value), false, 'placeholder should not release: '+value);
    assert.equal(analyzeCalendarEvent({ title:'CPI MoM', currency:'USD', actual:value, forecast:'0.3%' }).status,'pending');
  }
  for (const value of [0, '0', '0%', '-0.2%', '(250K)']) {
    assert.equal(hasPublishedActual(value), true, 'real zero/negative must be preserved: '+value);
  }
  assert.equal(analyzeCalendarEvent({ title:'CPI MoM', currency:'USD', actual:'0%', forecast:'0.3%' }).status,'surprise');
  assert.equal(calendarScenarios({title:'CPI MoM', currency:'USD', actual:'Held', forecast:'0.3%'}), null);
  assert.equal(analyzeCalendarEvent({title:'CPI MoM', currency:'USD', actual:'Held', forecast:'0.3%'}).status,'unknown');
});

test('stale calendar timestamps are flagged rather than silently passing as fresh data', () => {
  const now=Date.parse('2026-11-11T04:00:00Z');
  assert.equal(isCalendarSourceDelayed('2026-11-11T03:45:00Z',now),false);
  assert.equal(isCalendarSourceDelayed('2026-11-11T03:14:00Z',now),true);
  assert.equal(isCalendarSourceDelayed('2026-11-11T04:07:00Z',now),true);
  assert.equal(isCalendarSourceDelayed(null,now),true);
  assert.equal(isCalendarSourceDelayed('not-a-date',now),true);
});

test('calendar UI does not show a pre-release scenario after release time', () => {
  const main=fs.readFileSync('src/components/EconomicCalendar.jsx','utf8');
  assert.match(main,/Date\.parse\(event\.time\) <= now \|\| hasPublishedActual\(event\.actual\)/);
  assert.match(main,/<BeforeRelease event=\{event\} lang=\{lang\} c=\{c\} now=\{now\}\/>/);
  assert.match(main,/hasPublishedActual\(event\.actual\) \? c\.released/);
  assert.match(main,/providerDelayed && <div role="alert"/);
  const translations=fs.readFileSync('src/lib/calendar-i18n.js','utf8');
  assert.match(translations,/sourceDelayed:'ئاگاداری/);
  assert.match(translations,/sourceDelayed:'تنبيه/);
  assert.match(translations,/sourceDelayed:'Notice/);
});

test('Actual Forecast and Previous fields are preserved exactly as supplied',()=>{
  const payload=normalizeCalendarPayload({generated_at:'2026-11-11T04:00:00Z',events:[
    {id:'usd-cpi',time:'2026-11-11T13:30:00Z',currency:'USD',title:'CPI MoM',
      actual:'0%',forecast:'0.3%',previous:'-0.1%',impact:'high'},
    {id:'usd-jobs',time:'2026-11-11T14:30:00Z',currency:'USD',title:'Initial Jobless Claims',
      actual:'',forecast:'250K',previous:'275K',impact:'medium'}
  ]});
  assert.deepEqual(payload.events.map(e=>[e.actual,e.forecast,e.previous]),[['0%','0.3%','-0.1%'],['','250K','275K']]);
  assert.equal(analyzeCalendarEvent(payload.events[0]).status,'surprise');
  assert.equal(analyzeCalendarEvent(payload.events[1]).status,'pending');
});

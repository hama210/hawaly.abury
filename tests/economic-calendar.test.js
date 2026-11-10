import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCalendarEvent, parseEconomicValue, indicatorKind } from '../src/lib/economic-impact.js';
import { normalizeCalendarPayload } from '../src/services/economic-calendar.js';
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

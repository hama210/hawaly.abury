import React, { useEffect, useMemo, useState } from 'react';
import { fetchEconomicCalendar, CALENDAR_SOURCE_URL } from '../services/economic-calendar.js';
import { analyzeCalendarEvent } from '../lib/economic-impact.js';
import { calendarText, calendarEventTitle } from '../lib/calendar-i18n.js';

const CURRENCIES = ['USD','EUR','GBP','JPY','CAD','AUD','NZD','CHF','CNY'];
const BAGHDAD_TZ = 'Asia/Baghdad';

function dateKey(input) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:BAGHDAD_TZ,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(input);
  const pick = type => parts.find(part => part.type === type)?.value || '';
  return pick('year') + '-' + pick('month') + '-' + pick('day');
}
function releaseTime(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone:BAGHDAD_TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).format(new Date(iso));
}
function releaseDate(iso, lang) {
  if (lang === 'ku') {
    const date = new Date(iso);
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone:BAGHDAD_TZ, day:'numeric', month:'numeric', year:'numeric', weekday:'long' }).formatToParts(date);
    const part = type => parts.find(value => value.type === type)?.value;
    const weekdays = {Sunday:'یەکشەممە',Monday:'دووشەممە',Tuesday:'سێشەممە',Wednesday:'چوارشەممە',Thursday:'پێنجشەممە',Friday:'هەینی',Saturday:'شەممە'};
    const months = ['کانوونی دووەم','شوبات','ئازار','نیسان','ئایار','حوزەیران','تەمووز','ئاب','ئەیلوول','تشرینی یەکەم','تشرینی دووەم','کانوونی یەکەم'];
    return weekdays[part('weekday')] + '، ' + part('day') + ' ' + months[Number(part('month'))-1] + ' ' + part('year');
  }
  const language = lang === 'ar' ? 'ar-IQ' : 'en-GB';
  return new Intl.DateTimeFormat(language, {
    timeZone:BAGHDAD_TZ,weekday:'long',year:'numeric',month:'long',day:'numeric'
  }).format(new Date(iso));
}
const assetLabel = (asset, lang) =>
  asset === 'XAGUSD' ? (lang === 'ku' ? 'زیو (XAGUSD)' : lang === 'ar' ? 'الفضة (XAGUSD)' : 'Silver (XAGUSD)')
  : asset === 'XAUUSD' ? (lang === 'ku' ? 'زێڕ (XAUUSD)' : lang === 'ar' ? 'الذهب (XAUUSD)' : 'Gold (XAUUSD)')
  : asset;
function ImpactContext({ event, lang, c }) {
  const analysis = analyzeCalendarEvent(event);
  const showComparison = analysis.status === 'surprise' && analysis.difference !== null;
  return <div className="ec-context">
    <h4>{c.detail}</h4>
    {showComparison && <p className="ec-surprise">
      {analysis.difference > 0 ? c.actualHigher : c.actualLower}
    </p>}
    {analysis.markets.length ? <div className="ec-market-effects">
      {analysis.markets.map(market => <div className="ec-market" key={market.asset}>
        <b dir="auto">{assetLabel(market.asset, lang)}</b>
        <span className={'ec-bias ec-bias-'+market.direction}>
          {market.direction === 'up' ? '↑ ' + c.up : '↓ ' + c.down}
        </span>
      </div>)}
    </div> : <p className="ec-muted">{analysis.status === 'equal' ? c.neutral : analysis.status === 'pending' ? c.pending : c.unknown}</p>}
    <p className="ec-muted">{c[analysis.note] || c.conditional}</p>
    {event.currency === 'USD' && analysis.markets.length > 1 && <p className="ec-muted">{c.ratesDisclaimer}</p>}
    <p className="ec-disclaimer">{c.warning}</p>
  </div>;
}

function EventCard({ event, lang, c, now }) {
  const comparison = analyzeCalendarEvent(event);
  const resultClass = comparison.status === "surprise" ? (comparison.difference > 0 ? "above" : "below") : "neutral";
  const translated = calendarEventTitle(event.title, lang);
  const translationAvailable = translated !== event.title;
  return <article className={'ec-event ec-impact-'+event.impact}>
    <div className="ec-event-summary">
      <time className="ec-time" dateTime={event.time} dir="ltr">{releaseTime(event.time)}</time>
      <div className="ec-event-heading">
        <strong dir="auto">{translated}</strong>
        {translationAvailable && <small dir="ltr" className="ec-original">{event.title}</small>}
        {event.status === 'tentative' && <small className="ec-tentative">⚠ {c.tentative}</small>}
        {event.status === 'moved' && <small className="ec-tentative">↻ {c.moved}</small>}
      </div>
      <span className="ec-currency" dir="ltr">{event.currency}</span>
      <span className={'ec-impact-pill ec-'+event.impact}>{c[event.impact === 'high' ? 'major' : event.impact] || event.impact}</span>
    </div>
    <p className="ec-release-state">{event.actual ? c.released : Date.parse(event.time) > now ? c.upcoming : c.awaiting}</p>
    <div className="ec-values">
      <div><span>{c.previous}</span><strong dir="ltr">{event.previous || c.notAvailable}</strong></div>
      <div><span>{c.forecast}</span><strong dir="ltr">{event.forecast || c.notAvailable}</strong></div>
      <div><span>{c.actual}</span><strong className={event.actual ? 'ec-result-' + resultClass : ''} dir="ltr">{event.actual || c.notAvailable}</strong></div>
    </div>
    {comparison.status === 'surprise' && <p className={'ec-comparison ec-result-' + resultClass}>{comparison.difference > 0 ? '↑ ' + c.actualHigher : '↓ ' + c.actualLower}</p>}
    <details className="ec-details">
      <summary>{c.showDetails}</summary>
      <div className="ec-detail-inner">
        {!translationAvailable && lang !== 'en' && <p className="ec-muted">{c.unknownTitle}: <span dir="ltr">{event.title}</span></p>}
        {event.period && <p className="ec-muted">{c.period}: <span dir="ltr">{event.period}</span></p>}
        <ImpactContext event={event} lang={lang} c={c}/>
      </div>
    </details>
  </article>;
}

export default function EconomicCalendar({ lang='ku' }) {
  const c = calendarText(lang);
  const [data,setData] = useState({events:[],publishedAt:null});
  const [state,setState] = useState('loading');
  const [revision,setRevision] = useState(0);
  const [currency,setCurrency] = useState('USD');
  const [impact,setImpact] = useState('all');
  const [windowDays,setWindowDays] = useState('week');
  const [metalsOnly,setMetalsOnly] = useState(false);
  const [search,setSearch] = useState('');
  const [now,setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    const refresh = window.setInterval(() => setRevision(number => number + 1), 15 * 60000);
    return () => { clearInterval(timer); clearInterval(refresh); };
  },[]);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetchEconomicCalendar(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setData(result);
      setState('ready');
      setNow(Date.now());
    }).catch(() => {
      if (!controller.signal.aborted) setState('error');
    });
    return () => controller.abort();
  },[revision]);

  const visible = useMemo(() => data.events.filter(event => {
    const eventMs = Date.parse(event.time);
    if (!Number.isFinite(eventMs)) return false;
    if (eventMs < now - 6 * 3600000) return false;
    if (windowDays === 'today' && dateKey(new Date(eventMs)) !== dateKey(new Date(now))) return false;
    if (metalsOnly && (event.currency !== 'USD' || event.impact === 'holiday')) return false;
    if (!metalsOnly && currency !== 'all' && event.currency !== currency) return false;
    if (impact !== 'all' && event.impact !== impact) return false;
    if (search.trim() && !event.title.toLowerCase().includes(search.trim().toLowerCase()) &&
      !calendarEventTitle(event.title, lang).toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }),[data.events,now,windowDays,metalsOnly,currency,impact,search,lang]);

  const grouped = useMemo(() => {
    const list = [];
    for (const event of visible) {
      const key = dateKey(new Date(event.time));
      let group = list.find(item => item.key === key);
      if (!group) { group = {key,date:event.time,events:[]}; list.push(group); }
      group.events.push(event);
    }
    return list;
  },[visible]);

  const soon = data.events.filter(event => {
    const left = Date.parse(event.time) - now;
    return event.impact === 'high' && left >= 0 && left <= 15 * 60000
      && (metalsOnly ? event.currency === 'USD' : currency === 'all' || event.currency === currency);
  });

  const next = visible.find(event => Date.parse(event.time) > now && event.impact !== 'holiday');
  const resetFilters = () => { setCurrency('all'); setImpact('all'); setWindowDays('week'); setSearch(''); setMetalsOnly(false); };
  return <main className="ec-page" dir={lang === 'en' ? 'ltr' : 'rtl'}>
    <section className="ec-header">
      <div>
        <p className="ec-eyebrow">HAWAL · ECONOMIC CALENDAR</p>
        <h1>{c.title}</h1>
        <p>{c.lead} · Asia/Baghdad (UTC+3)</p>
      </div>
      <button type="button" onClick={() => setRevision(number => number + 1)} disabled={state === 'loading'} className="ec-refresh">{c.refresh} ↻</button>
    </section>
    <section className="ec-overview" aria-label={c.count}>
      <div className="ec-stat"><span>{c.count}</span><strong>{state === 'loading' && !data.events.length ? '—' : visible.length}</strong></div>
      <div className="ec-stat ec-stat-high"><span>{c.impact} · {c.major}</span><strong>{state === 'loading' && !data.events.length ? '—' : visible.filter(event => event.impact === 'high').length}</strong></div>
      <div className="ec-next"><span>{c.next}</span><strong>{next ? calendarEventTitle(next.title, lang) : state === 'loading' ? c.loading : c.noUpcoming}</strong>{next && <small><b dir="ltr">{next.currency} · {releaseTime(next.time)}</b> · {Math.ceil((Date.parse(next.time)-now)/60000)} {c.minutes}</small>}</div>
    </section>
    {soon.length > 0 && <div className="ec-warning-soon" role="status">🔴 {c.soon}: {soon.map(event => calendarEventTitle(event.title,lang)).join(' · ')}</div>}
    <section className="ec-filter-bar" aria-label={c.title}>
      <label>{c.currency}<select aria-label={c.currency} value={currency} disabled={metalsOnly} onChange={e=>setCurrency(e.target.value)}>
        <option value="all">{c.allCurrency}</option>
        {CURRENCIES.map(code=><option key={code} value={code}>{code}</option>)}
      </select></label>
      <label>{c.impact}<select aria-label={c.impact} value={impact} onChange={e=>setImpact(e.target.value)}>
        <option value="all">{c.all}</option>
        <option value="high">🔴 {c.major}</option>
        <option value="medium">🟠 {c.medium}</option>
        <option value="low">🟡 {c.low}</option>
        <option value="holiday">{c.holiday}</option>
      </select></label>
      <label>{c.date}<select aria-label={c.date} value={windowDays} onChange={e=>setWindowDays(e.target.value)}>
        <option value="today">{c.today}</option><option value="week">{c.week}</option>
      </select></label>
      <label>{c.event}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={c.event}/></label>
      <div className="ec-filter-bottom"><label className="ec-metal-toggle"><input type="checkbox" checked={metalsOnly} onChange={e=>setMetalsOnly(e.target.checked)}/>{c.metals}</label><button type="button" className="ec-reset" onClick={resetFilters}>{c.reset} ↺</button></div>
    </section>
    <div className="ec-status" role="status" aria-live="polite">
      <strong>{c.count}: {visible.length}</strong>
      <span>{c.updated}: {data.publishedAt ? releaseDate(data.publishedAt,lang) + ' · ' + releaseTime(data.publishedAt) : '—'} (UTC+3)</span>
      <a href={CALENDAR_SOURCE_URL} target="_blank" rel="noreferrer">{c.source}: ShowMyTrades ↗</a>
    </div>
    {state === 'error' && <div role="alert" className="ec-error">{data.events.length ? c.stale : c.error} <button type="button" onClick={()=>setRevision(x=>x+1)}>{c.retry}</button></div>}
    {state === 'loading' && !data.events.length && <p className="ec-message" role="status">{c.loading}</p>}
    {state === 'ready' && !visible.length && <p className="ec-message">{c.empty}</p>}
    {grouped.map(group => <section className="ec-day" key={group.key}>
      <h2><span>{releaseDate(group.date,lang)}</span><small>{group.events.length} {c.count}</small></h2>
      <div className="ec-event-list">{group.events.map(event => <EventCard key={event.id} event={event} lang={lang} c={c} now={now}/>)}</div>
    </section>)}
    <section className="ec-notes"><p>{c.delay}</p><p>{c.recentWindow}</p><p>{c.warning}</p></section>
  </main>;
}

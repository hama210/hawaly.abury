import React, { useEffect, useMemo, useState } from 'react';
import { fetchEconomicCalendar, fetchCalendarHistory, CALENDAR_SOURCE_URL } from '../services/economic-calendar.js';
import { calendarDayKey, shiftCalendarDay, matchesCalendarView, mergeCalendarEvents } from '../lib/calendar-history.js';
import { analyzeCalendarEvent, calendarScenarios } from '../lib/economic-impact.js';
import { calendarText, calendarEventTitle } from '../lib/calendar-i18n.js';
import EconomicEventAlerts from './EconomicEventAlerts.jsx';

const CURRENCIES = ['USD','EUR','GBP','JPY','CAD','AUD','NZD','CHF','CNY'];
const BAGHDAD_TZ = 'Asia/Baghdad';

const dateKey = calendarDayKey;
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

function BeforeRelease({ event, lang, c }) {
  const scenarios = calendarScenarios(event);
  if (!scenarios || event.impact === 'holiday') return null;
  return <aside className="ec-before-release" aria-label={c.beforeRelease}>
    <h4>{c.beforeRelease}</h4>
    {scenarios.cases.length ? <>
      <div className="ec-scenario-grid">{scenarios.cases.map(scenario => <div className="ec-scenario" key={scenario.comparison}>
        <strong>{scenario.comparison === 'higher' ? c.ifHigher : c.ifLower}</strong>
        <ul>{scenario.markets.map(market => <li key={market.asset}>
          <b dir="auto">{assetLabel(market.asset,lang)}</b>
          <span className={'ec-bias ec-bias-'+market.direction}>{market.direction === 'up' ? '↑ '+c.up : '↓ '+c.down}</span>
        </li>)}</ul>
      </div>)}</div>
      <p>{c.ifEqual}</p>
      <p>{c[scenarios.note]}</p>
      {event.currency === 'USD' && <p>{c.ratesDisclaimer}</p>}
    </> : <p>{c[scenarios.note]}</p>}
    <p className="ec-disclaimer">{c.warning}</p>
  </aside>;
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
    <p className="ec-release-state">{event.actual ? c.released : Date.parse(event.time) > now ? c.upcoming : Date.parse(event.time) < now - 6 * 3600000 ? c.noActualPast : c.awaiting}</p>
    <div className="ec-values">
      <div><span>{c.previous}</span><strong dir="ltr">{event.previous || c.notAvailable}</strong></div>
      <div><span>{c.forecast}</span><strong dir="ltr">{event.forecast || c.notAvailable}</strong></div>
      <div><span>{c.actual}</span><strong className={event.actual ? 'ec-result-' + resultClass : ''} dir="ltr">{event.actual || c.notAvailable}</strong></div>
    </div>
    {comparison.status === 'surprise' && <p className={'ec-comparison ec-result-' + resultClass}>{comparison.difference > 0 ? '↑ ' + c.actualHigher : '↓ ' + c.actualLower}</p>}
    <BeforeRelease event={event} lang={lang} c={c}/>
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
  const [historyDays,setHistoryDays] = useState('7');
  const [historyDate,setHistoryDate] = useState('');
  const [visibleLimit,setVisibleLimit] = useState(60);
  const [archive,setArchive] = useState({events:[],updatedAt:null});
  const [archiveFailed,setArchiveFailed] = useState(false);
  const [archiveLoading,setArchiveLoading] = useState(true);
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
    setArchiveLoading(true);
    // These are independent requests: a slow or unavailable historical archive
    // must never block today's live calendar results (or vice versa).
    fetchEconomicCalendar(controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setData(result);
        setState('ready');
        setNow(Date.now());
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    fetchCalendarHistory(controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setArchive(result);
        setArchiveFailed(false);
        setNow(Date.now());
      })
      .catch(() => {
        if (!controller.signal.aborted) setArchiveFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setArchiveLoading(false);
      });
    return () => controller.abort();
  },[revision]);

  useEffect(() => { setVisibleLimit(60); },[windowDays,historyDays,historyDate,currency,impact,metalsOnly,search]);
  const combined = useMemo(() => mergeCalendarEvents(archive.events,data.events),[archive.events,data.events]);
  const visible = useMemo(() => combined.filter(event => {
    if (!matchesCalendarView(event.time,windowDays,now,{historyDays,historyDate})) return false;
    if (metalsOnly && (event.currency !== 'USD' || event.impact === 'holiday')) return false;
    if (!metalsOnly && currency !== 'all' && event.currency !== currency) return false;
    if (impact !== 'all' && event.impact !== impact) return false;
    if (search.trim() && !event.title.toLowerCase().includes(search.trim().toLowerCase()) &&
      !calendarEventTitle(event.title, lang).toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }),[combined,now,windowDays,historyDays,historyDate,metalsOnly,currency,impact,search,lang]);

  const selectedDataPending = windowDays === 'history'
    ? archiveLoading && !archive.events.length
    : state === 'loading' && !data.events.length;
  const selectedDataSettled = windowDays === 'history' ? !archiveLoading : state !== 'loading';
  const pageEvents = windowDays === 'history' ? visible.slice(0,visibleLimit) : visible;
  const grouped = useMemo(() => {
    const list = [];
    for (const event of pageEvents) {
      const key = dateKey(new Date(event.time));
      let group = list.find(item => item.key === key);
      if (!group) { group = {key,date:event.time,events:[]}; list.push(group); }
      group.events.push(event);
    }
    return list;
  },[pageEvents]);

  const soon = data.events.filter(event => {
    const left = Date.parse(event.time) - now;
    return event.impact === 'high' && left >= 0 && left <= 15 * 60000
      && (metalsOnly ? event.currency === 'USD' : currency === 'all' || event.currency === currency);
  });

  const next = data.events.find(event => Date.parse(event.time) > now && event.impact !== 'holiday'
    && (metalsOnly ? event.currency === 'USD' : currency === 'all' || event.currency === currency)
    && (impact === 'all' || event.impact === impact));
  const resetFilters = () => { setCurrency('all'); setImpact('all'); setWindowDays('week'); setHistoryDays('7'); setHistoryDate(''); setSearch(''); setMetalsOnly(false); };
  const todayKey = dateKey(now);
  const tabs = ['yesterday','today','tomorrow','week','history'];
  const tabLabels = {yesterday:c.yesterday,today:c.today,tomorrow:c.tomorrow,week:c.weekTab,history:c.history};
  return <main className="ec-page" dir={lang === 'en' ? 'ltr' : 'rtl'}>
    <section className="ec-header">
      <div>
        <p className="ec-eyebrow">HAWAL · ECONOMIC CALENDAR</p>
        <h1>{c.title}</h1>
        <p>{c.lead} · Asia/Baghdad (UTC+3)</p>
      </div>
      <button type="button" onClick={() => setRevision(number => number + 1)} disabled={state === 'loading'} className="ec-refresh">{c.refresh} ↻</button>
    </section>
    <EconomicEventAlerts lang={lang} events={data.events}/>
    <nav className="ec-date-tabs" aria-label={c.dateTabs}>
      {tabs.map(tab => <button key={tab} type="button" className={windowDays===tab ? 'active' : ''}
        aria-current={windowDays===tab ? 'date' : undefined} aria-pressed={windowDays===tab}
        onClick={() => { setWindowDays(tab); setHistoryDate(''); if (tab === 'history') setCurrency('all'); }}>{tabLabels[tab]}</button>)}
    </nav>
    {windowDays === 'history' && <section className="ec-history-tools" aria-label={c.history}>
      <label>{c.historyPeriod}<select value={historyDays} onChange={event => { setHistoryDays(event.target.value); setHistoryDate(''); }}>
        <option value="7">{c.past7}</option><option value="30">{c.past30}</option><option value="90">{c.past90}</option>
      </select></label>
      <label>{c.historyDate}<input type="date" value={historyDate} min={shiftCalendarDay(todayKey,1-Number(historyDays))}
        max={todayKey} onChange={event=>setHistoryDate(event.target.value)} /></label>
      {historyDate && <button className="ec-clear-history" type="button" onClick={()=>setHistoryDate('')}>{c.allHistoryDates}</button>}
      <p>{c.archiveNote}</p>
    </section>}
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
      <label>{c.event}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={c.event}/></label>
      <div className="ec-filter-bottom"><label className="ec-metal-toggle"><input type="checkbox" checked={metalsOnly} onChange={e=>setMetalsOnly(e.target.checked)}/>{c.metals}</label><button type="button" className="ec-reset" onClick={resetFilters}>{c.reset} ↺</button></div>
    </section>
    <div className="ec-status" role="status" aria-live="polite">
      <strong>{c.count}: {visible.length}</strong>
      <span>{c.updated}: {data.publishedAt ? releaseDate(data.publishedAt,lang) + ' · ' + releaseTime(data.publishedAt) : '—'} (UTC+3)</span>
      <a href={CALENDAR_SOURCE_URL} target="_blank" rel="noreferrer">{c.source}: ShowMyTrades ↗</a>
    </div>
    {windowDays === 'history' && archive.updatedAt && <p className="ec-archive-date">{c.archiveUpdated}: {releaseDate(archive.updatedAt,lang)} · {releaseTime(archive.updatedAt)} (UTC+3)</p>}
    {windowDays === 'history' && archiveFailed && <p className="ec-archive-warning" role="status">{c.archiveUnavailable}</p>}
    {state === 'error' && <div role="alert" className="ec-error">{data.events.length ? c.stale : c.error} <button type="button" onClick={()=>setRevision(x=>x+1)}>{c.retry}</button></div>}
    {selectedDataPending && !visible.length && <p className="ec-message" role="status">{c.loading}</p>}
    {selectedDataSettled && !visible.length && !(state === 'error' && windowDays !== 'history') &&
      <p className="ec-message">{windowDays === 'history' ? c.historyEmpty : c.empty}</p>}
    {grouped.map(group => <section className="ec-day" key={group.key}>
      <h2><span>{releaseDate(group.date,lang)}</span><small>{group.events.length} {c.count}</small></h2>
      <div className="ec-event-list">{group.events.map(event => <EventCard key={event.id} event={event} lang={lang} c={c} now={now}/>)}</div>
    </section>)}
    {windowDays === 'history' && visible.length > pageEvents.length && <button className="ec-show-more" type="button"
      onClick={() => setVisibleLimit(count => count + 60)}>{c.loadMore} ({visible.length - pageEvents.length})</button>}
    <section className="ec-notes"><p>{c.delay}</p><p>{c.recentWindow}</p><p>{c.warning}</p></section>
  </main>;
}

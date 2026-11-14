import React, { useEffect, useMemo, useState } from 'react';
import { fetchEconomicCalendar, fetchCalendarHistory, CALENDAR_SOURCE_URL } from '../services/economic-calendar.js';
import { calendarDayKey, calendarClockTime, CALENDAR_TIME_ZONE, shiftCalendarDay, archivePastCalendarEvents, matchesCalendarView, mergeCalendarEvents, recentPublishedCalendarResults } from '../lib/calendar-history.js';
import { analyzeCalendarEvent, calendarScenarios, hasPublishedCalendarActual } from '../lib/economic-impact.js';
import { calendarText, calendarEventTitle } from '../lib/calendar-i18n.js';
import EconomicEventAlerts from './EconomicEventAlerts.jsx';

const BAGHDAD_TZ = CALENDAR_TIME_ZONE;
const dateKey = calendarDayKey;
const releaseTime = calendarClockTime;
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
  const resultPublished = hasPublishedCalendarActual(event);
  const resultClass = comparison.status === "surprise" ? (comparison.difference > 0 ? "above" : "below") : "neutral";
  const translated = calendarEventTitle(event.title, lang);
  const translationAvailable = translated !== event.title;
  const isSpeech = /\b(?:speech|speaks|remarks)\b/i.test(event.title);
  const noNumericResult = !resultPublished && (isSpeech || event.impact === 'holiday');
  const releaseAt = Date.parse(event.time);
  const releaseState = resultPublished ? c.released : releaseAt > now ? c.upcoming
    : releaseAt < now - 6 * 3600000 ? c.noActualPast : c.awaiting;
  return <article className={'ec-event ec-impact-'+event.impact}>
    <details className="ec-details">
      <summary className="ec-event-summary">
        <time className="ec-time" dateTime={event.time} dir="ltr">{releaseTime(event.time)}</time>
        <span className="ec-event-heading">
          <strong dir="auto">{translated}</strong>
          {event.status === 'tentative' && <small className="ec-tentative">⚠ {c.tentative}</small>}
          {event.status === 'moved' && <small className="ec-tentative">↻ {c.moved}</small>}
        </span>
        <span className="ec-currency" dir="ltr">{event.currency}</span>
        <span className={'ec-impact-pill ec-'+event.impact}>{event.impact === 'unknown' ? c.notAvailable : (c[event.impact === 'high' ? 'major' : event.impact] || c.notAvailable)}</span>
        <span className="ec-event-actual">
          {noNumericResult ? (isSpeech ? c.speech : c.noNumericResult) : <>
            {c.actual} <strong className={resultPublished ? 'ec-result-' + resultClass : ''} dir="ltr">{resultPublished ? event.actual : c.notAvailable}</strong>
          </>}
        </span>
        <span className="ec-event-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="ec-detail-inner">
        {lang !== 'en' && <p className="ec-muted">{!translationAvailable && c.unknownTitle + ': '}<span dir="ltr">{event.title}</span></p>}
        {event.period && <p className="ec-muted">{c.period}: <span dir="ltr">{event.period}</span></p>}
        <p className="ec-release-state">{noNumericResult ? c.noNumericResult : releaseState}</p>
        {!noNumericResult && <>
          <div className="ec-values">
            <div><span>{c.previous}</span><strong dir="ltr">{event.previous || c.notAvailable}</strong></div>
            <div><span>{c.forecast}</span><strong dir="ltr">{event.forecast || c.notAvailable}</strong></div>
          </div>
          {releaseAt > now && !resultPublished && <BeforeRelease event={event} lang={lang} c={c}/>}
          <ImpactContext event={event} lang={lang} c={c}/>
        </>}
        <a href={CALENDAR_SOURCE_URL} target="_blank" rel="noreferrer">{c.source}: ShowMyTrades ↗</a>
      </div>
    </details>
  </article>;
}

export default function EconomicCalendar({ lang='ku' }) {
  const c = calendarText(lang);
  const [data,setData] = useState({events:[],publishedAt:null});
  const [captured,setCaptured] = useState([]);
  const [state,setState] = useState('loading');
  const [revision,setRevision] = useState(0);
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
        const receivedAt = Date.now();
        setCaptured(previous => archivePastCalendarEvents(previous,result.events,receivedAt));
        setData(result);
        setState('ready');
        setNow(receivedAt);
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

  useEffect(() => { setVisibleLimit(60); },[windowDays,historyDays,historyDate,impact,metalsOnly,search]);
  const history = useMemo(() => mergeCalendarEvents(archive.events,captured),[archive.events,captured]);
  const combined = useMemo(() => mergeCalendarEvents(history,data.events),[history,data.events]);
  const latestActuals = useMemo(() => recentPublishedCalendarResults(combined,now,30),[combined,now]);
  const isPastView=windowDays === 'history' || windowDays === 'results';
  const visible = useMemo(() => {
    const candidates=windowDays === 'results' ?
      recentPublishedCalendarResults(combined,now,Number(historyDays)) : combined;
    return candidates.filter(event => {
    if (!matchesCalendarView(event.time,windowDays === 'results' ? 'history' : windowDays,now,{historyDays,historyDate})) return false;
    if (metalsOnly && (event.currency !== 'USD' || event.impact === 'holiday')) return false;
    if (impact !== 'all' && event.impact !== impact) return false;
    if (search.trim() && !event.title.toLowerCase().includes(search.trim().toLowerCase()) &&
      !calendarEventTitle(event.title, lang).toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
    });
  },[combined,now,windowDays,historyDays,historyDate,metalsOnly,impact,search,lang]);

  const selectedDataPending = isPastView
    ? (archiveLoading || state === 'loading') && !history.length
    : state === 'loading' && !data.events.length;
  const selectedDataSettled = isPastView ? !archiveLoading && state !== 'loading' : state !== 'loading';
  const pageEvents = isPastView ? visible.slice(0,visibleLimit) : visible;
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
      && (!metalsOnly || event.currency === 'USD');
  });

  const next = data.events.find(event => Date.parse(event.time) > now && event.impact !== 'holiday'
    && (!metalsOnly || event.currency === 'USD')
    && (impact === 'all' || event.impact === impact));
  const resetFilters = () => {  setImpact('all'); setWindowDays('week'); setHistoryDays('7'); setHistoryDate(''); setSearch(''); setMetalsOnly(false); };
  const todayKey = dateKey(now);
  const tabs = ['yesterday','today','tomorrow','week','results','history'];
  const tabLabels = {yesterday:c.yesterday,today:c.today,tomorrow:c.tomorrow,week:c.weekTab,results:c.released,history:c.history};
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
        onClick={() => { setWindowDays(tab); setHistoryDate(''); if (tab === 'history' || tab === 'results') {
          setImpact('all');setMetalsOnly(false);setSearch('');
          if(tab === 'results')setHistoryDays('30');
        } }}>{tabLabels[tab]}</button>)}
    </nav>
    <section className="ec-latest-results" aria-label={c.released}>
      <div className="ec-latest-results-head">
        <strong>{c.released} · {archiveLoading && !archive.events.length ? '…' : latestActuals.length}</strong>
        <button type="button" onClick={()=>{
          setWindowDays('results');setHistoryDays('30');setHistoryDate('');
          setImpact('all');setMetalsOnly(false);setSearch('');
        }}>{c.history} ↗</button>
      </div>
      {archiveLoading && !archive.events.length ? <p className="ec-muted">{c.loading}</p>
        : latestActuals.length ? <div className="ec-latest-results-list">
          {latestActuals.slice(0,3).map(event=><div key={event.id} className="ec-latest-result">
            <span dir="auto">{calendarEventTitle(event.title,lang)}</span>
            <small dir="ltr">{event.currency} · {releaseDate(event.time,lang)} · {releaseTime(event.time)}</small>
            <strong dir="ltr">{c.actual}: {event.actual}</strong>
          </div>)}
        </div> : <p className="ec-muted">{c.historyEmpty}</p>}
      {archiveFailed && <p className="ec-archive-warning" role="status">
        {c.archiveUnavailable} <button type="button" onClick={()=>setRevision(x=>x+1)}>{c.retry}</button>
      </p>}
    </section>
    {isPastView && <section className="ec-history-tools" aria-label={c.history}>
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
    {isPastView && archive.updatedAt && <p className="ec-archive-date">{c.archiveUpdated}: {releaseDate(archive.updatedAt,lang)} · {releaseTime(archive.updatedAt)} (UTC+3)</p>}
    {isPastView && archiveFailed && <p className="ec-archive-warning" role="status">{c.archiveUnavailable}</p>}
    {state === 'error' && <div role="alert" className="ec-error">{data.events.length ? c.stale : c.error} <button type="button" onClick={()=>setRevision(x=>x+1)}>{c.retry}</button></div>}
    {selectedDataPending && !visible.length && <p className="ec-message" role="status">{c.loading}</p>}
    {selectedDataSettled && !visible.length && !(state === 'error' && windowDays !== 'history') &&
      <p className="ec-message">{isPastView ? c.historyEmpty : c.empty}</p>}
    {grouped.map(group => <section className="ec-day" key={group.key}>
      <h2><span>{releaseDate(group.date,lang)}</span><small>{group.events.length} {c.count}</small></h2>
      <div className="ec-event-list">{group.events.map(event => <EventCard key={event.id} event={event} lang={lang} c={c} now={now}/>)}</div>
    </section>)}
    {isPastView && visible.length > pageEvents.length && <button className="ec-show-more" type="button"
      onClick={() => setVisibleLimit(count => count + 60)}>{c.loadMore} ({visible.length - pageEvents.length})</button>}
    <section className="ec-notes"><p>{c.delay}</p><p>{c.recentWindow}</p><p>{c.warning}</p></section>
  </main>;
}

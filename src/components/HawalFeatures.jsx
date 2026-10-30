import React, { useEffect, useMemo, useRef, useState } from 'react';
import { quoteState, safeUrl, timestamp } from '../lib/market-tools.js';
import { getTitle } from '../utils/news.js';
import { featureCopy } from '../lib/hawal-feature-copy.js';
import {
  HISTORY_KEY, ALERTS_KEY, TOPICS, DAYS, marketStories, sourceAssessment, claimWords,
  findRelatedReports, collectRates, normalizeHistory, historyFor, chartCoordinates,
  marketSnapshot, calculateAlerts
} from '../lib/hawal-features.js';

const cities = ['erbil','sulaymaniyah','baghdad'];
const labels = { en:{erbil:'Erbil',sulaymaniyah:'Sulaymaniyah',baghdad:'Baghdad'},ku:{erbil:'هەولێر',sulaymaniyah:'سلێمانی',baghdad:'بەغدا'},ar:{erbil:'أربيل',sulaymaniyah:'السليمانية',baghdad:'بغداد'} };
const fmt = n => typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US',{maximumFractionDigits:2}) : '—';
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
};
const putStorage = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} };

export function MarketIntelligence({ markets = [], news = [], lang = 'ku' }) {
  const c = featureCopy[lang] || featureCopy.ku;
  const [topic,setTopic] = useState('USD/IQD');
  const item = markets.find(m => m.symbol === topic);
  const local = topic === 'USD/IQD';
  const price = local ? item?.erbil?.sell : item?.price;
  const fresh = quoteState(item) === 'reported' && (local ? Boolean(item?.erbil?.sell) : true);
  const stories = useMemo(()=>marketStories(news,topic),[news,topic]);
  return <section className="desk-panel hawal-feature" id="intelligence" aria-labelledby="hawal-intelligence-title">
    <div className="feature-head"><div><p className="feature-kicker">01 / HAWAL INSIGHTS</p><h2 id="hawal-intelligence-title">{c.intelligence}</h2></div><span className="feature-icon" aria-hidden="true">◈</span></div>
    <p className="feature-description">{c.intelligentNote}</p>
    <label className="feature-field">{c.chooseMarket}<select value={topic} onChange={e=>setTopic(e.target.value)}>{TOPICS.map(key=><option key={key} value={key}>{key === 'USD/IQD' ? 'USD/IQD · '+labels[lang].erbil : key}</option>)}</select></label>
    <div className="insight-quote">
      <div><span>{topic}{local ? ' / $100' : ''}</span><strong dir="ltr">{fresh ? fmt(price) : '—'}</strong>{local && <small>IQD / $100</small>}</div>
      <div>{!fresh ? <span className="feature-status caution">{c.quoteUnavailable}</span> : <>
        <span className="feature-status">{c.move}</span>
        <b dir="ltr" className={Number(item?.changePct) > 0 ? 'up' : Number(item?.changePct) < 0 ? 'down' : ''}>{local || item?.changePct == null ? '—' : (item.changePct > 0 ? '+' : '') + fmt(item.changePct) + '%'}</b>
      </>}
      </div>
    </div>
    {item?.updatedAt && <p className="feature-foot">{c.sourceTime}: <time dateTime={item.updatedAt}>{timestamp(item.updatedAt,lang)}</time> {safeUrl(item.sourceUrl) && <a href={safeUrl(item.sourceUrl)} target="_blank" rel="noopener noreferrer">{item.source || c.original} ↗</a>}</p>}
    <h3>{c.relevant}</h3>
    {stories.length ? <ul className="feature-article-list">{stories.map(story=><li key={story.id || story.link}><a href={safeUrl(story.link)} target="_blank" rel="noopener noreferrer">{getTitle(story,lang)} ↗</a><small>{story.source} · <time dateTime={story.publishedAt}>{timestamp(story.publishedAt,lang)}</time></small></li>)}</ul> : <p className="feature-description">{c.noRelevant}</p>}
    <p className="feature-disclaimer">{c.possibleContext}</p>
  </section>;
}

export function VerificationDesk({ news = [], lang = 'ku' }) {
  const c = featureCopy[lang] || featureCopy.ku;
  const [claim,setClaim] = useState('');
  const [submitted,setSubmitted] = useState(null);
  const related = useMemo(()=>submitted == null ? [] : findRelatedReports(submitted,news),[submitted,news]);
  const ready = claimWords(claim).length >= 2;
  const defaultReports = useMemo(()=>news.filter(item=>safeUrl(item.link) && item.source && !item.isFallback).slice(0,3),[news]);
  const results = submitted == null ? defaultReports : related;
  return <section className="desk-panel hawal-feature" id="verify" aria-labelledby="hawal-verification-title">
    <div className="feature-head"><div><p className="feature-kicker">02 / SOURCE CHECK</p><h2 id="hawal-verification-title">{c.verification}</h2></div><span className="feature-icon" aria-hidden="true">✓?</span></div>
    <p className="feature-description">{c.verifyNote}</p>
    <form onSubmit={e=>{e.preventDefault();if(ready)setSubmitted(claim.trim());}} className="claim-form">
      <label className="feature-field">{c.claim}<textarea value={claim} onChange={e=>setClaim(e.target.value)} placeholder={c.claimHint} rows={3} maxLength={500}/></label>
      <button className="primary-button" type="submit" disabled={!ready}>{c.searchReports} ↗</button>
    </form>
    {submitted != null && <p className="feature-status">{related.length ? c.matching : c.notFound}</p>}
    {submitted == null && !ready && <small className="feature-foot">{c.minWords}</small>}
    <ul className="feature-article-list verification-list">{results.map(story=><li key={story.id || story.link}>
      <span className={'verification-badge ' + sourceAssessment(story)}>{c[sourceAssessment(story)]}</span>
      <a href={safeUrl(story.link)} target="_blank" rel="noopener noreferrer">{getTitle(story,lang)} ↗</a>
      <small>{story.source} · <time dateTime={story.publishedAt}>{timestamp(story.publishedAt,lang)}</time></small>
    </li>)}</ul>
    {submitted == null && !results.length && <p className="feature-description">{c.noNews}</p>}
  </section>;
}

function initialHistory() {
  const existing = readStorage(HISTORY_KEY,[]);
  const legacy = cities.flatMap(city=> {
    const old = readStorage('hawall-observations-'+city, []);
    return Array.isArray(old) ? old.map(p=>({city,side:'sell',at:p.time,price:p.price,source:p.source,sourceUrl:p.sourceUrl})) : [];
  });
  return normalizeHistory([...existing,...legacy]);
}
export function DollarHistory({ markets = [], lang = 'ku' }) {
  const c = featureCopy[lang] || featureCopy.ku;
  const [history,setHistory] = useState(initialHistory);
  const [city,setCity] = useState('erbil');
  const [side,setSide] = useState('sell');
  const [days,setDays] = useState(7);
  useEffect(()=>{
    const additions = collectRates(markets);
    if (!additions.length) return;
    setHistory(previous=>{
      const next = normalizeHistory([...previous,...additions]);
      if (JSON.stringify(previous) === JSON.stringify(next)) return previous;
      putStorage(HISTORY_KEY,next);
      return next;
    });
  },[markets]);
  const points = useMemo(()=>historyFor(history,city,side,days),[history,city,side,days]);
  const coords = chartCoordinates(points);
  const delta = points.length > 1 ? points.at(-1).price - points[0].price : null;
  return <section className="desk-panel hawal-feature" id="dollar-history" aria-labelledby="hawal-history-title">
    <div className="feature-head"><div><p className="feature-kicker">03 / LOCAL MARKET</p><h2 id="hawal-history-title">{c.history}</h2></div><span className="feature-icon" aria-hidden="true">⌁</span></div>
    <p className="feature-description">{c.historyNote}</p>
    <div className="feature-controls">
      <label className="feature-field">{c.city}<select value={city} onChange={e=>setCity(e.target.value)}>{cities.map(k=><option value={k} key={k}>{labels[lang][k]}</option>)}</select></label>
      <label className="feature-field">{c.side}<select value={side} onChange={e=>setSide(e.target.value)}><option value="sell">{c.sell}</option><option value="buy">{c.buy}</option></select></label>
    </div>
    <div className="history-tabs" role="group" aria-label={c.range}>{DAYS.map(d=><button type="button" key={d} aria-pressed={days===d} className={days===d?'selected':''} onClick={()=>setDays(d)}>{d}D</button>)}</div>
    <div className="history-chart" aria-label={c.historyLabel}>
      {coords.length > 1 ? <svg role="img" aria-label={c.historyLabel} viewBox="0 0 640 180" preserveAspectRatio="none">
        <path d="M15 45 H625 M15 90 H625 M15 135 H625" fill="none" stroke="currentColor" opacity=".13" strokeDasharray="4 8"/>
        <polyline points={coords.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        <circle cx={coords.at(-1).x} cy={coords.at(-1).y} r="5" fill="var(--primary)"/>
      </svg> : <p>{points.length ? c.needHistory : c.historyEmpty}</p>}
    </div>
    <div className="history-stats"><div><small>{c.first}</small><b dir="ltr">{fmt(points[0]?.price)}</b></div><div><small>{c.last}</small><b dir="ltr">{fmt(points.at(-1)?.price)}</b></div><div><small>{c.difference}</small><b dir="ltr" className={delta>0?'up':delta<0?'down':''}>{delta==null?'—':(delta>0?'+':'')+fmt(delta)}</b></div></div>
    <p className="feature-foot">{points.length} {c.observations} · {c.historyLabel}</p>
    {points.length > 0 && <div className="feature-foot">{c.historySource}: <a href={safeUrl(points.at(-1).sourceUrl)} target="_blank" rel="noopener noreferrer">{points.at(-1).source || c.original} ↗</a> · <time dateTime={points.at(-1).at}>{timestamp(points.at(-1).at,lang)}</time></div>}
  </section>;
}

const defaultSettings = {enabled:false,city:'erbil',threshold:'500',goldEnabled:false,goldThreshold:'0.75',breakingEnabled:true};
function savedSettings() {
  const value = readStorage(ALERTS_KEY,{});
  return { ...defaultSettings,...value,enabled:value.enabled===true };
}
export function MarketAlerts({ markets = [], news = [], lang = 'ku' }) {
  const c = featureCopy[lang] || featureCopy.ku;
  const [settings,setSettings] = useState(savedSettings);
  const [messages,setMessages] = useState([]);
  const [permissionText,setPermissionText] = useState('');
  const previousRef = useRef(null);
  const seenRef = useRef(new Set());
  const settingsRef = useRef(settings);
  const change = patch => setSettings(prev=>({...prev,...patch}));
  useEffect(()=>{ settingsRef.current=settings; putStorage(ALERTS_KEY,settings); },[settings]);
  useEffect(()=>{
    const current = marketSnapshot(markets,news);
    const before = previousRef.current;
    if (before && settingsRef.current.enabled) {
      const notices = calculateAlerts(before,current,settingsRef.current,[...seenRef.current]);
      if (notices.length) {
        const newItems = notices.filter(item=> !seenRef.current.has(item.id));
        if (newItems.length) {
          newItems.forEach(item=>seenRef.current.add(item.id));
          setMessages(list=>[...newItems.reverse(),...list].slice(0,12));
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            for (const notice of newItems.slice(0,3)) {
              try {
                const title = notice.type==='rate' ? c.alertRate : notice.type==='gold' ? c.alertGold : c.alertNews;
                const detail = notice.type==='rate' ? labels[lang][notice.city] + ': '+fmt(notice.price) : notice.type==='gold' ? fmt(notice.price)+' USD' : notice.title;
                new Notification('Hawal · '+title,{body:detail,tag:'hawall-'+notice.id});
              } catch { /* In-app notices remain available if system notification fails. */ }
            }
          }
        }
      }
    }
    previousRef.current = current;
    if (seenRef.current.size > 100) seenRef.current = new Set([...seenRef.current].slice(-60));
  },[markets,news,lang]);
  const valid = Number(settings.threshold)>0 && Number(settings.goldThreshold)>0;
  const toggle = () => {
    if (!valid) return;
    previousRef.current = marketSnapshot(markets,news);
    seenRef.current = new Set();
    change({enabled:!settings.enabled});
  };
  const askPermission = async () => {
    if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') { setPermissionText(c.browserUnsupported); return; }
    try { const result=await Notification.requestPermission();setPermissionText(result === 'granted' ? c.enabled : c.notificationsBlocked); } catch { setPermissionText(c.browserUnsupported); }
  };
  return <section className="desk-panel hawal-feature" id="market-alerts" aria-labelledby="hawal-alerts-title">
    <div className="feature-head"><div><p className="feature-kicker">04 / YOUR WATCHLIST</p><h2 id="hawal-alerts-title">{c.alerts}</h2></div><span className={'feature-icon '+(settings.enabled?'feature-on':'')} aria-hidden="true">♧</span></div>
    <p className="feature-description">{c.alertsNote}</p>
    <label className="feature-field">{c.rateAlerts} · {c.city}<select value={settings.city} onChange={e=>change({city:e.target.value})}>{cities.map(k=><option key={k} value={k}>{labels[lang][k]}</option>)}</select></label>
    <label className="feature-field">{c.cityThreshold}<input type="number" min="1" step="1" value={settings.threshold} onChange={e=>change({threshold:e.target.value})}/></label>
    <div className="feature-controls option-row"><label><input type="checkbox" checked={settings.goldEnabled} onChange={e=>change({goldEnabled:e.target.checked})}/>{c.goldAlerts}</label><label><input type="checkbox" checked={settings.breakingEnabled} onChange={e=>change({breakingEnabled:e.target.checked})}/>{c.breakingAlerts}</label></div>
    {settings.goldEnabled && <label className="feature-field">{c.goldThreshold}<input type="number" min="0.01" step="0.05" value={settings.goldThreshold} onChange={e=>change({goldThreshold:e.target.value})}/></label>}
    {!valid && <small className="feature-status caution">{c.thresholdInvalid}</small>}
    <div className="feature-actions"><button type="button" className="primary-button" disabled={!valid} onClick={toggle}>{settings.enabled ? c.disable : c.enable}</button><span className={'feature-status '+(settings.enabled?'on':'')}>{settings.enabled ? c.enabled : c.disabled}</span></div>
    <button className="feature-permission" type="button" onClick={askPermission}>{c.notifyOpt} ↗</button>
    {permissionText && <small role="status" className="feature-description">{permissionText}</small>}
    <h3>{c.notice}</h3>
    <div className="alert-feed" role="status" aria-live="polite">{messages.length ? messages.map(alert=><article key={alert.id} className="alert-entry"><b>{alert.type === 'rate' ? c.alertRate : alert.type === 'gold' ? c.alertGold : c.alertNews}</b><p>{alert.type === 'rate' ? labels[lang][alert.city]+': '+fmt(alert.price)+' IQD / $100 ('+(alert.diff > 0 ? '+' : '')+fmt(alert.diff)+')' : alert.type === 'gold' ? fmt(alert.price)+' USD ('+(alert.pct > 0 ? '+' : '')+fmt(alert.pct)+'%)' : alert.title}</p>{safeUrl(alert.url || alert.link) && <a href={safeUrl(alert.url || alert.link)} target="_blank" rel="noopener noreferrer">{c.alertSource} ↗</a>}</article>) : <p>{c.noAlerts}</p>}</div>
    <p className="feature-disclaimer">{c.onlyOn}</p>
  </section>;
}

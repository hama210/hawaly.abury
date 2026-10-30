import React, { useId, useState } from 'react';
import { dashboardCopy } from '../lib/dashboard-copy.js';
import { polishCopy } from '../lib/polish-copy.js';
import { cityRecord, cityQuote, quoteState, positive, formatNumber, timestamp, safeUrl, currencyValue } from '../lib/market-tools.js';
import { historyFor, chartCoordinates } from '../lib/hawal-features.js';

export function RateMeta({ item, lang }) {
  const c=dashboardCopy[lang], p=polishCopy[lang], state=quoteState(item);
  return <div className="quote-meta">
    <span className={'quote-status '+state}>{state==='unavailable'?p.unavailable:c[state]}</span>
    {item?.updatedAt && <time dateTime={item.updatedAt}>{c.asof}: {timestamp(item.updatedAt,lang)}</time>}
    {item?.checkedAt && <small>{c.checked}: <time dateTime={item.checkedAt}>{timestamp(item.checkedAt,lang)}</time></small>}
    {safeUrl(item?.sourceUrl) && <a href={safeUrl(item.sourceUrl)} target="_blank" rel="noopener noreferrer">{item.source} ↗</a>}
  </div>;
}
export function RateSparkline({ history, city, lang }) {
  const p=polishCopy[lang], c=dashboardCopy[lang];
  const points=historyFor(history,city,'sell',30), coords=chartCoordinates(points,240,70);
  return <details className="rate-history-mini"><summary>{p.history}</summary>
    {coords.length>1 ? <>
      <svg viewBox="0 0 240 70" role="img" aria-label={c[city]+' · '+p.history}>
        <polyline points={coords.map(q=>q.x+','+q.y).join(' ')} fill="none" stroke="currentColor" strokeWidth="2"/>
      </svg>
      <div className="spark-values"><bdi>{formatNumber(points[0].price,lang)}</bdi><span>→</span><bdi>{formatNumber(points.at(-1).price,lang)}</bdi></div>
      <small>{timestamp(points[0].at,lang)} → {timestamp(points.at(-1).at,lang)}</small>
      <ul className="sr-only">{points.map(q=><li key={q.at}>{timestamp(q.at,lang)}: {formatNumber(q.price,lang)}</li>)}</ul>
    </> : <p>{p.historyEmpty}</p>}
    <small>{p.historyNote}{city==='official'?' '+p.observed:''}</small>
  </details>;
}
export function QuickConverter({ markets, lang }) {
  const [city,setCity]=useState('erbil'), [from,setFrom]=useState('USD'), [amount,setAmount]=useState('100');
  const p=polishCopy[lang], c=dashboardCopy[lang], id=useId();
  const to=from==='USD'?'IQD':'USD';
  // A customer selling USD receives the dealer BUY quote; buying USD uses SELL.
  const side=from==='USD'?'buy':'sell', quote=cityRecord(markets,city);
  const rate=city==='official'?quote?.price:cityQuote(markets,city,side);
  const result=currencyValue(amount,from,to,{USD:1,IQD:positive(rate)?1/rate:null});
  const invalid=amount==='' || !Number.isFinite(Number(amount)) || Number(amount)<0;
  const state=quoteState(quote);
  return <section className="quick-converter" aria-labelledby={id}>
    <h3 id={id}>{p.converter}</h3><div className="desk-fields">
      <label>{c.amount}<input type="number" inputMode="decimal" min="0" step="any" value={amount} aria-invalid={invalid} onChange={e=>setAmount(e.target.value)}/></label>
      <label>{c.from}<select value={from} onChange={e=>setFrom(e.target.value)}><option>USD</option><option>IQD</option></select></label>
      <button className="swap-button" type="button" aria-label={p.swap} onClick={()=>{setFrom(to);if(result!==null)setAmount(String(Number(result.toFixed(2))));}}>⇄</button>
      <label>{c.basis}<select value={city} onChange={e=>setCity(e.target.value)}>{['erbil','sulaymaniyah','baghdad','official'].map(k=><option value={k} key={k}>{c[k]}</option>)}</select></label>
    </div>
    <output className="quick-result" aria-live="polite"><small>{c.result}</small><strong><bdi>{result===null ? (invalid?p.invalidAmount:p.noRate) : formatNumber(result,lang)+' '+to}</bdi></strong></output>
    <p className="desk-note">{city==='official'?c.reference:c[side]} · {c.estimate}</p>
    {result!==null && state==='stale' && <p className="rate-warning" role="status">{p.staleConversion}</p>}
    {result!==null && state==='undated' && <p className="rate-warning">{p.undatedConversion}</p>}
  </section>;
}
export function DollarRates({ markets=[], lang, loading=false, history=[], onRefresh }) {
  const c=dashboardCopy[lang], p=polishCopy[lang], id=useId();
  const checked=markets.map(q=>q.checkedAt || q.fetchedAt).filter(q=>Number.isFinite(Date.parse(q))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  const failed=markets.some(q=>q.retrievalError);
  return <section className="desk-panel dollar-panel" aria-labelledby={id} aria-busy={loading}>
    <div className="desk-heading"><div><p className="desk-eyebrow">USD / IQD</p><h2 id={id}>{c.rates}</h2></div><span>{c.unit}</span></div>
    <div className="rates-check"><span role="status">{loading?p.pending:checked?<>{c.checked}: <time dateTime={checked}>{timestamp(checked,lang)}</time></>:p.unknownCheck}</span>{onRefresh&&<button type="button" disabled={loading} onClick={onRefresh}>{p.refresh} ↻</button>}</div>
    {failed&&<p className="rate-warning" role="status">{p.failed}</p>}
    <div className="dollar-grid">{['official','erbil','sulaymaniyah','baghdad'].map(city=>{
      const q=cityRecord(markets,city), state=quoteState(q), has=positive(q?.price);
      return <article className={'dollar-card '+(city==='official'?'official-card':'')} key={city}>
        <h3>{c[city]}</h3>{loading&&!has?<div className="rate-skeleton" aria-label={p.pending}><i/><i/><i/></div>:has?<>
          {state==='stale'&&<span className="last-known">{p.lastKnown}</span>}
          {city==='official'?<><strong><bdi>{formatNumber(q.price*100,lang)}</bdi></strong><p>{c.reference}</p></>:<dl>{['buy','sell'].map(side=><div key={side}><dt>{c[side]}</dt><dd className={!positive(q[side])?'missing-side':''}><bdi>{positive(q[side])?formatNumber(q[side],lang):p.missingSide}</bdi></dd></div>)}</dl>}
        </>:<div className="rate-empty"><span aria-hidden="true">◷</span><strong>{p.unavailable}</strong><p>{p.emptyRate}</p></div>}
        {!loading&&<RateMeta item={q} lang={lang}/>}
        <RateSparkline history={history} city={city} lang={lang}/>
      </article>;
    })}</div>
    <p className="rates-disclaimer"><span aria-hidden="true">ⓘ</span>{c.disclaimer}</p>
    <QuickConverter markets={markets} lang={lang}/>
  </section>;
}

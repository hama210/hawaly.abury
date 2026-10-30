import React, { useEffect, useMemo, useRef, useState } from 'react';
import { dashboardCopy } from '../lib/dashboard-copy.js';
import { positive, cityQuote, currencyValue, goldValue, quoteState, timestamp, baghdadDate, safeUrl, pagePath } from '../lib/market-tools.js';
import { getTitle } from '../utils/news.js';
const fmt = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits:2 }) : '—';
export function QuoteMeta({ item, lang }) {
 const c = dashboardCopy[lang];
 return <div className="quote-meta"><span className={`quote-status ${quoteState(item)}`}>{c[quoteState(item)]}</span>{item?.updatedAt && <time dateTime={item.updatedAt}>{c.asof}: {timestamp(item.updatedAt, lang)}</time>}{item?.fetchedAt && <small>{c.checked}: {timestamp(item.fetchedAt, lang)}</small>}{safeUrl(item?.sourceUrl) && <a href={safeUrl(item.sourceUrl)} target="_blank" rel="noreferrer">{item.source} ↗</a>}</div>;
}
export function DollarRates({ markets, lang }) {
 const c = dashboardCopy[lang];
 const local = markets.find(q => q.symbol === 'USD/IQD');
 const official = markets.find(q => q.marketKind === 'official');
 return <section className="desk-panel dollar-panel" aria-labelledby="dollar-title"><div className="desk-heading"><div><p className="desk-eyebrow">USD / IQD</p><h2 id="dollar-title">{c.rates}</h2></div><span>{c.unit}</span></div><div className="dollar-grid"><article className="dollar-card official-card"><h3>{c.official}</h3><strong dir="ltr">{fmt(positive(official?.price) ? official.price * 100 : null)}</strong><p>{c.reference}</p><QuoteMeta item={official} lang={lang}/></article>{['erbil','sulaymaniyah','baghdad'].map(city => <article className="dollar-card" key={city}><h3>{c[city]}</h3><dl><div><dt>{c.buy}</dt><dd dir="ltr">{fmt(local?.[city]?.buy)}</dd></div><div><dt>{c.sell}</dt><dd dir="ltr">{fmt(local?.[city]?.sell)}</dd></div></dl>{positive(local?.[city]?.buy) || positive(local?.[city]?.sell) ? <QuoteMeta item={local} lang={lang}/> : <span className="quote-status unavailable">{c.unavailable}</span>}</article>)}</div><p className="desk-note">{c.disclaimer}</p></section>;
}
export function MarketDesk({ markets, lang }) {
 const c = dashboardCopy[lang];
 const [basis, setBasis] = useState('erbil');
 const [side, setSide] = useState('sell');
 const [manual, setManual] = useState('');
 const [amount, setAmount] = useState('100');
 const [from, setFrom] = useState('USD');
 const [to, setTo] = useState('IQD');
 const [grams, setGrams] = useState('1');
 const [karat, setKarat] = useState('21');
 const [mithqal, setMithqal] = useState('5');
 const local = markets.find(q => q.symbol === 'USD/IQD');
 const official = markets.find(q => q.marketKind === 'official');
 const gold = markets.find(q => q.symbol === 'XAU/USD');
 const iqd = basis === 'manual' ? Number(manual) / 100 : basis === 'official' ? official?.price : cityQuote(markets, basis, side);
 const usdValues = { USD:1, IQD:positive(iqd) ? 1 / iqd : null, EUR:markets.find(q => q.symbol === 'EUR/USD')?.price, GBP:markets.find(q => q.symbol === 'GBP/USD')?.price, BTC:markets.find(q => q.symbol === 'BTC/USD')?.price };
 const result = currencyValue(amount, from, to, usdValues);
 const totalGold = goldValue(gold?.price, Number(grams), Number(karat));
 return <section id="tools" className="market-tools" aria-label={c.tools}><div className="desk-panel basis-panel"><h2>{c.basis}</h2><div className="desk-fields"><label>{c.basis}<select value={basis} onChange={e => setBasis(e.target.value)}>{['erbil','sulaymaniyah','baghdad','official','manual'].map(key => <option key={key} value={key}>{c[key]}</option>)}</select></label>{!['official','manual'].includes(basis) && <label>{c.side}<select value={side} onChange={e => setSide(e.target.value)}><option value="sell">{c.sell}</option><option value="buy">{c.buy}</option></select></label>}{basis === 'manual' && <label>{c.manualRate}<input type="number" min="1" step="any" value={manual} onChange={e => setManual(e.target.value)} /></label>}</div>{basis !== 'manual' && <QuoteMeta item={basis === 'official' ? official : local?.[basis] ? local : null} lang={lang}/>}</div><div className="tools-grid"><section className="desk-panel"><h2>{c.converter}</h2><div className="desk-fields"><label>{c.amount}<input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)}/></label><label>{c.from}<select value={from} onChange={e => setFrom(e.target.value)}>{Object.keys(usdValues).map(key => <option key={key}>{key}</option>)}</select></label><label>{c.to}<select value={to} onChange={e => setTo(e.target.value)}>{Object.keys(usdValues).map(key => <option key={key}>{key}</option>)}</select></label></div><output className="conversion-result" aria-live="polite"><small>{c.result}</small><strong dir="ltr">{fmt(result)} {to}</strong></output>{result === null && <p>{c.missing}</p>}<p className="desk-note">{c.estimate}</p>{['EUR','GBP','BTC'].filter(code => [from,to].includes(code)).map(code => <QuoteMeta key={code} item={markets.find(q => q.symbol === code + '/USD')} lang={lang}/>)}</section><section className="desk-panel"><h2>{c.gold}</h2><div className="desk-fields"><label>{c.grams}<input type="number" min="0.001" step="any" value={grams} onChange={e => setGrams(e.target.value)}/></label><label>{c.purity}<select value={karat} onChange={e => setKarat(e.target.value)}>{[24,22,21,18].map(k => <option key={k} value={k}>{k}K</option>)}</select></label><label>{c.mithqal}<input type="number" min="0.001" step="any" value={mithqal} onChange={e => setMithqal(e.target.value)}/></label></div><output className="conversion-result" aria-live="polite"><small>{c.result}</small><strong dir="ltr">{fmt(totalGold)} USD · {fmt(positive(iqd) && totalGold !== null ? totalGold * iqd : null)} IQD</strong></output><div className="gold-units"><span>{c.gram}: <b dir="ltr">{fmt(goldValue(gold?.price, 1, Number(karat)))} USD</b></span><span>{c.perMithqal} ({mithqal || '—'} g): <b dir="ltr">{fmt(goldValue(gold?.price, Number(mithqal), Number(karat)))} USD</b></span></div><p className="desk-note">{c.goldNote}</p><QuoteMeta item={gold} lang={lang}/></section></div></section>;
}
export function DailyBrief({ items, lang }) {
 const c = dashboardCopy[lang];
 const today = baghdadDate();
 const headlines = useMemo(() => items.filter(item => !item.isFallback && baghdadDate(item.publishedAt) === today && Date.parse(item.publishedAt) <= Date.now() && safeUrl(item.link)).sort((a,b) => (b.strengthScore || 0) - (a.strengthScore || 0)).slice(0,5), [items,today]);
 return <section className="desk-panel daily-summary"><div className="desk-heading"><h2>{c.five}</h2><time>{today}</time></div><p className="desk-note">{c.briefNote}</p>{headlines.length ? <ol>{headlines.map(item => <li key={item.id}><a href={safeUrl(item.link)} target="_blank" rel="noreferrer">{getTitle(item,lang)} ↗</a><small>{item.source} · <time dateTime={item.publishedAt}>{timestamp(item.publishedAt,lang)}</time></small></li>)}</ol> : <p className="desk-note">{c.noBrief}</p>}</section>;
}
export function CalendarLinks({ lang }) {
 const c = dashboardCopy[lang];
 return <section className="desk-panel"><h2>{c.calendar}</h2><p className="desk-note">{c.calendarNote}</p><div className="official-links">{[['cbi','https://cbi.iq/'],['opec','https://www.opec.org/'],['krg','https://gov.krd/'],['fed','https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm']].map(([key,url]) => <a key={key} href={url} target="_blank" rel="noreferrer">{c[key]} ↗</a>)}</div></section>;
}
export function AboutPage({ lang, page }) {
 const c = dashboardCopy[lang];
 return <main className="desk-panel information-page"><h1>{c[page]}</h1>{page === 'about' ? <><p>{c.aboutText}</p><h2>{c.methodology}</h2><p>{c.methodologyText}</p><p>{c.disclaimer}</p><a href={pagePath(lang,'contact')}>{c.contact} →</a></> : <><p>{c.contactText}</p><a className="primary-button" href="https://github.com/hama210/hawaly.abury/issues" target="_blank" rel="noreferrer">{c.feedback} ↗</a></>}</main>;
}
export function InstallPanel({ lang }) {
 const c = dashboardCopy[lang];
 const [prompt,setPrompt] = useState(null);
 const [installed,setInstalled] = useState(false);
 useEffect(() => { setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone)); const before = e => { e.preventDefault(); setPrompt(e); }; const after = () => { setInstalled(true); setPrompt(null); }; window.addEventListener('beforeinstallprompt',before); window.addEventListener('appinstalled',after); return () => { window.removeEventListener('beforeinstallprompt',before); window.removeEventListener('appinstalled',after); }; },[]);
 return <section className="desk-panel install-panel"><h2>{installed ? c.installed : c.install}</h2>{!installed && (prompt ? <button type="button" className="primary-button" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>{c.install}</button> : <p className="desk-note">{c.installHelp}</p>)}</section>;
}
export function RateWatch({ markets, lang }) {
 const c = dashboardCopy[lang];
 const [city,setCity] = useState('erbil');
 const [enabled,setEnabled] = useState(false);
 const [threshold,setThreshold] = useState('500');
 const [notice,setNotice] = useState('');
 const [history,setHistory] = useState([]);
 const baseline = useRef(null);
 const local = markets.find(q => q.symbol === 'USD/IQD');
 useEffect(() => { baseline.current=null; setNotice(''); try { setHistory(JSON.parse(localStorage.getItem('hawall-observations-' + city) || '[]')); } catch { setHistory([]); } },[city]);
 useEffect(() => {
  const price=local?.[city]?.sell;
  if (!positive(price) || !local.updatedAt || quoteState(local) !== 'reported') return;
  const key='hawall-observations-' + city;
  let saved=[]; try { saved=JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  if (!Array.isArray(saved)) saved=[];
  saved=saved.filter(p => positive(p.price) && Number.isFinite(Date.parse(p.time)) && Date.now()-Date.parse(p.time)<30*86400000);
  const last=saved.at(-1);
  if (!last || Date.parse(local.updatedAt)>Date.parse(last.time)) { saved=[...saved,{time:local.updatedAt,price,source:local.source,sourceUrl:local.sourceUrl}].slice(-30); setHistory(saved); try { localStorage.setItem(key,JSON.stringify(saved)); } catch {} }
  if (!enabled) { baseline.current=null; return; }
  const previous=baseline.current;
  if (previous && previous.source===local.source && Date.parse(local.updatedAt)>Date.parse(previous.time) && Math.abs(price-previous.price)>=Number(threshold)) { setNotice(`${c[city]}: ${fmt(previous.price)} → ${fmt(price)} IQD / $100`); baseline.current={price,time:local.updatedAt,source:local.source}; }
  if (!previous || previous.source!==local.source) baseline.current={price,time:local.updatedAt,source:local.source};
 },[local,city,enabled,threshold,lang]);
 return <section className="desk-panel rate-watch"><h2>{c.trend}</h2><div className="desk-fields"><label>{c.basis}<select value={city} onChange={e=>setCity(e.target.value)}>{['erbil','sulaymaniyah','baghdad'].map(key=><option key={key} value={key}>{c[key]}</option>)}</select></label></div><p className="desk-note">{c.trendNote}</p>{history.length ? <ul className="observation-list">{history.slice(-5).map(point=><li key={point.time}><time dateTime={point.time}>{timestamp(point.time,lang)}</time><strong dir="ltr">{fmt(point.price)} IQD / $100</strong></li>)}</ul> : <p className="desk-note">{c.noTrend}</p>}<h3>{c.localAlerts}</h3><p className="desk-note">{c.alertNote}</p><div className="desk-fields"><label>{c.threshold}<input type="number" min="1" step="1" value={threshold} onChange={e=>{setThreshold(e.target.value);baseline.current=null;}}/></label><button type="button" className="primary-button" disabled={!positive(Number(threshold))} onClick={()=>{setEnabled(!enabled);baseline.current=null;setNotice('');}}>{enabled ? c.disable : c.enable}</button></div>{notice && <p className="rate-notice" role="alert">{c.alert}: {notice}</p>}</section>;
}

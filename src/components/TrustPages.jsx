import React, { useState } from 'react';
import { dashboardCopy } from '../lib/dashboard-copy.js';
import { polishCopy } from '../lib/polish-copy.js';
import { pagePath } from '../lib/market-tools.js';

export function AboutPage({ lang, page, contact={} }) {
  const c=dashboardCopy[lang], p=polishCopy[lang];
  const [topic,setTopic]=useState('rateIssue'), [message,setMessage]=useState(''), [url,setUrl]=useState('');
  const email=contact.email || import.meta.env.VITE_CONTACT_EMAIL || '';
  const telegram=contact.telegram || import.meta.env.VITE_CONTACT_TELEGRAM || '';
  const publicEmail=/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(email)?email:'';
  const publicTelegram=/^https:\/\/t\.me\/[A-Za-z0-9_]{5,}\/?$/.test(telegram)?telegram:'';
  const report='https://github.com/hama210/hawaly.abury/issues/new?'+new URLSearchParams({title:'[Hawal] '+p[topic],body:message+(url?'\n\nSource / page: '+url:'')+'\n\nLanguage: '+lang});
  return <main className="desk-panel information-page" id="main-content" tabIndex="-1">
    <p className="desk-eyebrow">HAWAL</p><h1>{c[page]}</h1>
    {page==='about'?<>
      <p>{c.aboutText}</p><h2>{p.methodology}</h2><p>{p.collection}</p>
      <div className="method-sources"><a href="https://shafaq.com/en/Economy" target="_blank" rel="noreferrer">Shafaq News ↗</a><a href="https://cbi.iq/" target="_blank" rel="noreferrer">{c.official} ↗</a><a href="https://alanchand.com/en/exchange-rates/usd-iqd" target="_blank" rel="noreferrer">AlanChand ↗</a><a href="https://finance.yahoo.com/" target="_blank" rel="noreferrer">Yahoo Finance ↗</a></div>
      <p>{p.timing}</p><p>{p.retention}</p><p>{p.translationPolicy}</p>
      <h2>{p.corrections}</h2><p>{p.correctionText}</p><a href={pagePath(lang,'contact')}>{p.feedback} →</a>
      <h2>{p.privacy}</h2><p>{p.privacyText}</p><p className="rates-disclaimer">{c.disclaimer}</p>
    </>:<>
      <p>{p.contactIntro}</p>
      <form className="feedback-form" action="https://github.com/hama210/hawaly.abury/issues/new" onSubmit={e=>{e.preventDefault();if(message.trim())location.assign(report);}}>
        <label>{p.topic}<select value={topic} onChange={e=>setTopic(e.target.value)}>{['rateIssue','translationIssue','siteIssue'].map(k=><option key={k} value={k}>{p[k]}</option>)}</select></label>
        <label>{p.message}<textarea required minLength={5} maxLength={2500} rows={5} value={message} onChange={e=>setMessage(e.target.value)}/></label>
        <label>{p.evidence}<input type="url" maxLength={1000} value={url} onChange={e=>setUrl(e.target.value)}/></label>
        <button type="submit" className="primary-button" disabled={message.trim().length<5}>{p.prepareReport} ↗</button><p className="desk-note">{p.reportNote}</p>
      </form>
      {(publicEmail||publicTelegram)&&<><h2>{p.contactChannels}</h2><div className="method-sources">{publicEmail&&<a href={'mailto:'+publicEmail}>{p.email}: <bdi>{publicEmail}</bdi></a>}{publicTelegram&&<a href={publicTelegram} target="_blank" rel="noreferrer">{p.telegram} ↗</a>}</div></>}
      <p className="desk-note"><a href="https://github.com/hama210/hawaly.abury" target="_blank" rel="noreferrer">{p.project} ↗</a></p>
    </>}
  </main>;
}

// Read-only calendar audit. Use the same public provider and static archive as HAWAL.
// No authentication, no owner endpoint, and no translation services.
import { normalizeCalendarPayload,normalizeCalendarHistory,CALENDAR_API_URL } from '../src/services/economic-calendar.js';
import { archivePastCalendarEvents } from '../src/lib/calendar-history.js';
import { analyzeCalendarEvent,parseEconomicValue,indicatorKind } from '../src/lib/economic-impact.js';
const BASE='https://hawaly-aburyy.pages.dev';
async function get(url){
 const start=Date.now();
 try{
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'HAWAL-Calendar-Audit/1.0'},signal:AbortSignal.timeout(17000),cache:'no-store'});
  const data=await response.json().catch(()=>null);
  return {http:response.status,ms:Date.now()-start,etag:response.headers.get('etag'),data};
 }catch(e){return {http:null,ms:Date.now()-start,error:String(e?.name||'network-error')};}
}
const [provider,archive]=await Promise.all([
 get(CALENDAR_API_URL),get(BASE+'/data/economic-calendar-history.json')
]);
let normalized,history;
try{normalized=normalizeCalendarPayload(provider.data);}catch(e){normalized={error:e.message,events:[]};}
try{history=normalizeCalendarHistory(archive.data);}catch(e){history={error:e.message,events:[]};}
const now=Date.now();
const group=new Map();
const raw=provider.data?.events||[];
for(const e of raw){
 const impact=String(e?.impact);
 const kind=indicatorKind(e?.title);
 const parsed=analyzeCalendarEvent(e);
 const key=[e.currency,impact,kind,parsed.status].join('/');
 group.set(key,(group.get(key)||0)+1);
}
const abnormal=raw.filter(e=>{
 const time=Date.parse(e?.time);
 return !Number.isFinite(time)||!['high','medium','low','holiday'].includes(e.impact)||
  !['scheduled','moved','tentative'].includes(e.status)||
  (e.actual && time>now+5*60000)||
  (e.actual && parseEconomicValue(e.actual)&&e.forecast && !parseEconomicValue(e.forecast));
}).slice(0,18).map(e=>({id:e.id,time:e.time,title:e.title,currency:e.currency,impact:e.impact,status:e.status,
 actual:e.actual,forecast:e.forecast,previous:e.previous}));
const sample=raw.filter(e=>/unemploy|jobless|CPI|PCE|payroll|interest rate|rate decision|FED|oil|sales|GDP|PMI|balance|wages/i.test(e.title||''))
 .slice(0,28).map(e=>({id:e.id,time:e.time,currency:e.currency,impact:e.impact,title:e.title,
 actual:e.actual,forecast:e.forecast,previous:e.previous,analysis:analyzeCalendarEvent(e).note}));
const archiveActual=history.events.filter(e=>String(e.actual||'').trim()).length;
const archiveForecast=history.events.filter(e=>String(e.forecast||'').trim()).length;
const providerActual=normalized.events.filter(e=>String(e.actual||'').trim()).length;
const providerForecast=normalized.events.filter(e=>String(e.forecast||'').trim()).length;
const result={at:new Date(now).toISOString(),sources:{
 provider:{http:provider.http,ms:provider.ms,etag:provider.etag,rawCount:raw.length,valid:normalized.events.length,
  publishedAt:normalized.publishedAt,serverTime:provider.data?.server_time_iso||null,error:normalized.error||provider.error||null},
 archive:{http:archive.http,ms:archive.ms,count:history.events.length,updatedAt:history.updatedAt,error:history.error||archive.error||null}
 },completeness:{providerActual,providerForecast,archiveActual,archiveForecast,
  pastActualUnpublished:normalized.events.filter(e=>Date.parse(e.time)<now-6*3600000&&!e.actual).length,
  providerDuplicateIds:raw.length-new Set(raw.map(e=>e.id)).size,
  archiveDuplicateIds:history.events.length-new Set(history.events.map(e=>e.id)).size},
 abnormal,groups:[...group.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25),
 sample,archiveSample:history.events.filter(e=>e.actual&&e.forecast).slice(-7).map(e=>({
 id:e.id,title:e.title,time:e.time,currency:e.currency,impact:e.impact,actual:e.actual,forecast:e.forecast,previous:e.previous,
 conclusion:analyzeCalendarEvent(e).note}))};
console.log('HAWAL LIVE CALENDAR AUDIT');
console.log(JSON.stringify(result,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
 const fs=await import('node:fs');
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### Calendar public audit\n'+
  '- Provider: '+provider.http+', valid '+normalized.events.length+', last update '+normalized.publishedAt+'\n'+
  '- Past releases captured: '+history.events.length+', with actual '+archiveActual+' and forecast '+archiveForecast+'\n'+
  '- Anomalies (sampled): '+abnormal.length+'\n');
}
if(provider.http!==200||archive.http!==200||normalized.error||history.error)process.exitCode=1;

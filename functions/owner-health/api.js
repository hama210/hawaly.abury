import { ownerAuthorized,accessDenied,ownerResponseHeaders } from '../lib/owner-auth.js';
import { buildSourceHealthReport } from '../../src/lib/source-health.js';
import { onRequest as loadNews } from '../api/news.js';
import { onRequest as loadMarkets } from '../api/markets.js';
import { onRequestGet as loadMetalsHistory } from '../api/metals-history.js';
import { getOwnerBackgroundStatus } from '../lib/owner-watch-status.js';

// Call Pages handlers directly; recursive same-host Worker fetches can fail or
// loop through Access policies. Do not send Access JWTs to public data APIs.
async function getPublicApi(context,path,handler){
  const response=await handler({...context,request:new Request(new URL(context.request.url).origin+path)});
  if(!response.ok)throw new Error('Source HTTP '+response.status);
  const data=await response.json();
  if(!data||typeof data!=='object')throw new Error('Invalid source payload');
  return data;
}
async function getCalendar(){
  const response=await fetch('https://showmytrades.com/api/public/calendar/v1?days=7&impact=all',{
    headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error('Calendar unavailable');
  return response.json();
}
async function checked(task){
  try{return await task();}catch{return null;}
}
export async function onRequest(context){
  if(context.request.method!=='GET')return accessDenied('GET only',405);
  // The Access JWT must be cryptographically valid and claim the EXACT owner
  // email. Matching an "admin" role or an arbitrary email header is never enough.
  if(!await ownerAuthorized(context.request,context.env))return accessDenied();
  const batch0=await checked(()=>getPublicApi(context,'/api/news?mode=full&batch=0&limit=120',loadNews));
  const count=Number(batch0?.batchCount);
  const remaining=Number.isSafeInteger(count)&&count>1&&count<=8?count-1:0;
  const paths=Array.from({length:remaining},(_,i)=>'/api/news?mode=full&batch='+(i+1)+'&limit=120');
  const [rest,markets,calendar,metalsHistory,background]=await Promise.all([
    Promise.all(paths.map(path=>checked(()=>getPublicApi(context,path,loadNews)))),
    checked(()=>getPublicApi(context,'/api/markets',loadMarkets)), 
    checked(()=>getCalendar()),
    checked(()=>getPublicApi(context,'/api/metals-history',loadMetalsHistory)),
    checked(()=>getOwnerBackgroundStatus())
  ]);
  const report=buildSourceHealthReport({news:[batch0,...rest],markets,calendar,metalsHistory});
  report.background=background||{status:'unknown',lastCheckedAt:null};
  // No report is stored in a public endpoint, browser cache or GitHub Actions log.
  return Response.json(report,{headers:{...ownerResponseHeaders,
    'Content-Type':'application/json; charset=utf-8'}});
}

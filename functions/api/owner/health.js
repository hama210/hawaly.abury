import { ownerAuthorized,accessDenied,ownerResponseHeaders } from '../../lib/owner-auth.js';
import { buildSourceHealthReport } from '../../../src/lib/source-health.js';

async function fetchJson(origin,path,timeoutMs=17000){
  const response=await fetch(origin+path,{
    headers:{Accept:'application/json','User-Agent':'HAWAL-OwnerHealth/1.0'},
    cache:'no-store',signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response.ok)throw new Error('Source HTTP '+response.status);
  const data=await response.json();
  if(!data||typeof data!=='object')throw new Error('Invalid source payload');
  return data;
}
async function checked(task){
  try{return await task();}catch{return null;}
}
export async function onRequest(context){
  if(context.request.method!=='GET')return accessDenied('GET only',405);
  // The Access JWT must be cryptographically valid and claim the EXACT owner
  // email. Matching an "admin" role or an arbitrary email header is never enough.
  if(!await ownerAuthorized(context.request,context.env))return accessDenied();
  const origin=new URL(context.request.url).origin;
  const batch0=await checked(()=>fetchJson(origin,'/api/news?mode=full&batch=0&limit=120'));
  const count=Number(batch0?.batchCount);
  const remaining=Number.isSafeInteger(count)&&count>1&&count<=8?count-1:0;
  const paths=Array.from({length:remaining},(_,i)=>'/api/news?mode=full&batch='+(i+1)+'&limit=120');
  const [rest,markets,calendar,metalsHistory]=await Promise.all([
    Promise.all(paths.map(path=>checked(()=>fetchJson(origin,path)))),
    checked(()=>fetchJson(origin,'/api/markets')),
    checked(()=>fetchJson('https://showmytrades.com','/api/public/calendar/v1?days=7&impact=all')),
    checked(()=>fetchJson(origin,'/api/metals-history'))
  ]);
  const report=buildSourceHealthReport({news:[batch0,...rest],markets,calendar,metalsHistory});
  // No report is stored in a public endpoint, browser cache or GitHub Actions log.
  return Response.json(report,{headers:{...ownerResponseHeaders,
    'Content-Type':'application/json; charset=utf-8'}});
}

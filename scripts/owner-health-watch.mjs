// Read-only, non-credentialled HAWAL uptime/source watch.
// Runs from GitHub Actions even when the owner's dashboard is closed.
// DO NOT log any Access cookies, JWTs, email addresses or private reports.
const BASE='https://hawaly-aburyy.pages.dev';
const CALENDAR='https://showmytrades.com/api/public/calendar/v1?days=7&impact=all';
const CHECKS=[
  {name:'home',url:BASE+'/',kind:'html'},
  {name:'news',url:BASE+'/api/news?mode=fast&limit=8',kind:'json'},
  {name:'markets',url:BASE+'/api/markets',kind:'json'},
  {name:'calendar',url:CALENDAR,kind:'json'},
  {name:'metalsHistory',url:BASE+'/api/metals-history',kind:'json'},
  {name:'ownerPage',url:BASE+'/owner-health',kind:'private'},
  {name:'ownerApi',url:BASE+'/owner-health/api',kind:'private'}
];

export function isOwnerRouteLocked(status,location='',origin=BASE){
  if(status===403)return true;
  if(status<300||status>=400)return false;
  try{
    const target=new URL(location,origin);
    return (target.protocol==='https:'&&target.hostname.endsWith('.cloudflareaccess.com'))
      ||(target.origin===new URL(origin).origin&&target.pathname.startsWith('/cdn-cgi/access/'));
  }catch{return false;}
}

export function analyzeReadings(raw,now=Date.now()){
  const readings=Object.fromEntries((Array.isArray(raw)?raw:[]).map(row=>[row.name,row]));
  const issues=[];
  const add=(severity,service,message)=>issues.push({severity,service,message});
  const usable=r=>r && r.status>=200 && r.status<300 && r.data && typeof r.data==='object';
  const home=readings.home;
  if(!home || !(home.status>=200&&home.status<300) || !home.isHtml){
    add('critical','home','Public homepage is unavailable or is not the HAWAL page');
  }
  for(const name of ['ownerPage','ownerApi']){
    const owner=readings[name];
    if(!owner || !isOwnerRouteLocked(owner.status,owner.location)){
      add('critical',name,'Anonymous access was not denied (possible owner-only privacy incident)');
    }
  }
  const news=readings.news;
  if(!usable(news) || !Array.isArray(news.data.items) || !news.data.feedStats){
    add('critical','news','News feed API failed or returned an invalid payload');
  }else{
    const stats=news.data.feedStats;
    if(stats.requested>0 && stats.succeeded===0)
      add('critical','news','All checked news feed sources failed');
    else if(stats.requested>=3 && stats.failed>=Math.ceil(stats.requested*.8))
      add('warning','news','Most checked news sources failed');
    // A quiet source with zero recent relevant news is not by itself a failure.
  }
  const markets=readings.markets;
  if(!usable(markets) || !Array.isArray(markets.data.items)){
    add('critical','markets','Market quotes API failed or returned an invalid payload');
  }else{
    const symbols=['USD/IQD','XAU/USD','XAG/USD'];
    const quotes=markets.data.items.filter(item=>symbols.includes(item?.symbol));
    const have=quotes.filter(item=>typeof item.price==='number'&&Number.isFinite(item.price)&&item.price>0);
    if(!have.length)add('critical','markets','USD/IQD, gold and silver prices are all unavailable');
    else if(have.length<symbols.length)add('warning','markets','One or more major currency or metals quotes are unavailable');
    // A stale last-good quote is not described as live, but a closed market
    // or a scheduled gap should not page the owner every quarter hour.
  }
  const calendar=readings.calendar;
  if(!usable(calendar) || !Array.isArray(calendar.data.events)){
    add('warning','calendar','Economic calendar provider is unavailable');
  }else{
    const generated=Date.parse(calendar.data.generated_at||'');
    if(Number.isFinite(generated) && now-generated>4*3600000)
      add('warning','calendar','Calendar source publication is older than four hours');
  }
  const metals=readings.metalsHistory;
  if(!usable(metals) || !Array.isArray(metals.data.items)){
    add('warning','metalsHistory','Historical precious metals data provider is unavailable');
  }else if(!metals.data.items.some(item=>Array.isArray(item.points)&&item.points.length>=2)){
    add('warning','metalsHistory','No source-recorded metals history could be verified');
  }
  const critical=issues.filter(issue=>issue.severity==='critical');
  const warning=issues.filter(issue=>issue.severity==='warning');
  return {
    status:critical.length?'critical':warning.length?'degraded':'healthy',
    checkedAt:new Date(now).toISOString(),
    criticalCount:critical.length,
    warningCount:warning.length,
    issues,
    // Public data only; no owner email, private report or auth token.
    checks:Object.fromEntries(CHECKS.map(check=>{
      const row=readings[check.name];
      return [check.name,{
        status:row?.status??null,
        ok:check.kind==='private'?Boolean(row&&isOwnerRouteLocked(row.status,row.location)):Boolean(row?.status>=200&&row.status<300)
      }];
    }))
  };
}

export async function readEndpoint(check,fetchImpl=fetch){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('Health probe timeout'),22000);
  try{
    const response=await fetchImpl(check.url,{
      method:'GET',redirect:'manual',cache:'no-store',
      headers:{'Accept':check.kind==='html'?'text/html':check.kind==='private'?'*/*':'application/json',
        'User-Agent':'HAWAL-Owner-Uptime/1.0'},
      signal:controller.signal
    });
    const status=response.status;
    const location=response.headers.get('location')||'';
    if(check.kind==='private')return {name:check.name,status,location};
    if(check.kind==='html'){
      const type=response.headers.get('content-type')||'';
      const body=await response.text();
      return {name:check.name,status,isHtml:type.includes('text/html')&&body.includes('id="root"')};
    }
    if(status<200||status>=300)return {name:check.name,status};
    return {name:check.name,status,data:await response.json()};
  }catch{return {name:check.name,status:null};}
  finally{clearTimeout(timer);}
}

export async function runWatch({fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now()}={}){
  let readings=await Promise.all(CHECKS.map(check=>readEndpoint(check,fetchImpl)));
  let report=analyzeReadings(readings,now);
  // Avoid false critical incidents from a transient Cloudflare cold start.
  // Privacy exposure, however, is immediately re-tested (and never ignored).
  if(report.criticalCount){
    await sleep(1500);
    const criticalNames=new Set(report.issues.filter(issue=>issue.severity==='critical').map(issue=>issue.service));
    const updated=await Promise.all(CHECKS.filter(check=>criticalNames.has(check.name))
      .map(check=>readEndpoint(check,fetchImpl)));
    const recovered=new Map(updated.map(row=>[row.name,row]));
    readings=readings.map(row=>recovered.get(row.name)||row);
    report=analyzeReadings(readings,now);
  }
  return report;
}
export function formatWatchSummary(report){
  const details=report.issues.map(issue=>'- '+issue.severity.toUpperCase()+' '+issue.service+': '+issue.message).join('\n');
  return 'HAWAL owner uptime watch — '+report.checkedAt+'\nStatus: '+report.status+
    ' | critical: '+report.criticalCount+' | warning: '+report.warningCount+
    '\n'+(details||'No major availability or owner-access issues detected')+
    '\nThe public-source watch never fetches authenticated dashboard data.';
}

if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const report=await runWatch();
  const summary=formatWatchSummary(report);
  // Output contains only health of public URLs and unauthenticated private paths.
  process.stdout.write(summary+'\n');
  if(process.env.GITHUB_STEP_SUMMARY){
    const {appendFileSync}=await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
  }
  if(report.criticalCount)process.exitCode=1;
}

// Read-only public GitHub Actions metadata, exposed ONLY after owner JWT verification.
// No email, Access JWT, authenticated report, secret or public incident database.
const BASE_URL='https://api.github.com/repos/hama210/hawaly.abury/actions/workflows/owner-health-watch.yml/runs';
const WATCH_URL='https://github.com/hama210/hawaly.abury/actions/workflows/owner-health-watch.yml';
const EVENTS=new Set(['schedule','workflow_dispatch','push']);
const FAILED=new Set(['failure','timed_out','action_required']);
const MAX_PAGES=3;
const PAGE_SIZE=100;
const LIMIT=20;

function validRun(run){
  if(!run||!EVENTS.has(run.event))return false;
  if(!['queued','in_progress','completed'].includes(run.status))return false;
  return Number.isFinite(Date.parse(run.created_at||''));
}
function orderedRuns(payload){
  return (Array.isArray(payload?.workflow_runs)?payload.workflow_runs:[])
    .filter(validRun)
    .sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
}
function emptyHistory(){
  return {status:'ready',incidents:[],runsExamined:0,coverageStart:null,coverageEnd:null,
    complete:false,note:'GitHub history is limited to recent workflow runs, not permanent storage'};
}

// Each failed GitHub check is a monitor failure (site outage OR runner error).
// Never label it a confirmed live website outage without checking its logs.
export function summarizeIncidentHistory(payload,now=Date.now(),complete=false){
  const runs=orderedRuns(payload).filter(run=>run.status==='completed');
  const history=emptyHistory();
  history.runsExamined=runs.length;
  history.complete=Boolean(complete);
  if(!runs.length)return history;
  history.coverageStart=runs[0].created_at;
  history.coverageEnd=runs.at(-1).created_at;
  const incidents=[];
  let current=null;
  for(const run of runs){
    if(FAILED.has(run.conclusion)){
      if(!current){
        current={id:String(run.id||run.created_at),status:'ongoing',
          startedAt:run.created_at,lastFailedAt:run.created_at,
          resolvedAt:null,failedChecks:0,
          url:typeof run.html_url==='string'&&run.html_url.startsWith('https://github.com/hama210/hawaly.abury/actions/runs/')?
            run.html_url:WATCH_URL};
      }
      current.failedChecks++;
      current.lastFailedAt=run.created_at;
    }else if(run.conclusion==='success'&&current){
      current.status='resolved';
      current.resolvedAt=run.created_at;
      incidents.push(current);
      current=null;
    }
    // cancelled, skipped, neutral or still running does not confirm recovery.
  }
  if(current)incidents.push(current);
  history.incidents=incidents.reverse().slice(0,LIMIT).map(incident=>{
    const from=Date.parse(incident.startedAt);
    const until=Date.parse(incident.resolvedAt||new Date(now).toISOString());
    return {...incident,durationMinutes:Number.isFinite(until)&&until>=from?
      Math.round((until-from)/60000):null};
  });
  return history;
}

export function summarizeBackgroundRuns(payload,now=Date.now()){
  const candidates=orderedRuns(payload).reverse();
  const latest=candidates[0];
  if(!latest)return {status:'not-started',lastCheckedAt:null,conclusion:null,trigger:null,url:WATCH_URL};
  const at=latest.created_at;
  const isLate=now-Date.parse(at)>65*60000 || Date.parse(at)>now+300000;
  return {
    status:isLate?'overdue':latest.status==='completed'?(latest.conclusion==='success'?'healthy':'failed'):'running',
    lastCheckedAt:at,
    conclusion:latest.status==='completed'?latest.conclusion:null,
    trigger:latest.event,
    url:WATCH_URL
  };
}
export async function getOwnerBackgroundStatus(fetchImpl=fetch,now=Date.now()){
  const records=[];
  let complete=false;
  let received=false;
  try{
    // Paginate only as needed; Github provides at most 100 runs per request.
    // 300 recent checks cover about 3 days at a planned 15-minute cadence.
    for(let page=1;page<=MAX_PAGES;page++){
      const response=await fetchImpl(BASE_URL+'?per_page='+PAGE_SIZE+'&page='+page,{
        headers:{Accept:'application/vnd.github+json','User-Agent':'HAWAL-Owner-Uptime/1.0'},
        signal:AbortSignal.timeout(5500),cf:{cacheTtl:300}
      });
      if(!response.ok)throw Error('GitHub returned HTTP '+response.status);
      const payload=await response.json();
      if(!Array.isArray(payload?.workflow_runs))throw Error('GitHub invalid response');
      received=true;
      records.push(...payload.workflow_runs);
      if(payload.workflow_runs.length<PAGE_SIZE){complete=true;break;}
    }
  }catch{
    if(!received){
      return {status:'unknown',lastCheckedAt:null,conclusion:null,trigger:null,url:WATCH_URL,
        history:{...emptyHistory(),status:'unavailable'}};
    }
    // Partial history is visibly labelled; never claim full coverage.
  }
  const seen=new Set();
  const deduped=records.filter(run=>{
    const key=String(run.id||[run.created_at,run.event,run.conclusion].join('|'));
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
  const payload={workflow_runs:deduped};
  return {...summarizeBackgroundRuns(payload,now),
    history:summarizeIncidentHistory(payload,now,complete)};
}

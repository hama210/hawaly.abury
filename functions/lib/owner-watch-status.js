// Read-only metadata about GitHub's public scheduled workflow.
// Called exclusively after the Cloudflare Access owner JWT is verified.
// This does not expose an owner email, token, private health report or secret.
const URL='https://api.github.com/repos/hama210/hawaly.abury/actions/workflows/owner-health-watch.yml/runs?per_page=8';
const WATCH_URL='https://github.com/hama210/hawaly.abury/actions/workflows/owner-health-watch.yml';

export function summarizeBackgroundRuns(payload,now=Date.now()){
  const runs=Array.isArray(payload?.workflow_runs)?payload.workflow_runs:[];
  const candidates=runs.filter(run=>run?.event==='schedule'||run?.event==='workflow_dispatch'||run?.event==='push')
    .filter(run=>run?.status==='completed'||run?.status==='in_progress'||run?.status==='queued')
    .sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
  const latest=candidates[0];
  if(!latest)return {status:'not-started',lastCheckedAt:null,conclusion:null,trigger:null,url:WATCH_URL};
  const at=typeof latest.created_at==='string'&&Number.isFinite(Date.parse(latest.created_at))?latest.created_at:null;
  const isLate=!at||now-Date.parse(at)>65*60000;
  return {
    status:isLate?'overdue':latest.status==='completed'?(latest.conclusion==='success'?'healthy':'failed'):'running',
    lastCheckedAt:at,
    conclusion:latest.status==='completed'?latest.conclusion:null,
    trigger:latest.event,
    url:WATCH_URL
  };
}
export async function getOwnerBackgroundStatus(fetchImpl=fetch,now=Date.now()){
  try{
    const response=await fetchImpl(URL,{headers:{Accept:'application/vnd.github+json','User-Agent':'HAWAL-Owner-Uptime/1.0'},
      signal:AbortSignal.timeout(5500),cf:{cacheTtl:300}});
    if(!response.ok)throw new Error('GitHub unavailable');
    return summarizeBackgroundRuns(await response.json(),now);
  }catch{
    return {status:'unknown',lastCheckedAt:null,conclusion:null,trigger:null,url:WATCH_URL};
  }
}

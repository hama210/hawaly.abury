// Live, read-only HAWAL news/translation probe run from GitHub Actions.
// It does not access authenticated owner paths, collect private data, or log article bodies.
// Use only fixed public samples for translation tests; no tokens or API keys.
const BASE='https://hawaly-aburyy.pages.dev';
const UA='HAWAL-News-Diagnostics/1.0 (https://hawaly-aburyy.pages.dev)';
const HEADERS={'User-Agent':UA,'Accept':'application/json'};
const MAX_NEWS_BATCHES=5;
async function request(path,{method='GET',body,timeout=18000}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(BASE+path,{method,headers:body?{...HEADERS,'Content-Type':'application/json'}:HEADERS,
      body:body?JSON.stringify(body):undefined,redirect:'manual',cache:'no-store',signal:controller.signal});
    const type=response.headers.get('content-type')||'';
    let data=null;
    if(type.includes('json'))data=await response.json().catch(()=>null);
    return {status:response.status,data,type};
  }catch(error){return {status:null,error:error?.name==='AbortError'?'timeout':'network-error'};}
  finally{clearTimeout(timer);}
}
function summarizeNews(data,origin){
  if(!data || !Array.isArray(data.items)||!data.feedStats)
    return {origin,ok:false,error:'invalid-news-response'};
  const stats=data.feedStats;
  return {origin,ok:true,items:data.items.length,requested:stats.requested,
    succeeded:stats.succeeded,failed:stats.failed,
    sourceStatuses:Array.isArray(stats.sources)?stats.sources.map(s=>({
      name:s.source,status:s.status,via:s.via||'',
      reason:s.reason||'',articles:s.articles
    })):[]};
}
function summarizeTranslation(data){
  const flags=Array.isArray(data?.translatedFlags)?data.translatedFlags:[];
  return {ok:data?.ok===true && flags.length===2 && flags.every(Boolean),
    flags,providers:Array.isArray(data?.sources)?data.sources:[],
    failureReasons:Array.isArray(data?.failureReasons)?data.failureReasons:[]};
}
async function main(){
  const startedAt=new Date().toISOString();
  const [health,status,ku,ar,fast]=await Promise.all([
    request('/api/translation-health'),
    request('/api/translation-status'),
    request('/api/translate',{method:'POST',body:{lang:'ku',texts:[
      'Gold prices fell in Baghdad today.','Iraq banks discussed foreign exchange rates today.']}}),
    request('/api/translate',{method:'POST',body:{lang:'ar',texts:[
      'Gold prices fell in Baghdad today.','Iraq banks discussed foreign exchange rates today.']}}),
    request('/api/news?mode=fast&limit=12',{timeout:26000})
  ]);
  const summary={startedAt,
    health:{http:health.status,ok:health.data?.ok===true,provider:health.data?.provider||null,
      failure:health.data?.failure||health.error||null},
    status:{http:status.status,configured:status.data?.preferredProvider||'unknown'},
    ku:{http:ku.status,...summarizeTranslation(ku.data)},
    ar:{http:ar.status,...summarizeTranslation(ar.data)},
    fast:{http:fast.status,...summarizeNews(fast.data,'fast')},
    full:[]};
  const batchCount=Math.min(MAX_NEWS_BATCHES,Math.max(0,Number(fast.data?.batchCount)||0));
  if(batchCount) {
    const results=await Promise.all(Array.from({length:batchCount},(_,index)=>
      request('/api/news?mode=full&batch='+index+'&limit=16',{timeout:35000})));
    summary.full=results.map((result,index)=>({http:result.status,
      ...summarizeNews(result.data,'batch-'+index)}));
  }
  const statusCount={};
  const anomalies=[];
  for(const row of [summary.fast,...summary.full]){
    for(const source of row.sourceStatuses||[]){
      statusCount[source.status]=(statusCount[source.status]||0)+1;
      if(source.status!=='active')anomalies.push({...source,batch:row.origin});
    }
  }
  summary.aggregate={sourceCheckCounts:statusCount,
    quietSources:anomalies.filter(s=>s.status==='quiet'),
    failedSources:anomalies.filter(s=>s.status==='failed')};
  process.stdout.write('HAWAL NEWS / TRANSLATION REAL-LIVE DIAGNOSTIC (public endpoints only)\n');
  // Only status information, not copyrighted publisher content or personal data.
  process.stdout.write(JSON.stringify(summary,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY){
    const {appendFileSync}=await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### Live HAWAL news & translation\n'+
      '- Kurdish: '+(summary.ku.ok?'working':'needs attention')+' ('+summary.ku.providers.join(',')+')\n'+
      '- Arabic: '+(summary.ar.ok?'working':'needs attention')+' ('+summary.ar.providers.join(',')+')\n'+
      '- News source checks: '+JSON.stringify(statusCount)+'\n');
  }
}
await main();

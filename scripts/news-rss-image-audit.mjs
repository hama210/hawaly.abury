// Read-only production audit of HAWAL RSS timings and published image URLs.
// No owner routes, Google Translation, secrets, article-body scraping, or TinyFish.
const BASE = 'https://hawaly-aburyy.pages.dev';
const USER_AGENT = 'HAWAL-News-RSS-Images-Audit/1.0';
const TIMEOUT = 35000;
const abortable = (ms) => AbortSignal.timeout(ms);

async function api(path){
 const at=Date.now();
 try{
   const res=await fetch(BASE+path,{headers:{Accept:'application/json','User-Agent':USER_AGENT},
     redirect:'manual',cache:'no-store',signal:abortable(TIMEOUT)});
   if(!res.ok)return {path,status:res.status,ok:false,ms:Date.now()-at};
   const data=await res.json();
   return {path,status:res.status,ok:true,ms:Date.now()-at,data};
 }catch(e){return {path,status:null,ok:false,ms:Date.now()-at,error:e?.name==='TimeoutError'?'timeout':'network-error'};}
}
function imageKind(item){
 if(item?.imageSource==='illustration'||/^\/news-covers\//.test(item?.image||''))return 'no-publisher-image';
 let url;
 try{url=new URL(item?.image);}catch{return 'invalid-publisher-image';}
 if(!['http:','https:'].includes(url.protocol))return 'invalid-publisher-image';
 return 'publisher-image';
}
const sourceName = item => String(item.sourceGroup||item.source||'unspecified').slice(0,70);
async function probe(url){
 const at=Date.now();
 try{
  const res=await fetch(url,{method:'GET',redirect:'manual',cache:'no-store',
    headers:{Accept:'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8',Range:'bytes=0-1023','User-Agent':USER_AGENT},
    signal:abortable(11000)});
  const type=(res.headers.get('content-type')||'').split(';')[0];
  try{await res.body?.cancel();}catch{}
  const ok=(res.status===200||res.status===206)&&type.startsWith('image/');
  return {ok,status:res.status,type:type.slice(0,40),ms:Date.now()-at};
 }catch(e){return {ok:false,status:null,type:'',ms:Date.now()-at,error:e?.name==='TimeoutError'?'timeout':'network-error'};}
}
function backendFor(item){
 const raw=String(item.image||'');
 if(imageKind(item)!=='publisher-image'){
  let u;
  try{u=new URL(item.link);}catch{return null;}
  const allowed=['bbc.com','theguardian.com','shafaq.com','aljazeera.com','marketwatch.com','cnbc.com','fxstreet.com','federalreserve.gov'];
  if(!allowed.some(x=>u.hostname===x||u.hostname.endsWith('.'+x)))return null;
  return '/api/article-image?article='+encodeURIComponent(item.link)+'&category='+encodeURIComponent(item.category||'markets');
 }
 let u;
 try{u=new URL(raw);}catch{return null;}
 // Only known publisher CDN hosts have a same-origin image proxy.
 const proxy=['images.mktw.net','media.shafaq.com','i.iranintl.com','ichef.bbci.co.uk',
  'd1ldvf68ux039x.cloudfront.net','cdn.sanity.io','static.aljazeera.net',
  'www.aljazeera.com','media.guim.co.uk','i.guim.co.uk'];
 if(proxy.includes(u.hostname))return '/api/news-image?src='+encodeURIComponent(raw);
 // FXStreet's editorial image CDN is currently loaded directly by browsers.
 // Probe only this exact public host (never arbitrary URLs from an RSS feed).
 if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
    u.hostname==='editorial.fxsstatic.com')return raw;
 return null;
}
const batches=await Promise.all([
 api('/api/news?mode=fast&limit=60&refresh=1'),
 ...[0,1,2].map(b=>api('/api/news?mode=full&batch='+b+'&limit=40&refresh=1'))
]);
const sources=new Map(),articles=new Map();
for(const entry of batches){
 for(const s of entry.data?.feedStats?.sources||[]){
   const id=s.source;
   const prev=sources.get(id)||{source:id,observations:0,statuses:[],maxMs:0,totalMs:0,failures:[]};
   prev.observations++; prev.statuses.push(s.status);
   prev.maxMs=Math.max(prev.maxMs,Number(s.durationMs)||0);
   prev.totalMs+=Number(s.durationMs)||0;
   if(s.reason)prev.failures.push(String(s.reason).slice(0,80));
   sources.set(id,prev);
 }
 for(const item of entry.data?.items||[]){
   const key=String(item.id||item.title);
   if(!articles.has(key))articles.set(key,item);
 }
}
const allArticles=[...articles.values()];
const counts={};
for(const item of allArticles){const kind=imageKind(item);counts[kind]=(counts[kind]||0)+1;}
const byHost={};
for(const item of allArticles.filter(i=>imageKind(i)==='publisher-image')){
 try{const host=new URL(item.image).hostname;byHost[host]=(byHost[host]||0)+1;}catch{}
}
const candidates=new Map();
for(const item of allArticles){
 const url=backendFor(item);
 if(!url)continue;
 // Sample unique source and route combinations; no credentials, no arbitrary links.
 const key=sourceName(item)+'/'+url.split('?')[0];
 if(!candidates.has(key))candidates.set(key,{source:sourceName(item),url,kind:imageKind(item)});
}
// Always include Guardian's i.guim.co.uk proxy in the sample when present.
const allCandidates=[...candidates.values()];
const guardian=allCandidates.filter(test=>test.kind==='publisher-image'&&test.url.includes('i.guim.co.uk'));
const chosen=[...guardian,...allCandidates.filter(test=>!guardian.includes(test))].slice(0,14);
const results=await Promise.all(chosen.map(async test=>({...test,url:undefined,
  endpoint:test.url.startsWith('https://')?'publisher-direct:'+new URL(test.url).hostname:test.url.split('?')[0],
  ...await probe(test.url.startsWith('https://')?test.url:BASE+test.url)})));
const slow=[...sources.values()].map(s=>({source:s.source,observations:s.observations,
   status:s.statuses,avgMs:Math.round(s.totalMs/s.observations),maxMs:s.maxMs,
   failures:s.failures.slice(0,2)})).sort((a,b)=>b.maxMs-a.maxMs);
const summary={at:new Date().toISOString(),
 batches:batches.map(b=>({path:b.path,ok:b.ok,status:b.status,ms:b.ms,
   articles:b.data?.items?.length||0,feedRequested:b.data?.feedStats?.requested,
   feedActive:b.data?.feedStats?.succeeded,feedUnusable:b.data?.feedStats?.failed})),
 uniqueSources:sources.size,uniqueArticles:allArticles.length,imageCounts:counts,
 imageHosts:byHost,probeCount:results.length,imageChecks:results,slowSources:slow.slice(0,33),
 quietSources:slow.filter(x=>x.status.every(t=>t==='quiet')).map(x=>x.source)};
console.log('HAWAL RSS / IMAGE LIVE AUDIT');
console.log(JSON.stringify(summary,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
 const fs=await import('node:fs');
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '### HAWAL RSS & image audit\n'+
  '- News articles sampled: '+allArticles.length+'; publisher photos: '+(counts['publisher-image']||0)+
  '; no-publisher-image: '+(counts['no-publisher-image']||0)+'\n'+
  '- Image checks: '+results.filter(r=>r.ok).length+'/'+results.length+' valid\n'+
  '- Slowest feeds: '+slow.slice(0,8).map(s=>s.source+' ('+s.maxMs+' ms)').join(', ')+'\n');
}
if(batches.every(b=>!b.ok))process.exitCode=1;

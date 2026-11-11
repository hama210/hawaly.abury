// Read-only public live audit of HAWAL, run from a GitHub Actions runner.
// Does not make financial claims or fabricate availability on failure.
const BASE = process.env.HAWAL_SITE_URL || 'https://hawaly-aburyy.pages.dev';
const checks = [
  ['/', 'html'],
  ['/ar/', 'html'],
  ['/en/', 'html'],
  ['/metals', 'metals'],
  ['/ar/metals', 'metals'],
  ['/en/metals', 'metals'],
  ['/calendar', 'calendar'],
  ['/ar/calendar', 'calendar'],
  ['/en/calendar', 'calendar'],
  ['/about', 'html'],
  ['/contact', 'html'],
  ['/data/economic-calendar-history.json', 'archive'],
  ['/api/news?mode=fast&limit=5', 'news'],
  ['/api/markets', 'markets'],
  ['/api/metals-history', 'metals-history'],
  ['/api/translation-status', 'translation'],
  ['/sw.js', 'worker']
];

async function inspect([path, kind]) {
  const url = new URL(path,BASE);
  let status = null;
  try {
    const res = await fetch(url,{
      cache:'no-store',
      headers:{ Accept: kind==='html'||kind==='calendar'||kind==='metals' ? 'text/html' : '*/*', 'User-Agent':'HawalWebsiteAudit/1.0' },
      signal:AbortSignal.timeout(15000)
    });
    status = res.status;
    const type = res.headers.get('content-type') || '';
    const body = await res.text();
    if (!res.ok) return {path,kind,status,ok:false,reason:'HTTP '+status};
    if (kind === 'html' || kind === 'calendar' || kind === 'metals') {
      if (!type.includes('text/html') || !body.includes('id="root"'))
        return {path,kind,status,ok:false,reason:'Expected React HTML shell'};
      const locale = path.startsWith('/ar/') ? 'ar' : path.startsWith('/en/') ? 'en' : 'ckb';
      const langOk = body.includes('lang="'+locale+'"');
      const metalsOk = kind !== 'metals' || (body.includes('GC=F') && body.includes('SI=F'));
      if (!metalsOk) return {path,kind,status,ok:false,reason:'Metals metadata not deployed'};
      return {path,kind,status,ok:true,bytes:body.length,locale:langOk?'verified':'not verifiable from response',edgeVersion:res.headers.get('X-Hawall-Version')};
    }
    if (kind === 'worker') {
      return {path,kind,status,ok:true,cacheFix:body.includes("url.pathname.startsWith('/data/')")?'present':'not published'};
    }
    const data=JSON.parse(body);
    if (kind === 'archive') {
      if (!Array.isArray(data.events)) throw new Error('Archive missing events array');
      return {path,kind,status,ok:true,eventCount:data.events.length,updatedAt:data.updatedAt||null};
    }
    if (kind === 'metals-history') {
      if (!Array.isArray(data.items)) throw new Error('Metals history missing items');
      const counts=Object.fromEntries(data.items.map(item=>[item.symbol,Array.isArray(item.points)?item.points.length:0]));
      const found=counts['XAU/USD']>=2 && counts['XAG/USD']>=2;
      return {path,kind,status,ok:found,counts,...(!found?{reason:'Real gold or silver history missing'}:{})};
    }
    if (kind === 'news'||kind === 'markets') {
      if (!Array.isArray(data.items)) throw new Error(kind+' API missing items array');
      if (kind === 'news' && path.includes('limit=5') && data.items.length > 5) {
        return {path,kind,status,ok:false,itemCount:data.items.length,reason:'News API exceeded the requested 5-item limit'};
      }
      return {path,kind,status,ok:true,itemCount:data.items.length};
    }
    return {path,kind,status,ok:true,provider:data?.provider??null,configured:data?.configured??null};
  } catch(error) {
    return {path,kind,status,ok:false,reason:String(error?.message||error).slice(0,200)};
  }
}

let results = [];
for (const check of checks) {
  const result = await inspect(check);
  results.push(result);
  console.log(JSON.stringify(result));
}
// Cold starts can produce an initial timeout while subsequent requests work.
// Retry once and retain that fact in the published evidence instead of claiming
// the site is permanently unavailable or silently ignoring a timeout.
for (const index of results.map((value,index)=>({value,index})).filter(({value})=>!value.ok && (value.path==='/' || value.path==='/ar/' || value.kind==='metals' || value.kind==='metals-history')).map(({index})=>index)) {
  const retry = await inspect(checks[index]);
  if (retry.ok) results[index] = {...retry,recoveredAfterInitialTimeout:true};
  console.log(JSON.stringify({retryOf:checks[index][0],...retry}));
}

// The master-branch audit also checks whether Cloudflare has actually
// published the changed edge function AND the refreshed service worker.
if (process.env.GITHUB_REF === 'refs/heads/master') {
  let published = false;
  for (let attempt=1;attempt<=8;attempt++) {
    const worker = await inspect(['/sw.js','worker']);
    const home = await inspect(['/','html']);
    published = worker.cacheFix === 'present' && home.edgeVersion === '2026-11-11-ssr-budget-v3';
    console.log(JSON.stringify({deployAttempt:attempt,cacheFix:worker.cacheFix||null,edgeVersion:home.edgeVersion||null,published}));
    if (published) break;
    if (attempt<8) await new Promise(resolve=>setTimeout(resolve,12000));
  }
  results.push({path:'deployment-revision',kind:'deploy',ok:published,...(!published?{reason:'Updated Cloudflare edge and service worker could not be verified'}:{})});
}

const failures=results.filter(result=>!result.ok);
console.log(JSON.stringify({total:results.length,passed:results.length-failures.length,failed:failures.length}));
if (failures.length) process.exitCode=1;

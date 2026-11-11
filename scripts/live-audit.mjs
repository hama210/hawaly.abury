// Read-only public live audit of HAWAL, run from a GitHub Actions runner.
// Does not make financial claims or fabricate availability on failure.
const BASE = process.env.HAWAL_SITE_URL || 'https://hawaly-aburyy.pages.dev';
const checks = [
  ['/', 'html'],
  ['/ar/', 'html'],
  ['/en/', 'html'],
  ['/calendar', 'calendar'],
  ['/ar/calendar', 'calendar'],
  ['/en/calendar', 'calendar'],
  ['/about', 'html'],
  ['/contact', 'html'],
  ['/data/economic-calendar-history.json', 'archive'],
  ['/api/news?mode=fast&limit=5', 'news'],
  ['/api/markets', 'markets'],
  ['/api/translation-status', 'translation'],
  ['/sw.js', 'worker']
];

async function inspect([path, kind]) {
  const url = new URL(path,BASE);
  let status = null;
  try {
    const res = await fetch(url,{
      cache:'no-store',
      headers:{ Accept: kind==='html'||kind==='calendar' ? 'text/html' : '*/*', 'User-Agent':'HawalWebsiteAudit/1.0' },
      signal:AbortSignal.timeout(15000)
    });
    status = res.status;
    const type = res.headers.get('content-type') || '';
    const body = await res.text();
    if (!res.ok) return {path,kind,status,ok:false,reason:'HTTP '+status};
    if (kind === 'html' || kind === 'calendar') {
      if (!type.includes('text/html') || !body.includes('id="root"'))
        return {path,kind,status,ok:false,reason:'Expected React HTML shell'};
      const locale = path.startsWith('/ar/') ? 'ar' : path.startsWith('/en/') ? 'en' : 'ckb';
      const langOk = body.includes('lang="'+locale+'"');
      return {path,kind,status,ok:true,bytes:body.length,locale:langOk?'verified':'not verifiable from response'};
    }
    if (kind === 'worker') {
      return {path,kind,status,ok:true,cacheFix:body.includes("url.pathname.startsWith('/data/')")?'present':'not published'};
    }
    const data=JSON.parse(body);
    if (kind === 'archive') {
      if (!Array.isArray(data.events)) throw new Error('Archive missing events array');
      return {path,kind,status,ok:true,eventCount:data.events.length,updatedAt:data.updatedAt||null};
    }
    if (kind === 'news'||kind === 'markets') {
      if (!Array.isArray(data.items)) throw new Error(kind+' API missing items array');
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
const failures=results.filter(result=>!result.ok);
console.log(JSON.stringify({total:results.length,passed:results.length-failures.length,failed:failures.length}));
if (failures.length) process.exitCode=1;

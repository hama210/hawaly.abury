// Public, read-only USD/IQD provenance audit. No owner routes, secrets, or translations.
const urls={
 hawal:'https://hawaly-aburyy.pages.dev/api/markets',
 cbi:'https://cbi.iq/',
 shafaq:'https://shafaq.com/rss/en/Economy',
 xeiqd:'https://xeiqd.com/en',
 alanchand:'https://alanchand.com/en/exchange-rates/usd-iqd'
};
async function get(label,url){
 const at=Date.now();
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(14000),cache:'no-store',
    headers:{'User-Agent':'HAWAL-Public-Market-Audit/1.0',Accept:'text/html,application/json,application/rss+xml'}});
  const body=await response.text();
  return {label,http:response.status,contentType:response.headers.get('content-type'),
    ms:Date.now()-at,body:body.slice(0,900000)};
 }catch(e){return {label,http:null,error:e?.name==='TimeoutError'?'timeout':'network-error',ms:Date.now()-at,body:''};}
}
const results=await Promise.all(Object.entries(urls).map(([label,url])=>get(label,url)));
const json=results.find(x=>x.label==='hawal');let data;
try{data=JSON.parse(json?.body||'{}')}catch{}
const liveRows=(data?.items||[]).filter(i=>i.symbol==='USD/IQD'||i.symbol==='CBI USD/IQD').map(i=>({
 symbol:i.symbol,price:i.price,marketKind:i.marketKind,quoteCity:i.quoteCity,
 erbil:i.erbil,baghdad:i.baghdad,sulaymaniyah:i.sulaymaniyah,
 source:i.source,sourceUrl:i.sourceUrl,updatedAt:i.updatedAt,
 fetchedAt:i.fetchedAt,lastLiveAt:i.lastLiveAt,dataStatus:i.dataStatus
}));
const cbi=results.find(x=>x.label==='cbi')?.body||'';
const cbiTable=[...cbi.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
 .map(x=>x[0].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim())
 .filter(x=>/\bUSD\b/i.test(x)).slice(0,4).map(x=>x.slice(0,200));
const xeiqd=results.find(x=>x.label==='xeiqd')?.body||'';
const around=(text,term,range=500)=>{const i=text.toLowerCase().indexOf(term.toLowerCase());return i<0?null:text.slice(Math.max(0,i-130),i+range).replace(/\s+/g,' ').slice(0,range+130);};
const shafaq=results.find(x=>x.label==='shafaq')?.body||'';
const shafaqItems=[...shafaq.matchAll(/<item>[\s\S]*?<\/item>/gi)].slice(0,50)
 .map(x=>x[0]).filter(x=>/(?:dollar|USD|exchange rate)/i.test(x)).slice(0,4)
 .map(item=>({title:around(item,'<title>',175),time:around(item,'<pubDate>',100)}));
const alan=results.find(x=>x.label==='alanchand')?.body||'';
const report={asOf:new Date().toISOString(),
  hosts:results.map(x=>({source:x.label,http:x.http,contentType:x.contentType,ms:x.ms,length:x.body.length,error:x.error||null})),
  hawal:{status:data?.dataStatus,updatedAt:data?.updatedAt,failures:(data?.failures||[]).filter(x=>x.symbol==='USD/IQD'||x.symbol==='CBI USD/IQD'),rows:liveRows},
  cbiUsdRows:cbiTable,
  shafaqRateHeadlines:shafaqItems,
  xeiqdSample:{sulaymaniyah:around(xeiqd,'Slemani'),sula:around(xeiqd,'Sulaymaniyah'),
    erbil:around(xeiqd,'Erbil'),baghdad:around(xeiqd,'Baghdad'),
    updated:around(xeiqd,'Last updated'),json:around(xeiqd,'application/ld+json')},
  alanchandSample:{rate:around(alan,'inputCalcValue'),today:around(alan,'today,')}
};
console.log('HAWAL PUBLIC USD/IQD AUDIT');
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
 const fs=await import('node:fs');
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '### USD/IQD and CBI public provenance\n'+
  '- Local market: '+(liveRows.find(x=>x.symbol==='USD/IQD')?.source||'unavailable')+'\n'+
  '- CBI: '+(liveRows.find(x=>x.symbol==='CBI USD/IQD')?.source||'unavailable')+'\n'+
  '- Sources: '+results.map(x=>x.label+': '+x.http).join(', ')+'\n');
}
if(json?.http!==200||!data?.items)process.exitCode=1;

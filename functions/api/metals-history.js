// Source-backed daily futures observations. No price estimates or synthetic bars.
// Gold GC=F and silver SI=F match the existing Yahoo Finance market quote feed.
const HISTORY_SOURCE='Yahoo Finance';
const PAIRS=[{symbol:'XAU/USD',yahooSymbol:'GC=F'},{symbol:'XAG/USD',yahooSymbol:'SI=F'}];
const MAX_AGE_MS=36*86400000;

export function parseYahooMetalChart(payload,symbol,now=Date.now()) {
  const chart=payload?.chart;
  if(chart?.error)throw new Error('Yahoo chart reported an error');
  const result=chart?.result?.[0];
  const stamps=result?.timestamp;
  const closes=result?.indicators?.quote?.[0]?.close;
  if(!Array.isArray(stamps)||!Array.isArray(closes))throw new Error('No Yahoo daily quotes');
  const seen=new Map();
  for(let i=0;i<Math.min(stamps.length,closes.length);i++){
    const unix=Number(stamps[i]),price=closes[i];
    const at=unix*1000;
    if(!Number.isFinite(at)||at<now-MAX_AGE_MS||at>now+300000
       ||typeof price!=='number'||!Number.isFinite(price)||price<=0)continue;
    seen.set(new Date(at).toISOString(),{time:new Date(at).toISOString(),close:Math.round(price*10000)/10000});
  }
  const points=[...seen.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  if(!points.length)throw new Error('No dated positive daily observations');
  return {symbol,points:points.slice(-35)};
}

export async function fetchYahooMetalHistory(descriptor,fetchImpl=fetch,now=Date.now()){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort('Yahoo metals history timeout'),6000);
  try{
    const endpoint='https://query1.finance.yahoo.com/v8/finance/chart/'
      +encodeURIComponent(descriptor.yahooSymbol)+'?range=1mo&interval=1d';
    const response=await fetchImpl(endpoint,{
      signal:controller.signal,
      headers:{Accept:'application/json','User-Agent':'HAWAL/1.0'},
      cf:{cacheTtl:600,cacheEverything:true}
    });
    if(!response.ok)throw new Error('Yahoo history HTTP '+response.status);
    return parseYahooMetalChart(await response.json(),descriptor.symbol,now);
  }finally{clearTimeout(timeout);}
}

export async function onRequestGet() {
  const settled=await Promise.allSettled(PAIRS.map(pair=>fetchYahooMetalHistory(pair)));
  const items=[],failures=[];
  settled.forEach((result,index)=>{
    if(result.status==='fulfilled')items.push(result.value);
    else failures.push({symbol:PAIRS[index].symbol,reason:'Source unavailable'});
  });
  const ok=items.length>0;
  return Response.json({source:HISTORY_SOURCE,range:'1mo',interval:'1d',
    updatedAt:new Date().toISOString(),items,failures},
    {status:ok?200:503,headers:{
      'Cache-Control':ok?'public,max-age=0,s-maxage=600,must-revalidate':'no-store',
      'X-Content-Type-Options':'nosniff'
    }});
}
export const onRequest=onRequestGet;

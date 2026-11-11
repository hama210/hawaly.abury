// Pure source-health assessment. Never describe a 200 status alone as fresh data.
import { quoteState } from './market-tools.js';

const financialSymbols=['USD/IQD','XAU/USD','XAG/USD','EUR/USD','GBP/USD','CBI USD/IQD'];
const MAX_NEWS_AGE_MS=3*86400000;
const statusScore={failed:3,stale:2,quiet:1,healthy:0};
export const healthStatus=(statuses=[])=>statuses.some(s=>s==='failed')?'failed':
  statuses.some(s=>s==='stale')?'stale':statuses.some(s=>s==='quiet')?'quiet':'healthy';

export function assessNews(batches=[],now=Date.now()){
  const feeds=new Map();
  const failures=[];
  let latest=null,articles=0,expected=0;
  for(const batch of batches){
    if(!batch || !Array.isArray(batch.feedStats?.sources)){
      failures.push('Batch unavailable');continue;
    }
    const list=batch.feedStats.sources;
    expected=Math.max(expected,Number(batch.feedStats.total)||0);
    for(const raw of list){
      if(!raw||typeof raw.source!=='string')continue;
      const status=['active','failed','quiet'].includes(raw.status)?raw.status:'unchecked';
      const previous=feeds.get(raw.source);
      const next={name:raw.source,status:status==='active'?'healthy':status==='failed'?'failed':'quiet',
        articles:Number(raw.articles)||0,latencyMs:Number.isFinite(raw.durationMs)?raw.durationMs:null,
        reason:typeof raw.reason==='string'?raw.reason.slice(0,180):null};
      if(!previous||statusScore[next.status]>(statusScore[previous.status]||0))feeds.set(raw.source,next);
    }
    for(const story of batch.items||[]){
      const time=Date.parse(story?.publishedAt||'');
      if(Number.isFinite(time)&&time<=now+300000&&(!latest||time>Date.parse(latest)))latest=new Date(time).toISOString();
      articles++;
    }
  }
  const sources=[...feeds.values()].sort((a,b)=>(statusScore[b.status]||0)-(statusScore[a.status]||0)||a.name.localeCompare(b.name));
  const incomplete=failures.length>0 || (expected>0&&sources.length<expected);
  const overall=!sources.length?'failed':incomplete?'stale':healthStatus(sources.map(s=>s.status));
  const staleness=latest&&now-Date.parse(latest)>MAX_NEWS_AGE_MS;
  return {status:staleness&&overall==='healthy'?'stale':overall,
    latest,sourceCount:sources.length,expectedSourceCount:expected,
    checkedBatches:batches.length,articles,sources,partial:incomplete||Boolean(staleness),error:failures.length?'Some news batches unavailable':null};
}

export function assessMarkets(payload,now=Date.now()){
  if(!payload||!Array.isArray(payload.items))return {status:'failed',sources:[],error:'Market feed unavailable'};
  const sources=financialSymbols.map(symbol=>{
    const item=payload.items.find(row=>row?.symbol===symbol);
    const state=quoteState(item,now);
    return {name:symbol,status:state==='reported'?'healthy':state==='stale'||state==='undated'?'stale':'failed',
      state,updatedAt:item?.updatedAt||null,source:item?.source||null,
      url:typeof item?.sourceUrl==='string'&&/^https:\/\//.test(item.sourceUrl)?item.sourceUrl:null};
  });
  return {status:healthStatus(sources.map(x=>x.status)),sources,
    failureCount:Array.isArray(payload.failures)?payload.failures.length:0};
}

export function assessCalendar(payload,now=Date.now()){
  if(!payload||!Array.isArray(payload.events))return {status:'failed',count:0,error:'Economic Calendar unavailable'};
  const generatedAt=typeof payload.generated_at==='string'&&Number.isFinite(Date.parse(payload.generated_at))?payload.generated_at:null;
  const age=generatedAt?now-Date.parse(generatedAt):null;
  const stale=age===null||age< -300000 ||age>2*3600000;
  return {status:stale?'stale':'healthy',count:payload.events.length,updatedAt:generatedAt,
    note:generatedAt?null:'Provider update time missing'};
}

export function assessMetalsHistory(payload,now=Date.now()){
  if(!payload||!Array.isArray(payload.items))return {status:'failed',sources:[],error:'Metals history unavailable'};
  const sources=['XAU/USD','XAG/USD'].map(symbol=>{
    const points=payload.items.find(item=>item.symbol===symbol)?.points;
    const dates=(Array.isArray(points)?points:[]).map(p=>Date.parse(p.time)).filter(Number.isFinite);
    const latest=dates.length?Math.max(...dates):null;
    // Daily futures bars do not refresh on closed weekends/holidays.
    return {name:symbol,status:latest===null?'failed':now-latest>5*86400000?'stale':'healthy',
      points:dates.length,updatedAt:latest?new Date(latest).toISOString():null};
  });
  return {status:healthStatus(sources.map(x=>x.status)),sources};
}

export function buildSourceHealthReport(data,now=Date.now()){
  const news=assessNews(data.news||[],now);
  const markets=assessMarkets(data.markets,now);
  const calendar=assessCalendar(data.calendar,now);
  const metalsHistory=assessMetalsHistory(data.metalsHistory,now);
  const sections={news,markets,calendar,metalsHistory};
  const overall=healthStatus(Object.values(sections).map(s=>s.status));
  return {checkedAt:new Date(now).toISOString(),status:overall,sections,
    disclaimer:'News checks cover source batches requested now. Quiet feeds may have no relevant updates, not necessarily a technical failure. Sources may be cached.'};
}

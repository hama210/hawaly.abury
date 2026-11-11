import { positive, quoteState, safeUrl } from './market-tools.js';

export const METALS = Object.freeze({
  gold:{ symbol:'XAU/USD', yahooSymbol:'GC=F', color:'gold' },
  silver:{ symbol:'XAG/USD', yahooSymbol:'SI=F', color:'silver' }
});
export const METALS_HISTORY_URL='/api/metals-history';
export const METAL_HISTORY_RANGES=Object.freeze([7,30]);

export function metalQuote(markets=[], metal='gold', now=Date.now()) {
  const symbol=METALS[metal]?.symbol;
  const quote=(Array.isArray(markets)?markets:[]).find(q=>q?.symbol===symbol);
  const price=positive(quote?.price)?quote.price:null;
  const change=typeof quote?.changePct==='number' && Number.isFinite(quote.changePct)?quote.changePct:null;
  const timestamp=Number.isFinite(Date.parse(quote?.updatedAt||''))?quote.updatedAt:null;
  const state=quoteState(quote,now);
  return {
    symbol,price,change,state,timestamp,
    source:quote?.source||null,sourceUrl:safeUrl(quote?.sourceUrl),
    // These pairs are backed by GC=F/SI=F futures in the existing source API.
    instrument:'futures'
  };
}

export function cleanMetalHistory(payload,now=Date.now()) {
  if(!payload || !Array.isArray(payload.items)) throw new Error('Invalid metals history');
  const min=now-36*86400000, max=now+300000;
  const items={};
  for(const raw of payload.items) {
    if(!Object.values(METALS).some(m=>m.symbol===raw?.symbol)) continue;
    const seen=new Map();
    for(const point of Array.isArray(raw.points)?raw.points:[]) {
      const time=Date.parse(point?.time||'');
      const close=Number(point?.close);
      if(!Number.isFinite(time)||time<min||time>max||!positive(close))continue;
      seen.set(new Date(time).toISOString(),{time:new Date(time).toISOString(),close});
    }
    items[raw.symbol]=[...seen.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)).slice(-40);
  }
  return {items,updatedAt:typeof payload.updatedAt==='string'&&Number.isFinite(Date.parse(payload.updatedAt))?payload.updatedAt:null,
    source:payload.source==='Yahoo Finance'?'Yahoo Finance':null,failures:Array.isArray(payload.failures)?payload.failures:[]};
}

export function recentMetalHistory(points=[],days=30,now=Date.now()) {
  if(!METAL_HISTORY_RANGES.includes(Number(days))) return [];
  const after=now-Number(days)*86400000;
  return (Array.isArray(points)?points:[]).filter(p=>Number.isFinite(Date.parse(p.time))
    && Date.parse(p.time)>=after && Date.parse(p.time)<=now+300000
    && positive(p.close)).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
}

export function metalChartPoints(points,width=640,height=218) {
  if(points.length<2)return [];
  const times=points.map(p=>Date.parse(p.time)),values=points.map(p=>p.close);
  const first=times[0],last=times[times.length-1],low=Math.min(...values),high=Math.max(...values);
  if(!Number.isFinite(first)||last<=first||!Number.isFinite(low)||!Number.isFinite(high))return [];
  const padding=Math.max((high-low)*.12,high*.0007,.01);
  const bottom=low-padding,top=high+padding;
  return points.map((p,i)=>({
    x:38+(times[i]-first)/(last-first)*(width-53),
    y:13+(top-values[i])/(top-bottom)*(height-38),
    at:p.time,price:p.close
  }));
}

export function selectMetalEvents(events=[],now=Date.now(),max=5) {
  return (Array.isArray(events)?events:[])
    .filter(event=>event?.currency==='USD' && event?.impact==='high' && event?.status!=='moved'
      && Number.isFinite(Date.parse(event.time)) && Date.parse(event.time)>=now
      && Date.parse(event.time)<=now+7*86400000)
    .sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)).slice(0,max);
}

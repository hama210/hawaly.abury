// Explicit city/side provenance for cash USD/IQD quotations.
// Never copy Erbil or Baghdad prices into Sulaymaniyah, nor infer "buy" from
// the aggregate bourse price (side:null in the XEIQD public JSON).
export const LOCAL_CITIES=['erbil','sulaymaniyah','baghdad'];
const XE_CITY_SLUGS={erbil:'erbil',sulaymaniyah:'slemani',baghdad:'baghdad'};
const SOURCE_AGE_MS=24*60*60*1000;
const FUTURE_TOLERANCE_MS=5*60*1000;
const validRate=value=>typeof value==='number'&&Number.isFinite(value)&&value>=100000&&value<=250000;
const validTime=(raw,now)=>{const t=Date.parse(raw||'');
 return Number.isFinite(t)&&t<=now+FUTURE_TOLERANCE_MS&&t>=now-SOURCE_AGE_MS ? new Date(t).toISOString():null;};
const recent=(value,at,now)=>validRate(value)&&Boolean(validTime(at,now));

export function parseXeIqdRates(payload,now=Date.now()){
 const data=typeof payload==='string'?JSON.parse(payload):payload;
 if(!data || data.base_currency!=='IQD'||!Array.isArray(data.cities))
   throw new Error('XEIQD city rate schema invalid');
 const cities={};
 for(const [city,slug] of Object.entries(XE_CITY_SLUGS)){
   const match=data.cities.find(x=>x?.slug===slug);
   if(!match||!Array.isArray(match.sides))continue;
   const sideRecords={};
   for(const side of ['buy','sell']){
     const candidates=match.sides.filter(x=>x?.side===side&&
       recent(x.usd_iqd_per_100,x.updated_at,now)&&
       (x.usd_iqd_per_1==null||Math.abs(x.usd_iqd_per_1*100-x.usd_iqd_per_100)<=1));
     candidates.sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
     if(candidates[0])sideRecords[side]={
       price:candidates[0].usd_iqd_per_100,
       updatedAt:validTime(candidates[0].updated_at,now),
       source:'XEIQD city market',sourceUrl:'https://xeiqd.com/en/usd/'+slug
     };
   }
   if(sideRecords.buy||sideRecords.sell)cities[city]=sideRecords;
 }
 const preferred=LOCAL_CITIES.map(city=>({city,record:cities[city]?.sell||cities[city]?.buy}))
   .find(x=>x.record);
 if(!preferred)throw new Error('XEIQD has no recent verified city side quotes');
 return {cities,source:'XEIQD city market',sourceUrl:'https://xeiqd.com/rates.json'};
}

function normalizePublisherCity(city,report,now){
 const original=report?.[city];
 if(!original)return {};
 const output={};
 for(const side of ['buy','sell']){
   if(recent(original[side],report.updatedAt,now))output[side]={
     price:original[side],updatedAt:new Date(Date.parse(report.updatedAt)).toISOString(),
     source:report.source,sourceUrl:report.sourceUrl
   };
 }
 return output;
}
export function mergeUsdIqdCities(shafaq,xeiqd,now=Date.now()){
 const finalCities={};
 for(const city of LOCAL_CITIES){
   const publisher=normalizePublisherCity(city,shafaq,now);
   const other=xeiqd?.cities?.[city]||{};
   const chosen={};
   for(const side of ['buy','sell']){
     const a=publisher[side],b=other[side];
     const first=a&&b?(Date.parse(a.updatedAt)>=Date.parse(b.updatedAt)?a:b):(a||b);
     if(first&&recent(first.price,first.updatedAt,now))chosen[side]=first;
   }
   if(!chosen.buy&&!chosen.sell)continue;
   const newer=[chosen.buy,chosen.sell].filter(Boolean).sort((a,b)=>
     Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
   finalCities[city]={
     buy:chosen.buy?.price||null,sell:chosen.sell?.price||null,
     updatedAt:newer.updatedAt,source:newer.source,sourceUrl:newer.sourceUrl,
     sideUpdatedAt:{buy:chosen.buy?.updatedAt||null,sell:chosen.sell?.updatedAt||null},
     sideSources:{buy:chosen.buy?.source||null,sell:chosen.sell?.source||null},
     sideSourceUrls:{buy:chosen.buy?.sourceUrl||null,sell:chosen.sell?.sourceUrl||null}
   };
   if(city==='baghdad'&&validRate(shafaq?.baghdad?.market))finalCities[city].market=shafaq.baghdad.market;
 }
 if(!Object.keys(finalCities).length)return shafaq||null;
 const city=LOCAL_CITIES.find(key=>finalCities[key]?.sell)||
   LOCAL_CITIES.find(key=>finalCities[key]?.buy);
 const quote=finalCities[city].sell||finalCities[city].buy;
 const side=finalCities[city].sell?'sell':'buy';
 const stamp=finalCities[city].sideUpdatedAt[side];
 const source=finalCities[city].sideSources[side],sourceUrl=finalCities[city].sideSourceUrls[side];
 const primary=shafaq||{};
 return {...primary,
   symbol:'USD/IQD',name:'Iraq local market · 100 USD',type:'iraq',
   marketKind:'local',quoteAmount:100,quoteCity:city,
   price:quote,buyPrice:finalCities[city].buy,sellPrice:finalCities[city].sell,
   erbil:finalCities.erbil||null,sulaymaniyah:finalCities.sulaymaniyah||null,
   baghdad:finalCities.baghdad||null,updatedAt:stamp,
   source,sourceUrl,
   changePct:source===shafaq?.source?shafaq.changePct??null:null,
   status:'neutral'};
}

// A city must be assessed against its own timestamp, never the freshness of
// another city or the API's retrieval time.
export function cityMarketQuote(local,city,side='sell'){
 if(!LOCAL_CITIES.includes(city)||!['buy','sell'].includes(side))return null;
 const rate=local?.[city];
 if(!rate||!validRate(rate[side]))return null;
 const at=rate.sideUpdatedAt?.[side]||rate.updatedAt||local?.updatedAt||null;
 const source=rate.sideSources?.[side]||rate.source||local?.source||null;
 const sourceUrl=rate.sideSourceUrls?.[side]||rate.sourceUrl||local?.sourceUrl||null;
 return {price:rate[side],updatedAt:at,source,sourceUrl,
   marketKind:'local',dataStatus:local?.dataStatus==='stale'?'stale':undefined};
}

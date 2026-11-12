import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isOwnerRouteLocked,analyzeReadings,readEndpoint,runWatch,formatWatchSummary
} from '../scripts/owner-health-watch.mjs';

const t=Date.parse('2026-11-12T04:00:00Z');
const base='https://hawaly-aburyy.pages.dev';
const ts=new Date(t-60000).toISOString();
function goodReadings(){
  return [
    {name:'home',status:200,isHtml:true},
    {name:'news',status:200,data:{items:[],feedStats:{requested:6,succeeded:5,failed:1}}},
    {name:'markets',status:200,data:{items:[
      {symbol:'USD/IQD',price:149900,updatedAt:ts},
      {symbol:'XAU/USD',price:4001,updatedAt:ts},
      {symbol:'XAG/USD',price:49,updatedAt:ts},
      {symbol:'CBI USD/IQD',price:null,updatedAt:null}]}},
    {name:'calendar',status:200,data:{events:[],generated_at:ts}},
    {name:'metalsHistory',status:200,data:{items:[{symbol:'XAU/USD',points:[
      {time:ts,close:4000},{time:new Date(t).toISOString(),close:4001}]}]}},
    {name:'ownerPage',status:302,location:'https://hama-pages.cloudflareaccess.com/cdn-cgi/access/login'},
    {name:'ownerApi',status:403}
  ];
}
test('Cloudflare Access redirect and forbidden response are accepted; public login is not',()=>{
  assert.equal(isOwnerRouteLocked(403),true);
  assert.equal(isOwnerRouteLocked(302,'https://hama-pages.cloudflareaccess.com/cdn-cgi/access/login'),true);
  assert.equal(isOwnerRouteLocked(302,base+'/cdn-cgi/access/login'),true);
  assert.equal(isOwnerRouteLocked(302,base+'/metals'),false);
  assert.equal(isOwnerRouteLocked(302,'https://cloudflareaccess.com.evil.net/cdn-cgi/access/login'),false);
  assert.equal(isOwnerRouteLocked(200,'anything'),false);
  assert.equal(isOwnerRouteLocked(500,''),false);
});
test('quiet sources and CBI gaps are not fabricated into a total outage',()=>{
  const report=analyzeReadings(goodReadings(),t);
  assert.equal(report.status,'healthy');
  assert.equal(report.criticalCount,0);
  assert.equal(report.warningCount,0);
  assert.ok(!JSON.stringify(report).includes('muhammadch14'));
});
test('unauthenticated owner page or JSON exposure triggers a critical alert',()=>{
  const input=goodReadings();
  input.find(x=>x.name==='ownerPage').status=200;
  input.find(x=>x.name==='ownerApi').status=200;
  const report=analyzeReadings(input,t);
  assert.equal(report.criticalCount,2);
  assert.deepEqual(report.issues.filter(x=>x.severity==='critical').map(x=>x.service),['ownerPage','ownerApi']);
  assert.match(formatWatchSummary(report),/privacy incident/);
});
test('widespread news and core quotes failure is critical; isolated issue is warning',()=>{
  const input=goodReadings();
  const market=input.find(x=>x.name==='markets');
  market.data.items=[];
  const news=input.find(x=>x.name==='news');
  news.data.feedStats={requested:6,succeeded:0,failed:6};
  const report=analyzeReadings(input,t);
  assert.equal(report.criticalCount,2);
  assert.ok(report.issues.some(issue=>issue.service==='markets'&&issue.severity==='critical'));
  news.data.feedStats={requested:6,succeeded:1,failed:5};
  market.data.items=[{symbol:'USD/IQD',price:150000,updatedAt:ts}];
  const second=analyzeReadings(input,t);
  assert.equal(second.criticalCount,0);
  assert.equal(second.status,'degraded');
});
test('calendar outage and sparse metals history are warnings, not security incidents',()=>{
  const input=goodReadings();
  input.find(x=>x.name==='calendar').status=503;
  input.find(x=>x.name==='metalsHistory').data.items=[];
  const report=analyzeReadings(input,t);
  assert.equal(report.status,'degraded');
  assert.equal(report.criticalCount,0);
  assert.equal(report.warningCount,2);
});
test('readEndpoint preserves no-auth redirects and never sends Access credentials',async()=>{
  let headers;
  const row=await readEndpoint({name:'ownerPage',kind:'private',url:base+'/owner-health'},
    async(_,options)=>{headers=options.headers;return Response.redirect('https://hama-pages.cloudflareaccess.com/cdn-cgi/access/login',302);});
  assert.equal(row.status,302);
  assert.ok(isOwnerRouteLocked(row.status,row.location));
  assert.deepEqual(Object.keys(headers).sort(),['Accept','User-Agent'].sort());
});
test('transient failed homepage gets one retry and does not trigger a false incident',async()=>{
  let homeCount=0,ownerCount=0;
  const fixtures=goodReadings();
  const fetchImpl=async(url,opts)=>{
    const path=new URL(url).pathname;
    const selected=fixtures.find(row=>({home:'/',news:'/api/news',markets:'/api/markets',calendar:'/api/public/calendar/v1',
      metalsHistory:'/api/metals-history',ownerPage:'/owner-health',ownerApi:'/owner-health/api'}[row.name])===path);
    if(!selected)throw Error('Unmocked request');
    if(selected.name==='home'){
      homeCount++;
      return homeCount===1?new Response('temporary',{status:503}):
        new Response('<div id="root"></div>',{status:200,headers:{'Content-Type':'text/html'}});
    }
    if(selected.name==='ownerPage')ownerCount++;
    if(selected.name==='ownerPage')return Response.redirect(selected.location,302);
    if(selected.name==='ownerApi')return new Response('Denied',{status:403});
    return Response.json(selected.data);
  };
  const report=await runWatch({fetchImpl,sleep:async()=>{},now:t});
  assert.equal(report.status,'healthy');
  assert.equal(homeCount,2);
  assert.equal(ownerCount,1);
});
test('new workflow checks the site while the dashboard is closed with read-only token',()=>{
  const yaml=readFileSync('.github/workflows/owner-health-watch.yml','utf8');
  const source=readFileSync('scripts/owner-health-watch.mjs','utf8');
  const dashboard=readFileSync('src/components/OwnerHealth.jsx','utf8');
  assert.match(yaml,/cron: '11,26,41,56 \* \* \* \*'/);
  assert.match(yaml,/workflow_dispatch:/);
  assert.match(yaml,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(yaml,/secrets\.|contents: write/);
  assert.match(source,/owner-health\/api/);
  assert.doesNotMatch(source,/Cf-Access-Jwt-Assertion|muhammadch14@gmail.com/);
  assert.match(dashboard,/owner-health\/api/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ownerAuthorized,accessConfiguration,accessDenied } from '../functions/lib/owner-auth.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { onRequest as reportEndpoint } from '../functions/owner-health/api.js';
import { assessNews,assessMarkets,assessCalendar,assessMetalsHistory,buildSourceHealthReport } from '../src/lib/source-health.js';
import { pageRoute, pagePath } from '../src/lib/market-tools.js';

const issuer='https://my-team.cloudflareaccess.com';
const audience='abc123def456abc123def456abc123def456abc123def456abc123def456';
const email='owner@example.com';
const env={HAWAL_OWNER_EMAIL:email,HAWAL_ACCESS_AUD:audience,HAWAL_ACCESS_TEAM_DOMAIN:issuer};
const enc=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
const time=Math.floor(Date.now()/1000);

async function signedToken(claimPatch={},headerPatch={}){
  const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await webcrypto.subtle.exportKey('jwk',keys.publicKey);
  const head={alg:'RS256',typ:'JWT',kid:'test-key',...headerPatch};
  const claims={iss:issuer,aud:[audience],sub:'test-user',email,iat:time-15,exp:time+300,...claimPatch};
  const input=enc(head)+'.'+enc(claims);
  const signature=new Uint8Array(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(input)));
  return {token:input+'.'+Buffer.from(signature).toString('base64url'),jwk};
}
const request=token=>new Request('https://hawaly-aburyy.pages.dev/owner-health',
  {headers:token?{'Cf-Access-Jwt-Assertion':token}:{}});

test('owner Access config fails closed without all three Cloudflare bindings',()=>{
  assert.equal(accessConfiguration({}),null);
  assert.equal(accessConfiguration({...env,HAWAL_ACCESS_AUD:''}),null);
  assert.equal(accessConfiguration({...env,HAWAL_ACCESS_TEAM_DOMAIN:'https://evil.example.com'}),null);
  assert.equal(accessConfiguration(env).owner,email);
});
test('real signed Cloudflare-shaped JWT accepts only exact owner identity',async()=>{
  const {token,jwk}=await signedToken();
  let called=0;
  const fetchImpl=async(url)=>{
    called++;
    assert.equal(url,issuer+'/cdn-cgi/access/certs');
    return Response.json({keys:[{...jwk,kid:'test-key',alg:'RS256',use:'sig'}]});
  };
  assert.equal(await ownerAuthorized(request(token),env,fetchImpl),true);
  assert.equal(called,1);
  const different=await signedToken({email:'admin@example.com'});
  assert.equal(await ownerAuthorized(request(different.token),env,async()=>Response.json({
    keys:[{...different.jwk,kid:'test-key',alg:'RS256',use:'sig'}]
  })),false);
  assert.equal(await ownerAuthorized(request(token),{...env,HAWAL_OWNER_EMAIL:'another@example.com'},fetchImpl),false);
});
test('rejects forged email headers, unsigned JWTs, invalid audience and expired claims',async()=>{
  const {token,jwk}=await signedToken();
  const fetchImpl=async()=>Response.json({keys:[{...jwk,kid:'test-key',alg:'RS256',use:'sig'}]});
  const wrongAud=await signedToken({aud:['another-app']});
  assert.equal(await ownerAuthorized(request(wrongAud.token),env,fetchImpl),false);
  const expired=await signedToken({exp:time-1});
  assert.equal(await ownerAuthorized(request(expired.token),env,fetchImpl),false);
  const badAlgorithm=await signedToken({}, {alg:'none'});
  assert.equal(await ownerAuthorized(request(badAlgorithm.token),env,fetchImpl),false);
  const parts=token.split('.');
  const forgedPayload={iss:issuer,aud:[audience],email,iat:time-5,exp:time+300};
  assert.equal(await ownerAuthorized(request(parts[0]+'.'+enc(forgedPayload)+'.'+parts[2]),env,fetchImpl),false);
  assert.equal(await ownerAuthorized(new Request('https://example.com/owner-health',
    {headers:{'CF-Access-Authenticated-User-Email':email}}),env,fetchImpl),false);
});
test('owner page and owner-only API deny all unauthenticated browsers and administrators',async()=>{
  const html=readFileSync('index.html','utf8');
  const base={env:{},request:request(),next:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})};
  const res=await middleware(base);
  assert.equal(res.status,403);
  assert.equal(res.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.match(res.headers.get('X-Robots-Tag'),/noindex/);
  assert.doesNotMatch(await res.text(),/hawall-bootstrap/);
  const api=await reportEndpoint({...base,request:new Request('https://hawaly-aburyy.pages.dev/owner-health/api')});
  assert.equal(api.status,403);
  assert.equal(api.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.deepEqual(pageRoute('/owner-health'),{lang:'ku',page:'owner-health',valid:true});
  assert.equal(pageRoute('/en/owner-health').valid,false);
  assert.equal(pageRoute('/owner-health/api').valid,false);
  assert.equal(pagePath('ku','owner-health'),'/owner-health');
  const bypass=await middleware({...base,request:new Request('https://example.com/owner-health/api'),next:async()=>Response.json({test:true})});
  assert.deepEqual(await bypass.json(),{test:true});
});
test('source health marks missing, undated and stale rates instead of assuming live status',()=>{
  const now=Date.parse('2026-11-11T18:00:00Z');
  const quote={symbol:'XAU/USD',price:4000,updatedAt:new Date(now-60000).toISOString(),source:'Yahoo'};
  const rates=assessMarkets({items:[quote]},now);
  assert.equal(rates.sources.find(row=>row.name==='XAU/USD').status,'healthy');
  assert.equal(rates.sources.find(row=>row.name==='XAG/USD').status,'failed');
  assert.equal(rates.status,'failed');
  assert.equal(assessMarkets(null,now).status,'failed');
  assert.equal(assessMarkets({items:[{...quote,updatedAt:null}]},now).sources.find(s=>s.name==='XAU/USD').status,'stale');
});
test('RSS health distinguishes quiet feeds, failed feeds and incomplete batches',()=>{
  const date=new Date(Date.now()-10000).toISOString();
  const batch={items:[{publishedAt:date}],feedStats:{total:3,requested:2,sources:[
    {source:'A',status:'active',articles:1},{source:'B',status:'quiet',articles:0}
  ]}};
  const second={items:[],feedStats:{total:3,requested:1,sources:[{source:'C',status:'failed',articles:0,reason:'timeout'}]}};
  const all=assessNews([batch,second]);
  assert.equal(all.sourceCount,3);assert.equal(all.expectedSourceCount,3);
  assert.equal(all.status,'failed');
  assert.equal(all.partial,false);
  assert.equal(all.sources.find(s=>s.name==='B').status,'quiet');
  assert.equal(assessNews([batch,null]).partial,true);
});
test('provider calendar and metals histories report real freshness, not fake data',()=>{
  const now=Date.parse('2026-11-11T18:00:00Z');
  assert.equal(assessCalendar({events:[{id:'CPI'}],generated_at:new Date(now-120000).toISOString()},now).status,'healthy');
  assert.equal(assessCalendar({events:[],generated_at:new Date(now-10000000).toISOString()},now).status,'stale');
  assert.equal(assessCalendar(null,now).status,'failed');
  const history={items:[{symbol:'XAU/USD',points:[{time:new Date(now-86400000).toISOString(),close:4042}]},
    {symbol:'XAG/USD',points:[]}]};
  assert.equal(assessMetalsHistory(history,now).status,'failed');
  assert.equal(assessMetalsHistory({items:[{symbol:'XAG/USD',points:[{time:new Date(now-80000000).toISOString(),close:53}]}]},now).sources[1].status,'healthy');
  const report=buildSourceHealthReport({news:[],markets:null,calendar:null,metalsHistory:null},now);
  assert.equal(report.status,'failed');
  assert.equal(report.sections.news.status,'failed');
  assert.equal(report.checkedAt,new Date(now).toISOString());
});
test('private dashboard is hidden from public nav and data requested only through private API',()=>{
  const main=readFileSync('src/main.jsx','utf8');
  const ui=readFileSync('src/components/OwnerHealth.jsx','utf8');
  const nav=readFileSync('src/components/HawalDashboard.jsx','utf8');
  const middlewareSrc=readFileSync('functions/_middleware.js','utf8');
  const server=readFileSync('src/lib/server-page.js','utf8');
  assert.match(main,/<OwnerHealth\s*\/>/);
  assert.match(ui,/fetch\('\/owner-health\/api'/);
  assert.match(ui,/15\*60\*1000/);
  assert.doesNotMatch(nav,/owner-health/);
  assert.doesNotMatch(main,/href=\{pagePath\(lang,'owner-health'\)/);
  assert.match(middlewareSrc,/ownerAuthorized\(context.request,context.env\)/);
  assert.match(server,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(readFileSync('public/sitemap.xml','utf8'),/owner-health/);
});

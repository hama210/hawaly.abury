import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest } from '../functions/_middleware.js';
import { replaceGlobal } from './helpers.js';

const html = fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const routeFile = fs.readFileSync(new URL('../public/_routes.json',import.meta.url),'utf8');
const page = (url,method='GET')=>({
  request:new Request(url,{method}),
  next:async()=>new Response(method==='HEAD'?null:html,{headers:{'Content-Type':'text/html'}}),
  waitUntil(){}
});

test('Cloudflare routing includes SSR pages and APIs but skips hashed/static assets',()=>{
  const config=JSON.parse(routeFile);
  assert.equal(config.version,1);
  assert.deepEqual(config.include,['/*']);
  assert.ok(config.exclude.includes('/assets/*'));
  assert.ok(config.exclude.includes('/sw.js'));
  assert.ok(config.exclude.includes('/og-image.png'));
  assert.ok(config.exclude.every(pattern=>!pattern.startsWith('/api/')));
  assert.ok(!config.exclude.includes('/'));
  assert.ok(!config.exclude.includes('/en/*'));
});

test('edge uses cached real news and quotes, escapes them, and advertises SSR state',async()=>{
  const restore=replaceGlobal('caches',{default:{
    async match(){return Response.json({
      news:[{ title:'Gold <script>alert(1)</script>',source:'Example news',link:'https://example.com/story',publishedAt:'2026-10-08T12:00:00Z' }],
      markets:[{symbol:'USD/IQD',price:153000,marketKind:'local',erbil:{buy:152500,sell:153000},source:'Local market',sourceUrl:'https://example.com/quote',updatedAt:'2026-10-08T12:00:00Z'}]
    });}
  }});
  try {
    const response=await onRequest(page('https://example.com/en/'));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('X-SSR'),'ok');
    assert.equal(response.headers.get('X-Hawall-Version'),'2026-10-ssr-routes-v2');
    const rendered=await response.text();
    assert.match(rendered,/lang="en" dir="ltr"/);
    assert.match(rendered,/153,000/);
    assert.match(rendered,/Gold &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(rendered,/hawall-bootstrap/);
    assert.match(rendered,/href="https:\/\/example.com\/story"/);
  } finally { restore(); }
});

test('empty feeds are not filled with invented headlines or market values',async()=>{
  const restore=replaceGlobal('caches',{default:{async match(){return Response.json({news:[],markets:[]});}}});
  try {
    const response=await onRequest(page('https://example.com/'));
    assert.equal(response.headers.get('x-ssr'),'empty');
    const body=await response.text();
    assert.match(body,/lang="ckb" dir="rtl"/);
    assert.match(body,/hawall-bootstrap/);
    assert.doesNotMatch(body,/153,000/);
  } finally {restore();}
});

test('edge errors fall back to the unchanged working shell with an explicit status',async()=>{
  const restore=replaceGlobal('caches',{default:{async match(){throw new Error('cache down');}}});
  const oldWarn=console.warn; console.warn=()=>{};
  try {
    const response=await onRequest(page('https://example.com/en/'));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('X-SSR'),'error');
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal(await response.text(),html);
  } finally {console.warn=oldWarn;restore();}
});

test('assets and API payload pass through middleware without rewriting',async()=>{
  const resource=await onRequest({request:new Request('https://example.com/assets/main.js'),next:async()=>new Response('const active=true;',{headers:{'Content-Type':'application/javascript'}})});
  assert.equal(await resource.text(),'const active=true;');
  assert.equal(resource.headers.get('X-SSR'),null);
  const api=await onRequest({request:new Request('https://example.com/api/markets'),next:async()=>Response.json({items:[],ok:true})});
  assert.deepEqual(await api.json(),{items:[],ok:true});
  const about=await onRequest(page('https://example.com/ar/about'));
  assert.equal(about.status,200);
  assert.match(await about.text(),/lang="ar" dir="rtl"/);
  const head=await onRequest(page('https://example.com/en/','HEAD'));
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
});

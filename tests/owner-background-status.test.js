import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeBackgroundRuns,getOwnerBackgroundStatus } from '../functions/lib/owner-watch-status.js';

const now=Date.parse('2026-11-12T12:00:00Z');
const recent=new Date(now-10*60000).toISOString();
const older=new Date(now-70*60000).toISOString();

test('owner report recognizes completed scheduled background monitoring',()=>{
  const payload={workflow_runs:[
    {event:'schedule',created_at:recent,status:'completed',conclusion:'success'},
    {event:'push',created_at:older,status:'completed',conclusion:'failure'}
  ]};
  const report=summarizeBackgroundRuns(payload,now);
  assert.equal(report.status,'healthy');
  assert.equal(report.lastCheckedAt,recent);
  assert.equal(report.trigger,'schedule');
  assert.match(report.url,/owner-health-watch.yml/);
});
test('report shows failed, late, queued and unknown checks without claiming success',()=>{
  assert.equal(summarizeBackgroundRuns({workflow_runs:[]},now).status,'not-started');
  assert.equal(summarizeBackgroundRuns({workflow_runs:[{
    event:'schedule',created_at:recent,status:'completed',conclusion:'failure'
  }]},now).status,'failed');
  assert.equal(summarizeBackgroundRuns({workflow_runs:[{
    event:'schedule',created_at:recent,status:'in_progress'
  }]},now).status,'running');
  assert.equal(summarizeBackgroundRuns({workflow_runs:[{
    event:'schedule',created_at:older,status:'completed',conclusion:'success'
  }]},now).status,'overdue');
});
test('GitHub run metadata failures fail gracefully and are not public endpoints',async()=>{
  const network=await getOwnerBackgroundStatus(async()=>Response.json({
    workflow_runs:[{event:'schedule',created_at:recent,status:'completed',conclusion:'success'}]
  }),now);
  assert.equal(network.status,'healthy');
  const offline=await getOwnerBackgroundStatus(async()=>{throw Error('GitHub offline');},now);
  assert.equal(offline.status,'unknown');
  assert.doesNotMatch(JSON.stringify(offline),/email|token/i);
  const api=readFileSync('functions/owner-health/api.js','utf8');
  const ui=readFileSync('src/components/OwnerHealth.jsx','utf8');
  assert.ok(api.indexOf('ownerAuthorized(context.request,context.env)')<api.indexOf('getOwnerBackgroundStatus()'));
  assert.match(ui,/backgroundLabels/);
  assert.match(ui,/github.com\/hama210\/hawaly.abury\/actions/);
  assert.doesNotMatch(readFileSync('public/sitemap.xml','utf8'),/owner-health/);
});

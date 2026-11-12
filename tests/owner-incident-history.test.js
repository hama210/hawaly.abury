import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeIncidentHistory,getOwnerBackgroundStatus} from '../functions/lib/owner-watch-status.js';

const t=Date.parse('2026-11-12T12:00:00Z');
const time=n=>new Date(t+n*60000).toISOString();
function run(id,minute,conclusion,status='completed'){
  return {id,event:'schedule',status,conclusion,created_at:time(minute),
    html_url:'https://github.com/hama210/hawaly.abury/actions/runs/'+id};
}
test('joins failed monitor checks until first successful recovery, even with ignored neutral run',()=>{
  const history=summarizeIncidentHistory({workflow_runs:[
    run(5,60,'success'),run(4,45,'failure'),run(3,30,'failure'),run(2,15,'cancelled'),run(1,0,'success')
  ]},t+120*60000,true);
  assert.equal(history.incidents.length,1);
  const incident=history.incidents[0];
  assert.equal(incident.startedAt,time(30));
  assert.equal(incident.lastFailedAt,time(45));
  assert.equal(incident.resolvedAt,time(60));
  assert.equal(incident.durationMinutes,30);
  assert.equal(incident.failedChecks,2);
  assert.equal(incident.status,'resolved');
  assert.equal(incident.url,'https://github.com/hama210/hawaly.abury/actions/runs/3');
});
test('detects an unresolved monitor incident without asserting full outage',()=>{
  const history=summarizeIncidentHistory({workflow_runs:[run(1,0,'success'),run(2,15,'failure')]},t+60*60000,false);
  assert.equal(history.incidents[0].status,'ongoing');
  assert.equal(history.incidents[0].durationMinutes,45);
  assert.equal(history.incidents[0].resolvedAt,null);
  assert.equal(history.complete,false);
});
test('has no fake incidents if all runs succeed and shows bounded coverage',()=>{
  const history=summarizeIncidentHistory({workflow_runs:[
    run(2,15,'success'),run(1,0,'success')
  ]},t+60000,true);
  assert.deepEqual(history.incidents,[]);
  assert.equal(history.runsExamined,2);
  assert.equal(history.coverageStart,time(0));
  assert.equal(history.coverageEnd,time(15));
});
test('never trusts arbitrary HTML urls and ignores queued runs in failure timeline',()=>{
  const h=summarizeIncidentHistory({workflow_runs:[
    {...run(2,15,'failure'),html_url:'https://evil.example/a'},
    run(3,30,null,'queued')
  ]},t+60000,false);
  assert.equal(h.incidents[0].url,'https://github.com/hama210/hawaly.abury/actions/workflows/owner-health-watch.yml');
  assert.equal(h.runsExamined,1);
});
test('paged GitHub history aggregates runs, removes duplicates and marks partial',async()=>{
  const calls=[];
  const fixture=Array.from({length:100},(_,i)=>run(i+1,i*15,'success'));
  let current=[fixture.slice(),[run(100,99*15,'success'),run(101,100*15,'failure')]];
  const report=await getOwnerBackgroundStatus(async(url)=>{
    calls.push(url);
    return Response.json({workflow_runs:current[calls.length-1]||[]});
  },t+101*15*60000);
  assert.equal(calls.length,2);
  assert.match(calls[0],/per_page=100&page=1/);
  assert.equal(report.history.runsExamined,101);
  assert.equal(report.history.incidents.length,1);
  assert.equal(report.history.complete,true);
});
test('GitHub API failure returns unknown history, not a fake success',async()=>{
  const report=await getOwnerBackgroundStatus(async()=>{throw Error('offline');});
  assert.equal(report.status,'unknown');
  assert.equal(report.history.status,'unavailable');
});
test('incident history only appears behind existing owner JWT and has no public route',()=>{
  const api=readFileSync('functions/owner-health/api.js','utf8');
  const ui=readFileSync('src/components/OwnerHealth.jsx','utf8');
  assert.ok(api.indexOf('ownerAuthorized(context.request,context.env)')<api.indexOf('getOwnerBackgroundStatus()'));
  assert.match(ui,/incidentHistory/);
  assert.match(ui,/oh-incidents-title/);
  assert.doesNotMatch(readFileSync('public/sitemap.xml','utf8'),/owner-health/);
});

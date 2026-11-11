import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('public site smoke audit parses before GitHub Actions runs it',()=>{
 const result=spawnSync(process.execPath,['--check','scripts/live-audit.mjs'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});

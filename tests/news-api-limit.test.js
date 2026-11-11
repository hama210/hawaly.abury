import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPrioritizedNews } from '../functions/api/news.js';

const article = (i, region='Iraq') => ({
  id:'story-'+i,
  title: region === 'Iraq' ? 'Iraq dollar bank update ' + i : 'Global metals market ' + i,
  summary: region === 'Iraq' ? 'Iraq economy and dinar news' : 'Precious metals news',
  source: region === 'Iraq' ? 'Iraq Business News' : 'Global Markets',
  publishedAt: new Date(Date.parse('2026-11-11T12:00:00Z') - i*60000).toISOString(),
  sourceTier:'major', intelligence:{impact:'high',effects:[]}
});

test('news API respects small limits despite reserved Iraq headlines',()=>{
  const raw = [...Array.from({length:20},(_,i)=>article(i)),...Array.from({length:8},(_,i)=>article(i+30,'Global'))];
  for (const limit of [1,2,5,10,12,15,24]) {
    const items = selectPrioritizedNews(raw,limit);
    assert.ok(items.length <= limit, 'limit=' + limit + ' yielded ' + items.length);
    assert.equal(new Set(items.map(item=>item.title)).size,items.length);
  }
  assert.equal(selectPrioritizedNews(raw,5).length,5);
});

test('news API fills remaining slots with non-Iraq market news',()=>{
  const raw = [article(0),article(1),...Array.from({length:8},(_,i)=>article(i+4,'Global'))];
  const items = selectPrioritizedNews(raw,5);
  assert.equal(items.length,5);
  assert.equal(items.filter(item=>item.title.includes('Iraq')).length,2);
  assert.equal(items.filter(item=>item.title.includes('Global')).length,3);
});

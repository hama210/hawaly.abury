import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeNewsText } from '../functions/api/news.js';

test('RSS news headlines and summaries decode plain and nested HTML entities', () => {
  assert.equal(decodeNewsText('year&nbsp;&nbsp;Reuters'), 'year Reuters');
  assert.equal(decodeNewsText('year&amp;nbsp;&amp;nbsp;Reuters'), 'year Reuters');
  assert.equal(decodeNewsText('Gold &amp;amp; silver &quot;rise&quot;'), 'Gold & silver "rise"');
  assert.equal(decodeNewsText('Iraq &#x2014; markets &amp;#160; today'), 'Iraq — markets today');
  assert.equal(decodeNewsText('<p>US dollar &amp; growth</p>'), 'US dollar & growth');
});
test('RSS decoder is bounded, safe on malformed numeric entities, and retains publisher words', () => {
  assert.equal(decodeNewsText('&#x110000; Iraq'), '&#x110000; Iraq');
  assert.equal(decodeNewsText('&#xD800; Iraq'), '&#xD800; Iraq');
  assert.equal(decodeNewsText('<![CDATA[Dollar &amp;#38; bonds]]>'), 'Dollar & bonds');
});

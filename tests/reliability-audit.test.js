import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeNewsText } from '../functions/api/news.js';
import { retainCityHistory } from '../functions/api/markets.js';
import { displayCityQuote, timestamp } from '../src/lib/market-tools.js';
import { storyExcerpt } from '../src/lib/article-content.js';
import { serverContent } from '../src/lib/server-page.js';

test('RSS decoder resolves nested HTML entities without leaking entity strings', () => {
  assert.equal(decodeNewsText('year&amp;nbsp;&amp;nbsp;Reuters'), 'year Reuters');
  assert.equal(decodeNewsText('Gold &amp;amp; silver &quot;rise&quot;'), 'Gold & silver "rise"');
  assert.equal(decodeNewsText('&#x2014; &amp;#160;'), '—');
});

test('only a dated quote from the SAME city may be shown as last close', () => {
  const now = Date.parse('2026-11-11T10:00:00Z');
  const priorTime = new Date(now-60*60*1000).toISOString();
  const prior={ symbol:'USD/IQD', price:150000, lastCityQuotes:{
    sulaymaniyah:{buy:149000,sell:150000,updatedAt:priorTime,source:'Test city feed',sourceUrl:'https://example.com/sula'}
  }};
  const current={ symbol:'USD/IQD',price:151000,updatedAt:new Date(now-60000).toISOString(),
    erbil:{buy:150000,sell:151000},sulaymaniyah:null,
    source:'New city feed',sourceUrl:'https://example.com/new' };
  const updated=retainCityHistory(current,prior,now);
  const sulay=displayCityQuote(updated,'sulaymaniyah',now);
  assert.equal(sulay.lastClose,true);
  assert.equal(sulay.quote.sell,150000);
  assert.equal(sulay.metadata.source,'Test city feed');
  assert.equal(displayCityQuote(updated,'erbil',now).lastClose,false);
  assert.equal(displayCityQuote(updated,'baghdad',now).quote,null);
  assert.equal(displayCityQuote(updated,'sulaymaniyah',now+25*60*60*1000).quote,null);
  const expired = retainCityHistory(current,prior,now+26*60*60*1000);
  assert.equal(expired.lastCityQuotes.sulaymaniyah,undefined);
});

test('localized cards hide untranslated English snippet but preserve verified translations', () => {
  const item={title:'Iraq market',summary:'English finance report',titleKu:'بازاڕی عێراق',summaryKu:'ڕاپۆرتی دارایی'};
  assert.equal(storyExcerpt(item,'ku'),'');
  assert.equal(storyExcerpt(item,'ar'),'');
  assert.equal(storyExcerpt(item,'en'),'English finance report');
  assert.equal(storyExcerpt({...item,_hawalInlineVerified:true},'ku'),'ڕاپۆرتی دارایی');
});

test('Sorani uses Kurdish month names, and SSR twelve stories do not claim only five', () => {
  assert.match(timestamp('2026-11-11T10:00:00Z','ku'),/تشرینی دووەم/);
  const news=Array.from({length:12},(_,index)=>({
    id:'story-'+index,title:'Story '+index,source:'Test feed',
    link:'https://example.com/'+index,publishedAt:'2026-11-11T10:00:00Z'
  }));
  const html=serverContent({lang:'ku',page:'home',news,markets:[]});
  assert.match(html,/دوایین هەواڵەکان/);
  assert.doesNotMatch(html,/پێنج خاڵی گرنگ/);
  assert.equal((html.match(/<article>/g)||[]).length,12);
});

test('market skeleton and inline source placement do not obstruct mobile navigation', () => {
  const main=fs.readFileSync('src/main.jsx','utf8');
  const css=fs.readFileSync('src/redesign.css','utf8');
  const marketDesk=fs.readFileSync('src/components/MarketDesk.jsx','utf8');
  assert.match(main,/<SourcesDisclosure lang=\{lang\}/);
  assert.ok(main.indexOf('<SourcesDisclosure lang={lang}') < main.indexOf('<SiteFooter lang={lang}'));
  assert.match(main,/loading=\{marketLoading\}/);
  assert.match(marketDesk,/rate-skeleton-line/);
  assert.match(css,/\.sources-corner:not\(\.is-open\)/);
  assert.match(css,/\.sources-corner \.sources-panel/);
});

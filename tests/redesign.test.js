import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync('src/main.jsx','utf8');
const dashboard=fs.readFileSync('src/components/HawalDashboard.jsx','utf8');
const css=fs.readFileSync('src/redesign.css','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');

test('the four preview-inspired screens are part of the actual application',()=>{
  for(const name of ['home','markets','news','more']){
    assert.match(main,new RegExp('hawal-screen '+name+'-screen'));
    assert.match(dashboard,new RegExp(name+':', 'i'));
  }
  assert.match(main,/<Navigation mobile active=\{activeView\}/);
  assert.match(main,/<Navigation active=\{activeView\}/);
  assert.match(main,/onNavigate=\{navigate\}/);
  assert.match(main,/navigationCopy\[lang\]/);
  assert.match(main,/document\.documentElement\.dir = LANGS\[lang\]\.dir/);
  assert.match(main,/<LanguagePills lang=\{lang\}/);
});

test('home and market cards use genuine API quote values and never invented mockup numbers',()=>{
  assert.match(dashboard,/markets\.find\(m=>m\.symbol==='USD\/IQD'\)/);
  assert.match(dashboard,/markets\.find\(m=>m\.symbol==='XAU\/USD'\)/);
  assert.match(dashboard,/markets\.find\(m=>m\.symbol==='BRENT\/USD'\)/);
  assert.match(dashboard,/quoteState\(q\)/);
  assert.match(dashboard,/c\.noQuote/);
  assert.doesNotMatch(dashboard,/153,750|4,150\.1|82\.91/);
  assert.match(main,/<Hero item=\{hero\}/);
  assert.match(main,/<NewsCard key=\{item.id\}/);
  assert.match(main,/<MarketIntelligence markets=\{markets\} news=\{displayNews\}/);
  assert.match(main,/<VerificationDesk news=\{displayNews\}/);
});

test('price history and market alert modules stay mounted when changing screens',()=>{
  assert.match(main,/<DollarHistory markets=\{markets\} lang=\{lang\}/);
  assert.match(main,/<MarketAlerts markets=\{markets\} news=\{displayNews\}/);
  assert.match(css,/\.hawal-screen\.is-hidden-view\{display:none!important\}/);
  assert.doesNotMatch(main,/activeView==='more' && <MarketAlerts/);
  assert.match(main,/<MarketDesk markets=\{markets\} lang=\{lang\}/);
});

test('mobile design matches navy-blue screenshot while supporting narrow and RTL devices',()=>{
  assert.match(main,/import '\.\/redesign\.css'/);
  assert.match(css,/--bg:#020b19/);
  assert.match(css,/--primary:#1685ff/);
  assert.match(css,/\.redesigned-mobile-nav/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(max-width:370px\)/);
  assert.match(css,/\.pulse-card strong\{[^}]*overflow:hidden/);
  assert.match(css,/\[data-theme="light"\]/);
  assert.match(sw,/v28-news-images/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBILE_VIEWS, viewFromHash } from '../src/lib/mobile-view.js';

test('mobile tabs have stable deep links and unknown hashes fall back home', () => {
  assert.deepEqual(MOBILE_VIEWS, ['home', 'markets', 'news', 'more']);
  for (const view of MOBILE_VIEWS) assert.equal(viewFromHash('#' + view), view);
  assert.equal(viewFromHash('#NEWS'), 'news');
  assert.equal(viewFromHash('#unknown'), 'home');
  assert.equal(viewFromHash(''), 'home');
});

test('mobile rate panel is no longer sticky and does not obstruct news browsing', () => {
  const css = readFileSync(new URL('../src/redesign.css', import.meta.url), 'utf8');
  const mobileRateRule = css.match(/@media \(max-width: 680px\)\s*\{[\s\S]*?\.home-rate-board\s*\{([^}]*)\}/);
  assert.ok(mobileRateRule, 'expected mobile-only exchange rate board CSS');
  assert.match(mobileRateRule[1], /position:\s*static\s*;/);
  assert.doesNotMatch(mobileRateRule[1], /position:\s*sticky\s*;/);
  assert.match(css, /\.redesigned-mobile-nav button span\s*\{[^}]*font-size:\s*clamp\(/);
});

test('mobile navigation preserves tab state through browser history', () => {
  const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(source, /history\.pushState\(/);
  assert.match(source, /addEventListener\('popstate', restoreView\)/);
  assert.match(source, /addEventListener\('hashchange', restoreView\)/);
  assert.match(source, /useState\(\(\) => viewFromHash\(window\.location\.hash\)\)/);
});

test('installed mobile app fetches new JS and CSS rather than caching old bundles', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(sw, /request\.destination === 'script'/);
  assert.match(sw, /request\.destination === 'style'/);
  assert.match(sw, /hawali-aburi-v33-calendar-freshness/);
  assert.match(main, /sw\.js\?v=20261111-calendar-freshness-v3/);
});


test('mobile search opens as a visible field and focuses inside the tap gesture', () => {
  const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/redesign.css', import.meta.url), 'utf8');
  assert.match(source, /flushSync\(\(\) => setSearchOpen\(true\)\)/);
  assert.match(source, /searchInputRef\.current\?\.focus\(\{ preventScroll:true \}\)/);
  assert.match(source, /aria-controls="hawal-news-search"/);
  assert.match(source, /if\(activeView!=='news'\) navigate\('news'\)/);
  assert.match(css, /\.site-header\.mobile-search-open\s*\.search-wrap\.is-open\s*\{/);
  assert.match(css, /position:relative;inset:auto;top:auto;order:3/);
  assert.match(css, /\.page:has\(\.search-wrap input:focus\) \.redesigned-mobile-nav\{display:none\}/);
});

test('calendar and information pages link to news search instead of a nonfunctional field', () => {
  const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/redesign.css', import.meta.url), 'utf8');
  assert.match(source, /const showSearch = route\.page === 'home';/);
  assert.match(source, /href=\{pagePath\(lang\)\+'#news'\}/);
  assert.match(css, /\.site-header\.no-search\{grid-template-columns:minmax\(145px,1fr\) auto\}/);
});

test('mobile news and article reader have readable text, accessible tap targets and safe narrow layouts', () => {
  const css = readFileSync(new URL('../src/redesign.css', import.meta.url), 'utf8');
  assert.match(css, /\.news-screen \.story-title,\.home-news \.story-title\{font-size:14px/);
  assert.match(css, /\.article-reader \.article-body\{font-size:15px/);
  assert.match(css, /\.header-calendar-button,\.site-header \.icon-button\{[\s\S]*?min-height:44px/);
  assert.match(css, /\.home-news \.story-card,\.news-screen \.story-card\{grid-template-columns:98px/);
});

test('reader keyboard navigation traps focus inside the dialog and restores original focus on close', () => {
  const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(source, /const dialogRef = useRef\(null\)/);
  assert.match(source, /dialogRef\.current/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /returnFocus\?\.isConnected/);
  assert.match(source, /onClose=\{closeArticle\}/);
  assert.match(source, /event\.preventDefault\(\); onOpen\(item\);/);
});

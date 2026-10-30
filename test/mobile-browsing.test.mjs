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
  assert.match(sw, /hawali-aburi-v33-production/);
  assert.match(main, /sw\.js\?v=20261030-production-v6.2/);
});

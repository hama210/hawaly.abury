import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('market cards have bounded responsive columns and isolated source metadata', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const jsx = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /grid-template-columns:repeat\(9,minmax\(125px,1fr\)\)/);
  assert.match(css, /\.market-strip \{ display:grid; grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.market-strip \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.market-source span:first-child \{[^}]*text-overflow:ellipsis/);
  assert.match(css, /\.market-item \{[^}]*overflow:hidden/);
  assert.match(jsx, /<time className="market-updated"/);
  assert.match(jsx, /<a className="market-source"/);
});

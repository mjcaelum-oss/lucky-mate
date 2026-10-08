import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Experience from '../components/experience';

test('intro preserves the supplied keycap placeholder and uses the original design asset', () => {
  const markup = renderToStaticMarkup(createElement(Experience, { path: [], localDemo: false }));
  assert.match(markup, /4조의 멋있는<br\/>키캡 이미지/);
  assert.match(markup, /이용 방법/);
  assert.doesNotMatch(markup, /desktop-brand|hero-glow|\/clover.svg/);
  const original = readFileSync('Lucky Mate_design.png');
  assert.deepEqual(readFileSync('public/images/design-reference.png'), original);
  assert.equal(original.readUInt32BE(16), 2540);
  assert.equal(original.readUInt32BE(20), 1262);
  assert.match(readFileSync('app/globals.css', 'utf8'), /\/images\/design-reference.png/);
  assert.match(readFileSync('public/images/clover.svg', 'utf8'), /<svg/);
});

/* feedback-kit: which @font-face rules embedFonts keeps (picture.js). Plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontFaces, LATIN } from './picture.js';

// as Google Fonts writes it (css2?family=Inter), shortened, plus another family
const face = (subset, range, family = 'Inter') => `/* ${subset} */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/${family.toLowerCase()}/${subset}.woff2) format('woff2');
  unicode-range: ${range};
}`;
const CSS = [
  face('cyrillic-ext', 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F'),
  face('cyrillic', 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'),
  face('greek', 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF'),
  face('vietnamese', 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+1EA0-1EF9, U+20AB'),
  face('latin-ext', 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'),
  face('latin', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'),
  face('latin', 'U+0000-00FF', 'Bungee')
].join('\n');
const subsets = faces => faces.map(f => /\/([\w-]+)\.woff2/.exec(f)[1]);

test('by default, Latin and Latin Extended are kept; Cyrillic, Greek and Vietnamese are not', () => {
  assert.deepEqual(subsets(fontFaces(CSS, 'Inter')), ['latin-ext', 'latin']);
});

test('only the rules of the family asked for', () => {
  assert.deepEqual(subsets(fontFaces(CSS, 'Bungee')), ['latin']);
});

test('a range that starts at U+0000 or U+0100 is Latin, however it is written', () => {
  for (const range of ['U+0000-00FF', 'U+0-FF', 'u+00-ff', 'U+0100-024F', 'U+100-17F', 'U+0100-02AF, U+0304'])
    assert.ok(LATIN.test(`unicode-range: ${range};`), range);
  for (const range of ['U+0102-0103, U+0110-0111', 'U+0400-045F', 'U+10000-1FFFF', 'U+1100-11FF', 'U+0370-03FF'])
    assert.ok(!LATIN.test(`unicode-range: ${range};`), range);
});

test('a given unicode picks other subsets, or just basic Latin as before 2.2.0', () => {
  assert.deepEqual(subsets(fontFaces(CSS, 'Inter', /U\+0400-045F/i)), ['cyrillic']);
  assert.deepEqual(subsets(fontFaces(CSS, 'Inter', /U\+0000-00FF/i)), ['latin']);
  assert.deepEqual(subsets(fontFaces(CSS, 'Inter', /U\+0*(?:0|100|400)-/i)), ['cyrillic', 'latin-ext', 'latin']);   // as in the README
});

test('a rule without a unicode-range covers everything and is always kept', () => {
  const own = `@font-face { font-family: 'Inter'; src: url(fonts/inter.woff2) format('woff2'); }`;
  assert.equal(fontFaces(own + '\n' + CSS, 'Inter', /U\+0400-045F/i).length, 2);
  assert.equal(fontFaces(own, 'Inter')[0], own);
});

test('no rules, no faces', () => {
  assert.deepEqual(fontFaces('body { color: red }', 'Inter'), []);
});

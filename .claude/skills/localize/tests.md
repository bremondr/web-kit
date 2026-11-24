# Tests for a strings module

A skeleton for `<module>/strings.test.mjs` (or a project's `tests/strings.test.mjs`), from feedback-kit's. Adapt the names; keep the six kinds of check.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format, LANGUAGES, STRINGS, texts } from './strings.js';

const names = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
const words = text => text.toLowerCase().match(/\p{L}+/gu) || [];

test('every language has every key, with the same {names} as English', () => {
  const keys = Object.keys(STRINGS.en).sort();
  for (const language of LANGUAGES){
    assert.deepEqual(Object.keys(STRINGS[language]).sort(), keys, `${language}: the keys differ from English's`);
    for (const key of keys){
      const text = STRINGS[language][key];
      assert.ok(typeof text === 'string' && text.trim(), `${language}.${key}`);
      assert.deepEqual(names(text), names(STRINGS.en[key]), `${language}.${key}: its {names} differ`);
    }
  }
});

test('English is exactly what the code said before languages', () => {
  // copy the old literals here, from the last release: changing one changes every project that sets no language
  const before = {heading: 'Send feedback', undo: 'Undo' /* , … every key */};
  for (const [key, text] of Object.entries(before)) assert.equal(STRINGS.en[key], text, key);
  assert.deepEqual(texts(), STRINGS.en);
  // and whole outputs, string-equal to the last release's, with no language and with 'en'
  for (const language of [undefined, 'en']) assert.equal(makeOutput({language}), OUTPUT_FROM_LAST_RELEASE);
});

test('Czech: no English left in the output', () => {
  const cs = texts('cs');
  const out = makeOutput({language: 'cs', /* the app's own values in Czech too */})
    .replace(USER_AGENT, '').replace(/https?:\/\/[^\s)|]+/g, '');   // what is legitimately not Czech
  for (const [key, text] of Object.entries(STRINGS.en))
    if (text !== cs[key] && text.length > 2) assert.ok(!out.includes(text), `the output has "${text}"`);
  const czech = new Set(words(Object.values(cs).join(' ')));
  const english = new Set(words(Object.values(STRINGS.en).join(' ')).filter(w => !czech.has(w) && w.length > 1));
  assert.deepEqual(words(out).filter(w => english.has(w)), []);
});

test('Czech: the filled-in sentences as approved', () => {
  const cs = texts('cs');
  assert.equal(format(cs.openIssue, {provider: cs['provider.github']}), 'Napsat hlášení na GitHub');
  // each plural form, each number format, each grammatical variant
});

test('strings overrides single texts; another language falls back to English', () => {
  assert.equal(texts('cs', {undo: 'Vrátit'}).undo, 'Vrátit');
  assert.equal(texts('de', {undo: 'Rückgängig'}).clear, STRINGS.en.clear);
});

test('a wrong language or strings throws', () => {
  assert.throws(() => texts('de'), /no texts for the language/);
  for (const language of ['', 'c', 'english language', 7, null]) assert.throws(() => texts(language));
  assert.throws(() => texts('cs', {undoo: 'Zpět'}), /unknown key/);
  assert.throws(() => texts('cs', {undo: 3}), /must be text/);
});
```

The browser check uses the same idea on the rendered component: collect every text node plus `aria-label` and `title` attributes (hidden elements too), then look for English texts and words as above. In web-kit, `tools/check-demo.mjs` does this for feedback-kit since 2.2.0 (`panelTexts()` and `englishIn()`).

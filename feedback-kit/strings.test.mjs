/* feedback-kit: the texts in each language (strings.js), and what they make in the issue. Plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format, LANGUAGES, listOf, STRINGS, texts } from './strings.js';
import { issueBody, issueUrl } from './issue.js';

// deviceRows reads the browser's window: a stand-in for one, an iPad on the home screen in dark mode
const media = {'(prefers-color-scheme: dark)': true, '(display-mode: standalone)': true, '(pointer: fine)': true, '(pointer: coarse)': false};
Object.assign(globalThis, {matchMedia: m => ({matches: !!media[m]}), innerWidth: 1180, innerHeight: 820, devicePixelRatio: 1.5,
  outerWidth: 1200, outerHeight: 900, screen: {width: 1920, height: 1080}, location: {origin: 'https://example.org', pathname: '/app/'}});
const UA = 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
Object.defineProperty(globalThis, 'navigator', {value: {userAgent: UA, standalone: false}, configurable: true});
const { deviceRows } = await import('./kit.js');

const names = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('every language has every key, with the same {names} as English', () => {
  const keys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(LANGUAGES, ['en', 'cs']);
  for (const language of LANGUAGES){
    assert.deepEqual(Object.keys(STRINGS[language]).sort(), keys, `${language}: the keys differ from English's`);
    for (const key of keys){
      const text = STRINGS[language][key];
      assert.equal(typeof text, 'string', `${language}.${key}`);
      assert.ok(text.trim(), `${language}.${key} is empty`);
      assert.deepEqual(names(text), names(STRINGS.en[key]), `${language}.${key}: its {names} differ from English's`);
    }
  }
});

test('English is exactly what the kit said before languages', () => {
  // the panel's texts, as kit.js had them in 2.1.0: changing one changes every project that doesn't set language
  const panel = {
    heading: 'Send feedback', pictureLabel: 'Just this part', close: 'Close',
    canvasLabel: 'Picture of the screen. Draw on it to point at the problem.', making: 'Making the picture…',
    pickLabel: 'Picture', kindPage: 'Whole page', kindOwn: 'Your screenshot', kindScreen: 'Screen capture',
    grab: 'Take a real screenshot', mine: 'Use my screenshot…', mineNote: 'Or paste a screenshot (Ctrl+V, ⌘V) or drop one on the picture.',
    pensLabel: 'Pen colour', penRed: 'Red', penWhite: 'White', penBlue: 'Blue', penBlack: 'Black', penLabel: '{pen} pen',
    undo: 'Undo', clear: 'Clear', drawNote: 'Draw on the picture to point at the problem.',
    openIssue: 'Write the issue on {provider}', 'provider.github': 'GitHub', 'provider.gitlab': 'GitLab',
    copy: 'Copy picture', share: 'Share…', save: 'Save picture',
    issueNote: 'The issue opens on {provider} with what was on screen filled in. Sign in, paste the picture, say what’s wrong, and tap Submit.',
    fileName: 'feedback.png',
    copied: 'The picture is copied. Paste it into the issue, or draw on it first.',
    copiedDrawing: 'The picture is copied, with your drawing. Paste it into the issue.',
    notCopied: 'Couldn’t copy the picture here. Save or share it, then attach it to the issue.',
    drawThen: 'Draw on the picture, then copy, save or share it for the issue.',
    ownIn: 'Your screenshot is in. Draw on it, then copy, save or share it for the issue.',
    notPicture: 'That isn’t a picture. Drop a screenshot (PNG or JPEG).',
    unreadable: 'That picture couldn’t be read. Try a PNG or JPEG screenshot.',
    noPicture: 'No picture in this browser.',
    noPictureNote: 'Couldn’t make a picture here. The issue still says what was on screen.',
    noCapture: 'No screen capture, so the picture is the one made from the page. Your own screenshot works too.',
    // changed on purpose in 2.2.0 (#44): the note names the sections that gave way, where 2.1.0 said
    // 'Some of what was on screen was too long to put in the issue.'
    tooLong: 'Too long to put in the issue: {sections}. It has a shorter note in its place, so add that part by hand if it matters.'
  };
  for (const [key, text] of Object.entries(panel)) assert.equal(STRINGS.en[key], text, key);
  assert.equal(format(STRINGS.en.openIssue, {provider: 'GitLab'}), 'Write the issue on GitLab');
  assert.equal(format(STRINGS.en.penLabel, {pen: 'Red'}), 'Red pen');
  assert.deepEqual(texts(), STRINGS.en);

  // the device's rows
  assert.deepEqual(deviceRows(), [
    ['Screen', '1180 × 820 px, landscape, pixel ratio 1.5, dark mode, home screen app'],
    ['Window', '1200 × 900 px on a 1920 × 1080 px screen'],
    ['Browser', UA],
    ['Page', 'https://example.org/app/']]);

  // the issue's address, as 2.1.0 made it, with and without language: 'en'
  const it = {title: 'Feedback: chart', labels: ['feedback'], footer: 'Sent from the app.',
    sections: [{heading: 'Reopen', text: '[Open it again](https://example.org/#x)'}],
    rows: [['View', 'Sales'], ['Screen', '390 × 844 px, portrait, pixel ratio 3, light mode']]};
  const body = '%23%23%20What%E2%80%99s%20wrong%2C%20and%20what%20should%20happen%0A%0A%0A%0A%23%23%20Picture%0A%0A%3C!--%20The%20picture%20was%20copied%3A%20paste%20it%20here%2C%20or%20attach%20the%20saved%20picture.%20--%3E%0A%0A%0A%23%23%20Reopen%0A%0A%5BOpen%20it%20again%5D(https%3A%2F%2Fexample.org%2F%23x)%0A%0A%23%23%20On%20screen%0A%0A%7C%20%7C%20%7C%0A%7C---%7C---%7C%0A%7C%20View%20%7C%20Sales%20%7C%0A%7C%20Screen%20%7C%20390%20%C3%97%20844%20px%2C%20portrait%2C%20pixel%20ratio%203%2C%20light%20mode%20%7C%0A%0A%3Csub%3ESent%20from%20the%20app.%3C%2Fsub%3E';
  for (const language of [undefined, 'en']){
    assert.equal(issueUrl({...it, repo: 'o/r', language}).url, `https://github.com/o/r/issues/new?title=Feedback%3A%20chart&labels=feedback&body=${body}`);
    assert.equal(issueUrl({...it, provider: 'gitlab', repo: 'g/p', language}).url, `https://gitlab.com/g/p/-/issues/new?issue%5Btitle%5D=Feedback%3A%20chart&issue%5Bdescription%5D=${body}%0A%0A%2Flabel%20~feedback`);
  }
});

test('Czech: the issue has no English left, apart from the browser’s user agent', () => {
  const cs = texts('cs');
  const rows = deviceRows(cs);
  assert.deepEqual(rows, [
    ['Obrazovka', '1180 × 820 px, na šířku, poměr pixelů 1,5, tmavý režim, aplikace na ploše'],
    ['Okno', '1200 × 900 px na obrazovce 1920 × 1080 px'],
    ['Prohlížeč', UA],
    ['Stránka', 'https://example.org/app/']]);
  // what a Czech project gives, so that only the kit's own words are left to look at
  const it = {repo: 'o/r', language: 'cs', title: 'Zpětná vazba: graf', footer: 'Odesláno z aplikace.',
    sections: [{heading: 'Znovu otevřít', text: '[Otevřít graf](https://example.org/#den=2)'}],
    rows: [['Den', 'úterý'], ...rows]};
  for (const provider of ['github', 'gitlab']){
    const q = new URL(issueUrl({...it, provider, repo: 'o/r'}).url).searchParams;
    const body = q.get(provider === 'github' ? 'body' : 'issue[description]');
    assert.ok(body.startsWith('## Co je špatně a co by se mělo stát\n\n\n\n## Obrázek\n\n<!-- Obrázek je zkopírovaný: vložte ho sem, nebo přiložte uložený obrázek. -->'), body.slice(0, 120));
    assert.ok(body.includes('\n## Na obrazovce\n\n| | |\n|---|---|\n| Den | úterý |\n| Obrazovka | 1180 × 820 px, na šířku,'));
    const kit = body.replace(UA, '').replace('/label ~feedback', '').replace(/https:\/\/[^\s)|]+/g, '');   // and the addresses
    // no English text of the kit's, and no English word from any of them (a few are the same in both: px, PNG, …)
    for (const [key, text] of Object.entries(STRINGS.en)) if (text !== cs[key] && text.length > 2) assert.ok(!kit.includes(text), `the issue has "${text}"`);
    const czech = new Set(Object.values(cs).join(' ').toLowerCase().match(/\p{L}+/gu));
    const english = new Set(Object.values(STRINGS.en).join(' ').toLowerCase().match(/\p{L}+/gu).filter(w => !czech.has(w) && w.length > 1));
    const words = kit.toLowerCase().match(/\p{L}+/gu).filter(w => english.has(w));
    assert.deepEqual(words, [], `English words in the Czech issue: ${words.join(', ')}`);
  }
});

test('Czech: the provider in the right form, and the pen names', () => {
  const cs = texts('cs');
  assert.equal(format(cs.openIssue, {provider: cs['provider.github']}), 'Napsat hlášení na GitHub');
  assert.equal(format(cs.openIssue, {provider: cs['provider.gitlab']}), 'Napsat hlášení na GitLab');
  assert.ok(format(cs.issueNote, {provider: cs['provider.gitlab']}).startsWith('GitLab otevře nové předvyplněné hlášení. '));
  assert.equal(format(cs.penLabel, {pen: cs.penRed}), 'Červená barva pera');
});

test('strings changes single texts, over the chosen language', () => {
  const t = texts('cs', {openIssue: 'Nahlásit na {provider}'});
  assert.equal(t.openIssue, 'Nahlásit na {provider}');
  assert.equal(t.undo, 'Zpět');
  assert.equal(texts('en', {undo: 'Back'}).undo, 'Back');
  assert.equal(texts(undefined, {undo: 'Back'}).clear, 'Clear');
  // in the issue too
  const body = issueBody({language: 'cs', strings: {issueOnScreen: 'Co bylo vidět'}, rows: [['a', 'b']]});
  assert.ok(body.includes('## Co bylo vidět\n') && body.startsWith('## Co je špatně'));
  // another language: what strings leaves out is English
  const de = texts('de', {undo: 'Rückgängig', heading: 'Feedback senden'});
  assert.equal(de.undo, 'Rückgängig');
  assert.equal(de.clear, 'Clear');
});

test('a wrong language or strings throws', () => {
  assert.throws(() => texts('de'), /no texts for the language "de"/);
  for (const language of ['', 'c', 'english language', 7, null]) assert.throws(() => texts(language), /language must be/, JSON.stringify(language));
  assert.throws(() => texts('cs', {undoo: 'Zpět'}), /unknown key "undoo"/);
  assert.throws(() => texts('cs', {undo: 3}), /strings\.undo must be text/);
  assert.throws(() => texts('cs', 'Zpět'), /strings must be/);
  assert.throws(() => texts('cs', ['Zpět']), /strings must be/);
  assert.throws(() => issueUrl({repo: 'o/r', language: 'xx'}), /no texts/);
  assert.doesNotThrow(() => texts('cs-CZ', {}));
});

test('format puts the values in, and leaves unknown names', () => {
  assert.equal(format('{a} and {b}, {c}', {a: 1, b: 'two'}), '1 and two, {c}');
  assert.equal(format('{toString}', {}), '{toString}');
});

test('the too-long note names the sections that gave way, in each language', () => {
  const two = ['Reopen', 'Data'];
  assert.equal(format(STRINGS.en.tooLong, {sections: listOf(['Reopen'], 'en')}),
    'Too long to put in the issue: Reopen. It has a shorter note in its place, so add that part by hand if it matters.');
  assert.equal(format(STRINGS.en.tooLong, {sections: listOf(two, 'en')}).split('.')[0], 'Too long to put in the issue: Reopen and Data');
  assert.equal(format(STRINGS.cs.tooLong, {sections: listOf(['Znovu otevřít'], 'cs')}),
    'Do hlášení se nevešlo: Znovu otevřít. Je v něm místo toho kratší poznámka, takže pokud na tom záleží, doplňte to ručně.');
  assert.equal(format(STRINGS.cs.tooLong, {sections: listOf(two, 'cs')}).split('.')[0], 'Do hlášení se nevešlo: Reopen a\u00a0Data');   // no line break after a one-letter word, as Czech wants
  assert.equal(listOf(['A', 'B', 'C']), 'A, B, and C');
  assert.equal(listOf(['A', 'B'], 'not a language!'), 'A, B');   // no list format for it: commas
});

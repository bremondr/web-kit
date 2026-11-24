/* Tests for which releases a push to main makes (tools/releases-due.mjs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, releasesDue, tagsFromLsRemote, topHeading } from './releases-due.mjs';

const log = (...sections) => `# Changes to the kit\n\nIntro, with a ## in the middle of a line.\n\n${sections.map(s => `${s}\n\n- Something.\n`).join('\n')}`;
const TAGS = ['kit-v1.0.0', 'kit-v1.1.0', 'other-v0.1.0', 'other-v0.2.0'];

test('the top heading', () => {
  assert.equal(topHeading(log('## 1.2.0 (2026-12-01)', '## 1.1.0 (2026-11-01)')), '1.2.0 (2026-12-01)');
  assert.equal(topHeading('# Changes\n\nNothing yet.\n'), null);
});

test('a dated section without a tag is released', () => {
  const d = decide('kit', log('## 1.2.0 (2026-12-01)', '## 1.1.0 (2026-11-01)'), TAGS);
  assert.equal(d.action, 'release');
  assert.equal(d.tag, 'kit-v1.2.0');
});

test('a new major version, and a module with no release yet', () => {
  assert.equal(decide('kit', log('## 2.0.0 (2026-12-01)'), TAGS).action, 'release');
  assert.equal(decide('new-kit', log('## 1.0.0 (2026-12-01)'), TAGS).tag, 'new-kit-v1.0.0');
});

test('an unreleased section is skipped', () => {
  for (const word of ['unreleased', 'Unreleased']){
    const d = decide('kit', log(`## 1.2.0 (${word})`, '## 1.1.0 (2026-11-01)'), TAGS);
    assert.equal(d.action, 'skip');
    assert.match(d.message, /unreleased/);
  }
  assert.equal(decide('new-kit', log('## 1.0.0 (unreleased)'), TAGS).action, 'skip');
});

test('an unreleased section with a version already used or lower warns, but fails nothing', () => {
  assert.equal(decide('kit', log('## 1.1.0 (unreleased)'), TAGS).action, 'warn');
  assert.equal(decide('kit', log('## 1.0.5 (unreleased)'), TAGS).action, 'warn');
});

test('a section already tagged is skipped, so running again changes nothing', () => {
  const d = decide('kit', log('## 1.1.0 (2026-11-01)', '## 1.0.0 (2026-10-01)'), TAGS);
  assert.equal(d.action, 'skip');
  assert.match(d.message, /already released/);
  // also when an older version is tagged after a newer one: the tag exists, nothing is moved
  assert.equal(decide('kit', log('## 1.0.0 (2026-10-01)'), TAGS).action, 'skip');
});

test('a dated version lower than the newest release is a problem', () => {
  const d = decide('kit', log('## 1.0.5 (2026-12-01)', '## 1.1.0 (2026-11-01)'), TAGS);
  assert.equal(d.action, 'problem');
  assert.match(d.message, /not higher than the newest release, 1\.1\.0/);
});

test('malformed headings are problems', () => {
  for (const heading of ['## 1.2.0', '## 1.2.0 2026-12-01', '## v1.2.0 (2026-12-01)', '## 1.2 (2026-12-01)', '## Unreleased',
    '## 1.2.0 (soon)', '## 1.2.0 (2026-13-01)', '## 1.2.0 (2026-02-30)', '## 1.2.0 (1 December 2026)', '## 1.2.0 (2026-12-01) and more']){
    const d = decide('kit', log(heading, '## 1.1.0 (2026-11-01)'), TAGS);
    assert.equal(d.action, 'problem', heading);
  }
  assert.equal(decide('kit', '# Changes\n\n### 1.2.0 (2026-12-01)\n', TAGS).action, 'problem');
  assert.equal(decide('kit', null, TAGS).action, 'problem');
});

test('two modules in one merge both get their release', () => {
  const r = releasesDue({kit: log('## 1.2.0 (2026-12-01)'), other: log('## 0.3.0 (2026-12-01)'), third: log('## 1.0.0 (unreleased)')}, TAGS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.release, ['kit-v1.2.0', 'other-v0.3.0']);
  assert.deepEqual(r.decisions.map(d => d.action), ['release', 'release', 'skip']);
});

test('a problem in one module releases nothing at all', () => {
  const r = releasesDue({kit: log('## 1.2.0 (2026-12-01)'), other: log('## 0.3.0')}, TAGS);
  assert.equal(r.ok, false);
  assert.deepEqual(r.release, []);
});

test('nothing to release', () => {
  const r = releasesDue({kit: log('## 1.1.0 (2026-11-01)'), other: log('## 0.3.0 (unreleased)')}, TAGS);
  assert.deepEqual(r, {ok: true, release: [], decisions: r.decisions});
});

test('the tags from git ls-remote', () => {
  const out = 'abc\trefs/tags/kit-v1.0.0\ndef\trefs/tags/kit-v1.0.0^{}\n123\trefs/tags/other-v0.1.0\n';
  assert.deepEqual(tagsFromLsRemote(out), ['kit-v1.0.0', 'other-v0.1.0']);
});

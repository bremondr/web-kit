/* The update script's choices (update-vendor.mjs). Plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changesBetween, compare, describe, parseTag, pick, versionsOf } from './update-vendor.mjs';

const TAGS = ['feedback-kit-v1.0.0', 'feedback-kit-v1.10.0', 'feedback-kit-v1.2.0', 'feedback-kit-v2.0.0',
  'share-kit-v0.1.0', 'feedback-kit-vX', 'not-a-release'];

test('versions are compared as numbers', () => {
  assert.ok(compare('1.10.0', '1.2.0') > 0);
  assert.equal(compare('1.2.3', '1.2.3'), 0);
  assert.deepEqual(parseTag('feedback-kit-v1.2.3'), {module: 'feedback-kit', version: '1.2.3'});
  assert.equal(parseTag('feedback-kit-v1.2'), null);
});

test('the releases of one module, oldest first', () => {
  assert.deepEqual(versionsOf(TAGS, 'feedback-kit'), ['1.0.0', '1.2.0', '1.10.0', '2.0.0']);
  assert.deepEqual(versionsOf(TAGS, 'share-kit'), ['0.1.0']);
});

test('the newest release with the same major version, unless new majors are allowed', () => {
  const v = versionsOf(TAGS, 'feedback-kit');
  assert.equal(pick(v, '1.0.0'), '1.10.0');
  assert.equal(pick(v, '1.10.0'), null);
  assert.equal(pick(v, '1.10.0', {major: true}), '2.0.0');
  assert.equal(pick(v, '2.0.0', {major: true}), null);
});

const CHANGELOG = `# Changes to feedback-kit

Intro.

## 1.2.0 (2026-12-01)

- Thicker pen.

## 1.1.0 (2026-11-28)

- Arrow tool.

## 1.0.0 (2026-11-21)

- First release.
`;

test('the changelog between two versions, newest first', () => {
  assert.equal(changesBetween(CHANGELOG, '1.0.0', '1.2.0'), '## 1.2.0 (2026-12-01)\n\n- Thicker pen.\n\n## 1.1.0 (2026-11-28)\n\n- Arrow tool.');
  assert.equal(changesBetween(CHANGELOG, null, '1.0.0'), '## 1.0.0 (2026-11-21)\n\n- First release.');
  assert.equal(changesBetween(CHANGELOG, '1.2.0', '1.2.0'), '');
});

test('the pull request says what changed and warns about a new major version', () => {
  const one = describe([{module: 'feedback-kit', from: '1.0.0', to: '1.1.0', changes: '## 1.1.0\n\n- Arrow tool.'}]);
  assert.equal(one.title, 'Update feedback-kit to 1.1.0');
  assert.match(one.body, /^## feedback-kit: 1\.0\.0 → 1\.1\.0\n\n### 1\.1\.0\n\n- Arrow tool\./);
  assert.doesNotMatch(one.body, /major/);
  const two = describe([{module: 'feedback-kit', from: '1.1.0', to: '2.0.0', changes: ''}, {module: 'share-kit', from: null, to: '0.1.0', changes: ''}]);
  assert.equal(two.title, 'Update feedback-kit to 2.0.0, share-kit to 0.1.0');
  assert.match(two.body, /A new major version/);
  assert.match(two.body, /## share-kit: new → 0\.1\.0/);
});

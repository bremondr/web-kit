import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBranch, checkFolder, checkRepo, hashValue, hashWithout, idOfFile, itemPath, parseRepo } from './sources.js';

const short = n => `bremondr/ultimate-playbook-${n}`;

test('full repo names are checked against GitHub\'s rules', () => {
  assert.equal(checkRepo('bremondr/ultimate-playbook-sunset'), 'bremondr/ultimate-playbook-sunset');
  assert.equal(checkRepo(' Some-Org/repo.name_2 '), 'Some-Org/repo.name_2');
  for (const bad of ['', 'owner', 'owner/', '/repo', 'a/b/c', '-owner/repo', 'owner-/repo', 'ow--ner/repo', 'owner/..', 'owner/.',
    'owner/repo.git', 'own er/repo', 'owner/re po', 'owner/repo?x=1', 'owner/repo#x', 'https://github.com/a/b', '../../etc/passwd',
    'a'.repeat(40) + '/repo', 'owner/' + 'r'.repeat(101), 'owner/rep%2F', 'ówner/repo', null, 42])
    assert.equal(checkRepo(bad), null, String(bad));
});

test('link values: a short name through the project, or owner/repo in full', () => {
  assert.equal(parseRepo('sunset', short), 'bremondr/ultimate-playbook-sunset');
  assert.equal(parseRepo('someone/their-playbook', short), 'someone/their-playbook');
  assert.equal(parseRepo('sunset'), null, 'no short names without the option');
  assert.equal(parseRepo('sun set', short), null);
  assert.equal(parseRepo('..', short), null);
  assert.equal(parseRepo('x', () => 'not a repo'), null);
  assert.equal(parseRepo('x', () => { throw new Error('no'); }), null);
  assert.equal(parseRepo('javascript:alert(1)', short), null);
});

test('the link parameter is read from the hash, and can be taken out', () => {
  assert.equal(hashValue('#team=sunset', 'team'), 'sunset');
  assert.equal(hashValue('#angel&team=owner%2Frepo&t=4', 'team'), 'owner/repo');
  assert.equal(hashValue('#teams=x', 'team'), null);
  assert.equal(hashValue('', 'team'), null);
  assert.equal(hashValue('#team=%E0%A4%A', 'team'), null, 'broken escapes');
  assert.equal(hashWithout('#angel&team=sunset&t=4', 'team'), '#angel&t=4');
  assert.equal(hashWithout('#team=sunset', 'team'), '');
});

test('folders, branches, item files', () => {
  assert.equal(checkFolder('drills'), 'drills');
  assert.equal(checkFolder('/data/boards/'), 'data/boards');
  assert.equal(checkFolder(''), '');
  for (const bad of ['../x', 'a/../b', 'a b', 'a//b']) assert.throws(() => checkFolder(bad), bad);
  assert.equal(checkBranch(null), null);
  assert.equal(checkBranch('main'), 'main');
  assert.equal(checkBranch('feature/x'), 'feature/x');
  for (const bad of ['a/../c', 'x.lock', 'a b', 'a//b']) assert.throws(() => checkBranch(bad), bad);
  assert.equal(itemPath('drills', 'abc_1-2'), 'drills/abc_1-2.json');
  assert.equal(itemPath('', 'abc'), 'abc.json');
  assert.throws(() => itemPath('drills', '../x'));
  assert.equal(idOfFile('k3x9.json'), 'k3x9');
  assert.equal(idOfFile('README.md'), null);
  assert.equal(idOfFile('a b.json'), null);
  assert.equal(idOfFile('.json'), null);
});

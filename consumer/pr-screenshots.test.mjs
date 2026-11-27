import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageUrl, markdown, parseArgs, repoOfRemote } from './pr-screenshots.mjs';

const script = new URL('./pr-screenshots.mjs', import.meta.url).pathname;

test('the repository from the remote, and the links', () => {
  assert.equal(repoOfRemote('https://github.com/bremondr/web-kit.git'), 'bremondr/web-kit');
  assert.equal(repoOfRemote('git@github.com:bremondr/web-kit.git'), 'bremondr/web-kit');
  assert.equal(repoOfRemote('http://local_proxy@127.0.0.1:1234/git/bremondr/web-kit'), 'bremondr/web-kit');
  assert.equal(repoOfRemote(''), null);
  assert.equal(imageUrl('me/x', 'pr-5/a b.png'), 'https://github.com/me/x/blob/pr-screenshots/pr-5/a%20b.png?raw=true');
  assert.equal(markdown('me/x', ['pr-5/git-store_index.png']), '![git store index](https://github.com/me/x/blob/pr-screenshots/pr-5/git-store_index.png?raw=true)');
});

test('the arguments are checked', () => {
  assert.deepEqual(parseArgs(['--list']), {mode: 'list', repo: null});
  assert.deepEqual(parseArgs(['--remove', '61', '62']), {mode: 'remove', numbers: [61, 62], repo: null});
  assert.throws(() => parseArgs(['--remove']), /numbers/);
  assert.throws(() => parseArgs(['x', 'a.png']), /Not a pull request number/);
  assert.throws(() => parseArgs(['5', 'notes.txt']), /Not an image/);
  assert.throws(() => parseArgs(['5', 'missing.png']), /No such file/);
  assert.throws(() => parseArgs(['5']), /Usage/);
  assert.throws(() => parseArgs(['--repo', 'nope', '--list']), /owner\/name/);
});

test('adds folders to the branch, replaces, removes, and leaves the checkout alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pr-shots-test-'));
  const env = {...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t'};
  const git = (cwd, ...a) => execFileSync('git', a, {cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const run = (...a) => execFileSync(process.execPath, [script, ...a], {cwd: join(dir, 'work'), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  try {
    git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
    git(dir, 'clone', '-q', join(dir, 'origin.git'), 'work');
    const work = join(dir, 'work');
    writeFileSync(join(work, 'app.js'), 'x\n');
    git(work, 'add', '.'); git(work, 'commit', '-qm', 'app'); git(work, 'push', '-q', 'origin', 'HEAD:main');
    writeFileSync(join(dir, 'a.png'), 'A'); writeFileSync(join(dir, 'b.png'), 'B');
    writeFileSync(join(work, 'untracked.txt'), 'mine');

    const out = run('--repo', 'me/x', '7', join(dir, 'a.png'), join(dir, 'b.png'));
    assert.match(out, /!\[a\]\(https:\/\/github\.com\/me\/x\/blob\/pr-screenshots\/pr-7\/a\.png\?raw=true\)/);
    const files = () => git(join(dir, 'origin.git'), 'ls-tree', '-r', '--name-only', 'pr-screenshots').split('\n');
    assert.deepEqual(files(), ['README.md', 'pr-7/a.png', 'pr-7/b.png']);
    assert.equal(git(join(dir, 'origin.git'), 'rev-list', '--count', 'pr-screenshots'), '1', 'its own history');
    assert.equal(git(work, 'status', '--porcelain'), '?? untracked.txt', 'the checkout is untouched');
    assert.equal(git(work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');

    writeFileSync(join(dir, 'a.png'), 'A2');
    run('--repo', 'me/x', '8', join(dir, 'a.png'));
    run('--repo', 'me/x', '7', join(dir, 'a.png'));
    assert.deepEqual(files(), ['README.md', 'pr-7/a.png', 'pr-7/b.png', 'pr-8/a.png']);
    assert.equal(git(join(dir, 'origin.git'), 'show', 'pr-screenshots:pr-7/a.png'), 'A2', 'replaced');
    assert.equal(run('--list').trim(), 'pr-7\npr-8');

    assert.match(run('--remove', '7', '9'), /Removed/);
    assert.deepEqual(files(), ['README.md', 'pr-8/a.png']);
    assert.match(run('--remove', '7'), /Nothing to remove/);
    assert.equal(git(join(dir, 'origin.git'), 'rev-parse', 'main'), git(work, 'rev-parse', 'main'), 'main untouched');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('--repo takes exactly owner/name', () => {
  assert.throws(() => parseArgs(['--repo', 'a/b/c', '--list']), /owner\/name/);
  assert.throws(() => parseArgs(['--repo', 'https://github.com/a/b', '--list']), /owner\/name/);
  assert.equal(parseArgs(['--repo', 'bremondr/web-kit', '--list']).repo, 'bremondr/web-kit');
});

test('brackets in a file name are escaped in the Markdown', () => {
  assert.equal(markdown('me/r', ['pr-6/panel [cs].png']), '![panel \\[cs\\]](' + imageUrl('me/r', 'pr-6/panel [cs].png') + ')');
});

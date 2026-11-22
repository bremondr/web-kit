/* Tests for the new-project script, and that web-kit's own copies of the consumer files haven't drifted. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, CONSUMER_FILES, fill, placeholders } from './new-project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('placeholders from the repository name', () => {
  assert.deepEqual(placeholders('Someone/my-app', 'My App'),
    {TITLE: 'My App', REPO: 'Someone/my-app', OWNER: 'Someone', NAME: 'my-app', PAGES_URL: 'https://someone.github.io/my-app/'});
  assert.equal(placeholders('someone/someone.github.io').PAGES_URL, 'https://someone.github.io/');
  assert.equal(placeholders('o/app').TITLE, 'app');
  assert.throws(() => placeholders('no-slash'));
  assert.equal(fill('{{TITLE}} {{OTHER}}', {TITLE: 'A'}), 'A {{OTHER}}');
});

test('a new project gets the template and the consumer files', () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'new-project-')), 'app');
  try {
    const files = assemble({target, repo: 'o/app', title: 'The App'});
    for (const f of ['index.html', 'CLAUDE.md', 'README.md', 'vendor.json', 'site.json', '.nojekyll', '.github/workflows/test.yml', ...Object.values(CONSUMER_FILES)]) {
      assert.ok(files.includes(f), `${f} is there`);
    }
    for (const [from, to] of Object.entries(CONSUMER_FILES)) {
      assert.ok(fs.readFileSync(path.join(ROOT, from)).equals(fs.readFileSync(path.join(target, to))), `${to} is ${from} as it is`);
    }
    const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
    assert.ok(readme.startsWith('# The App') && readme.includes('https://o.github.io/app/preview/pr-<number>/'));
    for (const f of files.filter(f => /\.(html|md|json|yml|js|mjs|css)$/.test(f) && !Object.values(CONSUMER_FILES).includes(f))) {
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(fs.readFileSync(path.join(target, f), 'utf8')), `${f} has no placeholders left`);
    }
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'site.json'), 'utf8')).name, 'The App');
    assert.throws(() => assemble({target, repo: 'o/app'}), /isn't empty/);
  } finally {
    fs.rmSync(path.dirname(target), {recursive: true, force: true});
  }
});

test('the template keeps no copies of the consumer files', () => {
  for (const to of Object.values(CONSUMER_FILES)) assert.ok(!fs.existsSync(path.join(ROOT, 'template', to)), `template/${to} would drift from consumer/`);
});

test('web-kit\'s own deploy workflow is consumer/pages.yml, with the scripts in consumer/', () => {
  const original = fs.readFileSync(path.join(ROOT, 'consumer/pages.yml'), 'utf8');
  const own = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.ok(original.includes('\n  SITE_TOOLS: tools\n'));
  assert.equal(own, original.replace('\n  SITE_TOOLS: tools\n', '\n  SITE_TOOLS: consumer\n'));
});

/* Tests for the site build and the preview runtime. Plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  build, buildInfo, contentVersion, dropScripts, eligiblePreviews, localReferences, parseArgs, patternRegex,
  previewPageHtml, previewsIndexHtml, readConfig, runtimeSource, runtimeSrcFor, siteFiles, stampServiceWorker,
  startPath, STUB_SERVICE_WORKER
} from './build-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, 'preview-runtime.js');
const TEMPLATE = fs.readFileSync(RUNTIME, 'utf8');

test('site.json: defaults, and what it can\'t be', () => {
  const config = readConfig({});
  assert.deepEqual(config.pages, ['index.html']);
  assert.deepEqual(config.checks, ['node --test']);
  assert.equal(config.paths, null);
  assert.equal(readConfig({root: 'site/'}).root, 'site');
  assert.throws(() => readConfig({pages: []}));
  assert.throws(() => readConfig({exclude: 'x'}));
  assert.throws(() => readConfig({root: '../x'}));
  assert.throws(() => readConfig({maxPreviews: -1}));
});

test('patterns: names anywhere, folders, and from the root', () => {
  const t = (p, f) => patternRegex(p).test(f);
  assert.ok(t('*.md', 'README.md') && t('*.md', 'js/vendor/x/README.md'));
  assert.ok(!t('*.md', 'a.mdx'));
  assert.ok(t('/tools/', 'tools/a.mjs') && !t('/tools/', 'js/tools/a.mjs'));
  assert.ok(t('tools/', 'js/tools/a.mjs'), 'a folder without a leading / is any folder of that name');
  assert.ok(t('demo/*.json', 'demo/a.json') && !t('demo/*.json', 'demo/x/a.json') && !t('demo/*.json', 'x/demo/a.json'));
  assert.ok(t('demo/**/*.json', 'demo/x/y/a.json'));
  assert.ok(t('notes', 'notes/a.txt') && t('notes', 'x/notes'));
  assert.ok(t('a?.js', 'ab.js') && !t('a?.js', 'a/.js'));
});

test('the site\'s files: everything but the usual non-site files, or just "paths"', () => {
  const all = ['index.html', 'README.md', 'tools/build-site.mjs', 'js/a.js', 'js/a.test.mjs', 'site.json', '.github/workflows/x.yml', 'consumer/x.mjs', 'docs/a.md'];
  assert.deepEqual(siteFiles(all, readConfig({exclude: ['/consumer/']})), ['index.html', 'js/a.js']);
  assert.deepEqual(siteFiles(['index.html', 'js/a.js', 'js/a.test.mjs'], readConfig({paths: ['index.html', 'js']})), ['index.html', 'js/a.js', 'js/a.test.mjs']);
});

test('the preview link points at the first page', () => {
  assert.equal(startPath(readConfig({})), '');
  assert.equal(startPath(readConfig({pages: ['demo/index.html']})), 'demo/');
  assert.equal(startPath(readConfig({pages: ['app.html']})), 'app.html');
});

test('the runtime goes first in <head>, with noindex, and dropped scripts are gone', () => {
  const html = previewPageHtml('<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n  <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>\n<script type="module" src="js/main.js"></script>\n</head></html>', '../preview-runtime.js', ['simpleanalyticscdn']);
  const head = html.slice(html.indexOf('<head>'));
  assert.ok(head.indexOf('<script src="../preview-runtime.js">') < head.indexOf('charset'));
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!html.includes('simpleanalyticscdn') && html.includes('js/main.js'));
  assert.throws(() => previewPageHtml('<html><body></body></html>', 'preview-runtime.js'));
  assert.equal(dropScripts('<script src="a.js"></script>\n', []), '<script src="a.js"></script>\n');
  assert.equal(runtimeSrcFor('index.html'), 'preview-runtime.js');
  assert.equal(runtimeSrcFor('demo/a/b.html'), '../../preview-runtime.js');
});

test('the runtime gets the build description', () => {
  const info = buildInfo({name: 'pr-7', label: 'PR #7', sha: '0123456789abcdef', number: 7, repo: 'o/r'});
  assert.equal(info.sha, '0123456');
  assert.equal(info.storagePrefix, 'preview:pr-7:');
  assert.equal(info.pullUrl, 'https://github.com/o/r/pull/7');
  assert.equal(info.feedback, null);
  const withFeedback = buildInfo({name: 'pr-7', label: 'PR #7', number: 7, repo: 'o/r', config: readConfig({feedback: {labels: ['feedback']}, global: 'APP_PREVIEW'})});
  assert.deepEqual(withFeedback.feedback, {repo: 'o/r', labels: ['feedback'], event: 'preview:feedback'});
  assert.equal(withFeedback.global, 'APP_PREVIEW');
  const source = runtimeSource(TEMPLATE, info);
  assert.ok(source.includes('"storagePrefix":"preview:pr-7:"'));
  assert.ok(!source.includes('/*BUILD*/ null'));
  assert.throws(() => runtimeSource('no marker', info));
});

test('forks and malformed entries never become previews', () => {
  const pulls = [{number: 3, ref: 'a'}, {number: 4, ref: 'b', isCrossRepository: true}, {number: 'x', ref: 'c'}, {number: 5}];
  assert.deepEqual(eligiblePreviews(pulls).map(p => p.number), [3]);
});

test('local references: relative files the page loads', () => {
  const refs = localReferences(`<link rel="stylesheet" href="../css/a.css"><link rel="stylesheet" href="https://fonts.googleapis.com/x">
    <link rel="canonical" href="other.html"><link rel="icon" href="i.png"><a href="nope.html">
    <!-- <script src="old.js"></script> --><script type="module" src="./main.js?v=2"></script><img src="data:image/png;base64,AA"><img src="pics/">`, 'demo/index.html');
  assert.deepEqual(refs.sort(), ['css/a.css', 'demo/i.png', 'demo/main.js', 'demo/pics/index.html']);
});

test('the previews list escapes titles and links to the start page', () => {
  const html = previewsIndexHtml([{number: 9, title: '<b>x</b>', isDraft: true, sha: 'abc1234'}], 'o/r', {name: 'Kit', start: 'demo/'});
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(html.includes('href="pr-9/demo/"'));
  assert.ok(html.includes('<title>Kit previews</title>'));
  assert.ok(html.includes('draft'));
  assert.match(previewsIndexHtml([], ''), /No previews right now/);
});

test('the live service worker gets its version and file list from what is published', () => {
  const sw = "const VERSION = 'v2';\nconst APP_FILES = [\n  './',\n  './old.js'\n];\nself.x = 1;\n";
  const out = stampServiceWorker(sw, 'abc123', ['js/b.js', 'index.html', 'css/a.css']);
  assert.match(out, /const VERSION = 'abc123';/);
  assert.ok(out.includes("const APP_FILES = [\n  './',\n  './css/a.css',\n  './index.html',\n  './js/b.js'\n];"));
  assert.ok(!out.includes('old.js') && out.endsWith('self.x = 1;\n'));
  assert.throws(() => stampServiceWorker('nothing here', 'x', []));
  const a = contentVersion([['a.js', 'one'], ['b.js', 'two']]);
  assert.equal(a, contentVersion([['b.js', 'two'], ['a.js', 'one']]), 'order does not matter');
  assert.notEqual(a, contentVersion([['a.js', 'one!'], ['b.js', 'two']]), 'content does');
  assert.notEqual(a, contentVersion([['a.js', 'one'], ['c.js', 'two']]), 'names do');
});

test('arguments', () => {
  assert.deepEqual(parseArgs(['--out', '_site', '--run-checks', '--main', 'HEAD']), {out: '_site', 'run-checks': true, main: 'HEAD'});
  assert.throws(() => parseArgs(['--out']));
  assert.throws(() => parseArgs(['x']));
});

/* ---- the runtime in a pretend browser ---- */

function fakeStorageClass() {
  class Storage {
    constructor() { this._m = new Map(); }
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }
    setItem(k, v) { this._m.set(k, String(v)); }
    removeItem(k) { this._m.delete(k); }
    key(i) { return [...this._m.keys()][i] ?? null; }
    clear() { this._m.clear(); }
    get length() { return this._m.size; }
  }
  return Storage;
}

test('a preview sees only its own storage', async () => {
  const Storage = fakeStorageClass();
  const store = new Storage();
  store.setItem('prefs', 'live');
  const opened = [];
  class IDBFactory {
    open(name, version) { opened.push([name, version]); return {name}; }
    deleteDatabase(name) { opened.push(['delete', name]); }
    databases() { return Promise.resolve([{name: 'live-db', version: 1}, {name: 'preview:pr-2:mine', version: 3}]); }
  }
  class CacheStorage {
    constructor() { this.names = ['live-v1', 'preview:pr-2:c']; }
    open(name) { return Promise.resolve(name); }
    has(name) { return Promise.resolve(this.names.includes(name)); }
    delete(name) { this.names = this.names.filter(n => n !== name); return Promise.resolve(true); }
    keys() { return Promise.resolve([...this.names]); }
  }
  const sandbox = {Storage, IDBFactory, CacheStorage};
  vm.runInNewContext(runtimeSource(TEMPLATE, buildInfo({name: 'pr-2', label: 'PR #2'})), sandbox);
  assert.equal(store.getItem('prefs'), null);
  store.setItem('prefs', 'preview');
  assert.equal(store.getItem('prefs'), 'preview');
  assert.equal(store.length, 1);
  assert.equal(store.key(0), 'prefs');
  store.clear();
  assert.equal(store._m.get('prefs'), 'live');   // the live site's value is untouched
  assert.equal(store._m.size, 1);

  const idb = new IDBFactory();
  idb.open('mine', 3);
  idb.deleteDatabase('mine');
  assert.deepEqual(opened, [['preview:pr-2:mine', 3], ['delete', 'preview:pr-2:mine']]);
  assert.equal(JSON.stringify(await idb.databases()), '[{"name":"mine","version":3}]');

  const caches = new CacheStorage();
  assert.equal(await caches.open('c'), 'preview:pr-2:c');
  assert.equal(JSON.stringify(await caches.keys()), '["c"]');
  await caches.delete('live-v1');
  assert.ok(caches.names.includes('live-v1'), 'a preview can\'t delete the live site\'s cache');
  assert.equal(sandbox.SITE_PREVIEW.name, 'pr-2');
});

test('links: the live version of the same page, and all previews', () => {
  const sandbox = {URL};
  vm.runInNewContext(TEMPLATE, sandbox);
  const links = sandbox.__sitePreview.linksFor('https://o.github.io/kit/preview/pr-3/preview-runtime.js', 'https://o.github.io/kit/preview/pr-3/demo/a.html?x#y');
  assert.equal(links.liveUrl, 'https://o.github.io/kit/demo/a.html');
  assert.equal(links.indexUrl, 'https://o.github.io/kit/preview/');
});

test('the badge\'s Feedback link falls back to a new issue about the preview', () => {
  const sandbox = {};
  const config = readConfig({feedback: {labels: ['feedback', 'preview']}, global: 'APP_PREVIEW'});
  vm.runInNewContext(runtimeSource(TEMPLATE, buildInfo({name: 'pr-2', label: 'PR #2', sha: 'abcdef1234', number: 2, repo: 'o/r', config})), sandbox);
  assert.equal(sandbox.APP_PREVIEW, sandbox.SITE_PREVIEW);
  const win = {location: {href: 'https://x.github.io/app/preview/pr-2/#box'}, navigator: {userAgent: 'UA'}, innerWidth: 820, innerHeight: 1180};
  const url = new URL(sandbox.__sitePreview.feedbackUrl(sandbox.SITE_PREVIEW, win));
  assert.equal(url.origin + url.pathname, 'https://github.com/o/r/issues/new');
  assert.equal(url.searchParams.get('labels'), 'feedback,preview');
  assert.equal(url.searchParams.get('title'), 'Feedback on preview PR #2');
  assert.match(url.searchParams.get('body'), /- Where: Preview PR #2 \(commit abcdef1\)\n- Page: https:\/\/x\.github\.io\/app\/preview\/pr-2\/#box\n- Screen: 820 × 1180 px/);
});

/* ---- a whole build, from a small repository made here ---- */

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-repo-'));
  const g = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {cwd: dir, stdio: 'pipe'});
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true}); fs.writeFileSync(path.join(dir, file), text); };
  const commit = (message) => { g('add', '-A'); g('commit', '-q', '-m', message); return g('rev-parse', 'HEAD').toString().trim(); };
  g('init', '-q', '-b', 'main');
  write('index.html', '<!doctype html><html><head><title>A</title><script async src="https://cdn.example/stats.js"></script><link rel="stylesheet" href="css/a.css"></head><body><script type="module" src="js/main.js"></script></body></html>');
  write('css/a.css', 'body{}');
  write('js/main.js', 'localStorage.x = 1;');
  write('js/main.test.mjs', '');
  write('help/index.html', '<!doctype html><html><head><title>Help</title></head><body></body></html>');
  write('raw.html', '<p>no head</p>');
  write('sw.js', "const VERSION = 'dev';\nconst APP_FILES = [\n  './'\n];\n");
  write('README.md', '# A');
  write('tools/build-site.mjs', '');
  write('site.json', '{}');
  const main = commit('main');
  g('switch', '-q', '-c', 'feature');
  write('js/main.js', 'localStorage.x = 2;');
  const feature = commit('feature');
  g('switch', '-q', '-c', 'broken');
  fs.rmSync(path.join(dir, 'css'), {recursive: true});
  commit('broken');
  g('switch', '-q', 'main');
  return {dir, main, feature, cleanup: () => fs.rmSync(dir, {recursive: true, force: true})};
}

test('builds the live site and previews from git', () => {
  const repo = makeRepo();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'site-out-'));
  try {
    const config = {name: 'A', serviceWorker: 'sw.js', dropFromPreviews: ['cdn.example'], exclude: ['raw.html']};
    const summary = build({out, main: 'main', cwd: repo.dir, runtime: RUNTIME, repo: 'o/r', config, previews: [
      {number: 1, ref: 'feature', title: 'Feature'}, {number: 2, ref: 'broken'}, {number: 3, ref: 'refs/heads/nope'}, {number: 4, ref: 'feature', isCrossRepository: true}
    ]});
    const read = f => fs.readFileSync(path.join(out, f), 'utf8');
    const has = f => fs.existsSync(path.join(out, f));
    // the live site: the site's files only, with the service worker stamped
    assert.ok(has('index.html') && has('css/a.css') && has('.nojekyll') && has('help/index.html'));
    for (const f of ['README.md', 'tools', 'site.json', 'js/main.test.mjs', 'raw.html', 'preview-runtime.js']) assert.ok(!has(f), `${f} is not published`);
    assert.ok(read('index.html').includes('cdn.example'), 'the live site keeps its scripts');
    assert.match(read('sw.js'), new RegExp(`const VERSION = '${summary.version}';`));
    assert.ok(read('sw.js').includes("'./help/index.html'") && !read('sw.js').includes("'./sw.js'"));
    // the preview: its own files, the runtime in every page, the service worker stubbed
    assert.equal(read('preview/pr-1/js/main.js'), 'localStorage.x = 2;');
    assert.ok(read('preview/pr-1/index.html').includes('<script src="preview-runtime.js">'));
    assert.ok(!read('preview/pr-1/index.html').includes('cdn.example'));
    assert.ok(read('preview/pr-1/help/index.html').includes('<script src="../preview-runtime.js">'));
    assert.ok(read('preview/pr-1/preview-runtime.js').includes('"storagePrefix":"preview:pr-1:"'));
    assert.equal(read('preview/pr-1/sw.js'), STUB_SERVICE_WORKER);
    assert.equal(summary.production, repo.main);
    assert.deepEqual(summary.comment, {marker: '<!-- site-preview -->', note: readConfig({}).commentNote});
    assert.deepEqual(summary.results.map(r => [r.number, r.status]), [[1, 'built'], [2, 'skipped'], [3, 'skipped']]);
    assert.match(summary.results[1].reason, /css\/a\.css/);
    assert.equal(summary.results[2].reason, 'its head could not be fetched');
    assert.equal(summary.results[0].sha, repo.feature.slice(0, 7));
    assert.ok(!has('preview/pr-2') && !has('preview/pr-3') && !has('preview/pr-4'));
    assert.match(read('preview/index.html'), /href="pr-1\/"/);
  } finally {
    fs.rmSync(out, {recursive: true, force: true});
    repo.cleanup();
  }
});

test('the cap counts built previews only; a missing page skips the preview', () => {
  const repo = makeRepo();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'site-out-'));
  try {
    const summary = build({out, main: 'main', cwd: repo.dir, runtime: RUNTIME, config: {maxPreviews: 1},
      previews: [{number: 5, ref: 'refs/heads/nope'}, {number: 4, ref: 'feature'}, {number: 3, ref: 'feature'}]});
    assert.deepEqual(summary.results.map(r => [r.number, r.status]), [[5, 'skipped'], [4, 'built'], [3, 'over-cap']]);
    // a page main doesn't have stops the build: a broken main is never published
    assert.throws(() => build({out, main: 'main', cwd: repo.dir, runtime: RUNTIME, config: {pages: ['index.html', 'app/index.html']}}), /has no app\/index\.html/);
    // a page a pull request doesn't have skips its preview
    const pages = build({out, main: 'feature', cwd: repo.dir, runtime: RUNTIME, config: {pages: ['index.html', 'css/a.css']},
      previews: [{number: 2, ref: 'broken'}]});
    assert.deepEqual(pages.results.map(r => [r.status, r.reason]), [['skipped', 'the head has no css/a.css, rebase on main']]);
  } finally {
    fs.rmSync(out, {recursive: true, force: true});
    repo.cleanup();
  }
});

test('a site in a folder of its own', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-repo-'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'site-out-'));
  const g = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {cwd: dir, stdio: 'pipe'});
  try {
    g('init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(dir, 'public/app'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'public/app/index.html'), '<html><head></head><body></body></html>');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'not the site');
    g('add', '-A'); g('commit', '-q', '-m', 'x');
    const summary = build({out, main: 'main', cwd: dir, runtime: RUNTIME, config: {root: 'public', pages: ['app/index.html']}, previews: [{number: 8, ref: 'main'}]});
    assert.ok(fs.existsSync(path.join(out, 'app/index.html')) && !fs.existsSync(path.join(out, 'notes.txt')));
    assert.ok(fs.readFileSync(path.join(out, 'preview/pr-8/app/index.html'), 'utf8').includes('<script src="../preview-runtime.js">'));
    assert.equal(summary.start, 'app/');
  } finally {
    fs.rmSync(out, {recursive: true, force: true});
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

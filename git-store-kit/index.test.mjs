// The index (git-store-index.json): reading public repos with no API requests, its fallbacks, and default sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitStore } from './store.js';
import { createFakeGitHub } from './fake-github.js';
import { gitBlobSha } from './github.js';
import { memoryCache } from './cache.js';
import { indexedFiles, INDEX_FILE } from './sources.js';
import { blobSha, indexFolders, indexText, isCurrent } from './index/build-index.mjs';

const WRITE = 'github_pat_' + 'w'.repeat(40);
const DEMO = 'me/team-demo', PLAIN = 'me/team-plain';

function memoryStorage(){
  const m = new Map();
  return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)};
}
const read = json => json && typeof json.name === 'string' && Array.isArray(json.steps) ? {id: json.id, name: json.name, steps: json.steps} : null;
const write = item => ({id: item.id, name: item.name, steps: item.steps});
const FILES = {
  'drills/angel.json': {id: 'angel', name: 'Angel drill', steps: [1, 2]},
  'drills/box.json': {id: 'box', name: 'Box drill', steps: [1]},
  'drills/README.md': '# drills',
  'plans/tue.json': {id: 'tue', name: 'Tuesday', steps: [1]},
  'README.md': '# demo'
};

async function setup({index = true, files = FILES, storage = memoryStorage(), cache = memoryCache(), fake, options = {}} = {}){
  if (!fake){
    fake = createFakeGitHub();
    await fake.addRepo(DEMO, {files, index});
    await fake.addRepo(PLAIN, {files});
    fake.addToken(WRITE, DEMO, 'write');
  }
  const make = (more = {}) => createGitStore({app: 'idx-app', folder: 'drills', param: 'team', shortName: n => `me/team-${n}`, read, write, fetch: fake.fetch, storage, cache, ...options, ...more});
  return {store: make(), make, fake, storage, cache};
}
const fresh = fake => { fake.requests.api = 0; fake.requests.raw = 0; fake.log.length = 0; };
const rawFiles = fake => fake.log.filter(e => e.url.startsWith('https://raw.')).map(e => e.url.split('/').slice(6).join('/'));

test('the index is checked field by field; anything wrong makes it unusable', () => {
  const sha = 'a'.repeat(40);
  const good = {type: 'git-store-index', version: 1, generatedAt: '2026-12-01T10:00:00Z', commit: 'b'.repeat(40),
    folders: {drills: [{name: 'abc.json', path: 'drills/abc.json', sha, size: 12}], plans: [], 'data/boards': [{name: 'x.json', path: 'data/boards/x.json', sha}]}};
  assert.deepEqual(indexedFiles(good, 'drills'), [{name: 'abc.json', path: 'drills/abc.json', sha, size: 12}]);
  assert.deepEqual(indexedFiles(good, 'plans'), []);
  assert.deepEqual(indexedFiles(good, 'data/boards'), [{name: 'x.json', path: 'data/boards/x.json', sha, size: null}]);
  assert.equal(indexedFiles(good, 'games'), null, 'a folder the index does not list');
  const bad = change => { const v = structuredClone(good); change(v); return indexedFiles(v, 'drills'); };
  for (const [why, change] of [
    ['another type', v => { v.type = 'something'; }],
    ['another version', v => { v.version = 2; }],
    ['folders a list', v => { v.folders = []; }],
    ['folder not a list', v => { v.folders.drills = {}; }],
    ['a short sha', v => { v.folders.drills[0].sha = 'abc'; }],
    ['an upper-case sha', v => { v.folders.drills[0].sha = 'A'.repeat(40); }],
    ['a path outside the folder', v => { v.folders.drills[0].path = 'plans/abc.json'; }],
    ['a path going up', v => { v.folders.drills[0] = {name: '..json', path: 'drills/..json', sha}; }],
    ['a name that is no item id', v => { v.folders.drills[0] = {name: 'a b.json', path: 'drills/a b.json', sha}; }],
    ['a file twice', v => { v.folders.drills.push(v.folders.drills[0]); }],
    ['a negative size', v => { v.folders.drills[0].size = -1; }],
    ['a bad commit', v => { v.commit = 'nope'; }],
    ['a bad date', v => { v.generatedAt = 'yesterday'; }],
    ['an entry that is not an object', v => { v.folders.drills.push('x.json'); }]
  ]) assert.equal(bad(change), null, why);
  for (const v of [null, 'text', [], 42]) assert.equal(indexedFiles(v, 'drills'), null);
  // __proto__ and friends are not folders
  assert.equal(indexedFiles(JSON.parse('{"type":"git-store-index","version":1,"folders":{}}'), 'constructor'), null);
});

test('without a token, a repo with an index loads with zero API requests', async () => {
  const {store, fake} = await setup();
  store.follow(DEMO);
  fresh(fake);
  let [src] = await store.load();
  assert.equal(src.error, null);
  assert.deepEqual(src.items.map(i => i.id), ['angel', 'box']);
  assert.equal(src.fromIndex, true);
  assert.equal(src.outdated, 0);
  assert.equal(src.private, false);
  assert.equal(fake.requests.api, 0, 'no API request at all');
  assert.equal(fake.used, 0);
  assert.deepEqual(rawFiles(fake), [INDEX_FILE, 'drills/angel.json', 'drills/box.json']);
  // again: only the index, nothing changed
  fresh(fake);
  [src] = await store.load();
  assert.deepEqual(rawFiles(fake), [INDEX_FILE]);
  assert.equal(fake.requests.api, 0);
  // a change elsewhere (the workflow rebuilds the index): only that file
  await fake.edit(DEMO, 'drills/box.json', {id: 'box', name: 'Box drill, faster', steps: [1, 2]});
  await fake.edit(DEMO, 'drills/new.json', {id: 'new', name: 'New drill', steps: [3]});
  await fake.edit(DEMO, 'drills/angel.json', null);
  fresh(fake);
  [src] = await store.load();
  assert.deepEqual(src.items.map(i => [i.id, i.name]), [['box', 'Box drill, faster'], ['new', 'New drill']]);
  assert.deepEqual(rawFiles(fake).sort(), ['drills/box.json', 'drills/new.json', INDEX_FILE]);
  assert.equal(fake.requests.api, 0);
});

test('two stores of one app share the index: plans come from the same file', async () => {
  const {fake, storage, cache} = await setup();
  const plans = createGitStore({app: 'idx-app', folder: 'plans', read, write, fetch: fake.fetch, storage, cache});
  plans.follow(DEMO);
  fresh(fake);
  const [src] = await plans.load();
  assert.deepEqual(src.items.map(i => i.id), ['tue']);
  assert.equal(src.fromIndex, true);
  assert.equal(fake.requests.api, 0);
});

test('a missing, invalid or incomplete index falls back to listing through the API', async () => {
  const {store, fake} = await setup();
  store.follow(PLAIN);   // no index
  fresh(fake);
  let [src] = await store.load();
  assert.deepEqual(src.items.map(i => i.id), ['angel', 'box']);
  assert.equal(src.fromIndex, false);
  assert.equal(fake.requests.api, 1, 'the folder listing');
  for (const [why, text] of [
    ['not JSON', '{nope'],
    ['a bad sha', JSON.stringify({type: 'git-store-index', version: 1, folders: {drills: [{name: 'angel.json', path: 'drills/angel.json', sha: 'x'}]}})],
    ['no drills folder', JSON.stringify({type: 'git-store-index', version: 1, folders: {plans: []}})]
  ]){
    const f = createFakeGitHub();
    await f.addRepo(PLAIN, {files: {...FILES, [INDEX_FILE]: text}});
    const {store: s} = await setup({fake: f});
    s.follow(PLAIN);
    [src] = await s.load();
    assert.deepEqual(src.items.map(i => i.id), ['angel', 'box'], why);
    assert.equal(src.fromIndex, false, why);
    assert.equal(f.requests.api, 1, why);
  }
});

test('with a token, or with index: false, the API lists the folder as before', async () => {
  const {store, fake} = await setup();
  store.follow(DEMO);
  store.setToken(DEMO, WRITE);
  fresh(fake);
  let [src] = await store.load();
  assert.equal(src.fromIndex, false);
  assert.ok(!rawFiles(fake).includes(INDEX_FILE), 'the index is not even asked for');
  assert.ok(fake.requests.api >= 2);
  const off = await setup({options: {index: false}});
  off.store.follow(DEMO);
  fresh(off.fake);
  [src] = await off.store.load();
  assert.equal(src.fromIndex, false);
  assert.ok(!rawFiles(off.fake).includes(INDEX_FILE));
  assert.equal(off.fake.requests.api, 1);
  assert.throws(() => createGitStore({app: 'x', read, write, index: 'yes'}), /index/);
});

test('a file raw serves out of date costs no API request: the old copy stays until the next load', async () => {
  const {store, fake, make} = await setup();
  store.follow(DEMO);
  await store.load();
  await fake.edit(DEMO, 'drills/angel.json', {id: 'angel', name: 'Angel drill v2', steps: [1]});
  await fake.edit(DEMO, 'drills/late.json', {id: 'late', name: 'Late drill', steps: [1]});
  fake.staleRaw = ['drills/angel.json', 'drills/late.json'];   // the index is new, these two are not on raw yet
  fresh(fake);
  let [src] = await store.load();
  assert.equal(fake.requests.api, 0);
  assert.equal(src.items.find(i => i.id === 'angel').name, 'Angel drill', 'the version on the device');
  assert.ok(!src.items.some(i => i.id === 'late'), 'a new file not on raw yet is left out for now');
  assert.equal(src.outdated, 2);
  // a few minutes later raw has them
  fake.staleRaw = false;
  [src] = await store.load();
  assert.equal(src.items.find(i => i.id === 'angel').name, 'Angel drill v2');
  assert.ok(src.items.some(i => i.id === 'late'));
  assert.equal(src.outdated, 0);
  assert.equal(fake.requests.api, 0);
  // the whole of raw behind (the index too): what it serves is consistent, and nothing breaks
  await fake.edit(DEMO, 'drills/box.json', {id: 'box', name: 'Box v2', steps: [1]});
  fake.staleRaw = true;
  const other = make({cache: memoryCache()});
  [src] = await other.load();
  assert.equal(src.error, null);
  assert.equal(src.items.find(i => i.id === 'box').name, 'Box drill');
  assert.equal(fake.requests.api, 0);
});

test('the index is kept like the listing: offline shows the saved copy', async () => {
  const {store, fake, make} = await setup();
  store.follow(DEMO);
  await store.load();
  fake.offline = true;
  const [src] = await make().load();
  assert.equal(src.error.code, 'offline');
  assert.equal(src.stale, true);
  assert.deepEqual(src.items.map(i => i.id), ['angel', 'box']);
});

test('a save updates the editor at once; readers get it once the index is rebuilt', async () => {
  const {store, fake, make} = await setup();
  store.follow(DEMO);
  store.setToken(DEMO, WRITE);
  await store.load();
  await store.save(DEMO, {id: 'zig', name: 'Zig', steps: [1]});
  assert.ok(store.source(DEMO).items.some(i => i.id === 'zig'));
  const reader = make({storage: memoryStorage(), cache: memoryCache()});
  reader.follow(DEMO);
  fresh(fake);
  const [src] = await reader.load();
  assert.ok(src.items.some(i => i.id === 'zig'));
  assert.equal(fake.requests.api, 0);
});

test('defaults: followed on a first visit; once removed they stay removed; following again works', async () => {
  const storage = memoryStorage();
  const {make, fake} = await setup({storage, options: {defaults: [DEMO]}});
  let store = make();
  assert.deepEqual(store.following(), [DEMO]);
  store.followFromHash('#team=plain');
  assert.deepEqual(store.following(), [DEMO, PLAIN]);
  await store.unfollow(DEMO);
  store = make();                       // the next start
  assert.deepEqual(store.following(), [PLAIN], 'not back after removal');
  store.follow(DEMO);
  assert.deepEqual(store.following(), [PLAIN, DEMO]);
  store = make();
  assert.deepEqual(store.following(), [PLAIN, DEMO], 'not twice');
  // a default added later reaches people who already have the app, once; short names work
  await fake.addRepo('me/team-sunset', {files: FILES});
  store = make({defaults: [DEMO, 'sunset']});
  assert.deepEqual(store.following(), [PLAIN, DEMO, 'me/team-sunset']);
  await store.unfollow('me/team-sunset');
  assert.deepEqual(make({defaults: [DEMO, 'sunset']}).following(), [PLAIN, DEMO]);
  // another app on the same device has its own
  assert.deepEqual(createGitStore({app: 'other-app', read, write, fetch: fake.fetch, storage, cache: memoryCache(), defaults: [DEMO]}).following(), [DEMO]);
  // a default that isn't a repo is a mistake in the app
  assert.throws(() => make({defaults: ['not a repo']}), /defaults/);
  assert.throws(() => make({defaults: DEMO}), /defaults/);
  // without storage: followed for the page
  const bare = createGitStore({app: 'idx-app', read, write, fetch: fake.fetch, storage: null, cache: memoryCache(), defaults: [DEMO]});
  assert.deepEqual(bare.following(), [DEMO]);
  // and they load like any source
  const [src] = await make({storage: memoryStorage(), defaults: [DEMO]}).load();
  assert.equal(src.repo, DEMO);
  assert.equal(src.items.length, 2);
});

test('build-index.mjs: the same shas as git and the store, the same index as the fake, rewritten only on a change', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-store-index-'));
  try {
    const put = (path, text) => { mkdirSync(join(dir, path, '..'), {recursive: true}); writeFileSync(join(dir, path), text); };
    const files = {
      'drills/angel.json': JSON.stringify({id: 'angel', name: 'Šňůra 🥏', steps: [1]}, null, 2) + '\n',
      'drills/box.json': '{"id":"box","name":"Box","steps":[]}',
      'drills/notes.md': '# not an item',
      'drills/a b.json': '{}',
      'drills/deeper/x.json': '{}',
      'plans/tue.json': '{"id":"tue"}\r\n',
      '.github/workflows/x.json': '{}',
      'README.md': '# repo'
    };
    for (const [p, t] of Object.entries(files)) put(p, t);
    const folders = indexFolders(dir);
    assert.deepEqual(Object.keys(folders), ['drills', 'plans'], 'hidden folders left out');
    assert.deepEqual(folders.drills.map(f => f.name), ['angel.json', 'box.json']);
    for (const f of [...folders.drills, ...folders.plans]){
      const text = files[f.path];
      assert.equal(f.sha, await gitBlobSha(text), 'the store computes the same sha from the text');
      assert.equal(f.size, Buffer.byteLength(text));
    }
    let git = null;
    try { git = execFileSync('git', ['hash-object', join(dir, 'drills/angel.json')], {encoding: 'utf8'}).trim(); } catch { /* no git here */ }
    if (git) assert.equal(folders.drills[0].sha, git, 'what git hash-object gives');
    assert.equal(blobSha(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
    // named folders, also one that doesn't exist yet
    assert.deepEqual(Object.keys(indexFolders(dir, ['plans', 'games'])), ['games', 'plans']);
    assert.deepEqual(indexFolders(dir, ['games']).games, []);
    assert.throws(() => indexFolders(dir, ['../etc']), /Not a folder/);
    // the index it writes is what the store accepts, and what the fake builds from the same files
    const text = indexText(folders, {commit: 'c'.repeat(40)});
    assert.deepEqual(indexedFiles(JSON.parse(text), 'drills'), folders.drills);
    const fake = createFakeGitHub();
    await fake.addRepo('me/x', {files: Object.fromEntries(Object.entries(files).filter(([p]) => !p.includes(' '))), index: true});
    const built = fake.file('me/x', INDEX_FILE);
    assert.deepEqual(built.folders.drills, folders.drills);
    assert.deepEqual(built.folders.plans, folders.plans);
    // the command: writes it, then leaves it alone while nothing listed changes
    const script = new URL('./index/build-index.mjs', import.meta.url).pathname;
    const run = (...args) => { try { return {code: 0, out: execFileSync(process.execPath, [script, ...args], {cwd: dir, encoding: 'utf8'})}; } catch (e){ return {code: e.status, out: String(e.stdout)}; } };
    assert.equal(run('--check').code, 1);
    assert.match(run().out, /Wrote git-store-index\.json \(3 file\(s\) in 2 folder\(s\)/);
    const first = readFileSync(join(dir, INDEX_FILE), 'utf8');
    assert.ok(isCurrent(dir, folders));
    put('drills/notes.md', '# changed, but not an item');
    assert.match(run().out, /up to date/);
    assert.equal(readFileSync(join(dir, INDEX_FILE), 'utf8'), first, 'untouched, generatedAt included');
    assert.equal(run('--check').code, 0);
    put('drills/box.json', '{"id":"box","name":"Box 2","steps":[]}');
    assert.equal(run('--check').code, 1);
    assert.match(run().out, /Wrote/);
    assert.notEqual(readFileSync(join(dir, INDEX_FILE), 'utf8'), first);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('the fake GitHub: a 304 without a token counts, requests are counted by host, the index survives export', async () => {
  const fake = createFakeGitHub({limit: 3});
  await fake.addRepo(DEMO, {files: FILES, index: true});
  const url = 'https://api.github.com/repos/me/team-demo/contents/drills';
  const first = await fake.fetch(url);
  const etag = first.headers.get('etag');
  const again = await fake.fetch(url, {headers: {'If-None-Match': etag}});
  assert.equal(again.status, 304);
  assert.equal(fake.used, 2);
  await fake.fetch(url, {headers: {'If-None-Match': etag}});
  assert.equal((await fake.fetch(url, {headers: {'If-None-Match': etag}})).status, 403, 'the limit is used up, also for conditional requests');
  await fake.fetch('https://raw.githubusercontent.com/me/team-demo/HEAD/' + INDEX_FILE);
  assert.deepEqual(fake.requests, {api: 4, raw: 1});
  const copy = createFakeGitHub({state: JSON.parse(JSON.stringify(fake.export()))});
  await copy.edit(DEMO, 'drills/zz.json', {id: 'zz', name: 'Z', steps: []});
  assert.ok(copy.file(DEMO, INDEX_FILE).folders.drills.some(f => f.name === 'zz.json'), 'still rebuilds after import');
  // the index commit doesn't come before the change it lists
  assert.deepEqual(copy.commits(DEMO).slice(0, 2).map(c => c.paths[0]), [INDEX_FILE, 'drills/zz.json']);
});

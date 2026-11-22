import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitStore, GitHubError, GitStoreConflict, tokenNeed } from './store.js';
import { createFakeGitHub } from './fake-github.js';
import { fromBase64, gitBlobSha, toBase64 } from './github.js';
import { memoryCache } from './cache.js';

const WRITE = 'github_pat_' + 'w'.repeat(40);
const READ = 'github_pat_' + 'r'.repeat(40);
const OTHER = 'github_pat_' + 'o'.repeat(40);
const PUBLIC = 'me/team-public', PRIVATE = 'me/team-private';

function memoryStorage(){
  const m = new Map();
  return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), dump: () => [...m.values()].join('\n')};
}

// a drill-like item: {id, name, steps}; anything without steps is not one
const read = json => json && typeof json.name === 'string' && Array.isArray(json.steps) ? {id: json.id, name: json.name.slice(0, 80), steps: json.steps} : null;
const write = item => ({id: item.id, name: item.name, steps: item.steps});

async function setup({storage = memoryStorage(), cache = memoryCache(), fake} = {}){
  if (!fake){
    fake = createFakeGitHub();
    await fake.addRepo(PUBLIC, {files: {
      'drills/angel.json': {id: 'angel', name: 'Angel drill', steps: [1, 2]},
      'drills/box.json': {id: 'box', name: 'Box drill', steps: [1]},
      'drills/broken.json': {id: 'broken', name: 'No steps'},
      'drills/notes.md': '# not an item',
      'README.md': '# team'
    }});
    await fake.addRepo(PRIVATE, {private: true, files: {'drills/secret.json': {id: 'secret', name: 'Secret play', steps: [1]}}});
    fake.addToken(WRITE, PUBLIC, 'write');
    fake.addToken(WRITE, PRIVATE, 'write');
    fake.addToken(READ, PRIVATE, 'read');
  }
  const store = createGitStore({app: 'test-app', folder: 'drills', param: 'team', shortName: n => `me/team-${n}`, read, write, fetch: fake.fetch, storage, cache});
  return {store, fake, storage, cache};
}

test('UTF-8 base64 and git blob hashes', async () => {
  const text = 'Šňůra a „uvozovky“ — 🥏\n';
  assert.equal(fromBase64(toBase64(text)), text);
  assert.equal(fromBase64(toBase64(text).replace(/(.{10})/g, '$1\n')), text, 'GitHub breaks base64 into lines');
  // what `git hash-object` gives
  assert.equal(await gitBlobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.equal(await gitBlobSha(''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  assert.equal(await gitBlobSha('Šňůra 🥏\n'), '28bafcc8c53b7256343f38a97c4e4bf5eade4910', 'the length counts bytes, not letters');
});

test('a public source loads without a token: items through read, other files and broken items left out', async () => {
  const {store, fake} = await setup();
  assert.equal(store.followFromHash('#angel&team=public'), PUBLIC);
  const [src] = await store.load();
  assert.equal(src.repo, PUBLIC);
  assert.equal(src.error, null);
  assert.deepEqual(src.items.map(i => [i.id, i.name]), [['angel', 'Angel drill'], ['box', 'Box drill']]);
  assert.equal(src.dropped, 1, 'the item without steps');
  assert.equal(src.private, false);
  assert.equal(src.canWrite, false);
  assert.equal(src.hasToken, false);
  // one API request for the list; the files came from raw.githubusercontent.com
  assert.equal(fake.used, 1);
  assert.ok(fake.log.some(e => e.url.startsWith('https://raw.githubusercontent.com/me/team-public/HEAD/drills/angel.json')));
  assert.ok(!fake.log.some(e => e.url.includes('README')));
});

test('an unchanged folder costs nothing; a changed one fetches only the changed file', async () => {
  const {store, fake} = await setup();
  store.follow(PUBLIC);
  await store.load();
  const before = fake.used;
  await store.load();
  assert.equal(fake.used, before, 'a 304 does not count');
  assert.equal(fake.log.at(-1).status, 304);
  await fake.edit(PUBLIC, 'drills/box.json', {id: 'box', name: 'Box drill, faster', steps: [1, 2, 3]});
  const n = fake.log.length;
  const [src] = await store.load();
  assert.equal(src.items.find(i => i.id === 'box').name, 'Box drill, faster');
  const fetched = fake.log.slice(n).filter(e => e.url.startsWith('https://raw.')).map(e => e.url.split('/').pop());
  assert.deepEqual(fetched, ['box.json']);
});

test('raw.githubusercontent.com serving an old version is caught by the sha, and the blob is used instead', async () => {
  const {store, fake} = await setup();
  store.follow(PUBLIC);
  await fake.edit(PUBLIC, 'drills/angel.json', {id: 'angel', name: 'Angel drill v2', steps: [1]});
  fake.staleRaw = true;
  const [src] = await store.load();
  assert.equal(src.items.find(i => i.id === 'angel').name, 'Angel drill v2');
  assert.ok(fake.log.some(e => e.url.includes('/git/blobs/')));
});

test('a private source needs a token; a read token reads it but cannot write', async () => {
  const {store} = await setup();
  store.follow(PRIVATE);
  let [src] = await store.load();
  assert.equal(src.error.code, 'not-found');
  assert.match(src.error.message, /private repo also needs a token/);
  store.setToken(PRIVATE, READ);
  [src] = await store.load();
  assert.equal(src.error, null);
  assert.equal(src.private, true);
  assert.equal(src.canWrite, false);
  assert.deepEqual(src.items.map(i => i.name), ['Secret play']);
  await assert.rejects(store.save(PRIVATE, {id: 'x1', name: 'New', steps: []}), e => e.code === 'forbidden');
  store.setToken(PRIVATE, WRITE);
  [src] = await store.load();
  assert.equal(src.canWrite, true);
});

test('tokenNeed says when a source needs a token, or a new one, and why', async () => {
  const {store} = await setup();
  store.follow(PUBLIC); store.follow(PRIVATE);
  await store.load();
  assert.equal(tokenNeed(store.source(PUBLIC)), null, 'a public repo reads without one');
  let need = tokenNeed(store.source(PRIVATE), {label: 'team'});
  assert.equal(need.action, 'add');
  assert.equal(need.code, 'not-found');
  assert.match(need.reason, /private/);
  assert.match(need.reason, /this team/);
  store.setToken(PRIVATE, READ);
  await store.load(PRIVATE);
  assert.equal(tokenNeed(store.source(PRIVATE)), null, 'a read-only token is a choice, not a need');
  store.setToken(PRIVATE, OTHER);   // a token GitHub doesn't know: expired or deleted
  await store.load(PRIVATE);
  need = tokenNeed(store.source(PRIVATE));
  assert.deepEqual([need.action, need.code], ['replace', 'auth']);
  assert.match(need.reason, /expired/);
  // the other codes, as the store reports them
  const src = (code, hasToken) => ({repo: PRIVATE, hasToken, error: {code, message: ''}});
  assert.equal(tokenNeed(src('no-token', false)).action, 'add');
  assert.equal(tokenNeed(src('forbidden', true)).action, 'replace');
  assert.equal(tokenNeed(src('not-found', true)).action, 'replace');
  for (const code of ['offline', 'rate-limit', 'server', 'conflict']) assert.equal(tokenNeed(src(code, false)), null, code);
  assert.equal(tokenNeed(null), null);
});

test('save adds and replaces a single file as a commit, with the project\'s message; remove deletes it', async () => {
  const {store, fake} = await setup();
  store.follow(PUBLIC);
  store.setToken(PUBLIC, WRITE);
  await store.load();
  const added = await store.save(PUBLIC, {id: 'go-to', name: 'Go-to drill', steps: [1]}, {note: ''});
  assert.equal(fake.file(PUBLIC, 'drills/go-to.json').name, 'Go-to drill');
  assert.equal(fake.commits(PUBLIC)[0].message, 'Add Go-to drill');
  assert.ok(store.source(PUBLIC).items.some(i => i.id === 'go-to'), 'the editor sees it at once');
  assert.equal(fake.log.at(-1).method, 'PUT');
  const updated = await store.save(PUBLIC, {id: 'go-to', name: 'Go-to drill', steps: [1, 2]}, {note: 'Two steps'});
  assert.notEqual(updated.sha, added.sha);
  assert.equal(fake.commits(PUBLIC)[0].message, 'Two steps');
  await store.remove(PUBLIC, 'go-to');
  assert.equal(fake.file(PUBLIC, 'drills/go-to.json'), null);
  assert.equal(fake.commits(PUBLIC)[0].message, 'Remove Go-to drill');
  assert.ok(!store.source(PUBLIC).items.some(i => i.id === 'go-to'));
  // removing what is already gone is fine
  await store.remove(PUBLIC, 'go-to');
});

test('files are written as readable JSON, one property per line, so git shows what changed', async () => {
  const {store, fake} = await setup();
  store.setToken(PUBLIC, WRITE);
  await store.save(PUBLIC, {id: 'n1', name: 'Šňůra', steps: [1]});
  const put = fake.log.filter(e => e.method === 'PUT').at(-1);
  assert.ok(put.body.content);
  const raw = await (await fake.fetch(`https://raw.githubusercontent.com/${PUBLIC}/HEAD/drills/n1.json`)).text();
  assert.equal(raw, '{\n  "id": "n1",\n  "name": "Šňůra",\n  "steps": [\n    1\n  ]\n}\n');
});

test('a conflict: the file changed on another device; each answer does what it says', async () => {
  const {store, fake} = await setup();
  store.follow(PUBLIC);
  store.setToken(PUBLIC, WRITE);
  await store.load();
  const mine = {id: 'box', name: 'Box drill (mine)', steps: [9]};

  // overwrite
  await fake.edit(PUBLIC, 'drills/box.json', {id: 'box', name: 'Box drill (theirs)', steps: [1]});
  let c = await store.save(PUBLIC, mine).catch(e => e);
  assert.ok(c instanceof GitStoreConflict);
  assert.equal(c.theirs.item.name, 'Box drill (theirs)');
  assert.equal(c.mine.name, 'Box drill (mine)');
  let r = await store.resolve(c, 'overwrite');
  assert.equal(r.kept, 'mine');
  assert.equal(fake.file(PUBLIC, 'drills/box.json').name, 'Box drill (mine)');

  // keep theirs: nothing is written
  await fake.edit(PUBLIC, 'drills/box.json', {id: 'box', name: 'Box drill (theirs 2)', steps: [1]});
  c = await store.save(PUBLIC, mine).catch(e => e);
  const commits = fake.commits(PUBLIC).length;
  r = await store.resolve(c, 'theirs');
  assert.equal(r.item.name, 'Box drill (theirs 2)');
  assert.equal(fake.commits(PUBLIC).length, commits);
  assert.equal(store.source(PUBLIC).items.find(i => i.id === 'box').name, 'Box drill (theirs 2)', 'the store now has theirs');

  // copy: mine under a new id, theirs stays
  c = await store.save(PUBLIC, {...mine, name: 'Box drill (mine again)'}, {base: 'old'}).catch(e => e);
  assert.ok(c instanceof GitStoreConflict);
  r = await store.resolve(c, 'copy');
  assert.equal(r.kept, 'copy');
  assert.notEqual(r.id, 'box');
  assert.equal(fake.file(PUBLIC, `drills/${r.id}.json`).name, 'Box drill (mine again)');
  assert.equal(fake.file(PUBLIC, `drills/${r.id}.json`).id, r.id, 'the copy carries its own id');
  assert.equal(fake.file(PUBLIC, 'drills/box.json').name, 'Box drill (theirs 2)');
  assert.match(fake.commits(PUBLIC)[0].message, /^Add a copy of/);
});

test('a conflict when the file was removed elsewhere, and when a new item\'s id is taken', async () => {
  const {store, fake} = await setup();
  store.setToken(PUBLIC, WRITE);
  await store.load(PUBLIC);
  await fake.edit(PUBLIC, 'drills/angel.json', null);
  const c = await store.save(PUBLIC, {id: 'angel', name: 'Angel drill', steps: [3]}).catch(e => e);
  assert.ok(c instanceof GitStoreConflict);
  assert.equal(c.theirs, null);
  await store.resolve(c, 'overwrite');
  assert.equal(fake.file(PUBLIC, 'drills/angel.json').steps[0], 3);
  // an id that already exists, saved as new (base null)
  const taken = await store.save(PUBLIC, {id: 'box', name: 'Another box', steps: [1]}, {base: null}).catch(e => e);
  assert.ok(taken instanceof GitStoreConflict);
  assert.equal(taken.theirs.item.name, 'Box drill');
});

test('removing something that changed meanwhile asks too', async () => {
  const {store, fake} = await setup();
  store.setToken(PUBLIC, WRITE);
  await store.load(PUBLIC);
  await fake.edit(PUBLIC, 'drills/box.json', {id: 'box', name: 'Box drill, edited', steps: [1]});
  const c = await store.remove(PUBLIC, 'box').catch(e => e);
  assert.ok(c instanceof GitStoreConflict);
  assert.equal(c.op, 'remove');
  assert.equal(c.theirs.item.name, 'Box drill, edited');
  await assert.rejects(store.resolve(c, 'copy'));
  await store.resolve(c, 'overwrite');
  assert.equal(fake.file(PUBLIC, 'drills/box.json'), null);
});

test('history: the versions of one item, an old one opened, and restored as a new save', async () => {
  const {store, fake} = await setup();
  store.setToken(PUBLIC, WRITE);
  await store.load(PUBLIC);
  await store.save(PUBLIC, {id: 'box', name: 'Box drill', steps: [1, 2]}, {note: 'Second step'});
  await store.save(PUBLIC, {id: 'box', name: 'Box drill', steps: [1, 2, 3]}, {note: 'Third step'});
  const versions = await store.history(PUBLIC, 'box');
  assert.deepEqual(versions.map(v => v.message), ['Third step', 'Second step', 'Add drills/box.json']);
  assert.ok(versions.every(v => v.date && v.commit && v.author));
  const first = await store.version(PUBLIC, 'box', versions[2].commit);
  assert.deepEqual(first.item.steps, [1]);
  await store.restore(PUBLIC, 'box', versions[2].commit);
  assert.deepEqual(fake.file(PUBLIC, 'drills/box.json').steps, [1]);
  assert.match(fake.commits(PUBLIC)[0].message, /^Restore Box drill as it was in/);
  assert.equal((await store.history(PUBLIC, 'box')).length, 4, 'history is kept, with one more version');
  await assert.rejects(store.version(PUBLIC, 'box', 'not-a-commit'), e => e.code === 'invalid');
});

test('restore with a base: a newer save on GitHub brings up the conflict instead of being overwritten', async () => {
  const {store, fake} = await setup();
  store.setToken(PUBLIC, WRITE);
  const opened = await store.open(PUBLIC, 'box');   // the app has this version open
  await store.save(PUBLIC, {id: 'box', name: 'Box drill', steps: [1, 2]}, {base: opened.sha, note: 'Second step'});
  const mine = await store.open(PUBLIC, 'box');
  await fake.edit(PUBLIC, 'drills/box.json', {id: 'box', name: 'Box drill (laptop)', steps: [7]});
  await store.load(PUBLIC);                          // the store has seen the laptop's version; the app hasn't
  const versions = await store.history(PUBLIC, 'box');
  const oldest = versions.at(-1).commit;
  const commits = fake.commits(PUBLIC).length;
  const c = await store.restore(PUBLIC, 'box', oldest, {base: mine.sha}).catch(e => e);
  assert.ok(c instanceof GitStoreConflict, 'an old base is a conflict');
  assert.equal(c.op, 'restore');
  assert.equal(c.theirs.item.name, 'Box drill (laptop)');
  assert.deepEqual(c.mine.steps, [1]);
  assert.equal(fake.commits(PUBLIC).length, commits, 'nothing was written');
  const r = await store.resolve(c, 'overwrite');
  assert.equal(r.kept, 'mine');
  assert.deepEqual(fake.file(PUBLIC, 'drills/box.json').steps, [1]);
  assert.match(fake.commits(PUBLIC)[0].message, /^Restore Box drill as it was in/);
  // with the newest version as base, it just restores
  const again = await store.restore(PUBLIC, 'box', versions[1].commit, {base: r.sha, note: 'Back to two steps'});
  assert.deepEqual(fake.file(PUBLIC, 'drills/box.json').steps, [1, 2]);
  assert.equal(fake.commits(PUBLIC)[0].message, 'Back to two steps');
  assert.ok(again.commit && again.sha);
});

test('newId gets the item being copied, and the default needs nothing', async () => {
  const fake = createFakeGitHub();
  await fake.addRepo(PUBLIC, {files: {'drills/box.json': {id: 'box', name: 'Box drill', steps: [1]}}});
  fake.addToken(WRITE, PUBLIC, 'write');
  const given = [];
  const newId = item => { given.push(item); return item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-copy'; };
  const store = createGitStore({app: 'test-app', folder: 'drills', read, write, newId, fetch: fake.fetch, storage: memoryStorage(), cache: memoryCache()});
  store.setToken(PUBLIC, WRITE);
  await store.load(PUBLIC);
  await fake.edit(PUBLIC, 'drills/box.json', {id: 'box', name: 'Box drill (theirs)', steps: [2]});
  const c = await store.save(PUBLIC, {id: 'box', name: 'Island settlers', steps: [3]}).catch(e => e);
  const r = await store.resolve(c, 'copy');
  assert.equal(given.length, 1);
  assert.equal(given[0].name, 'Island settlers', 'the item being copied');
  assert.equal(r.id, 'island-settlers-copy');
  assert.equal(fake.file(PUBLIC, 'drills/island-settlers-copy.json').id, 'island-settlers-copy');
  // the default: a random id
  const plain = (await setup()).store;
  plain.setToken(PUBLIC, WRITE);
  const copy = await plain.save(PUBLIC, {id: 'box', name: 'Box drill', steps: [1]}, {asCopy: true});
  assert.match(copy.id, /^[A-Za-z0-9]{16}$/);
});

test('the fake GitHub exports its state as JSON and imports it again', async () => {
  const {store, fake} = await setup();
  store.setToken(PUBLIC, WRITE);
  await store.load(PUBLIC);
  await store.save(PUBLIC, {id: 'box', name: 'Box drill', steps: [1, 2]}, {note: 'Second step'});
  await store.remove(PUBLIC, 'angel');
  await store.load(PUBLIC);
  const before = fake.used;
  const text = JSON.stringify(fake.export());
  const again = createFakeGitHub({state: JSON.parse(text)});
  assert.deepEqual(again.export(), JSON.parse(text), 'the same state after a round trip');
  assert.equal(again.used, before, 'the limit state comes along');
  assert.deepEqual(again.commits(PUBLIC), fake.commits(PUBLIC));
  assert.deepEqual(again.file(PUBLIC, 'drills/box.json').steps, [1, 2]);
  assert.equal(again.file(PUBLIC, 'drills/angel.json'), null);
  // a store on the imported fake: tokens, files, history and old versions all work, and saving goes on
  const {store: s2} = await setup({fake: again});
  s2.setToken(PRIVATE, WRITE);
  const pub = await s2.load(PUBLIC), priv = await s2.load(PRIVATE);
  assert.equal(pub.error, null);
  assert.equal(priv.items[0].name, 'Secret play', 'the private repo with its token');
  const versions = await s2.history(PUBLIC, 'box');
  assert.deepEqual(versions.map(v => v.message), ['Second step', 'Add drills/box.json']);
  assert.deepEqual((await s2.version(PUBLIC, 'box', versions[1].commit)).item.steps, [1]);
  s2.setToken(PUBLIC, WRITE);
  await s2.save(PUBLIC, {id: 'box', name: 'Box drill', steps: [1, 2, 3]}, {note: 'Third step'});
  assert.equal((await s2.history(PUBLIC, 'box'))[0].message, 'Third step');
  assert.equal(fake.file(PUBLIC, 'drills/box.json').steps.length, 2, 'the first fake is untouched');
  // the read-only token stays read-only; something else is refused
  const {store: s3} = await setup({fake: createFakeGitHub({state: JSON.parse(text)})});
  s3.setToken(PRIVATE, READ);
  assert.equal((await s3.load(PRIVATE)).canWrite, false);
  assert.throws(() => again.import({repos: []}), /Not a state/);
});

test('working folder: open reads the newest version, and saving from it detects a change made meanwhile', async () => {
  const {store, fake} = await setup();
  store.setToken(PUBLIC, WRITE);
  const opened = await store.open(PUBLIC, 'angel');
  assert.equal(opened.item.name, 'Angel drill');
  await fake.edit(PUBLIC, 'drills/angel.json', {id: 'angel', name: 'Angel (laptop)', steps: [1]});
  const c = await store.save(PUBLIC, {...opened.item, name: 'Angel (iPad)'}, {base: opened.sha}).catch(e => e);
  assert.ok(c instanceof GitStoreConflict);
  assert.equal(await store.open(PUBLIC, 'nope'), null);
});

test('offline and rate limits fall back to the saved copy, and say why', async () => {
  const cache = memoryCache(), storage = memoryStorage();
  const first = await setup({cache, storage});
  first.store.follow(PUBLIC);
  await first.store.load();
  // a new page load, offline: the saved copy, marked stale
  const again = await setup({cache, storage, fake: first.fake});
  first.fake.offline = true;
  let [src] = await again.store.load();
  assert.equal(src.error.code, 'offline');
  assert.equal(src.stale, true);
  assert.equal(src.items.length, 2);
  // the limit used up: also the saved copy, and when the limit resets
  first.fake.offline = false;
  first.fake.used = first.fake.limit;
  await first.fake.edit(PUBLIC, 'drills/box.json', {id: 'box', name: 'Changed', steps: [1]});
  [src] = await again.store.load();
  assert.equal(src.error.code, 'rate-limit');
  assert.ok(src.error.resetAt > Date.now());
  assert.match(src.error.message, /resets at \d\d:\d\d/);
  assert.equal(src.items.length, 2);
  // a token lifts the limit
  again.store.setToken(PUBLIC, WRITE);
  [src] = await again.store.load();
  assert.equal(src.error, null);
  assert.equal(src.items.find(i => i.id === 'box').name, 'Changed');
});

test('errors people will hit, in plain words', async () => {
  const {store} = await setup();
  await assert.rejects(store.save(PUBLIC, {id: 'a', name: 'A', steps: []}), e => e.code === 'no-token' && /needs a GitHub token/.test(e.message));
  store.setToken(PUBLIC, OTHER);    // a token GitHub doesn't know (expired)
  await assert.rejects(store.save(PUBLIC, {id: 'a', name: 'A', steps: []}), e => e.code === 'auth' && /expired/.test(e.message));
  store.follow('me/missing');
  const src = await store.load('me/missing');
  assert.equal(src.error.code, 'not-found');
  assert.throws(() => store.setToken(PUBLIC, 'my password'), /doesn’t look like a GitHub token/);
  await assert.rejects(store.save(PUBLIC, {id: '../x', name: 'A', steps: []}), e => e.code === 'invalid' || e.code === 'no-token' || e.code === 'auth');
});

test('a file that is too big is refused before anything is sent', async () => {
  const fake = createFakeGitHub();
  await fake.addRepo(PUBLIC);
  fake.addToken(WRITE, PUBLIC);
  const store = createGitStore({app: 't', folder: 'd', read, write, fetch: fake.fetch, storage: memoryStorage(), cache: memoryCache(), maxBytes: 100});
  store.setToken(PUBLIC, WRITE);
  const n = fake.log.length;
  await assert.rejects(store.save(PUBLIC, {id: 'big', name: 'x'.repeat(200), steps: []}), e => e.code === 'too-big');
  assert.equal(fake.log.length, n);
});

test('following: several sources, kept per app, removed with their token and saved copy', async () => {
  const storage = memoryStorage(), cache = memoryCache();
  const {store} = await setup({storage, cache});
  assert.equal(store.follow('public'), PUBLIC);
  assert.equal(store.follow('ME/TEAM-PUBLIC'), PUBLIC, 'the same repo in other letters');
  assert.equal(store.follow('me/team-private'), PRIVATE);
  assert.equal(store.follow('not a repo'), null);
  assert.equal(store.followFromHash('#nothing'), null);
  assert.deepEqual(store.following(), [PUBLIC, PRIVATE]);
  store.setToken(PRIVATE, WRITE);
  await store.load();
  await store.unfollow(PRIVATE);
  assert.deepEqual(store.following(), [PUBLIC]);
  assert.equal(store.hasToken(PRIVATE), false);
  assert.equal(await cache.get('test-app:me/team-private'), null);
  // another app on the same origin has its own list
  const other = createGitStore({app: 'other-app', read, write, storage, cache, fetch: () => { throw new Error('no'); }});
  assert.deepEqual(other.following(), []);
});

test('listeners hear about loading and changes', async () => {
  const {store} = await setup();
  const heard = [];
  const off = store.subscribe(s => heard.push(s.map(x => x.loading)));
  store.follow(PUBLIC);
  await store.load();
  off();
  assert.ok(heard.some(h => h[0] === true) && heard.at(-1)[0] === false);
});

test('tokens never appear in errors, the saved copy, state or the request log', async () => {
  const storage = memoryStorage(), cache = memoryCache();
  const {store, fake} = await setup({storage, cache});
  store.follow(PUBLIC); store.follow(PRIVATE);
  store.setToken(PRIVATE, READ);
  store.setToken(PUBLIC, OTHER);
  await store.load();
  const errors = [];
  for (const run of [
    () => store.save(PRIVATE, {id: 'z', name: 'Z', steps: []}),
    () => store.save(PUBLIC, {id: 'z', name: 'Z', steps: []}),
    () => store.remove(PRIVATE, 'secret'),
    () => store.history('me/missing', 'x')
  ]) errors.push(await run().catch(e => e));
  fake.offline = true;
  errors.push(...(await store.load()).map(s => s.error));
  const seen = JSON.stringify([errors.map(e => e && {...e, message: e.message, stack: e.stack}), store.sources(), await cache.get('test-app:me/team-private'), await cache.get('test-app:me/team-public'), fake.log]);
  for (const t of [READ, OTHER, WRITE]) assert.ok(!seen.includes(t), 'a token leaked');
  assert.ok(storage.dump().includes(READ), 'the token is kept in local storage itself');
  assert.ok(errors.every(e => e instanceof GitHubError || (e && e.code)), 'every failure is a GitHubError with a code');
});

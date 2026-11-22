/* The git-store-kit demo: notes kept as JSON files in GitHub repos, the way a project's adapter would use the module.
   It runs against a fake GitHub in the page (git-store-kit/fake-github.js), so nothing here needs a network or a real
   token, and every request the module sends is listed with the token left out. One card reads the real repository
   instead, without a token.

   - Publish mode (like Ultimate Playbook): notes in this browser, published one by one to a repo.
   - Working folder mode (like Protogames): open a note from a repo, edit it, save it back as a commit. Its History
     restores on top of the version that was opened (base), and puts the restored version in the form (onRestore).
   The fake GitHub's state is kept in sessionStorage (fake.export / createFakeGitHub({state})), so a reload keeps it. */
import { createGitStore, tokenNeed } from '../git-store-kit/store.js';
import { createPanel } from '../git-store-kit/panel.js';
import { createFakeGitHub } from '../git-store-kit/fake-github.js';

const $ = id => document.getElementById(id);
const PUBLIC = 'demo-team/notes', PRIVATE = 'demo-team/notes-private';
const WRITE_TOKEN = 'github_pat_DEMO_write_token_for_both_demo_repos_0001';
const READ_TOKEN = 'github_pat_DEMO_read_only_token_for_the_private_repo';
const COLORS = ['sun', 'sea', 'leaf', 'rose'];

/* ---- the notes: what the app knows and the module doesn't ---- */
// every note read from a repo was written by someone else: rebuild it field by field
function readNote(json){
  if (!json || typeof json !== 'object' || json.format !== 'demo-note' || typeof json.title !== 'string') return null;
  return {id: String(json.id || ''), title: json.title.slice(0, 80) || 'Untitled', text: typeof json.text === 'string' ? json.text.slice(0, 2000) : '',
    color: COLORS.includes(json.color) ? json.color : 'sun'};
}
const writeNote = n => ({format: 'demo-note', id: n.id, title: n.title, text: n.text, color: n.color});

/* ---- the fake GitHub, with two repos, kept in this tab through a reload ---- */
const FAKE_KEY = 'git-store-demo:fake-github';
let fake = null;
try { const kept = JSON.parse(sessionStorage.getItem(FAKE_KEY)); if (kept) fake = createFakeGitHub({state: kept}); } catch { fake = null; }
const keepFake = () => { try { sessionStorage.setItem(FAKE_KEY, JSON.stringify(fake.export())); } catch { /* it just starts over */ } };
const note = (id, title, text, color) => ({format: 'demo-note', id, title, text, color});
if (!fake){ fake = createFakeGitHub(); await addDemoRepos(); }
async function addDemoRepos(){
  await fake.addRepo(PUBLIC, {files: {
    'notes/warmup.json': note('warmup', 'Warm-up', 'Ten minutes of jogging, then dynamic stretches.', 'sun'),
    'notes/stack.json': note('stack', 'Vertical stack', 'Cutters line up behind the disc; one cut at a time.', 'sea'),
    'notes/cooldown.json': note('cooldown', 'Cool-down', 'Slow lap and stretches. Say one good thing about a teammate.', 'leaf'),
    'notes/old-format.json': {title: 'Written by an older app', body: 'Not a demo-note: the app\'s read() drops it.'},
    'README.md': '# Demo team notes\n'
  }});
  await fake.addRepo(PRIVATE, {private: true, files: {
    'notes/tactic.json': note('tactic', 'Secret tactic', 'Only for the team: the hammer play against zone.', 'rose')
  }});
  // a little history, so "History" has something to show
  await fake.edit(PUBLIC, 'notes/stack.json', note('stack', 'Vertical stack', 'Cutters line up behind the disc; one cut at a time. Handlers reset with a dump.', 'sea'), {author: 'coach', message: 'Add the dump to the vertical stack'});
  await fake.edit(PUBLIC, 'notes/stack.json', note('stack', 'Vertical stack', 'Cutters line up behind the disc, 5 m apart; one cut at a time. Handlers reset with a dump.', 'sea'), {author: 'coach', message: 'Say how far apart'});
  fake.addToken(WRITE_TOKEN, PUBLIC, 'write');
  fake.addToken(WRITE_TOKEN, PRIVATE, 'write');
  fake.addToken(READ_TOKEN, PRIVATE, 'read');
  keepFake();
}

/* ---- the store and its panel ---- */
const store = createGitStore({
  app: 'git-store-demo', folder: 'notes', param: 'notes',
  shortName: n => `demo-team/${n}`,                 // #notes=notes-private → demo-team/notes-private
  read: readNote, write: writeNote, name: n => n.title,
  commitMessage: ({op, name, note}) => note || `${{add: 'Add', update: 'Update', remove: 'Remove', copy: 'Add a copy of', restore: 'Restore'}[op]} “${name}”`,
  fetch: (...a) => fake.fetch(...a)                // through the request list below
});
const panel = createPanel(store, {title: 'Note sources', noun: 'note', sourceLabel: 'repo'});
if (!store.following().length){ store.follow(PUBLIC); store.follow(PRIVATE); }
store.followFromHash();

/* ---- drawing ---- */
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)){
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(k => k != null && k !== false));
  return e;
};
const say = (id, text, warn = false) => { const el = $(id); el.textContent = text; el.classList.toggle('warn', warn); };
const failed = (id, e) => say(id, e && e.message ? e.message : String(e), true);

function noteCard(n, {repo = null, actions = []} = {}){
  return h('li', {class: `note note-${n.color}`, 'data-id': n.id},
    h('div', {class: 'note-head'}, h('strong', {text: n.title}), repo ? h('span', {class: 'tag', text: repo.split('/')[1]}) : null),
    n.text ? h('p', {class: 'small', text: n.text}) : null,
    actions.length ? h('div', {class: 'note-actions'}, actions) : null);
}

function drawShared(){
  const sources = store.sources();
  const line = s => {
    if (s.loading && !s.loadedAt) return `${s.repo}: loading…`;
    if (s.error) return `${s.repo}: ${(!s.loading && tokenNeed(s)?.reason) || s.error.message}${s.stale ? ' (the saved copy is shown)' : ''}`;
    return `${s.repo}: ${s.items.length} notes${s.dropped ? `, ${s.dropped} file left out` : ''}${s.canWrite ? ', you can edit' : s.hasToken ? ', read only' : ''}`;
  };
  // where a source needs a token, the way to add one is right next to what it says
  $('status').replaceChildren(...sources.map(s => {
    const need = !s.loading && tokenNeed(s);
    return h('li', {'data-repo': s.repo}, h('span', {text: line(s)}),
      need ? h('button', {class: 'btn primary need', type: 'button', text: need.action === 'replace' ? 'Replace the token' : 'Add a token',
        onclick: () => panel.open({token: s.repo})}) : null);
  }));
  $('shared').replaceChildren(...sources.flatMap(s => s.items.map(i => noteCard(i.item, {repo: s.repo, actions: [
    h('button', {class: 'btn', type: 'button', text: 'History', onclick: () => panel.showHistory(s.repo, i.id, {onOpen: showOld,
      onRestore: r => say('shared-msg', `Restored “${r.item.title}” in ${s.repo}${r.kept === 'copy' ? ', as a copy' : ''}. Commit ${r.commit.slice(0, 7)}.`)})}),
    s.canWrite ? h('button', {class: 'btn', type: 'button', text: 'Remove', onclick: async () => {
      try { const r = await panel.remove(s.repo, i.id); if (r) say('shared-msg', `Removed “${i.name}” from ${s.repo}.`); }
      catch (e){ failed('shared-msg', e); }
    }}) : null
  ]}))));
  if (!$('shared').children.length) $('shared').append(h('li', {class: 'muted small', text: 'No notes to show yet.'}));
  // the working folder's list of notes to open
  const pick = $('folder-pick'), was = pick.value;
  pick.replaceChildren(...sources.flatMap(s => s.items.map(i => h('option', {value: `${s.repo}#${i.id}`, text: `${i.name} (${s.repo})`}))));
  if ([...pick.options].some(o => o.value === was)) pick.value = was;
  $('folder-open').disabled = !pick.options.length;
  // where "Publish" goes: the repos that can be written to
  const to = $('publish-to'), wasTo = to.value;
  const writable = sources.filter(s => s.canWrite);
  to.replaceChildren(...writable.map(s => h('option', {value: s.repo, text: s.repo})));
  if (writable.some(s => s.repo === wasTo)) to.value = wasTo;
  $('publish-hint').hidden = writable.length > 0;
  drawMine();
}

/* ---- publish mode: notes in this browser ---- */
const MINE_KEY = 'git-store-demo:mine';
let mine = [];
try { mine = JSON.parse(localStorage.getItem(MINE_KEY)) || []; } catch { mine = []; }
if (!mine.length) mine = [
  {id: 'my-drill-1', title: 'Give-and-go', text: 'Throw, cut past the mark, get it back.', color: 'leaf'},
  {id: 'my-drill-2', title: 'Hammer practice', text: 'Pairs, 15 m apart. Ten each.', color: 'rose'}
];
const keepMine = () => { try { localStorage.setItem(MINE_KEY, JSON.stringify(mine)); } catch { /* fine */ } };

function drawMine(){
  const target = $('publish-to').value;
  const published = new Set((target && store.source(target)?.items || []).map(i => i.id));
  $('mine').replaceChildren(...mine.map(n => noteCard(n, {actions: [
    h('button', {class: 'btn', type: 'button', text: 'Edit', onclick: () => editMine(n)}),
    h('button', {class: 'btn primary', type: 'button', disabled: !target, text: published.has(n.id) ? 'Publish again' : 'Publish', onclick: () => publish(n)})
  ]})));
}
function editMine(n){
  const title = prompt('Title', n.title);
  if (title == null) return;
  n.title = title.trim().slice(0, 80) || n.title;
  keepMine(); drawMine();
}
async function publish(n){
  const repo = $('publish-to').value;
  if (!repo) return;
  say('mine-msg', 'Publishing…');
  try {
    const r = await panel.save(repo, n, {note: $('publish-note').value});
    if (!r){ say('mine-msg', 'Not published.'); return; }
    if (r.kept === 'theirs') say('mine-msg', `Kept the version on GitHub; yours wasn’t published.`);
    else if (r.kept === 'copy') say('mine-msg', `Published as a copy, “${r.item.title}”, next to the other one.`);
    else say('mine-msg', `Published “${n.title}” to ${repo}. Commit ${r.commit.slice(0, 7)}.`);
    touched = {repo, id: n.id};   // the note itself, also when a copy was made
    $('publish-note').value = '';
  } catch (e){ failed('mine-msg', e); }
}
$('mine-add').addEventListener('click', () => {
  const k = mine.length + 1;
  mine.push({id: 'my-note-' + Date.now().toString(36), title: `New note ${k}`, text: 'Written in this browser.', color: COLORS[k % COLORS.length]});
  keepMine(); drawMine();
});

/* ---- working folder mode: open, edit, save back ---- */
let opened = null;   // {repo, id, sha}: sha is the version the form is based on
function showOpened(item){
  if (item){ $('folder-title').value = item.title; $('folder-text').value = item.text; $('folder-color').value = item.color; }
  $('folder-where').textContent = `${opened.repo}, notes/${opened.id}.json at ${opened.sha ? opened.sha.slice(0, 7) : '–'}`;
}
let touched = null;  // the note published or opened last: "Change a note on another device" changes that one
$('folder-open').addEventListener('click', async () => {
  const [repo, id] = $('folder-pick').value.split('#');
  say('folder-msg', 'Opening the newest version…');
  try {
    const r = await store.open(repo, id);
    if (!r){ say('folder-msg', 'It isn’t there any more.', true); return; }
    opened = {repo, id, sha: r.sha};
    touched = opened;
    showOpened(r.item);
    $('folder-form').hidden = false;
    say('folder-msg', 'Opened. Edit it, then save it back.');
  } catch (e){ failed('folder-msg', e); }
});
$('folder-save').addEventListener('click', async () => {
  if (!opened) return;
  const item = {id: opened.id, title: $('folder-title').value.trim() || 'Untitled', text: $('folder-text').value, color: $('folder-color').value};
  say('folder-msg', 'Saving…');
  try {
    const r = await panel.save(opened.repo, item, {base: opened.sha, note: $('folder-note').value});
    if (!r){ say('folder-msg', 'Not saved. Your edits are still here.'); return; }
    if (r.kept === 'theirs'){
      $('folder-title').value = r.item ? r.item.title : ''; $('folder-text').value = r.item ? r.item.text : '';
      opened.sha = r.sha;
      say('folder-msg', 'Took the version from GitHub instead of yours.');
    } else {
      if (r.kept === 'copy'){ opened.id = r.id; }
      opened.sha = r.sha;
      say('folder-msg', `Saved as one commit (${r.commit.slice(0, 7)})${r.kept === 'copy' ? ', as a copy' : ''}.`);
    }
    showOpened(null);
    $('folder-note').value = '';
  } catch (e){ failed('folder-msg', e); }
});
// History restores on top of the version the form is based on (base): if it changed on GitHub since, the panel asks.
// A restored version is put in the form, which is then based on it.
$('folder-history').addEventListener('click', () => opened && panel.showHistory(opened.repo, opened.id, {base: opened.sha, onOpen: showOld, onRestore: r => {
  opened.id = r.id; opened.sha = r.sha;
  showOpened(r.item);
  say('folder-msg', `Restored as the newest version (${r.commit.slice(0, 7)})${r.kept === 'copy' ? ', as a copy' : ''}. The form shows it.`);
}}));

/* ---- an old version, opened from the history ---- */
function showOld({item, commit, date}){
  $('old').replaceChildren(
    h('p', {class: 'small muted', text: `As it was in ${commit.slice(0, 7)}${date ? ', ' + new Date(date).toLocaleString() : ''}. Read only.`}),
    h('ul', {class: 'notes'}, noteCard(item)));
  $('old-card').hidden = false;
  $('old-card').scrollIntoView({block: 'nearest'});
}
$('old-close').addEventListener('click', () => { $('old-card').hidden = true; });

/* ---- things to try ---- */
$('write-token').textContent = WRITE_TOKEN;
$('read-token').textContent = READ_TOKEN;
$('use-write').addEventListener('click', () => { store.setToken(PUBLIC, WRITE_TOKEN); store.setToken(PRIVATE, WRITE_TOKEN); store.load(); });
$('walk-add').addEventListener('click', () => panel.open({token: PRIVATE}));
for (const button of document.querySelectorAll('[data-copy]')){
  button.addEventListener('click', async () => {
    const code = $(button.dataset.copy), which = button.dataset.copy === 'write-token' ? 'write' : 'read-only';
    try { await navigator.clipboard.writeText(code.textContent); say('copy-msg', `The ${which} token is copied. Paste it in the token field.`); }
    catch {   // no clipboard here: select it, to copy by hand
      getSelection().selectAllChildren(code);
      say('copy-msg', 'Copying isn’t allowed here: the token is selected, copy it by hand.', true);
    }
  });
}
$('open-panel').addEventListener('click', () => panel.open());
$('elsewhere').addEventListener('click', async () => {
  // a change on another device: the opened note, or the first published one
  const target = touched || (() => { const s = store.sources().find(s => s.items.length); return s && {repo: s.repo, id: s.items[0].id}; })();
  if (!target){ say('try-msg', 'Nothing to change yet.'); return; }
  const path = `notes/${target.id}.json`, now = fake.file(target.repo, path);
  if (!now){ say('try-msg', 'That note isn’t there any more.'); return; }
  await fake.edit(target.repo, path, {...now, text: (now.text || '') + ' (changed on the laptop)'}, {message: 'Changed on the laptop'});
  keepFake();
  say('try-msg', `“${now.title}” was changed on another device. Save or publish it now to see the question.`);
});
fake.offline = $('offline').checked; fake.staleRaw = $('stale').checked;   // a reload can keep the boxes ticked
$('offline').addEventListener('change', e => { fake.offline = e.target.checked; store.load(); });
$('stale').addEventListener('change', e => { fake.staleRaw = e.target.checked; });
$('limit').addEventListener('click', () => { fake.used = fake.limit; keepFake(); store.load(); say('try-msg', 'The 60 reads without a token are used up: the saved copy is shown, and a token lifts the limit.'); });
$('reload').addEventListener('click', () => store.load());
$('fake-reset').addEventListener('click', () => { try { sessionStorage.removeItem(FAKE_KEY); } catch { /* nothing kept */ } location.reload(); });

/* ---- the requests, as the module sent them (the token is never in this list) ---- */
function drawLog(){
  $('log-count').textContent = `${fake.log.length} requests, ${fake.used} of ${fake.limit} reads without a token used`;
  $('log').replaceChildren(...fake.log.slice(-40).reverse().map(e => {
    const u = new URL(e.url);
    const extra = e.body ? ` — ${e.body.message ? `"${e.body.message.split('\n')[0]}"` : ''}${e.body.sha ? ` sha ${e.body.sha.slice(0, 7)}` : ''}` : '';
    return h('li', {class: 'small'},
      h('code', {text: `${e.method} ${u.host === 'api.github.com' ? '' : u.host}${decodeURIComponent(u.pathname)}${u.search}`}),
      h('span', {class: 'muted', text: ` ${e.status}${e.token ? ' · Authorization: Bearer ••••' : ''}${extra}`}));
  }));
}
const logged = fake.fetch;
fake.fetch = async (...a) => { try { return await logged(...a); } finally { keepFake(); queueMicrotask(drawLog); } };

/* ---- the real repository, read without a token ---- */
const real = createGitStore({app: 'git-store-demo-real', folder: 'demo/git-store-sample', read: readNote, write: writeNote, name: n => n.title, storage: null});
$('real-load').addEventListener('click', async () => {
  say('real-msg', 'Reading bremondr/web-kit on GitHub…');
  real.follow('bremondr/web-kit');
  const s = await real.load('bremondr/web-kit');
  $('real').replaceChildren(...s.items.map(i => noteCard(i.item)));
  say('real-msg', s.error ? s.error.message : `${s.items.length} notes from demo/git-store-sample/ on main.`, !!s.error);
});

store.subscribe(drawShared);
drawShared();
drawLog();
await store.load();
document.body.dataset.ready = 'true';

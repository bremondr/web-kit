#!/usr/bin/env node
/* Screenshots for pull requests, kept on one branch of their own (`pr-screenshots`), so a pull request's description
   can show them without anyone dragging images in on github.com, and without putting images in main's history.

     node tools/pr-screenshots.mjs 62 shots/a.png shots/b.png     adds them to pr-62/ on the branch, pushes, and prints
                                                                  Markdown image links for the pull request
     node tools/pr-screenshots.mjs --remove 61 62                 deletes those folders (after the pull requests closed)
     node tools/pr-screenshots.mjs --list                         the folders on the branch

   The branch shares no history with main and holds only pictures: pr-<number>/<file> and a README. The script works
   with git's plumbing and a temporary index, so it never touches the working tree or the branch checked out.
   A file with the same name in the same folder is replaced. `--repo owner/name` sets the repository for the links
   when the remote's URL doesn't say it. Plain Node 18+ and git, no packages.

   The original of this script is consumer/pr-screenshots.mjs in bremondr/web-kit, which runs it from there. Projects
   keep a copy in their tools/ folder; take a new copy from there rather than changing it in a project. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BRANCH = 'pr-screenshots';
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const README = `# Screenshots for pull requests

This branch holds only pictures for pull request descriptions: \`pr-<number>/\`, one folder per pull request. It shares
no history with \`main\` and is never merged. \`pr-screenshots.mjs\` (from bremondr/web-kit's \`consumer/\`) adds and
removes folders: \`node <path>/pr-screenshots.mjs <number> <images...>\`, \`--list\`, \`--remove <numbers...>\`.
`;

/* ---- pure helpers (tested in pr-screenshots.test.mjs, next to this file) ---- */

/** "owner/name" from a remote's URL (https, ssh, or a proxy URL ending in /owner/name), or null. */
export function repoOfRemote(url){
  const m = /[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(String(url || '').trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The address GitHub shows a file of the branch at, as an image. */
export const imageUrl = (repo, path) => `https://github.com/${repo}/blob/${BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}?raw=true`;

/** Markdown for the pull request: one image per file, named after the file. */
export function markdown(repo, paths){
  return paths.map(p => `![${basename(p).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/[[\]\\]/g, '\\$&')}](${imageUrl(repo, p)})`).join('\n');
}

/** Checks the arguments: {mode: 'add', number, files} | {mode: 'remove', numbers} | {mode: 'list'}, plus repo. Throws with a sentence. */
export function parseArgs(argv){
  const args = [...argv];
  let repo = null;
  const k = args.indexOf('--repo');
  if (k >= 0){ repo = args[k + 1]; args.splice(k, 2); if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo || '')) throw new Error('--repo needs owner/name'); }
  const number = v => { if (!/^[1-9]\d{0,6}$/.test(v || '')) throw new Error(`Not a pull request number: ${v}`); return Number(v); };
  if (args[0] === '--list') return {mode: 'list', repo};
  if (args[0] === '--remove'){
    if (args.length < 2) throw new Error('--remove needs the pull request numbers');
    return {mode: 'remove', numbers: args.slice(1).map(number), repo};
  }
  if (args.length < 2) throw new Error('Usage: node tools/pr-screenshots.mjs <pull request number> <image files...>');
  const n = number(args[0]), files = args.slice(1);
  for (const f of files){
    if (!IMAGE.test(f)) throw new Error(`Not an image (png, jpg, gif, webp or svg): ${f}`);
    if (!existsSync(f) || !statSync(f).isFile()) throw new Error(`No such file: ${f}`);
  }
  if (new Set(files.map(f => basename(f))).size !== files.length) throw new Error('Two files have the same name');
  return {mode: 'add', number: n, files, repo};
}

/* ---- git ---- */

function gitIn(cwd, env){
  return (...args) => execFileSync('git', args, {cwd, env: {...process.env, ...env}, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
}

// the branch as it is on origin now: its commit, or null when there is none yet
function fetchBranch(git){
  try { git('fetch', '--quiet', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`); }
  catch (e){ if (/couldn't find remote ref|not found/i.test(String(e.stderr))) return null; throw e; }
  return git('rev-parse', `refs/remotes/origin/${BRANCH}`);
}

/** Makes one commit on the branch with `change(git)` applied to its files (a temporary index), and pushes it.
    Tries again when someone pushed meanwhile. Returns false when there was nothing to change. */
export function commitToBranch(cwd, message, change){
  const dir = mkdtempSync(join(tmpdir(), 'pr-screenshots-'));
  try {
    for (let attempt = 1; ; attempt++){
      const git = gitIn(cwd, {GIT_INDEX_FILE: join(dir, `index-${attempt}`)});
      const parent = fetchBranch(git);
      if (parent) git('read-tree', parent); else git('read-tree', '--empty');
      if (!parent){
        const sha = execFileSync('git', ['hash-object', '-w', '--stdin'], {cwd, input: README, encoding: 'utf8'}).trim();
        git('update-index', '--add', '--cacheinfo', `100644,${sha},README.md`);
      }
      change(git);
      const tree = git('write-tree');
      if (parent && tree === git('rev-parse', `${parent}^{tree}`)) return false;
      const commit = git('commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message);
      try { git('push', '--quiet', 'origin', `${commit}:refs/heads/${BRANCH}`); return true; }
      catch (e){ if (attempt >= 3) throw e; }
    }
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

function folders(cwd){
  const git = gitIn(cwd);
  if (!fetchBranch(git)) return [];
  return git('ls-tree', '--name-only', `refs/remotes/origin/${BRANCH}`).split('\n').filter(n => /^pr-\d+$/.test(n));
}

function main(argv, cwd = process.cwd()){
  const opts = parseArgs(argv);
  // git from the top of the work tree, so paths on the branch (pr-<number>/…) don't depend on the folder it's run from
  cwd = gitIn(cwd)('rev-parse', '--show-toplevel');
  if (opts.mode === 'list'){ const f = folders(cwd); console.log(f.length ? f.join('\n') : `No folders on ${BRANCH}.`); return; }
  if (opts.mode === 'remove'){
    const changed = commitToBranch(cwd, `Remove the screenshots of ${opts.numbers.map(n => '#' + n).join(', ')}`,
      git => opts.numbers.forEach(n => git('rm', '--cached', '-r', '-q', '--ignore-unmatch', `pr-${n}`)));
    console.log(changed ? `Removed ${opts.numbers.map(n => `pr-${n}/`).join(', ')} from ${BRANCH}.` : 'Nothing to remove.');
    return;
  }
  const repo = opts.repo || repoOfRemote(gitIn(cwd)('remote', 'get-url', 'origin'));
  if (!repo) throw new Error('The remote doesn\'t say which GitHub repository this is: add --repo owner/name');
  const paths = opts.files.map(f => `pr-${opts.number}/${basename(f)}`);
  const changed = commitToBranch(cwd, `Screenshots for #${opts.number}`, git => opts.files.forEach((f, k) => {
    const sha = git('hash-object', '-w', resolve(f));
    git('update-index', '--add', '--cacheinfo', `100644,${sha},${paths[k]}`);
  }));
  console.log(changed ? `Pushed ${paths.length} picture(s) to ${BRANCH}/pr-${opts.number}/. For the pull request's description:\n`
    : `These picture(s) are already on ${BRANCH}/pr-${opts.number}/; nothing was pushed. For the pull request's description:\n`);
  console.log(markdown(repo, paths));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href){
  try { main(process.argv.slice(2)); }
  catch (e){ console.error(String(e.stderr || '').trim() || e.message); process.exitCode = 1; }
}

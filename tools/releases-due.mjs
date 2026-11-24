#!/usr/bin/env node
/* Which module releases a commit on main is due for, from the modules' changelogs and the tags that already exist:
     node tools/releases-due.mjs
   Writes one tag per line (for example feedback-kit-v2.2.0) to standard output and explains each module on standard
   error. Exit code 1, with nothing written to standard output, when a changelog can't be read as a release, so a run
   that finds a problem releases nothing at all. Used by .github/workflows/release.yml on every push to main.

   For each module (the folders tools/check-modules.mjs checks), the top "## " heading of its CHANGELOG.md decides:
   - "## X.Y.Z (YYYY-MM-DD)", no tag <module>-vX.Y.Z yet, and X.Y.Z higher than the module's newest tag: release it.
   - "## X.Y.Z (YYYY-MM-DD)" whose tag already exists: nothing to do (released before; a tag is never moved).
   - "## X.Y.Z (unreleased)": nothing to do yet; the pull request that dates it releases it.
   - anything else: a problem (see decide() below).
   The existing tags come from `git ls-remote --tags origin`, or from a file with one tag name per line:
     node tools/releases-due.mjs --tags tags.txt */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compare, versionsOf } from '../consumer/update-vendor.mjs';
import { moduleFolders } from './check-modules.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FORMS = '"## X.Y.Z (YYYY-MM-DD)" to release it, or "## X.Y.Z (unreleased)" to release it later';

// the first "## " heading of a changelog, without the "## ", or null when it has none
export function topHeading(changelog){
  const m = /^## (.*)$/m.exec(changelog);
  return m ? m[1].trim() : null;
}

function realDate(s){
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* What to do for one module: {module, action, message, version?, tag?}, where action is
   'release'  the top section is dated and has no tag yet;
   'skip'     nothing to release (already tagged, or unreleased);
   'warn'     nothing to release, but something to fix before the section is dated;
   'problem'  the top of the changelog can't be released: the run fails and releases nothing.
   `tags` are all the repository's tag names. */
export function decide(module, changelog, tags){
  const heading = changelog === null ? null : topHeading(changelog);
  const say = (action, message, extra = {}) => ({module, action, message: `${module}: ${message}`, ...extra});
  if (changelog === null) return say('problem', 'has no CHANGELOG.md.');
  if (heading === null) return say('problem', `CHANGELOG.md has no "## " section. Its top section should be ${FORMS}.`);
  const m = /^(\d+\.\d+\.\d+) \((.*)\)$/.exec(heading);
  if (!m && /^\d+\.\d+\.\d+$/.test(heading))
    return say('problem', `the top heading "## ${heading}" has no date and isn't marked unreleased. Write ${FORMS}.`);
  if (!m) return say('problem', `the top heading "## ${heading}" is not a version. Write ${FORMS}.`);
  const [, version, when] = m, tag = `${module}-v${version}`;
  const released = versionsOf(tags, module), newest = released[released.length - 1];
  const notHigher = newest && compare(version, newest) <= 0;
  if (/^unreleased$/i.test(when)){
    if (tags.includes(tag))
      return say('warn', `${version} (unreleased) is already released as ${tag}: choose a higher version before dating it.`, {version});
    if (notHigher)
      return say('warn', `${version} (unreleased) is not higher than the newest release, ${newest}: choose a higher version before dating it.`, {version});
    return say('skip', `${version} is unreleased; the pull request that dates it releases it.`, {version});
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(when) || !realDate(when))
    return say('problem', `the top heading "## ${heading}" has no date like 2026-12-01 (or "unreleased"). Write ${FORMS}.`);
  if (tags.includes(tag)) return say('skip', `${version} is already released (${tag}).`, {version, tag});
  if (notHigher)
    return say('problem', `${version} is dated but not higher than the newest release, ${newest}, so it can't be released. Use a higher version.`, {version, tag});
  return say('release', `${version} (${when}) will be released as ${tag}.`, {version, tag});
}

/* All modules: `changelogs` maps each module to its changelog's text (null when it has none).
   Returns {release: [tag, ...], decisions: [...], ok}; when not ok, release is empty. */
export function releasesDue(changelogs, tags){
  const decisions = Object.keys(changelogs).sort().map(module => decide(module, changelogs[module], tags));
  const ok = !decisions.some(d => d.action === 'problem');
  return {ok, decisions, release: ok ? decisions.filter(d => d.action === 'release').map(d => d.tag) : []};
}

// the tag names in the output of `git ls-remote --tags`
export function tagsFromLsRemote(out){
  return [...new Set(out.split('\n').map(l => (/\trefs\/tags\/(.+?)(\^\{\})?$/.exec(l) || [])[1]).filter(Boolean))];
}

function main(argv){
  const at = argv.indexOf('--tags');
  const tags = at >= 0
    ? readFileSync(argv[at + 1], 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
    : tagsFromLsRemote(execFileSync('git', ['ls-remote', '--tags', 'origin'], {cwd: ROOT, encoding: 'utf8'}));
  const changelogs = {};
  for (const module of moduleFolders(ROOT)){
    const file = join(ROOT, module, 'CHANGELOG.md');
    changelogs[module] = existsSync(file) ? readFileSync(file, 'utf8') : null;
  }
  const {ok, decisions, release} = releasesDue(changelogs, tags);
  const actions = !!process.env.GITHUB_ACTIONS;   // annotations show on the run's summary page
  const prefix = {warn: '::warning::', problem: '::error::'};
  for (const d of decisions) console.error(`${actions && prefix[d.action] || ''}${d.message}`);
  if (!ok){
    console.error('Nothing is released until the changelogs above are fixed on main; the next push to main then releases what is due.');
    process.exit(1);
  }
  if (!release.length) console.error('Nothing to release.');
  for (const tag of release) console.log(tag);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));

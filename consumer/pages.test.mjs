/* Tests for the deploy workflow's shape and its two event tests. Plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW = fs.readFileSync(path.join(HERE, 'pages.yml'), 'utf8');

// The text of one top-level job (from "  <name>:" to the next job or the end).
function job(name) {
  const start = WORKFLOW.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, `no job ${name}`);
  const next = WORKFLOW.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
  return next < 0 ? WORKFLOW.slice(start) : WORKFLOW.slice(start, start + 1 + next);
}

// A GitHub expression made into JavaScript; enough for the comparisons, && || ! and format() used here.
function evaluate(expression, github) {
  const js = expression
    .replace(/\$\{\{\s*|\s*\}\}/g, '')
    .replace(/==/g, '===')
    .replace(/!=(?!=)/g, '!==')
    .replace(/!===/g, '!==');
  const format = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => String(args[i]));
  return Function('github', 'format', `return (${js});`)(github, format);
}

const REPO = 'owner/app';
const events = {
  push: {event_name: 'push', repository: REPO, run_id: 1, event: {}},
  dispatch: {event_name: 'workflow_dispatch', repository: REPO, run_id: 2, event: {}},
  synchronize: {event_name: 'pull_request_target', repository: REPO, run_id: 3, event: {action: 'synchronize', pull_request: {merged: false, head: {repo: {full_name: REPO}}}}},
  closedUnmerged: {event_name: 'pull_request_target', repository: REPO, run_id: 4, event: {action: 'closed', pull_request: {merged: false, head: {repo: {full_name: REPO}}}}},
  closedMerged: {event_name: 'pull_request_target', repository: REPO, run_id: 5, event: {action: 'closed', pull_request: {merged: true, head: {repo: {full_name: REPO}}}}},
  fork: {event_name: 'pull_request_target', repository: REPO, run_id: 6, event: {action: 'opened', pull_request: {merged: false, head: {repo: {full_name: 'someone/app'}}}}},
  deletedFork: {event_name: 'pull_request_target', repository: REPO, run_id: 7, event: {action: 'opened', pull_request: {merged: false, head: {repo: null}}}}
};
// github.event.pull_request.head.repo.full_name on a deleted fork is null, not an error.
const safe = (g) => JSON.parse(JSON.stringify(g), (k, v) => (k === 'repo' && v === null ? {full_name: null} : v));

test('the artifact is uploaded in one job and deployed in another', () => {
  const build = job('build');
  const deploy = job('deploy');
  assert.match(build, /actions\/upload-pages-artifact@/);
  assert.doesNotMatch(build, /actions\/deploy-pages@/);
  assert.match(deploy, /actions\/deploy-pages@/);
  assert.match(deploy, /\n {4}needs: build\n/);
  assert.match(deploy, /needs\.build\.outputs\.summary/);
});

test('only runs that publish share the concurrency group, and only they build', () => {
  const group = WORKFLOW.match(/\nconcurrency:\n {2}group: (.+)\n {2}cancel-in-progress: true\n/);
  assert.ok(group, 'one workflow-level concurrency group, cancelling the run in progress');
  const condition = job('build').match(/\n {4}if: (.+)\n/)[1];
  const publishes = {push: true, dispatch: true, synchronize: true, closedUnmerged: true, closedMerged: false, fork: false, deletedFork: false};
  for (const [name, github] of Object.entries(events)) {
    const g = {...safe(github), event: safe(github).event};
    assert.equal(evaluate(condition, g), publishes[name], `build runs for ${name}`);
    const expected = publishes[name] ? 'pages' : `pages-skipped-${github.run_id}`;
    assert.equal(evaluate(group[1], g), expected, `group for ${name}`);
  }
});

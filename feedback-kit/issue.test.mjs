/* feedback-kit: the issue address (issue.js). Plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cell, issueBody, issueTarget, issueUrl, URL_LIMIT } from './issue.js';

const params = url => new URL(url).searchParams;
const issue = {repo: 'o/r', title: 'Feedback: chart', labels: ['feedback'], footer: 'Sent from the app.',
  sections: [{heading: 'Reopen', text: '[Open it again](https://example.org/#x)', fallback: '_Too long._'}],
  rows: [['View', 'Sales | March'], ['Empty', '']]};

test('the address has the title, the labels and the body', () => {
  const {url, shortened} = issueUrl(issue);
  assert.ok(url.startsWith('https://github.com/o/r/issues/new?'));
  assert.equal(shortened, false);
  const q = params(url);
  assert.equal(q.get('title'), 'Feedback: chart');
  assert.equal(q.get('labels'), 'feedback');
  assert.equal(q.get('body'), [
    '## What’s wrong, and what should happen', '', '', '',
    '## Picture', '', '<!-- The picture was copied: paste it here, or attach the saved picture. -->', '', '',
    '## Reopen', '', '[Open it again](https://example.org/#x)', '',
    '## On screen', '', '| | |', '|---|---|', '| View | Sales \\| March |', '| Empty | – |', '',
    '<sub>Sent from the app.</sub>'].join('\n'));
});

test('the longest sections give way to their fallback until the address fits', () => {
  const long = 'x'.repeat(URL_LIMIT);
  const {url, shortened} = issueUrl({...issue, sections: [
    {heading: 'A', text: 'kept'},
    {heading: 'B', text: long, fallback: 'B was too long'},
    {heading: 'C', text: 'short', fallback: 'C was too long'}]});
  assert.equal(shortened, true);
  assert.ok(url.length <= URL_LIMIT);
  const body = params(url).get('body');
  assert.ok(body.includes('## A\n\nkept') && body.includes('B was too long') && body.includes('## C\n\nshort'));
});

test('empty parts are left out', () => {
  assert.equal(issueBody({}), '## What’s wrong, and what should happen\n\n\n\n## Picture\n\n<!-- The picture was copied: paste it here, or attach the saved picture. -->\n\n');
  assert.equal(params(issueUrl({repo: 'o/r', title: 'T', labels: []}).url).get('labels'), null);
});

test('a table cell is one line, with | and \\ escaped', () => {
  assert.equal(cell(' a\n b | c \\ d '), 'a b \\| c \\\\ d');
  assert.equal(cell(null), '–');
});

// ---- providers: GitHub as before, GitLab, the host and repo checks ----

test('GitHub: the address is byte for byte what 2.0.0 made', () => {
  const {url} = issueUrl({repo: 'o/r', title: 'Feedback: chart & “más”', labels: ['feedback', 'bug'], footer: 'Sent from the app.',
    sections: [{heading: 'Reopen', text: '[Open](https://example.org/#day=2&x=a b)', fallback: '_Too long._'}], rows: [['View', 'Sales | March']]});
  assert.equal(url, 'https://github.com/o/r/issues/new?title=Feedback%3A%20chart%20%26%20%E2%80%9Cm%C3%A1s%E2%80%9D&labels=feedback%2Cbug&body=%23%23%20What%E2%80%99s%20wrong%2C%20and%20what%20should%20happen%0A%0A%0A%0A%23%23%20Picture%0A%0A%3C!--%20The%20picture%20was%20copied%3A%20paste%20it%20here%2C%20or%20attach%20the%20saved%20picture.%20--%3E%0A%0A%0A%23%23%20Reopen%0A%0A%5BOpen%5D(https%3A%2F%2Fexample.org%2F%23day%3D2%26x%3Da%20b)%0A%0A%23%23%20On%20screen%0A%0A%7C%20%7C%20%7C%0A%7C---%7C---%7C%0A%7C%20View%20%7C%20Sales%20%5C%7C%20March%20%7C%0A%0A%3Csub%3ESent%20from%20the%20app.%3C%2Fsub%3E');
  // the same with provider and host given
  assert.equal(issueUrl({...issue, provider: 'github', host: 'https://github.com/'}).url, issueUrl(issue).url);
});

test('GitHub Enterprise: another host, the same address', () => {
  assert.ok(issueUrl({...issue, host: 'https://GitHub.Example.com'}).url.startsWith('https://github.example.com/o/r/issues/new?title='));
});

test('GitLab: title and description in the address, the labels as a /label line at the end', () => {
  const {url, shortened} = issueUrl({...issue, provider: 'gitlab', repo: 'group/project'});
  assert.ok(url.startsWith('https://gitlab.com/group/project/-/issues/new?issue%5Btitle%5D=Feedback%3A%20chart&issue%5Bdescription%5D='));
  assert.equal(shortened, false);
  const q = params(url);
  assert.equal(q.get('issue[title]'), 'Feedback: chart');
  assert.equal(q.get('labels'), null);
  assert.equal(q.get('title'), null);
  const body = q.get('issue[description]');
  assert.equal(body, issueBody(issue) + '\n\n/label ~feedback');
  assert.ok(body.endsWith('<sub>Sent from the app.</sub>\n\n/label ~feedback'));
});

test('GitLab: labels with spaces, colons or other characters are quoted; none means no /label line', () => {
  const body = l => params(issueUrl({repo: 'g/p', provider: 'gitlab', title: 'T', labels: l}).url).get('issue[description]');
  assert.ok(body(['feedback', 'needs review', 'team::ux', 'v1.2', 'ok?&@_-']).endsWith('\n\n/label ~feedback ~"needs review" ~"team::ux" ~v1.2 ~ok?&@_-'));
  assert.ok(!body([]).includes('/label'));
  assert.equal(body([]), issueBody({}));
  for (const bad of [['say "hi"'], ['two\nlines'], ['  '], 'feedback', [1]]) assert.throws(() => issueTarget({provider: 'gitlab', repo: 'g/p', labels: bad}), /label/);
  // GitHub takes the same names as before
  assert.equal(params(issueUrl({repo: 'o/r', title: 'T', labels: ['needs review', 'team::ux']}).url).get('labels'), 'needs review,team::ux');
});

test('GitLab: nested groups, and a self-hosted server under a path', () => {
  assert.ok(issueUrl({...issue, provider: 'gitlab', repo: 'a/b/c/project.name_1'}).url.startsWith('https://gitlab.com/a/b/c/project.name_1/-/issues/new?'));
  for (const host of ['https://example.org/gitlab', 'https://example.org/gitlab/', 'https://Example.ORG:8443/tools/gitlab'])
    assert.match(issueUrl({...issue, provider: 'gitlab', host, repo: 'team/app'}).url, /^https:\/\/example\.org(:8443\/tools)?\/gitlab\/team\/app\/-\/issues\/new\?issue%5Btitle%5D=/);
});

test('bad hosts are refused', () => {
  for (const host of ['http://gitlab.example.com', 'gitlab.example.com', 'https://', 'https://gitlab.example.com?x=1', 'https://gitlab.example.com/#x',
    'https://user:pw@gitlab.example.com', 'https://gitlab.example.com/a/../b', 'https://gitlab.example.com/./b', 'https://gitlab.example.com//b',
    'https://gitlab.example.com:99999', 'https://-bad.example.com', 'https://gitlab.example.com/a b', 'https://gitlab.example.com\\evil.com',
    'javascript:alert(1)', 'https://evil.com%2F@gitlab.com', ' https://gitlab.example.com', 'https://gitlab.example.com\n', '', 42, {}])
    assert.throws(() => issueTarget({provider: 'gitlab', host, repo: 'g/p'}), /host must be/, JSON.stringify(host));
});

test('bad repos are refused', () => {
  for (const repo of ['', 'name', 'o/r/', '/o/r', 'o//r', 'o/../r', './r', 'o/r?x', 'o/r#x', 'o/r x', 'o\\r', 'o/r/-/issues', undefined, null, 7])
    for (const provider of ['github', 'gitlab']) assert.throws(() => issueTarget({provider, repo}), /repo must be/, `${provider} ${JSON.stringify(repo)}`);
  // GitHub has exactly two levels
  assert.throws(() => issueTarget({repo: 'a/b/c'}), /repo must be 'owner\/name'/);
  assert.doesNotThrow(() => issueTarget({provider: 'gitlab', repo: 'a/b/c'}));
  assert.doesNotThrow(() => issueTarget({repo: 'owner/.github'}));
  assert.throws(() => issueTarget({provider: 'bitbucket', repo: 'o/r'}), /unknown provider/);
  assert.throws(() => issueTarget({provider: 'toString', repo: 'o/r'}), /unknown provider/);
});

test('urlLimit: GitLab sections give way under the limit, which can be set', () => {
  const sections = [{heading: 'Link', text: `[x](https://example.org/#${'é&'.repeat(700)})`, fallback: '_Too long._'}];
  const gl = {...issue, provider: 'gitlab', repo: 'g/p', sections};
  const full = issueUrl(gl);
  assert.equal(full.shortened, false);   // about 7200 characters: fits under 8000
  const small = issueUrl({...gl, urlLimit: 4000});
  assert.equal(small.shortened, true);
  assert.ok(small.url.length <= 4000);
  const body = params(small.url).get('issue[description]');
  assert.ok(body.includes('_Too long._') && body.endsWith('/label ~feedback'));
  // the second argument still wins, as before
  assert.equal(issueUrl(gl, 4000).url, small.url);
  for (const urlLimit of [0, 999, 2.5, '8000', null]) assert.throws(() => issueTarget({repo: 'o/r', urlLimit}), /urlLimit/);
});

test('GitLab: special characters arrive as they were', () => {
  const title = 'Ä & ü ? # % + = / “quotes” <b> 🙂';
  const text = 'line one\nline two & [a](https://x.org/?q=1&r=%20#f) | pipe';
  const q = params(issueUrl({repo: 'g/p', provider: 'gitlab', title, sections: [{heading: 'S', text}], rows: [['a|b', 'c\nd']]}).url);
  assert.equal(q.get('issue[title]'), title);
  assert.ok(q.get('issue[description]').includes(`## S\n\n${text}\n`));
  assert.ok(q.get('issue[description]').includes('| a\\|b | c d |'));
});

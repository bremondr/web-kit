/* feedback-kit: the issue address (issue.js). Plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cell, issueBody, issueUrl, URL_LIMIT } from './issue.js';

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

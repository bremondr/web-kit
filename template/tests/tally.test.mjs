/* Tests for logic that runs in plain Node: node --test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCount, step } from '../js/tally.js';

test('a saved count is read back, and anything else is 0', () => {
  assert.equal(parseCount('7'), 7);
  assert.equal(parseCount(null), 0);
  assert.equal(parseCount(''), 0);
  assert.equal(parseCount('seven'), 0);
  assert.equal(parseCount('1.5'), 0);
});

test('the count never goes below zero', () => {
  assert.equal(step(0, -1), 0);
  assert.equal(step(2, 1), 3);
});

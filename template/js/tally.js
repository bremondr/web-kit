/* The tally's logic, with no DOM, so it runs in plain Node too (tests/tally.test.mjs). */

export const KEY = 'tally';

/** The count saved in `text`, or 0 when there is none or it isn't a whole number. */
export function parseCount(text) {
  const n = Number(text);
  return text !== null && text !== '' && Number.isSafeInteger(n) ? n : 0;
}

/** The count after a step, never below zero. */
export function step(count, by) {
  return Math.max(0, count + by);
}

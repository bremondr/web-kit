/* Wires the page to the tally: reads the saved count, and saves it after every tap. */
import { KEY, parseCount, step } from './tally.js';

const output = document.getElementById('count');

function load() {
  try { return parseCount(localStorage.getItem(KEY)); } catch { return 0; }
}

function save(count) {
  try { localStorage.setItem(KEY, String(count)); } catch { /* private mode: the count just isn't kept */ }
}

let count = load();
const show = () => { output.textContent = String(count); };
const change = (next) => { count = next; save(count); show(); };

document.getElementById('up').addEventListener('click', () => change(step(count, 1)));
document.getElementById('down').addEventListener('click', () => change(step(count, -1)));
document.getElementById('reset').addEventListener('click', () => change(0));
show();

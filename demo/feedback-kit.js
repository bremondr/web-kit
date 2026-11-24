/* The feedback-kit demo: a chart with a picked day, and the kit wired to it the way a project's adapter would be.
   It imports the module from this repository, so it always runs the current branch. */
import { createFeedback } from '../feedback-kit/kit.js';
import { embedFonts, svgPicture } from '../feedback-kit/picture.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TRIES = [3, 5, 2, 6, 4, 7, 1];
const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);

// the day comes from the address (#day=1…7), so a link can reopen the chart as it was
let day = Math.min(7, Math.max(1, parseInt(new URLSearchParams(location.hash.slice(1)).get('day'), 10) || 4)) - 1;

function draw(){
  const bars = $('bars'), top = 110, base = 360, max = Math.max(...TRIES), step = 650 / DAYS.length, width = 58;
  const y = v => base - (base - top) * v / max;
  const avg = TRIES.reduce((a, b) => a + b, 0) / TRIES.length;
  const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  bars.replaceChildren(
    ...TRIES.flatMap((v, k) => {
      const x = 40 + step * k + (step - width) / 2;
      return [
        el('rect', {class: 'bar' + (k === day ? ' is-picked' : ''), 'data-day': k + 1, x, y: y(v), width, height: base - y(v), rx: 6}),
        el('text', {class: 'value', x: x + width / 2, y: y(v) - 8}, v),
        el('text', {class: 'axis day', x: x + width / 2, y: base + 26}, DAYS[k].slice(0, 3))
      ];
    }),
    el('line', {class: 'avg', x1: 40, x2: 690, y1: y(avg), y2: y(avg)}),
    el('text', {class: 'axis', x: 690, y: y(avg) - 8, 'text-anchor': 'end'}, `average ${avg.toFixed(1)}`)
  );
  $('picked').textContent = DAYS[day];
  $('earlier').disabled = day === 0;
  $('later').disabled = day === DAYS.length - 1;
}

function pick(k){
  day = k;
  history.replaceState(null, '', `#day=${day + 1}`);
  draw();
}
$('earlier').addEventListener('click', () => pick(day - 1));
$('later').addEventListener('click', () => pick(day + 1));
addEventListener('hashchange', () => { const d = parseInt(new URLSearchParams(location.hash.slice(1)).get('day'), 10); if (d >= 1 && d <= 7) pick(d - 1); });
draw();

// a list scrolled part of the way down, so the whole page's picture shows it scrolled too
$('tries').replaceChildren(...Array.from({length: 24}, (_, k) => Object.assign(document.createElement('li'), {textContent: `${DAYS[k % 7]}: ${TRIES[k % 7]} tries`})));
$('tries').scrollTop = 160;

// the title's web font, inlined for the picture (an SVG drawn as an image can't load it by itself)
const fonts = embedFonts({stylesheet: new URL('fonts/bungee.css', location.href).href, family: 'Bungee'});
fonts.then(css => {
  $('font-status').textContent = css.includes('data:') ? `Bungee, inlined, ${Math.round(css.length / 1024)} KB` : 'Bungee could not be inlined';
});

// the same kit for GitHub (this repository) and for GitLab (a server that doesn't exist, so nothing goes anywhere);
// a project makes one, with its own repo
const TARGETS = {
  github: {repo: 'bremondr/web-kit'},
  gitlab: {provider: 'gitlab', host: 'https://gitlab.example.com/gitlab', repo: 'demo-group/feedback/demo-app'}
};
const options = {
  labels: ['demo'],
  footer: 'Sent from the feedback-kit demo page in web-kit.',
  // the whole page first; its area is read at each tap, so the checkbox works without making the kit again
  page: {fonts, get area(){ return $('full-page').checked ? 'full' : 'screen'; }},
  // the page's own part, as a switch in the panel
  picture: () => svgPicture($('chart'), {fonts, vars: ['--demo-sky-top', '--demo-sky-bottom']}),
  pictureLabel: 'Just the chart',
  // read at each tap, so the choice on the page works at once
  capture: () => document.querySelector('input[name=capture]:checked').value,
  describe: () => {
    const name = DAYS[day], tries = TRIES[day];
    let reopen = `${location.origin}${location.pathname}#day=${day + 1}`;
    if ($('long-link').checked) reopen += '&padding=' + 'x'.repeat(9000);   // longer than GitHub or GitLab accepts
    return {
      subtitle: `Tries per day, ${name}`,
      fileName: `feedback-demo-${name.toLowerCase()}.png`,
      // a promise, as when a project packs its link first: the panel opens at once and the issue link follows
      issue: new Promise(done => setTimeout(() => done({
        title: `Demo feedback: ${name}`,
        sections: [{heading: 'Reopen', text: `[Open the chart at ${name}](${reopen})`, fallback: '_The link was too long to include._'}],
        rows: [['Module', 'feedback-kit, from this branch'], ['Day', name], ['Tries', String(tries)]]
      }), 100))
    };
  }
};
const kits = Object.fromEntries(Object.entries(TARGETS).map(([name, target]) => [name, createFeedback({...target, ...options})]));
const provider = () => document.querySelector('input[name=provider]:checked').value;
for (const radio of document.querySelectorAll('input[name=provider]')) radio.addEventListener('change', () => {
  for (const name of Object.keys(TARGETS)) $(`where-${name}`).hidden = name !== provider();
});
$('feedback').addEventListener('click', () => kits[provider()].open());

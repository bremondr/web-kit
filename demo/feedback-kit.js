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

// the title's web font, inlined for the picture (an SVG drawn as an image can't load it by itself)
const fonts = embedFonts({stylesheet: new URL('fonts/bungee.css', location.href).href, family: 'Bungee'});
fonts.then(css => {
  $('font-status').textContent = css.includes('data:') ? `Bungee, inlined, ${Math.round(css.length / 1024)} KB` : 'Bungee could not be inlined';
});

const feedback = createFeedback({
  repo: 'bremondr/web-kit',
  labels: ['demo'],
  footer: 'Sent from the feedback-kit demo page in web-kit.',
  picture: () => svgPicture($('chart'), {fonts, vars: ['--demo-sky-top', '--demo-sky-bottom']}),
  describe: () => {
    const name = DAYS[day], tries = TRIES[day];
    let reopen = `${location.origin}${location.pathname}#day=${day + 1}`;
    if ($('long-link').checked) reopen += '&padding=' + 'x'.repeat(9000);   // longer than GitHub accepts
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
});
$('feedback').addEventListener('click', feedback.open);

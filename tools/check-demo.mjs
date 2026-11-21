#!/usr/bin/env node
/* Drives the demo pages (demo/) in headless Chromium with Playwright, at iPad and phone sizes, in light and dark mode:
   no page errors, no console errors, no failed requests, nothing wider than the screen. On the feedback-kit page the
   panel opens with a picture that kept the chart's CSS variables and classes, a stroke can be drawn and undone, and
   the issue link is filled in (also with the Reopen link too long, so the fallback is used).

     node tools/check-demo.mjs                        (exit code 1 when something is wrong)
     node tools/check-demo.mjs --screenshots <dir>    also save a picture of each page and of the open panel

   Needs Playwright with Chromium. It serves the repository's root itself, so nothing else has to run. */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);   // finds Playwright in node_modules or in a global install
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Playwright is not installed. Install it with:  npm install --no-save playwright && npx playwright install chromium'); process.exit(2); }

const arg = process.argv.indexOf('--screenshots');
const shots = arg > 0 ? resolve(process.argv[arg + 1] || 'demo-screenshots') : null;
if (shots) mkdirSync(shots, { recursive: true });

const SIZES = [['ipad-landscape', 1180, 820], ['ipad-portrait', 820, 1180], ['phone', 390, 844]];
const SCHEMES = ['light', 'dark'];
const COLORS = {   // as set in demo/feedback-kit.html
  light: { pick: '#e8590c', skyTop: '#8ec5ff' },
  dark: { pick: '#ffb347', skyTop: '#0b1f3a' }
};

// a static server for the repository's root
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/plain' };
const server = createServer((req, res) => {
  let path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403).end(); return; }
  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
    const body = readFileSync(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);
const hex = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
const near = (a, b, d = 24) => a.every((v, k) => Math.abs(v - b[k]) <= d);

const browser = await chromium.launch();
try {
  {   // the repository's root (as GitHub Pages serves it) sends visitors to the demo
    const page = await browser.newPage();
    await page.goto(`${base}/`);
    await page.waitForURL(`${base}/demo/`, { timeout: 5000 }).catch(() => fail('index.html', `the root goes to ${page.url()}, not /demo/`));
    await page.close();
  }
  for (const scheme of SCHEMES) for (const [size, width, height] of SIZES) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, hasTouch: width < 600, deviceScaleFactor: shots ? 2 : 1 });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    for (const pageName of ['index.html', 'feedback-kit.html']) {
      const where = `${pageName} ${size} ${scheme}`;
      const page = await context.newPage();
      page.on('pageerror', e => fail(where, `page error: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') fail(where, `console error: ${m.text()}`); });
      page.on('requestfailed', r => fail(where, `request failed: ${r.url()} (${r.failure()?.errorText})`));
      page.on('response', r => { if (r.status() >= 400) fail(where, `HTTP ${r.status()} for ${r.url()}`); });
      await page.goto(`${base}/demo/${pageName}`, { waitUntil: 'networkidle' });

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 0) fail(where, `the page is ${overflow} px wider than the screen`);
      if (shots) await page.screenshot({ path: join(shots, `${pageName.replace('.html', '')}-${size}-${scheme}.png`), fullPage: true });
      if (pageName === 'feedback-kit.html') await checkFeedback(page, where, scheme, size).catch(e => fail(where, e.message.split('\n')[0]));
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

async function checkFeedback(page, where, scheme, size) {
  await page.waitForFunction(() => /^Bungee, inlined/.test(document.getElementById('font-status').textContent), null, { timeout: 5000 })
    .catch(() => fail(where, 'the web font was not inlined for the picture'));

  // where the picked bar and the sky are, as fractions of the chart, to look for them in the picture
  const spots = await page.evaluate(() => {
    const svg = document.getElementById('chart').getBoundingClientRect();
    const bar = document.querySelector('.bar.is-picked').getBoundingClientRect();
    return { bar: [(bar.left + bar.width / 2 - svg.left) / svg.width, (bar.bottom - 6 - svg.top) / svg.height], sky: [0.5, 0.01] };
  });

  await page.click('#feedback');
  const panel = page.locator('.fk');
  await panel.waitFor({ state: 'visible' });
  // the canvas shows once the picture is ready, and "Making the picture…" goes
  await page.locator('.fk-wait').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => fail(where, 'no picture in the panel'));

  // a hidden canvas is really hidden (the kit's own display rule once won over the hidden attribute)
  const hiddenShows = await page.evaluate(() => {
    const c = document.querySelector('.fk-canvas'), was = c.hidden;
    c.hidden = true; const d = getComputedStyle(c).display; c.hidden = was;
    return d !== 'none';
  });
  if (hiddenShows) fail(where, 'the canvas shows while it is hidden (before the picture is ready)');

  const inside = await page.evaluate(() => {
    const r = document.querySelector('.fk-card').getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  });
  if (!inside) fail(where, 'the panel does not fit on the screen');

  // the picture kept the colour from the class and CSS variable, and the gradient set inside the SVG
  const pixel = ([fx, fy]) => page.evaluate(([fx, fy]) => {
    const c = document.querySelector('.fk-canvas');
    return [...c.getContext('2d').getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data].slice(0, 3);
  }, [fx, fy]);
  const bar = await pixel(spots.bar), sky = await pixel(spots.sky);
  if (!near(bar, hex(COLORS[scheme].pick))) fail(where, `the picked bar is rgb(${bar}) in the picture, not ${COLORS[scheme].pick}`);
  if (!near(sky, hex(COLORS[scheme].skyTop))) fail(where, `the sky is rgb(${sky}) in the picture, not ${COLORS[scheme].skyTop}`);

  // a stroke across the picture, then Undo
  const box = await page.locator('.fk-canvas').boundingBox();
  const from = [box.x + box.width * 0.2, box.y + box.height * 0.5], to = [box.x + box.width * 0.6, box.y + box.height * 0.5];
  const mid = [0.4, 0.5];
  const before = await pixel(mid);
  await page.mouse.move(...from);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) await page.mouse.move(from[0] + (to[0] - from[0]) * k / 10, from[1]);
  await page.mouse.up();
  const drawn = await pixel(mid);
  if (!near(drawn, hex('#ff2d55'), 40)) fail(where, `the stroke did not draw (rgb(${drawn}) under it)`);
  const undo = page.locator('.fk-tools .fk-btn', { hasText: 'Undo' });
  if (shots) await page.screenshot({ path: join(shots, `feedback-panel-${size}-${scheme}.png`) });
  if (await undo.isDisabled()) fail(where, 'Undo is still off after a stroke');
  else {
    await undo.click();
    const undone = await pixel(mid);
    if (!near(undone, before, 2)) fail(where, `Undo did not take the stroke away (rgb(${undone}), was rgb(${before}))`);
    if (!(await undo.isDisabled())) fail(where, 'Undo is still on with no strokes');
  }

  // the issue link
  await page.waitForFunction(() => document.querySelector('.fk-primary').href, null, { timeout: 5000 }).catch(() => {});
  const issue = await issueOf(page);
  if (!issue) fail(where, 'the issue link was not filled in');
  else {
    if (!issue.url.startsWith('https://github.com/bremondr/web-kit/issues/new?')) fail(where, `the issue goes to ${issue.url.slice(0, 60)}`);
    if (issue.labels !== 'demo') fail(where, `the issue's labels are "${issue.labels}"`);
    if (!/^Demo feedback: \w+day$/.test(issue.title)) fail(where, `the issue's title is "${issue.title}"`);
    for (const part of ['## Reopen', '/demo/feedback-kit.html#day=', '| Day |', '| Screen |', '| Browser |']) if (!issue.body.includes(part)) fail(where, `the issue's body has no "${part}"`);
    if (issue.shortened) fail(where, 'the panel says the issue was shortened, but nothing was too long');
  }
  await page.keyboard.press('Escape');
  if (await panel.isVisible()) fail(where, 'Esc did not close the panel');

  // with the Reopen link too long, its fallback is used and the panel says so
  await page.check('#long-link');
  await page.click('#feedback');
  await page.waitForFunction(() => document.querySelector('.fk-primary').href, null, { timeout: 5000 }).catch(() => {});
  const long = await issueOf(page);
  if (!long || !long.body.includes('_The link was too long to include._')) fail(where, 'the too-long Reopen link did not give way to its fallback');
  else if (!long.shortened) fail(where, 'the panel does not say the issue was shortened');
  if (long && long.url.length > 8000) fail(where, `the issue link is ${long.url.length} characters long`);
  await page.click('.fk-x');
  await page.uncheck('#long-link');
}

async function issueOf(page) {
  return page.evaluate(() => {
    const a = document.querySelector('.fk-primary');
    if (!a.href) return null;
    const q = new URL(a.href).searchParams;
    const note = [...document.querySelectorAll('.fk-side .fk-note')].find(n => /too long/.test(n.textContent));
    return { url: a.href, title: q.get('title'), labels: q.get('labels'), body: q.get('body'), shortened: !!note && !note.hidden };
  });
}

if (problems.length) { problems.forEach(p => console.log('PROBLEM ' + p)); process.exit(1); }
console.log(`The demo works at ${SIZES.length} sizes in light and dark mode${shots ? `; screenshots in ${shots}` : ''}.`);

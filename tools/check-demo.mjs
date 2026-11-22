#!/usr/bin/env node
/* Drives the demo pages (demo/) in a headless browser with Playwright, at desktop, iPad and phone sizes, in light and
   dark mode: no page errors, no console errors, no failed requests, nothing wider than the screen. On the
   feedback-kit page the panel opens with a picture of the whole page, "Just the chart" switches to the chart's own
   picture, both keep the chart's CSS variables and classes, a stroke can be drawn and undone, the whole scrollable
   page can be pictured, and the issue link is filled in (also with the Reopen link too long, so the fallback is used).

     node tools/check-demo.mjs                        (exit code 1 when something is wrong)
     node tools/check-demo.mjs --screenshots <dir>    also save a picture of each page and of the open panel
     node tools/check-demo.mjs --browser webkit       in WebKit (Safari's engine) instead of Chromium; also firefox

   Needs Playwright with that browser. It serves the repository's root itself, so nothing else has to run. */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);   // finds Playwright in node_modules or in a global install
const option = (name, otherwise) => { const k = process.argv.indexOf(name); return k > 0 ? process.argv[k + 1] || otherwise : null; };
const browserName = option('--browser', 'chromium') || 'chromium';
let browserType;
try { browserType = require('playwright')[browserName]; }
catch { console.error(`Playwright is not installed. Install it with:  npm install --no-save playwright && npx playwright install ${browserName}`); process.exit(2); }
if (!browserType) { console.error(`No browser called ${browserName}: chromium, webkit or firefox.`); process.exit(2); }

const shots = option('--screenshots', 'demo-screenshots') && resolve(option('--screenshots', 'demo-screenshots'));
if (shots) mkdirSync(shots, { recursive: true });

const SIZES = [['desktop', 1440, 900], ['ipad-landscape', 1180, 820], ['ipad-portrait', 820, 1180], ['phone', 390, 844]];
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

const browser = await browserType.launch();
try {
  {   // the repository's root (as GitHub Pages serves it) sends visitors to the demo
    const page = await browser.newPage();
    await page.goto(`${base}/`);
    await page.waitForURL(`${base}/demo/`, { timeout: 5000 }).catch(() => fail('index.html', `the root goes to ${page.url()}, not /demo/`));
    await page.close();
  }
  for (const scheme of SCHEMES) for (const [size, width, height] of SIZES) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, hasTouch: width < 600, deviceScaleFactor: shots ? 2 : 1 });
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
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

  // the chart just under the sticky bar, so the page is scrolled and the bar is stuck. Then where the picked bar and
  // the sky are: as fractions of the screen for the page's picture, and of the chart for the chart's own
  const spots = await page.evaluate(() => {
    const bar0 = document.querySelector('.topbar').getBoundingClientRect().height;
    scrollTo(0, scrollY + document.getElementById('chart').getBoundingClientRect().top - bar0 - 12);
    const svg = document.getElementById('chart').getBoundingClientRect();
    const bar = document.querySelector('.bar.is-picked').getBoundingClientRect();
    const top = document.querySelector('.topbar').getBoundingClientRect();
    const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
    const barAt = [bar.left + bar.width / 2, bar.bottom - 6];
    return {
      scrolled: scrollY > 0, stuck: Math.abs(top.top) < 1,
      pageBar: [barAt[0] / W, barAt[1] / H], pageTopbar: [0.5, (top.top + top.height / 2) / H],
      bar: [(barAt[0] - svg.left) / svg.width, (barAt[1] - svg.top) / svg.height], sky: [0.5, 0.01]
    };
  });

  await page.click('#feedback');
  const panel = page.locator('.fk');
  await panel.waitFor({ state: 'visible' });
  // the canvas shows once the picture is ready, and "Making the picture…" goes
  await page.locator('.fk-wait').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => fail(where, 'no picture in the panel'));
  await page.waitForFunction(() => !/^Making/.test(document.querySelector('.fk-status').textContent), null, { timeout: 5000 }).catch(() => {});

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

  const pixel = ([fx, fy]) => page.evaluate(([fx, fy]) => {
    const c = document.querySelector('.fk-canvas');
    return [...c.getContext('2d').getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data].slice(0, 3);
  }, [fx, fy]);
  // the picture is ready, and the message under it says whether it was copied
  const ready = async () => {
    await page.locator('.fk-wait').waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForFunction(() => !/^Making/.test(document.querySelector('.fk-status').textContent), null, { timeout: 5000 });
  };

  // the whole page comes first: the size of the screen, with the chart where it is on screen
  const pressed = await page.locator('.fk-pick [aria-pressed="true"]').textContent().catch(() => null);
  if (pressed !== 'Whole page') fail(where, `the panel opens with "${pressed}" chosen, not the whole page`);
  const shape = await page.evaluate(() => { const c = document.querySelector('.fk-canvas'), d = document.documentElement; return [c.width / c.height, d.clientWidth / d.clientHeight]; });
  if (Math.abs(shape[0] - shape[1]) > 0.02) fail(where, `the page's picture is ${shape[0].toFixed(2)} wide for 1 high, the screen ${shape[1].toFixed(2)}`);
  if (!spots.scrolled || !spots.stuck) fail(where, 'the demo page did not scroll so that the sticky bar sticks (the check needs that)');
  const pageBar = await pixel(spots.pageBar);
  if (!near(pageBar, hex(COLORS[scheme].pick))) fail(where, `the picked bar is rgb(${pageBar}) in the page's picture, not ${COLORS[scheme].pick}`);
  const topbar = await pixel(spots.pageTopbar);
  if (near(topbar, hex(COLORS[scheme].pick), 40)) fail(where, 'the sticky bar is not at the top of the page\'s picture');
  if (shots) await page.screenshot({ path: join(shots, `feedback-page-${size}-${scheme}.png`) });

  // the Share button shows only where the browser can share the picture
  const share = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.fk-btn')].find(x => x.textContent.startsWith('Share'));
    const can = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
    return { shown: !!b && b.offsetParent !== null, can };
  });
  if (share.shown && !share.can) fail(where, 'Share… shows, but this browser can\'t share the picture');

  // "Just the chart": the chart's own picture kept the colour from the class and CSS variable, and the gradient set
  // inside the SVG
  await page.locator('.fk-pick .fk-btn', { hasText: 'Just the chart' }).click();
  await ready().catch(() => fail(where, 'no picture after switching to the chart'));
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

  // the whole scrollable page: as tall as the page, not only the screen
  await page.check('#full-page');
  await page.click('#feedback');
  await ready().catch(() => fail(where, 'no picture of the whole scrollable page'));
  const tall = await page.evaluate(() => { const c = document.querySelector('.fk-canvas'), d = document.documentElement; return [c.height / c.width, d.scrollHeight / d.clientWidth]; });
  if (Math.abs(tall[0] - tall[1]) > 0.02) fail(where, `the whole page's picture is ${tall[0].toFixed(2)} high for 1 wide, the page ${tall[1].toFixed(2)}`);
  await page.click('.fk-x');
  await page.uncheck('#full-page');
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
console.log(`The demo works in ${browserName} at ${SIZES.length} sizes in light and dark mode${shots ? `; screenshots in ${shots}` : ''}.`);

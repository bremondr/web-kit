#!/usr/bin/env node
/* Drives the demo pages (demo/) in a headless browser with Playwright, at desktop, iPad and phone sizes, in light and
   dark mode: no page errors, no console errors, no failed requests, nothing wider than the screen. On the
   feedback-kit page the panel opens with a picture of the whole page, "Just the chart" switches to the chart's own
   picture, both keep the chart's CSS variables and classes, a stroke can be drawn and undone, the person's own
   screenshot can be chosen, pasted or dropped instead, a (faked) real screen capture works with the button and at the
   tap and leaves the panel out, the whole scrollable page can be pictured, and the issue link is filled in (also with the Reopen link too long, so the fallback is used).
   With GitLab chosen, the link goes to the example GitLab server, with the label as a /label line and GitLab named in the panel.
   The panel's texts are English by default; with Czech chosen, no English is left in the panel or the issue (but the
   browser's user agent), and no text in the panel is cut off or wider than its place.
   On the git-store-kit page (against its fake GitHub): the public repo loads without a token and the private one
   asks for one; a token pasted in the panel opens it; publishing sends one commit; a change made elsewhere brings up
   the conflict question, and each answer works; an item's history lists its versions and opens and restores one;
   the working folder opens, edits and saves, and its history restores into the form, asking first when GitHub has a
   newer version than the one opened; the fake GitHub survives a reload and starts over on request; offline shows
   the saved copy; and no token ever shows in the request list. The panel fits on the screen in each view.

     node tools/check-demo.mjs                        (exit code 1 when something is wrong)
     node tools/check-demo.mjs --screenshots <dir>    also save a picture of each page and of the open panel
     node tools/check-demo.mjs --browser webkit       in WebKit (Safari's engine) instead of Chromium; also firefox

   Needs Playwright with that browser. It serves the repository's root itself, so nothing else has to run. */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { STRINGS } = await import(pathToFileURL(join(root, 'feedback-kit/strings.js')).href);   // the kit's texts
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
    for (const pageName of ['index.html', 'feedback-kit.html', 'git-store-kit.html']) {
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
      if (pageName === 'git-store-kit.html') await checkGitStore(page, where, scheme, size).catch(e => fail(where, e.message.split('\n')[0]));
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

  // the kit's English texts, as without the language option
  if (await panel.getAttribute('lang') !== null) fail(where, 'the English panel has a lang attribute (the kit sets it only with language)');
  const enPanel = await panelTexts(page);
  for (const text of ['Send feedback', 'Write the issue on GitHub', 'Whole page', 'Use my screenshot…', 'Undo', 'Clear', 'Copy picture', 'Save picture', 'Red pen', 'Pen colour',
    'Draw on the picture to point at the problem.', 'The issue opens on GitHub with what was on screen filled in. Sign in, paste the picture, say what’s wrong, and tap Submit.'])
    if (!enPanel.split('\n').includes(text)) fail(where, `the English panel has no "${text}"`);

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
    for (const part of ['## Reopen', '/demo/feedback-kit.html#day=', '| Day |', '| Screen |', '| Browser |', ...(size === 'desktop' ? ['| Window |'] : [])]) if (!issue.body.includes(part)) fail(where, `the issue's body has no "${part}"`);
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

  // your own screenshot: chosen with the button, pasted, or dropped, it becomes the picture. Each test picture is one
  // colour, so the picture's middle says which one arrived
  const testPicture = color => page.evaluate(color => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 200;
    const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 320, 200);
    return c.toDataURL('image/png').split(',')[1];
  }, color);
  const own = async (how, color) => {
    await ready().catch(() => {});
    if (!near(await pixel([0.5, 0.5]), hex(color), 6)) fail(where, `the screenshot ${how} is not the picture (rgb(${await pixel([0.5, 0.5])}) in the middle)`);
    const chosen = await page.locator('.fk-pick [aria-pressed="true"]').textContent().catch(() => null);
    if (chosen !== 'Your screenshot') fail(where, `after a screenshot ${how}, "${chosen}" is chosen`);
  };
  await page.click('#feedback');
  await ready();
  await page.locator('.fk-own input[type=file]').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: Buffer.from(await testPicture('#00a86b'), 'base64') });
  await own('chosen', '#00a86b');
  const sent = async (type, color) => page.evaluate(async ([type, b64]) => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
    if (type === 'paste') document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    else {
      const stage = document.querySelector('.fk-stage');
      stage.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      stage.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  }, [type, await testPicture(color)]);
  await sent('paste', '#7b2ff7');
  await own('pasted', '#7b2ff7');
  await sent('drop', '#ffcc00');
  await own('dropped', '#ffcc00');
  if (await page.locator('.fk').evaluate(e => e.classList.contains('fk-drop'))) fail(where, 'the panel still shows the drop outline after the drop');
  await page.locator('.fk-pick .fk-btn', { hasText: 'Whole page' }).click();
  await ready().catch(() => fail(where, 'no picture after switching back to the whole page'));
  if (near(await pixel([0.5, 0.5]), hex('#ffcc00'), 6)) fail(where, 'switching back to the whole page still shows the screenshot');
  await page.click('.fk-x');

  // a real screen capture. Headless browsers can't capture, so getDisplayMedia gives a canvas painted one colour,
  // and notes whether the panel was out of the way when it was asked; or it says no, as when the person declines
  await page.evaluate(() => {
    window.fakeCapture = { answer: 'yes', asked: 0, panelShown: false };
    const getDisplayMedia = async () => {
      fakeCapture.asked++;
      const fk = document.querySelector('.fk');
      fakeCapture.panelShown = !!fk && !fk.hidden;
      if (fakeCapture.answer !== 'yes') throw new DOMException('declined', 'NotAllowedError');
      const c = document.createElement('canvas'); c.width = 1280; c.height = 800;
      const x = c.getContext('2d'), paint = () => { x.fillStyle = '#12ab34'; x.fillRect(0, 0, c.width, c.height); };
      // captureStream() with no frame rate: a frame each time the canvas is painted. In WebKit, captureStream(20)
      // with this canvas (not on the page, painted every 50 ms) sometimes gives no frame at all (issue #20)
      paint(); setInterval(paint, 50);
      return c.captureStream();
    };
    // on the prototype and the object itself: WebKit ignores a plain assignment
    const put = (o, k, v) => Object.defineProperty(o, k, { value: v, configurable: true, writable: true });
    if (navigator.mediaDevices){
      if (typeof MediaDevices === 'function') put(MediaDevices.prototype, 'getDisplayMedia', getDisplayMedia);
      put(navigator.mediaDevices, 'getDisplayMedia', getDisplayMedia);
    } else put(navigator, 'mediaDevices', { getDisplayMedia });
    window.fakeCapture.installed = navigator.mediaDevices.getDisplayMedia === getDisplayMedia;
  });
  if (!(await page.evaluate(() => fakeCapture.installed))) fail(where, 'the check could not put its fake screen capture in place');
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const grab = page.locator('.fk-btn', { hasText: 'Take a real screenshot' });
  await page.click('#feedback');
  await ready();
  if (coarse) { if (await grab.isVisible()) fail(where, '"Take a real screenshot" shows on a touch screen, where browsers can\'t capture'); }
  else if (!(await grab.isVisible())) fail(where, 'no "Take a real screenshot" button on a desktop-like screen');
  else {
    await grab.click();
    await page.waitForFunction(() => fakeCapture.asked > 0 && !document.querySelector('.fk').hidden, null, { timeout: 5000 }).catch(() => {});
    await ready().catch(() => fail(where, 'no picture after the screen capture'));
    const f = await page.evaluate(() => fakeCapture);
    if (f.asked !== 1) fail(where, `the screen capture was asked for ${f.asked} times`);
    if (f.panelShown) fail(where, 'the panel was on screen while capturing, so it would be in the picture');
    if (!(await page.locator('.fk').isVisible())) fail(where, 'the panel did not come back after the screen capture');
    if (!near(await pixel([0.5, 0.5]), hex('#12ab34'), 8)) fail(where, `the screen capture is not the picture (rgb(${await pixel([0.5, 0.5])}))`);
    const chosen = await page.locator('.fk-pick [aria-pressed="true"]').textContent().catch(() => null);
    if (chosen !== 'Screen capture') fail(where, `after the screen capture, "${chosen}" is chosen`);
    // declined: the panel comes back with the picture it had, and says so
    await page.evaluate(() => { fakeCapture.answer = 'no'; fakeCapture.asked = 0; });
    await grab.click();
    await page.waitForFunction(() => fakeCapture.asked > 0 && !document.querySelector('.fk').hidden, null, { timeout: 5000 })
      .catch(() => fail(where, 'the panel did not come back after the capture was declined'));
    await ready().catch(() => {});
    const said = await page.locator('.fk-status').textContent();
    if (!/No screen capture/.test(said)) fail(where, `after a declined capture the panel says "${said}"`);
    if (!near(await pixel([0.5, 0.5]), hex('#12ab34'), 8)) fail(where, 'after a declined capture the picture changed');
  }
  await page.click('.fk-x');
  if (!coarse) {
    // at the tap: the browser asks before the panel opens, which then shows the capture
    await page.evaluate(() => { fakeCapture.answer = 'yes'; fakeCapture.asked = 0; });
    await page.check('input[name=capture][value=tap]');
    await page.click('#feedback');
    await page.waitForFunction(() => fakeCapture.asked > 0 && !document.querySelector('.fk').hidden, null, { timeout: 5000 })
      .catch(() => fail(where, 'the panel did not open after a capture at the tap'));
    await ready().catch(() => {});
    const f = await page.evaluate(() => fakeCapture);
    if (f.asked !== 1 || f.panelShown) fail(where, `at the tap, the capture was asked ${f.asked} times, with the panel ${f.panelShown ? 'on screen' : 'hidden'}`);
    if (!near(await pixel([0.5, 0.5]), hex('#12ab34'), 8)) fail(where, 'at the tap, the screen capture is not the picture');
    await page.click('.fk-x');
    // off: no button
    await page.check('input[name=capture][value=off]');
    await page.click('#feedback');
    await ready();
    if (await grab.isVisible()) fail(where, '"Take a real screenshot" shows with capture off');
    await page.click('.fk-x');
    await page.check('input[name=capture][value=button]');
  }

  // the whole scrollable page: as tall as the page, not only the screen
  await page.check('#full-page');
  await page.click('#feedback');
  await ready().catch(() => fail(where, 'no picture of the whole scrollable page'));
  const tall = await page.evaluate(() => { const c = document.querySelector('.fk-canvas'), d = document.documentElement; return [c.height / c.width, d.scrollHeight / d.clientWidth]; });
  if (Math.abs(tall[0] - tall[1]) > 0.02) fail(where, `the whole page's picture is ${tall[0].toFixed(2)} high for 1 wide, the page ${tall[1].toFixed(2)}`);
  await page.click('.fk-x');
  await page.uncheck('#full-page');

  // GitLab: the same panel, with an address on the example self-hosted server (nested groups, a path), the label as a
  // /label line, and the provider's name in the button and the note. This makes a second panel, so it comes last
  await page.check('input[name=provider][value=gitlab]');
  if (!(await page.locator('#where-gitlab').isVisible()) || await page.locator('#where-github').isVisible()) fail(where, 'the page does not say where GitLab issues go');
  await page.click('#feedback');
  const open = page.locator('.fk:not([hidden])');
  await open.locator('.fk-wait').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => fail(where, 'GitLab: no picture in the panel'));
  await page.waitForFunction(() => !/^Making/.test(document.querySelector('.fk:not([hidden]) .fk-status').textContent), null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.fk:not([hidden]) .fk-primary')?.href, null, { timeout: 5000 }).catch(() => {});
  const gl = await issueOf(page);
  if (!gl) fail(where, 'GitLab: the issue link was not filled in');
  else {
    const start = 'https://gitlab.example.com/gitlab/demo-group/feedback/demo-app/-/issues/new?issue%5Btitle%5D=';
    if (!gl.url.startsWith(start)) fail(where, `GitLab: the issue goes to ${gl.url.slice(0, 90)}`);
    const q = new URL(gl.url).searchParams, body = q.get('issue[description]') || '';
    if (!/^Demo feedback: \w+day$/.test(q.get('issue[title]'))) fail(where, `GitLab: the issue's title is "${q.get('issue[title]')}"`);
    if (q.get('labels') !== null || q.get('title') !== null || q.get('body') !== null) fail(where, 'GitLab: the address has GitHub\'s fields');
    if (!body.endsWith('<sub>Sent from the feedback-kit demo page in web-kit.</sub>\n\n/label ~demo')) fail(where, `GitLab: the description ends with "${body.slice(-60)}"`);
    for (const part of ['## Reopen', '/demo/feedback-kit.html#day=', '| Day |', '| Screen |']) if (!body.includes(part)) fail(where, `GitLab: the description has no "${part}"`);
    if (gl.url.length > 8000) fail(where, `GitLab: the issue link is ${gl.url.length} characters long`);
  }
  const button = await open.locator('.fk-primary').textContent();
  if (button !== 'Write the issue on GitLab') fail(where, `GitLab: the button says "${button}"`);
  if (!(await open.locator('.fk-note', { hasText: 'The issue opens on GitLab' }).count())) fail(where, 'GitLab: the panel\'s note does not name GitLab');
  if ((await open.innerText()).includes('GitHub')) fail(where, 'GitLab: the panel mentions GitHub');
  if (shots) await page.screenshot({ path: join(shots, `feedback-panel-gitlab-${size}-${scheme}.png`) });
  await open.locator('.fk-x').click();
  await page.check('input[name=provider][value=github]');

  // Czech: language: 'cs' (another panel again). No English in the panel or in the issue, and the longer words fit
  await page.check('input[name=language][value=cs]');
  await page.click('#feedback');
  await open.locator('.fk-wait').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => fail(where, 'Czech: no picture in the panel'));
  await page.waitForFunction(() => !/^Připravuji/.test(document.querySelector('.fk:not([hidden]) .fk-status').textContent), null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.fk:not([hidden]) .fk-primary')?.href, null, { timeout: 5000 }).catch(() => {});
  if (await open.getAttribute('lang') !== 'cs') fail(where, 'Czech: the panel has no lang="cs"');
  const csButton = await open.locator('.fk-primary').textContent();
  if (csButton !== 'Napsat hlášení na GitHubu') fail(where, `Czech: the button says "${csButton}"`);
  const csPanel = await panelTexts(page);
  for (const text of englishIn(csPanel)) fail(where, `Czech: the panel has English in it: "${text}"`);
  const cut = await page.evaluate(() => {
    const card = document.querySelector('.fk:not([hidden]) .fk-card').getBoundingClientRect();
    return [...document.querySelectorAll('.fk:not([hidden]) :is(button, a, p, h2, .fk-side)')].filter(e => e.offsetParent !== null && !e.matches('.fk-sub')).flatMap(e => {
      const r = e.getBoundingClientRect(), what = (e.textContent || e.getAttribute('aria-label') || e.className).trim().slice(0, 40);
      return [
        ...(e.scrollWidth > e.clientWidth + 1 ? [`"${what}" is ${e.scrollWidth - e.clientWidth} px wider than its box`] : []),
        ...(r.left < card.left - 0.5 || r.right > card.right + 0.5 ? [`"${what}" sticks out of the panel`] : [])
      ];
    });
  });
  for (const c of cut) fail(where, `Czech: ${c}`);
  const csIssue = await issueOf(page);
  if (!csIssue) fail(where, 'Czech: the issue link was not filled in');
  else {
    if (!/^Zpětná vazba z ukázky: \p{L}+$/u.test(csIssue.title)) fail(where, `Czech: the issue's title is "${csIssue.title}"`);
    for (const part of ['## Co je špatně a co by se mělo stát', '## Obrázek', '## Znovu otevřít', '## Na obrazovce', '| Obrazovka |', '| Prohlížeč |', '| Stránka |', ...(size === 'desktop' ? ['| Okno |'] : [])])
      if (!csIssue.body.includes(part)) fail(where, `Czech: the issue's body has no "${part}"`);
    const ua = await page.evaluate(() => navigator.userAgent);
    for (const text of englishIn(csIssue.body.replace(ua, '').replace(/https?:\/\/[^\s)|]+/g, ''))) fail(where, `Czech: the issue has English in it: "${text}"`);
  }
  if (shots) await page.screenshot({ path: join(shots, `feedback-panel-cs-${size}-${scheme}.png`) });
  await open.locator('.fk-x').click();
  await page.check('input[name=language][value=en]');
}

// every text in the open panel, shown or not (hidden buttons and messages too), with labels and titles
async function panelTexts(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.fk:not([hidden])'), out = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) out.push(walk.currentNode.nodeValue.trim());
    for (const e of [root, ...root.querySelectorAll('*')]) for (const a of ['aria-label', 'title']) if (e.getAttribute(a)) out.push(e.getAttribute(a));
    return out.join('\n');
  });
}

// the kit's English texts in `text`, and English words of theirs that Czech doesn't use too (px, PNG, …)
function englishIn(text) {
  text = text.replace(/\b(feedback|web)-kit\b/g, '');   // the module's name, in the demo's own Czech texts
  const words = t => t.toLowerCase().match(/\p{L}+/gu) || [];
  const czech = new Set(words(Object.values(STRINGS.cs).join(' ')));
  const english = new Set(words(Object.values(STRINGS.en).join(' ')).filter(w => !czech.has(w) && w.length > 1));
  const whole = Object.entries(STRINGS.en).filter(([k, v]) => v !== STRINGS.cs[k] && v.length > 2 && !v.includes('{') && !k.startsWith('provider.')).map(([, v]) => v);
  return [...whole.filter(t => text.includes(t)), ...new Set(words(text).filter(w => english.has(w)))];
}

async function checkGitStore(page, where, scheme, size) {
  const WRITE = 'github_pat_DEMO_write_token_for_both_demo_repos_0001', READ = 'github_pat_DEMO_read_only_token_for_the_private_repo', PUBLIC = 'demo-team/notes', PRIVATE = 'demo-team/notes-private';
  const T = { timeout: 5000 };
  await page.waitForSelector('body[data-ready]', T);
  const status = async () => page.locator('#status').innerText();
  const shot = async name => { if (shots) await page.screenshot({ path: join(shots, `git-store-${name}-${size}-${scheme}.png`) }); };
  const panelFits = async view => {
    const r = await page.evaluate(() => {
      const c = document.querySelector('.gs-card'), b = c && c.getBoundingClientRect();
      return b && { inside: b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5, wide: document.documentElement.scrollWidth - innerWidth };
    });
    if (!r) fail(where, `no panel for ${view}`);
    else if (!r.inside) fail(where, `the panel (${view}) does not fit on the screen`);
  };
  const wait = (fn, arg, what) => page.waitForFunction(fn, arg, T).catch(() => fail(where, what));

  // reading: the public repo without a token, the private one asks for a token; the file in another format is left out
  let text = await status();
  if (!/demo-team\/notes: 3 notes, 1 file left out/.test(text)) fail(where, `the public repo reads "${text.split('\n')[0]}"`);
  if (!/notes-private: .*only with a token: it is private/.test(text)) fail(where, 'the private repo does not say why it needs a token');
  if (await page.locator('#shared .note').count() !== 3) fail(where, 'the public repo\'s 3 notes are not shown');

  // the panel lists the sources
  await page.click('#open-panel');
  await page.locator('.gs').waitFor({ state: 'visible', ...T });
  await panelFits('sources');
  await page.keyboard.press('Escape');

  // the token setup: the private repo has "Add a token" next to its status, which opens the panel at its token field
  if (await page.locator(`#status li[data-repo="${PUBLIC}"] .btn`).count()) fail(where, 'the public repo asks for a token');
  if (shots) await page.locator('.tokens').screenshot({ path: join(shots, `git-store-walkthrough-${size}-${scheme}.png`) });
  await page.locator('[data-copy="write-token"]').click();
  await wait(() => /copied|selected/.test(document.getElementById('copy-msg').textContent), null, 'the Copy button does not say what it did');
  const need = page.locator(`#status li[data-repo="${PRIVATE}"] .btn`, { hasText: 'Add a token' });
  if (!await need.count()) fail(where, 'the private repo has no "Add a token" next to its status');
  else await need.click();
  await page.locator('.gs').waitFor({ state: 'visible', ...T });
  const row = page.locator(`.gs-source[data-repo="${PRIVATE}"]`);
  await wait(r => document.activeElement && document.activeElement.matches(`.gs-source[data-repo="${r}"] .gs-input`), PRIVATE, 'the private repo\'s token field is not open and focused');
  if (!/private/.test(await row.locator('.gs-problem').innerText().catch(() => ''))) fail(where, 'the panel does not say why the private repo needs a token');
  // the help: numbered steps, folded until asked for; the panel still fits
  const help = row.locator('.gs-help');
  if (await help.evaluate(d => d.open)) fail(where, 'the token help is open before it is asked for');
  await help.locator('summary').click();
  if (await help.locator('li').count() !== 6) fail(where, 'the token help does not have its 6 steps');
  if (!await help.locator(`a[href="https://github.com/settings/personal-access-tokens/new"]`).count()) fail(where, 'the token help does not link to GitHub\'s page');
  await panelFits('token help');
  const wide = await page.evaluate(() => { const b = document.querySelector('.gs-body'); return b.scrollWidth - b.clientWidth; });
  if (wide > 0) fail(where, `the panel with the token help is ${wide} px wider than it can show`);
  await row.locator('.gs-input').scrollIntoViewIfNeeded();
  await shot('token');
  // a wrong token is refused; the read-only one reads the private repo, without a way to publish to it
  await row.locator('.gs-input').fill('not a token');
  await row.locator('.gs-btn', { hasText: 'Save token' }).click();
  if (!/doesn’t look like a GitHub token/.test(await row.locator('.gs-token .gs-note.gs-warn').innerText().catch(() => ''))) fail(where, 'a wrong token is not refused');
  await row.locator('.gs-input').fill(READ);
  await row.locator('.gs-btn', { hasText: 'Save token' }).click();
  await row.locator('.gs-badge', { hasText: 'Read only' }).waitFor(T).catch(() => fail(where, 'the read-only token does not say "Read only"'));
  await wait(() => /^Token saved\. .*1 note, read only/.test(document.querySelector('.gs-done')?.textContent), null, 'saving the read-only token does not say what changed');
  await wait(() => /Secret tactic/.test(document.getElementById('shared').innerText), null, 'the private repo\'s note does not show with the read-only token');
  if (await page.locator(`#publish-to option[value="${PRIVATE}"]`).count()) fail(where, 'the read-only private repo is offered to publish to');
  // the write token replaces it: "You can edit"
  await row.locator('[data-gs-token]').click();
  await row.locator('.gs-input').fill(WRITE);
  await row.locator('.gs-input').press('Enter');
  await row.locator('.gs-badge', { hasText: 'You can edit' }).waitFor(T).catch(() => fail(where, 'the private repo does not open for editing with the write token'));
  await wait(() => /^Token saved\. .*1 note, you can edit/.test(document.querySelector('.gs-done')?.textContent), null, 'saving the write token does not say what changed');
  if (await page.locator('.gs-input[type=password]').evaluateAll(els => els.some(e => e.value))) fail(where, 'a token field still holds the token');
  if ((await page.locator('.gs').innerText()).includes('github_pat_DEMO')) fail(where, 'the panel shows a stored token');
  await shot('panel');
  await page.keyboard.press('Escape');
  if (await page.locator('.gs').isVisible()) fail(where, 'Esc did not close the panel');
  await wait(r => [...document.querySelectorAll('#publish-to option')].some(o => o.value === r), PRIVATE, 'the private repo is not offered to publish to with the write token');
  await wait(() => /notes-private: 1 notes?, you can edit/.test(document.getElementById('status').innerText), null, 'the private repo\'s note is not listed');

  // publishing: one PUT with the token in its header only
  await page.click('#use-write');
  await wait(r => [...document.querySelectorAll('#publish-to option')].some(o => o.value === r), PUBLIC, 'the public repo is not offered to publish to');
  await page.selectOption('#publish-to', PUBLIC);
  const first = page.locator('#mine .note').first();
  await first.locator('.btn', { hasText: /^Publish/ }).click();
  await wait(() => /^Published/.test(document.getElementById('mine-msg').textContent), null, 'publishing did not say it worked');
  if (await page.locator('#shared .note').count() !== 5) fail(where, `after publishing, ${await page.locator('#shared .note').count()} notes show, not 5`);
  const log = await page.locator('#log').innerText();
  if (!/PUT \/repos\/demo-team\/notes\/contents\/notes\/my-drill-1\.json 201 · Authorization: Bearer ••••/.test(log)) fail(where, 'the request list does not show the PUT, with the token masked');

  // a conflict: changed on another device, then published again; each answer
  for (const [answer, expect] of [['Save mine as a copy', /as a copy/], ['Keep theirs, drop mine', /Kept the version on GitHub/], ['Overwrite with mine', /^Published/]]) {
    await page.evaluate(() => { document.getElementById('try-msg').textContent = ''; });
    await page.click('#elsewhere');
    await wait(() => /was changed on another device/.test(document.getElementById('try-msg').textContent), null, 'the change on another device did not happen');
    await first.locator('.btn', { hasText: /^Publish/ }).click();
    await page.locator('.gs-card', { hasText: 'Changed meanwhile' }).waitFor(T).catch(() => fail(where, 'no conflict question'));
    await panelFits('conflict');
    if (answer === 'Save mine as a copy') await shot('conflict');
    await page.locator('.gs-choices .gs-btn', { hasText: answer }).click();
    await wait(e => new RegExp(e).test(document.getElementById('mine-msg').textContent), expect.source, `"${answer}" did not say what it did`);
  }
  if (await page.locator('#shared .note').count() !== 6) fail(where, 'the copy is not listed next to the other one');

  // history: three versions of the vertical stack; open the oldest; restore it
  await page.locator('#shared .note', { hasText: 'Vertical stack' }).locator('.btn', { hasText: 'History' }).click();
  await page.locator('.gs-version').nth(2).waitFor(T).catch(() => fail(where, 'the history does not list 3 versions'));
  await panelFits('history');
  await shot('history');
  const oldest = page.locator('.gs-version').last();
  await oldest.locator('.gs-btn', { hasText: 'Restore' }).click();
  await oldest.locator('.gs-btn', { hasText: 'Restore this version' }).click();
  await wait(() => /^Restored/.test(document.querySelector('.gs-body .gs-note').textContent), null, 'restoring did not work');
  if (await page.locator('.gs-version').count() !== 4) fail(where, 'the restore is not the newest of 4 versions');
  await page.locator('.gs-version').last().locator('.gs-btn', { hasText: 'Open' }).click();
  await page.locator('#old-card').waitFor(T).catch(() => fail(where, 'opening an old version shows nothing'));
  if (!/one cut at a time\.$/m.test(await page.locator('#old').innerText())) fail(where, 'the old version is not the first one');

  // working folder: open, edit, save as a commit
  await page.selectOption('#folder-pick', `${PUBLIC}#warmup`);
  await page.click('#folder-open');
  await page.locator('#folder-form').waitFor(T);
  await page.fill('#folder-text', 'Edited in the working folder.');
  await page.click('#folder-save');
  await wait(() => /^Saved as one commit/.test(document.getElementById('folder-msg').textContent), null, 'saving from the working folder did not work');
  await wait(() => /Edited in the working folder/.test(document.getElementById('shared').innerText), null, 'the saved note is not shown');

  // working folder history: restoring puts the old version in the form (onRestore) and moves its base on
  const WARMUP = 'Ten minutes of jogging, then dynamic stretches.';
  const restoreOldest = async () => {
    await page.click('#folder-history');
    await page.locator('.gs-version').nth(1).waitFor(T).catch(() => fail(where, 'the working folder\'s history does not list its versions'));
    const last = page.locator('.gs-version').last();
    await last.locator('.gs-btn', { hasText: 'Restore' }).click();
    await last.locator('.gs-btn', { hasText: 'Restore this version' }).click();
  };
  const where0 = await page.locator('#folder-where').innerText();
  await restoreOldest();
  await wait(() => /^Restored/.test(document.querySelector('.gs-body .gs-note')?.textContent), null, 'restoring in the working folder did not work');
  await wait(() => /^Restored as the newest version/.test(document.getElementById('folder-msg').textContent), null, 'onRestore did not tell the working folder');
  if (await page.inputValue('#folder-text') !== WARMUP) fail(where, 'the restored version is not in the form');
  if (await page.locator('#folder-where').innerText() === where0) fail(where, 'the form is not based on the restored version');
  await page.keyboard.press('Escape');
  // a newer save on GitHub, which the store has loaded but the form hasn't: restoring asks instead of overwriting
  await page.fill('#folder-text', 'Edited again.');
  await page.click('#folder-save');
  await wait(() => /^Saved as one commit/.test(document.getElementById('folder-msg').textContent), null, 'saving again from the working folder did not work');
  await page.click('#elsewhere');
  await page.click('#reload');
  await wait(() => /changed on the laptop/.test(document.getElementById('shared').innerText), null, 'the change on another device is not loaded');
  await restoreOldest();
  await page.locator('.gs-card', { hasText: 'Changed meanwhile' }).waitFor(T).catch(() => fail(where, 'restoring on top of a newer version does not ask'));
  await panelFits('restore conflict');
  await shot('restore-conflict');
  await page.locator('.gs-choices .gs-btn', { hasText: 'Overwrite with mine' }).click();
  await wait(() => /^Restored as the newest version/.test(document.getElementById('folder-msg').textContent), null, 'onRestore was not called after the conflict');
  if (await page.inputValue('#folder-text') !== WARMUP) fail(where, 'after the conflict, the restored version is not in the form');
  await shot('folder-restored');

  // the fake GitHub survives a reload (fake.export into sessionStorage, createFakeGitHub({state}) back)
  const notes = await page.locator('#shared .note').count();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-ready]', T);
  await wait(() => !document.querySelector('#status').innerText.includes('loading'), null, 'after a reload, the repos do not load');
  if (await page.locator('#shared .note').count() !== notes) fail(where, `after a reload, ${await page.locator('#shared .note').count()} notes show, not ${notes}`);
  if (!(await page.locator('#shared').innerText()).includes(WARMUP)) fail(where, 'after a reload, the restored note is gone');
  if (!/demo-team\/notes: \d+ notes/.test(await status())) fail(where, `after a reload, the public repo reads "${(await status()).split('\n')[0]}"`);

  // offline: the saved copy, and why
  await page.check('#offline');
  await wait(() => /can’t be reached.*saved copy/.test(document.getElementById('status').innerText), null, 'offline does not show the saved copy');
  if (await page.locator('#shared .note').count() < 6) fail(where, 'offline, the notes are gone');
  await page.uncheck('#offline');

  // no token anywhere in the request list
  if ((await page.locator('#log').innerText()).includes('github_pat_')) fail(where, 'a token shows in the request list');
  // "Start the fake GitHub over": back to the three notes it started with
  await page.click('#fake-reset');
  await page.waitForSelector('body[data-ready]', T);
  await wait(() => /demo-team\/notes: 3 notes, 1 file left out/.test(document.getElementById('status').innerText), null, 'starting the fake GitHub over does not bring back its first notes');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) fail(where, `after trying it, the page is ${overflow} px wider than the screen`);
}

async function issueOf(page) {
  return page.evaluate(() => {
    const a = document.querySelector('.fk:not([hidden]) .fk-primary') || document.querySelector('.fk-primary');
    if (!a.href) return null;
    const q = new URL(a.href).searchParams;
    const note = [...document.querySelectorAll('.fk:not([hidden]) .fk-side .fk-note')].find(n => /too long/.test(n.textContent));
    return { url: a.href, title: q.get('title'), labels: q.get('labels'), body: q.get('body'), shortened: !!note && !note.hidden };
  });
}

if (problems.length) { problems.forEach(p => console.log('PROBLEM ' + p)); process.exit(1); }
console.log(`The demo works in ${browserName} at ${SIZES.length} sizes in light and dark mode${shots ? `; screenshots in ${shots}` : ''}.`);

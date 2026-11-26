// End-to-end on the local demo: loads dist/ (a HIBIRA_DEMO build) into
// Chromium, opens the panel pinned to the demo tab, runs the scripted chore,
// and saves store-sized screenshots (1280×800: site on the left, panel on
// the right) to SHOTS (default e2e/shots).
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const DIST = path.resolve(__dirname, '../dist');
const SHOTS = process.env.SHOTS ?? path.resolve(__dirname, 'shots');
const SCHEME = process.env.SCHEME ?? 'light';
const LANG = process.env.LANG_TAG ?? 'en-US';
const tag = `${LANG}-${SCHEME}`;
fs.mkdirSync(SHOTS, { recursive: true });

const assert = (ok, msg) => {
  if (!ok) throw new Error(`assertion failed: ${msg}`);
};

(async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    channel: 'chromium',
    args: ['--host-resolver-rules=MAP northwind.example:80 127.0.0.1:5174, MAP shop.example:80 127.0.0.1:5174', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, `--lang=${LANG}`],
    viewport: { width: 880, height: 800 },
    colorScheme: SCHEME,
    locale: LANG,
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  const site = await ctx.newPage();
  const panel = await ctx.newPage();
  await panel.setViewportSize({ width: 400, height: 800 });

  const tabOf = (prefix) => sw.evaluate(async (p) => (await chrome.tabs.query({ url: `${p}/*` }))[0]?.id, prefix);
  const shot = async (name) => {
    const a = await site.screenshot();
    const b = await panel.screenshot();
    fs.writeFileSync(`${SHOTS}/${name}-site.png`, a);
    fs.writeFileSync(`${SHOTS}/${name}-panel.png`, b);
  };

  // Signed out.
  await site.goto('http://shop.example/orders');
  await panel.goto(`chrome-extension://${id}/panel.html?tab=${await tabOf('http://shop.example')}`);
  await panel.waitForSelector('#gate:not([hidden])');
  await shot(`1-signin-${tag}`);

  // Signed in, on a site that is still off.
  // Sign in through the real flow (launchWebAuthFlow against the demo's
  // OAuth stand-in, which approves at once like hibira.io does for Hibi).
  await panel.click('#gate button');
  await panel.waitForFunction(() => document.querySelector('#gate')?.textContent?.includes('shop.example') && document.querySelector('#gate button'), null, { timeout: 15000 });
  const saved = await sw.evaluate(() => chrome.storage.local.get('hibiSession'));
  assert(saved.hibiSession?.token === 'sst_demo', 'signed in with a session token');
  assert((await panel.textContent('#gate')).includes('shop.example'), 'off gate names the site');
  await shot(`2-site-off-${tag}`);

  // A site that is on: the scripted chore.
  await site.goto('http://northwind.example/orders');
  await panel.goto(`chrome-extension://${id}/panel.html?tab=${await tabOf('http://northwind.example')}`);
  await panel.waitForSelector('#ask:not([hidden])');
  await panel.fill('#input', 'Mark order #1042 shipped: DHL, tracking JD014600.');
  await panel.click('#send');
  await panel.waitForSelector('.msg.approval button.primary', { timeout: 20000 }).catch(async (e) => {
    console.log(await panel.textContent('#log'));
    await shot('fail');
    throw e;
  });
  await site.bringToFront();
  assert(site.url().endsWith('/orders/1042'), `clicked through to the order (${site.url()})`);
  assert((await site.inputValue('#tracking')) === 'JD014600', 'typed the tracking number');
  assert((await site.inputValue('#carrier')) === 'dhl', 'picked the carrier');
  assert(!(await site.textContent('main')).includes('Shipment saved'), 'not saved before approval');
  await shot(`3-approval-${tag}`);
  await panel.click('.msg.approval button.primary');
  await panel.waitForFunction(() => document.querySelectorAll('.msg.hibi').length >= 4 && document.querySelector('#send:not([hidden])'), null, { timeout: 20000 });
  await site.waitForSelector('.ok');
  assert((await site.textContent('h1')).includes('Shipped'), 'order is shipped after approval');
  await shot(`4-done-${tag}`);

  // Sign-in pages are left alone.
  await ctx.close();
  console.log('e2e passed', tag);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Visual check harness: seeds a known game, then shoots the board at a spread
 * of viewports. Not part of the app — run it with `node scripts/shoot.mjs`.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || './shots';
const URL = process.env.SHOT_URL || 'http://localhost:5273/';

import saved from './fixture.mjs';

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1180', width: 1180, height: 800 },
  { name: 'tablet-900', width: 900, height: 780 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'phone-430', width: 430, height: 932 },
  { name: 'phone-375', width: 375, height: 667 },
  { name: 'landscape-844', width: 844, height: 390 }
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const problems = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`[${viewport.name}] ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`[${viewport.name}] ${error.message}`));

  await page.addInitScript((value) => {
    window.localStorage.setItem('tiki-solitaire-v2', value);
    window.localStorage.setItem('tiki-solitaire-v2:sound', 'false');
  }, JSON.stringify(saved));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${viewport.name}.png` });

  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyH: document.documentElement.scrollHeight - document.documentElement.clientHeight
  }));
  if (overflow.docScroll > 1 || overflow.bodyH > 1) {
    problems.push(`[${viewport.name}] page overflows: ${JSON.stringify(overflow)}`);
  }

  if (viewport.name === 'desktop-1440' || viewport.name === 'phone-430') {
    await page.getByTitle('How to play').click();
    await page.waitForTimeout(420);
    await page.screenshot({ path: `${OUT}/${viewport.name}-help.png` });
  }

  await context.close();
}

// The perfect game — win sheet, and a thirteen-domino loop behind it.
{
  const { default: win } = await import('./win-fixture.mjs');
  for (const [name, width, height] of [
    ['win-1440', 1440, 900],
    ['win-430', 430, 932]
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`[${name}] ${error.message}`));
    await page.addInitScript((value) => {
      window.localStorage.setItem('tiki-solitaire-v2', value);
      window.localStorage.setItem('tiki-solitaire-v2:sound', 'false');
    }, JSON.stringify(win));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    if (!(await page.locator('.sheet--win').count())) problems.push(`[${name}] win sheet missing`);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await page.locator('.sheet--win .btn--primary').waitFor();
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('.scrim')?.remove());
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/${name}-loop.png` });
    await context.close();
  }
}

await browser.close();

if (problems.length) {
  console.log('PROBLEMS:\n' + problems.join('\n'));
} else {
  console.log('clean');
}
console.log(`shot ${VIEWPORTS.length} viewports into ${OUT}`);

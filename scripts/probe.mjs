/** Layout probe: reports element boxes that spill past the viewport. */
import { chromium } from 'playwright';
import saved from './fixture.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:5273/';
const width = Number(process.env.W || 375);
const height = Number(process.env.H || 667);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
if (process.env.SEED !== '0') {
  await page.addInitScript((value) => {
    window.localStorage.setItem('tiki-solitaire-v2', value);
    window.localStorage.setItem('tiki-solitaire-v2:sound', 'false');
  }, JSON.stringify(saved));
}
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const report = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const spills = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.right > vw + 0.6 || r.bottom > vh + 0.6 || r.left < -0.6) {
      spills.push({
        el: el.className?.baseVal ?? el.className ?? el.tagName,
        tag: el.tagName,
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left)
      });
    }
  });
  const rows = [...document.querySelectorAll('.topbar, .stage, .tableau, .rail, .rail .panel, .reef')].map(
    (el) => ({ cls: el.className, h: Math.round(el.getBoundingClientRect().height) })
  );
  return { vw, vh, spills: spills.slice(0, 14), rows };
});

console.log(JSON.stringify(report, null, 1));
await browser.close();

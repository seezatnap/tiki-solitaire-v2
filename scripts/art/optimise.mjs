/**
 * Turns the generated PNGs into web-sized WebP.
 *
 * Uses the Chromium that already ships with the test harness rather than
 * pulling in an image library: the browser decodes, scales and re-encodes.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const JOBS = [
  { dir: './public/art/cards', width: 384, quality: 0.86 },
  // splash.png stays PNG: the iOS startup screens are derived from it directly.
  { dir: './public/art', width: 1600, quality: 0.82, only: ['table.png'] }
];

const browser = await chromium.launch();
const page = await browser.newPage();

const convert = async (bytes, width, quality) =>
  page.evaluate(
    async ({ data, width: w, quality: q }) => {
      const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, w / bitmap.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/webp', q);
      return { base64: url.split(',')[1], width: canvas.width, height: canvas.height };
    },
    { data: [...bytes], width, quality }
  );

await page.goto('about:blank');

let total = 0;
for (const job of JOBS) {
  let names;
  try {
    names = (await readdir(job.dir)).filter((n) => n.endsWith('.png'));
  } catch {
    continue;
  }
  if (job.only) names = names.filter((n) => job.only.includes(n));

  for (const name of names) {
    const source = await readFile(`${job.dir}/${name}`);
    const { base64, width, height } = await convert(source, job.width, job.quality);
    const out = `${job.dir}/${name.replace(/\.png$/, '.webp')}`;
    const bytes = Buffer.from(base64, 'base64');
    await writeFile(out, bytes);
    total += bytes.length;
    console.log(
      `${name} → ${out.split('/').pop()}  ${width}x${height}  ` +
        `${(source.length / 1024).toFixed(0)}KB → ${(bytes.length / 1024).toFixed(0)}KB`
    );
  }
}

await browser.close();
console.log(`\ntotal webp: ${(total / 1024 / 1024).toFixed(2)}MB`);

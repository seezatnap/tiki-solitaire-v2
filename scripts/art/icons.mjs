/**
 * Derives every installed-app asset from the two generated sources, so the
 * favicon, the home-screen icon and the startup screens are all the same
 * artwork at different sizes.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ART = './public/art';
const OUT = './public/icons';
const GROUND = '#04100e'; // matches theme_color / the app backdrop

await mkdir(OUT, { recursive: true });

const icon = await readFile(`${ART}/icon.png`);
const splash = await readFile(`${ART}/splash.png`);

const ICONS = [
  { name: 'favicon-32.png', size: 32, inset: 0 },
  { name: 'favicon-96.png', size: 96, inset: 0 },
  { name: 'apple-touch-icon.png', size: 180, inset: 0.06 },
  { name: 'icon-192.png', size: 192, inset: 0 },
  { name: 'icon-512.png', size: 512, inset: 0 },
  // Maskable icons get cropped to a circle by the launcher, so the artwork is
  // pulled well inside the safe zone.
  { name: 'icon-maskable-512.png', size: 512, inset: 0.2 }
];

// The handful of iOS screens worth covering; everything else falls back to the
// manifest's background colour.
const SPLASHES = [
  { name: 'splash-1290x2796.png', width: 1290, height: 2796 },
  { name: 'splash-1179x2556.png', width: 1179, height: 2556 },
  { name: 'splash-1170x2532.png', width: 1170, height: 2532 },
  { name: 'splash-828x1792.png', width: 828, height: 1792 },
  { name: 'splash-1536x2048.png', width: 1536, height: 2048 }
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');

const compose = async (bytes, { width, height, inset = 0, mode = 'cover', ground, posterize = 0 }) =>
  page.evaluate(
    async (options) => {
      const blob = new Blob([new Uint8Array(options.data)], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = options.width;
      canvas.height = options.height;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';

      context.fillStyle = options.ground;
      context.fillRect(0, 0, canvas.width, canvas.height);

      const box = {
        w: canvas.width * (1 - options.inset * 2),
        h: canvas.height * (1 - options.inset * 2)
      };
      const scale =
        options.mode === 'cover'
          ? Math.max(box.w / bitmap.width, box.h / bitmap.height)
          : Math.min(box.w / bitmap.width, box.h / bitmap.height);
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      context.drawImage(bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

      // The generated art carries a fine paper grain that PNG cannot compress —
      // flattening it to a coarse palette costs nothing visible on flat,
      // two-tone artwork and saves an order of magnitude in bytes.
      if (options.posterize) {
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const px = image.data;
        const step = options.posterize;
        for (let i = 0; i < px.length; i += 4) {
          px[i] = Math.round(px[i] / step) * step;
          px[i + 1] = Math.round(px[i + 1] / step) * step;
          px[i + 2] = Math.round(px[i + 2] / step) * step;
        }
        context.putImageData(image, 0, 0);
      }

      return canvas.toDataURL('image/png').split(',')[1];
    },
    { data: [...bytes], width, height, inset, mode, posterize, ground: ground || GROUND }
  );

for (const spec of ICONS) {
  const base64 = await compose(icon, {
    width: spec.size,
    height: spec.size,
    inset: spec.inset,
    mode: spec.inset ? 'contain' : 'cover',
    posterize: spec.size >= 96 ? 12 : 0
  });
  const bytes = Buffer.from(base64, 'base64');
  await writeFile(`${OUT}/${spec.name}`, bytes);
  console.log(`${spec.name}  ${spec.size}x${spec.size}  ${(bytes.length / 1024).toFixed(0)}KB`);
}

for (const spec of SPLASHES) {
  // Contain, so the totem is never cropped through — the plain ground fills the rest.
  const base64 = await compose(splash, {
    width: spec.width,
    height: spec.height,
    inset: 0.12,
    mode: 'contain',
    posterize: 16
  });
  const bytes = Buffer.from(base64, 'base64');
  await writeFile(`${OUT}/${spec.name}`, bytes);
  console.log(`${spec.name}  ${spec.width}x${spec.height}  ${(bytes.length / 1024).toFixed(0)}KB`);
}

await browser.close();
console.log(`\nicons and splashes → ${OUT}`);

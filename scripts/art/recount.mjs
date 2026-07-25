/** Stricter pip audit across the numbered cards. */
import { readFile, writeFile } from 'node:fs/promises';
import { SUITS, countCentre } from './lib.mjs';

const DIR = './public/art/cards';
const LANES = 5;
const jobs = [];
for (const suit of Object.keys(SUITS)) {
  for (let n = 2; n <= 10; n += 1) jobs.push({ rank: String(n), suit });
}

const out = [];
let next = 0;
const lane = async () => {
  while (next < jobs.length) {
    const { rank, suit } = jobs[next++];
    const png = await readFile(`${DIR}/${rank}${suit}.png`);
    const { count, symbols } = await countCentre(png, SUITS[suit].name);
    const ok = count === Number(rank);
    out.push({ card: `${rank}${suit}`, want: Number(rank), got: count, ok, symbols });
    if (!ok) console.log(`✗ ${rank}${suit}: wanted ${rank}, counted ${count} — ${symbols.join(', ')}`);
  }
};
await Promise.all(Array.from({ length: LANES }, lane));
out.sort((a, b) => a.card.localeCompare(b.card));
await writeFile('./scripts/art/reports/pip-audit.json', JSON.stringify(out, null, 2));
const bad = out.filter((r) => !r.ok);
console.log(`\n${out.length - bad.length}/${out.length} numbered cards have the right pip count`);

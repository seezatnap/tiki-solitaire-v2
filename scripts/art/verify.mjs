/** Reads every card back and checks it is the card it claims to be. */
import { readFile, writeFile } from 'node:fs/promises';
import { RANKS, SUITS, readCard } from './lib.mjs';

const DIR = process.env.ART_DIR || './public/art/cards';
const LANES = 6;

const wanted = [];
for (const suit of Object.keys(SUITS)) for (const rank of RANKS) wanted.push({ rank, suit });

const results = [];
let next = 0;
const lane = async () => {
  while (next < wanted.length) {
    const { rank, suit } = wanted[next++];
    const png = await readFile(`${DIR}/${rank}${suit}.png`);
    const seen = await readCard(png);
    const want = /^\d+$/.test(rank) ? Number(rank) : null;
    const problems = [];
    if (seen.rank !== rank) problems.push(`rank=${seen.rank}`);
    if (seen.suit !== SUITS[suit].name) problems.push(`suit=${seen.suit}`);
    if (want !== null && seen.centre_symbols !== want) problems.push(`pips=${seen.centre_symbols}`);
    if (seen.corner_index_legible === false) problems.push('index illegible');
    if (seen.stray_text) problems.push(`text="${seen.stray_text}"`);
    results.push({ card: `${rank}${suit}`, ok: !problems.length, problems, seen });
  }
};
await Promise.all(Array.from({ length: LANES }, lane));

results.sort((a, b) => a.card.localeCompare(b.card));
const bad = results.filter((r) => !r.ok);
for (const r of bad) console.log(`✗ ${r.card}: ${r.problems.join(', ')}`);
await writeFile('./scripts/art/reports/card-verification.json', JSON.stringify(results, null, 2));
console.log(`\n${results.length - bad.length}/${results.length} cards verified correct`);
process.exitCode = bad.length ? 1 : 0;

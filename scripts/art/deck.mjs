/**
 * Generates the 52 card faces.
 *
 * The first card is drawn from the prompt alone and becomes the anchor; one red
 * card is drawn from it so both ink colours are represented, and every other
 * card is an edit carrying both anchors as references. That is what keeps the
 * deck looking like one deck.
 *
 * Every card is then read back by a vision model and re-drawn if it shows the
 * wrong rank, the wrong suit or the wrong number of pips.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { RANKS, SUITS, cardPrompt, edit, generate, matchPrompt, readCard } from './lib.mjs';

const OUT = process.env.ART_DIR || './public/art/cards';
const QUALITY = process.env.ART_QUALITY || 'medium';
const LANES = Number(process.env.ART_LANES || 3);
const ATTEMPTS = 4;

await mkdir(OUT, { recursive: true });
const file = (rank, suit) => `${OUT}/${rank}${suit}.png`;

const expected = (rank) => (/^\d+$/.test(rank) ? Number(rank) : null);

/** What the picture must show to count as that card. */
const faults = (rank, suit, seen) => {
  const problems = [];
  if (seen.rank !== rank) problems.push(`rank reads "${seen.rank}", must be "${rank}"`);
  if (seen.suit !== SUITS[suit].name) problems.push(`suit reads "${seen.suit}", must be ${SUITS[suit].name}`);
  if (seen.corner_index_legible === false) problems.push('corner index is not legible');
  const want = expected(rank);
  if (want !== null && seen.centre_symbols !== want) {
    problems.push(`centre shows ${seen.centre_symbols} symbols, must be exactly ${want}`);
  }
  if (want === null && rank !== 'A' && seen.court_figure === false) {
    problems.push('court card is missing its figure');
  }
  if (seen.stray_text) problems.push(`stray text: ${seen.stray_text}`);
  return problems;
};

const draw = async (rank, suit, references, note = '') => {
  const prompt = references.length
    ? `${matchPrompt(rank, suit)}${note}`
    : `${cardPrompt(rank, suit)}${note}`;
  return references.length
    ? edit({ prompt, references, quality: QUALITY })
    : generate({ prompt, quality: QUALITY });
};

const makeCard = async (rank, suit, references) => {
  let note = '';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const png = await draw(rank, suit, references, note);
    const seen = await readCard(png);
    const problems = faults(rank, suit, seen);
    if (!problems.length) {
      await writeFile(file(rank, suit), png);
      return { card: `${rank}${suit}`, attempts: attempt, ok: true };
    }
    console.log(`   ${rank}${suit} attempt ${attempt}: ${problems.join('; ')}`);
    note = `\n\nThe previous attempt was wrong: ${problems.join('; ')}. Fix exactly that, keeping everything else identical.`;
    if (attempt === ATTEMPTS) {
      await writeFile(file(rank, suit), png);
      return { card: `${rank}${suit}`, attempts: attempt, ok: false, problems };
    }
  }
  return null;
};

/* ------------------------------------------------------------- anchors -- */

let anchor;
if (existsSync(file('A', 'S'))) {
  anchor = await readFile(file('A', 'S'));
  console.log('anchor A♠ — reusing the one on disk');
} else {
  console.log('anchor A♠ — drawing from the prompt alone');
  const result = await makeCard('A', 'S', []);
  console.log(`   ${result.ok ? 'ok' : 'GAVE UP'} after ${result.attempts}`);
  anchor = await readFile(file('A', 'S'));
}

let redAnchor;
if (existsSync(file('A', 'H'))) {
  redAnchor = await readFile(file('A', 'H'));
  console.log('red anchor A♥ — reusing the one on disk');
} else {
  console.log('red anchor A♥ — drawing from the anchor');
  const result = await makeCard('A', 'H', [anchor]);
  console.log(`   ${result.ok ? 'ok' : 'GAVE UP'} after ${result.attempts}`);
  redAnchor = await readFile(file('A', 'H'));
}

/* ---------------------------------------------------------------- deck -- */

const queue = [];
for (const suit of Object.keys(SUITS)) {
  for (const rank of RANKS) {
    if (existsSync(file(rank, suit))) continue;
    queue.push({ rank, suit });
  }
}
console.log(`${queue.length} cards to draw, ${LANES} at a time, quality ${QUALITY}`);

const report = [];
let next = 0;
const started = Date.now();

const lane = async (id) => {
  while (next < queue.length) {
    const { rank, suit } = queue[next++];
    const at = next;
    const result = await makeCard(rank, suit, [anchor, redAnchor]);
    report.push(result);
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    console.log(
      `[${at}/${queue.length}] ${result.card} ${result.ok ? 'ok' : 'GAVE UP'}` +
        `${result.attempts > 1 ? ` (${result.attempts} tries)` : ''} — ${mins}m elapsed`
    );
  }
  void id;
};

await Promise.all(Array.from({ length: LANES }, (_, i) => lane(i)));

const failed = report.filter((r) => !r.ok);
await writeFile('./scripts/art/reports/generation.json', JSON.stringify({ report, failed }, null, 2));
console.log(
  `\ndeck done in ${((Date.now() - started) / 60000).toFixed(1)}m — ` +
    `${report.length - failed.length}/${report.length} clean` +
    (failed.length ? `, unresolved: ${failed.map((f) => f.card).join(', ')}` : '')
);

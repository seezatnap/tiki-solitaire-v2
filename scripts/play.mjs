/**
 * Interaction check: drives a seeded board through tap-to-move, drag-and-drop,
 * pairing, forging and chaining, asserting the readouts along the way.
 */
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:5273/';
const OUT = process.env.SHOT_DIR || './shots';

const card = (rank, suit) => {
  const values = { A: 1, J: 11, Q: 12, K: 13 };
  return {
    rank,
    suit,
    value: values[rank] ?? Number(rank),
    isRed: suit === '♥' || suit === '♦',
    id: `${rank}${suit}`
  };
};

const seed = {
  tableau: [
    [card('4', '♣'), card('A', '♥')],
    [card('6', '♥'), card('K', '♠')],
    [card('9', '♦')],
    [card('9', '♣')],
    [card('7', '♦')],
    [card('7', '♣')],
    [],
    [card('Q', '♣')]
  ],
  pairs: [],
  dominos: [],
  chains: [],
  moveCount: 0
};

const failures = [];
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  console.log(`${ok ? '  ok ' : '  XX '} ${label}: ${actual}${ok ? '' : ` (wanted ${expected})`}`);
  if (!ok) failures.push(label);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript((value) => {
  window.localStorage.setItem('tiki-solitaire-v2', value);
  window.localStorage.setItem('tiki-solitaire-v2:sound', 'false');
}, JSON.stringify(seed));

// Count FLIP animations so the "cards travel between components" claim is tested.
await page.addInitScript(() => {
  window.__flips = 0;
  const original = Element.prototype.animate;
  Element.prototype.animate = function patched(...args) {
    window.__flips += 1;
    return original.apply(this, args);
  };
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const stat = async (label) =>
  page.locator('.stat', { has: page.locator('.stat__label', { hasText: label }) })
    .locator('.stat__value')
    .innerText();

const topCard = (column) => page.locator(`[data-drop-index="${column}"][data-drop-kind="column"] .card--top`);
const settle = () => page.waitForTimeout(520);

const drag = async (from, to, shot) => {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * i) / 6,
      start.y + ((end.y - start.y) * i) / 6
    );
    await page.waitForTimeout(24);
  }
  if (shot) {
    check('ghost is rendered mid-drag', await page.locator('.drag-ghost').count(), 1);
    await page.screenshot({ path: `${OUT}/${shot}.png` });
  }
  await page.mouse.up();
  await settle();
};

console.log('tap to move (9♦ onto 9♣, same rank)');
await topCard(2).click();
await topCard(3).click();
await settle();
check('column 3 depth', await page.locator('[data-drop-index="3"][data-drop-kind="column"] .card').count(), 2);
check('moves', await stat('moves'), 1);

console.log('undo puts it back');
await page.getByTitle('Undo the last move').click();
await settle();
check('column 3 depth', await page.locator('[data-drop-index="3"][data-drop-kind="column"] .card').count(), 1);
check('moves', await stat('moves'), 0);

console.log('drag Q♣ into the empty column');
await drag(topCard(7), page.locator('[data-drop-index="6"][data-drop-kind="column"] .column__slot'), 'interaction-drag');
check('column 6 depth', await page.locator('[data-drop-index="6"][data-drop-kind="column"] .card').count(), 1);

console.log('tap two cards that make fourteen (A♥ + K♠)');
await topCard(0).click();
await page.waitForTimeout(120);
check(
  'pair target is highlighted',
  await page.locator('[data-drop-index="1"][data-drop-kind="column"].column--pair').count(),
  1
);
await page.evaluate(() => {
  window.__flips = 0;
});
await topCard(1).click();
await settle();
check('pairs', await stat('pairs'), '1/6');
// Both cards should have flown from the table into the pair slot.
const flips = await page.evaluate(() => window.__flips);
check('cards animated into the slot', flips >= 2, true);

console.log('drag 7♦ onto 7♣ to make the second pair');
await drag(topCard(4), topCard(5));
check('pairs', await stat('pairs'), '2/6');

console.log('tap the two pairs to forge a domino');
await page.locator('.slot--filled .slot__grip').first().click();
await page.waitForTimeout(140);
await page.locator('.slot--filled .slot__grip').nth(1).click();
await settle();
check('dominos', await stat('dominos'), 1);
check('pairs', await stat('pairs'), '0/6');

console.log('tap the domino to open a chain');
await page.locator('.tray__grip').first().click();
await settle();
check('chained', await stat('chained'), '1/13');
check('chain rendered', await page.locator('.chain').count(), 1);
check('sockets rendered', await page.locator('.socket').count(), 2);
check('undo is now spent', await page.getByTitle('Undo the last move').isDisabled(), 'true');

console.log('arm a socket');
await page.locator('.socket--end').click();
await page.waitForTimeout(160);
check('socket armed', await page.locator('.socket--end.is-armed').count(), 1);
await page.screenshot({ path: `${OUT}/interaction-armed.png` });

console.log('help opens and closes');
await page.getByTitle('How to play').click();
await page.waitForTimeout(300);
check('help open', await page.locator('.sheet--help').count(), 1);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('help closed', await page.locator('.sheet--help').count(), 0);

console.log('state survives a fresh visit');
const chained = await stat('chained');
const moves = await stat('moves');
const revisit = await context.newPage(); // no seeding script — reads what was saved
await revisit.goto(URL, { waitUntil: 'networkidle' });
await revisit.waitForTimeout(400);
const restat = async (label) =>
  revisit.locator('.stat', { has: revisit.locator('.stat__label', { hasText: label }) })
    .locator('.stat__value')
    .innerText();
check('chained after reload', await restat('chained'), chained);
check('moves after reload', await restat('moves'), moves);
check('chain restored', await revisit.locator('.chain').count(), 1);

console.log('new game asks first');
await revisit.getByTitle('Deal a new game').click();
await revisit.waitForTimeout(300);
check('confirm shown', await revisit.locator('.sheet--confirm').count(), 1);
await revisit.getByRole('button', { name: 'Deal again' }).click();
await revisit.waitForTimeout(600);
check('fresh board', await restat('on board'), 52);
check('fresh moves', await restat('moves'), 0);
check('chains cleared', await revisit.locator('.chain').count(), 0);

/* ------------------------------------------------ chains, sockets, joins -- */

console.log('\nsecond board: sockets, joining and pair-dragging');
const { makeDomino } = await import('../src/game/rules.js');
const pair = (a, b) => [card(...a), card(...b)];

const domA = makeDomino(pair(['A', '♥'], ['K', '♣']), pair(['5', '♦'], ['9', '♠'])); // A-K | 5-9
const domB = makeDomino(pair(['2', '♥'], ['Q', '♠']), pair(['9', '♦'], ['5', '♣'])); // 2-Q | 5-9
const domC = makeDomino(pair(['2', '♠'], ['Q', '♥']), pair(['4', '♦'], ['10', '♣'])); // 2-Q | 4-10

const chainSeed = {
  tableau: Array.from({ length: 8 }, () => []),
  pairs: [pair(['A', '♦'], ['K', '♠']), pair(['7', '♥'], ['7', '♣'])],
  dominos: [{ ...domA, inChain: true }, domB, { ...domC, inChain: true }],
  chains: [
    [{ ...domA, displayValue1: 'A-K', displayValue2: '5-9' }],
    [{ ...domC, displayValue1: '2-Q', displayValue2: '4-10' }]
  ],
  moveCount: 61
};

const second = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const board = await second.newPage();
board.on('pageerror', (e) => errors.push(e.message));
board.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await board.addInitScript((value) => {
  window.localStorage.setItem('tiki-solitaire-v2', value);
  window.localStorage.setItem('tiki-solitaire-v2:sound', 'false');
}, JSON.stringify(chainSeed));
await board.goto(URL, { waitUntil: 'networkidle' });
await board.waitForTimeout(400);

const boardDrag = async (from, to) => {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await board.mouse.move(start.x, start.y);
  await board.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    await board.mouse.move(
      start.x + ((end.x - start.x) * i) / 6,
      start.y + ((end.y - start.y) * i) / 6
    );
    await board.waitForTimeout(24);
  }
  await board.mouse.up();
  await board.waitForTimeout(520);
};

check('two chains to start', await board.locator('.chain').count(), 2);
check(
  'compatible sockets glow while dragging is possible',
  await board.locator('.tray__item.is-connectable').count(),
  1
);

console.log('drag the loose domino onto the first chain’s end socket');
await boardDrag(
  board.locator('.tray__grip').first(),
  board.locator('.chain').first().locator('.socket--end')
);
check('first chain grew', await board.locator('.chain').first().locator('.domino').count(), 2);
check('tray is empty', await board.locator('.tray__grip').count(), 0);

console.log('tap the two chains to splice them');
await board.locator('.chain').first().locator('.chain__grip').click();
await board.waitForTimeout(160);
check('other chain offers to join', await board.locator('.chain.is-joinable').count(), 1);
await board.locator('.chain').nth(1).locator('.chain__grip').click();
await board.waitForTimeout(520);
check('one chain remains', await board.locator('.chain').count(), 1);
check('holding three dominos', await board.locator('.chain .domino').count(), 3);

console.log('drag one pair onto the other to forge');
await boardDrag(
  board.locator('.slot--filled .slot__grip').first(),
  board.locator('.slot--filled .slot__grip').nth(1)
);
check('pairs consumed', await board.locator('.slot--filled').count(), 0);
check('domino forged', await board.locator('.tray__grip').count(), 1);
await board.screenshot({ path: `${OUT}/interaction-chains.png` });

await browser.close();

if (errors.length) {
  console.log('\nCONSOLE ERRORS:\n' + errors.join('\n'));
}
console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nall interactions pass');
process.exitCode = failures.length || errors.length ? 1 : 0;

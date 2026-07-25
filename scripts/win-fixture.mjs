/**
 * A genuine perfect game: all 52 cards, 13 dominos, one closed loop.
 *
 * Built as an Eulerian circuit over the seven pair values — every value has an
 * even number of pairs, so a circuit through all thirteen dominos exists. Each
 * domino takes one ♥♠ pair and one ♦♣ pair, which is what satisfies the
 * four-suit rule.
 */
import { makeDomino } from '../src/game/rules.js';

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

const pair = (a, b) => [card(...a), card(...b)];

// Per value: two pairs showing ♥♠, two showing ♦♣.
const POOL = {
  'A-K': {
    H: [pair(['A', '♥'], ['K', '♠']), pair(['A', '♠'], ['K', '♥'])],
    D: [pair(['A', '♦'], ['K', '♣']), pair(['A', '♣'], ['K', '♦'])]
  },
  '2-Q': {
    H: [pair(['2', '♥'], ['Q', '♠']), pair(['2', '♠'], ['Q', '♥'])],
    D: [pair(['2', '♦'], ['Q', '♣']), pair(['2', '♣'], ['Q', '♦'])]
  },
  '3-J': {
    H: [pair(['3', '♥'], ['J', '♠']), pair(['3', '♠'], ['J', '♥'])],
    D: [pair(['3', '♦'], ['J', '♣']), pair(['3', '♣'], ['J', '♦'])]
  },
  '4-10': {
    H: [pair(['4', '♥'], ['10', '♠']), pair(['4', '♠'], ['10', '♥'])],
    D: [pair(['4', '♦'], ['10', '♣']), pair(['4', '♣'], ['10', '♦'])]
  },
  '5-9': {
    H: [pair(['5', '♥'], ['9', '♠']), pair(['5', '♠'], ['9', '♥'])],
    D: [pair(['5', '♦'], ['9', '♣']), pair(['5', '♣'], ['9', '♦'])]
  },
  '6-8': {
    H: [pair(['6', '♥'], ['8', '♠']), pair(['6', '♠'], ['8', '♥'])],
    D: [pair(['6', '♦'], ['8', '♣']), pair(['6', '♣'], ['8', '♦'])]
  },
  '7-7': {
    H: [pair(['7', '♥'], ['7', '♠'])],
    D: [pair(['7', '♦'], ['7', '♣'])]
  }
};

// The circuit: two laps of the value ring, the first detouring through 7-7.
const CIRCUIT = [
  ['A-K', '2-Q'],
  ['2-Q', '3-J'],
  ['3-J', '4-10'],
  ['4-10', '5-9'],
  ['5-9', '6-8'],
  ['6-8', '7-7'],
  ['7-7', 'A-K'],
  ['A-K', '2-Q'],
  ['2-Q', '3-J'],
  ['3-J', '4-10'],
  ['4-10', '5-9'],
  ['5-9', '6-8'],
  ['6-8', 'A-K']
];

const next = {};
const draw = (value, kind) => {
  const key = `${value}:${kind}`;
  const index = next[key] ?? 0;
  next[key] = index + 1;
  const found = POOL[value][kind][index];
  if (!found) throw new Error(`ran out of ${key}`);
  return found;
};

const chain = CIRCUIT.map(([from, to]) => {
  const domino = makeDomino(draw(from, 'H'), draw(to, 'D'));
  return { ...domino, displayValue1: from, displayValue2: to };
});

const seen = new Set(chain.flatMap((d) => d.cards.map((c) => c.id)));
if (seen.size !== 52) throw new Error(`built ${seen.size} cards, wanted 52`);

export default {
  tableau: Array.from({ length: 8 }, () => []),
  pairs: [],
  dominos: chain.map((domino) => ({ ...domino, inChain: true })),
  chains: [chain],
  moveCount: 118
};

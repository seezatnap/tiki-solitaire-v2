import { describe, expect, it } from 'vitest';
import {
  COLUMN_COUNT,
  canConnectToChainEnd,
  canConnectToChainStart,
  canFormDomino,
  canJoinChains,
  canPair,
  canStack,
  checkCircular,
  checkWin,
  countTableauCards,
  createDeck,
  dealTableau,
  getChainEndValues,
  getConnectableChains,
  getPairLabel,
  getTotalChainLength,
  makeDomino,
  normalizeDominoValues,
  orientedHalves,
  reverseChain,
  shuffleDeck
} from '../rules.js';

const card = (rank, suit) => {
  const values = { A: 1, J: 11, Q: 12, K: 13 };
  const value = values[rank] ?? Number(rank);
  return { rank, suit, value, isRed: suit === '♥' || suit === '♦', id: `${rank}${suit}` };
};

const chained = (domino, flipped = false) => ({
  ...domino,
  displayValue1: flipped ? domino.value2 : domino.value1,
  displayValue2: flipped ? domino.value1 : domino.value2
});

describe('deck', () => {
  it('builds 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('assigns A=1, J=11, Q=12, K=13', () => {
    const deck = createDeck();
    const byId = Object.fromEntries(deck.map((c) => [c.id, c]));
    expect(byId['A♥'].value).toBe(1);
    expect(byId['J♠'].value).toBe(11);
    expect(byId['Q♦'].value).toBe(12);
    expect(byId['K♣'].value).toBe(13);
    expect(byId['10♣'].value).toBe(10);
  });

  it('marks hearts and diamonds red', () => {
    const deck = createDeck();
    expect(deck.filter((c) => c.isRed)).toHaveLength(26);
  });

  it('shuffles without losing or duplicating cards', () => {
    const deck = createDeck();
    let seed = 7;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const shuffled = shuffleDeck(deck, rng);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(52);
    expect(shuffled.map((c) => c.id)).not.toEqual(deck.map((c) => c.id));
    expect(deck.map((c) => c.id)).toEqual(createDeck().map((c) => c.id)); // input untouched
  });

  it('deals 52 cards across 8 columns of 6-7', () => {
    const tableau = dealTableau(createDeck());
    expect(tableau).toHaveLength(COLUMN_COUNT);
    expect(countTableauCards(tableau)).toBe(52);
    tableau.forEach((column) => {
      expect(column.length).toBeGreaterThanOrEqual(6);
      expect(column.length).toBeLessThanOrEqual(7);
    });
  });
});

describe('canStack', () => {
  it('allows the same rank', () => {
    expect(canStack(card('9', '♥'), card('9', '♠'))).toBe(true);
    expect(canStack(card('9', '♥'), card('9', '♦'))).toBe(true);
  });

  it('allows a sum of fourteen', () => {
    expect(canStack(card('A', '♥'), card('K', '♠'))).toBe(true);
    expect(canStack(card('6', '♣'), card('8', '♣'))).toBe(true);
    expect(canStack(card('7', '♥'), card('7', '♥'))).toBe(true);
  });

  it('refuses anything else', () => {
    expect(canStack(card('9', '♥'), card('4', '♠'))).toBe(false);
    expect(canStack(card('2', '♥'), card('3', '♠'))).toBe(false);
    expect(canStack(null, card('3', '♠'))).toBe(false);
    expect(canStack(card('3', '♠'), null)).toBe(false);
  });
});

describe('canPair', () => {
  it('needs opposite colours summing to fourteen', () => {
    expect(canPair(card('A', '♥'), card('K', '♣'))).toBe(true);
    expect(canPair(card('7', '♦'), card('7', '♠'))).toBe(true);
    expect(canPair(card('6', '♠'), card('8', '♥'))).toBe(true);
  });

  it('refuses same colour', () => {
    expect(canPair(card('A', '♥'), card('K', '♦'))).toBe(false);
    expect(canPair(card('7', '♣'), card('7', '♠'))).toBe(false);
  });

  it('refuses wrong sums', () => {
    expect(canPair(card('A', '♥'), card('Q', '♠'))).toBe(false);
    expect(canPair(card('5', '♥'), card('5', '♠'))).toBe(false);
  });
});

describe('getPairLabel', () => {
  it('puts the lower value first regardless of order', () => {
    expect(getPairLabel([card('K', '♣'), card('A', '♥')])).toBe('A-K');
    expect(getPairLabel([card('A', '♥'), card('K', '♣')])).toBe('A-K');
    expect(getPairLabel([card('9', '♠'), card('5', '♦')])).toBe('5-9');
    expect(getPairLabel([card('10', '♠'), card('4', '♦')])).toBe('4-10');
    expect(getPairLabel([card('7', '♠'), card('7', '♦')])).toBe('7-7');
  });
});

describe('canFormDomino — the four-suit rule', () => {
  it('accepts two pairs covering all four suits, whatever their values', () => {
    expect(
      canFormDomino([card('3', '♥'), card('J', '♣')], [card('5', '♦'), card('9', '♠')])
    ).toBe(true);
    expect(
      canFormDomino([card('A', '♥'), card('K', '♣')], [card('A', '♦'), card('K', '♠')])
    ).toBe(true);
    expect(
      canFormDomino([card('A', '♥'), card('K', '♣')], [card('7', '♦'), card('7', '♠')])
    ).toBe(true);
  });

  it('refuses when a suit is missing', () => {
    expect(
      canFormDomino([card('A', '♥'), card('K', '♣')], [card('2', '♥'), card('Q', '♣')])
    ).toBe(false);
    expect(
      canFormDomino([card('A', '♥'), card('K', '♣')], [card('2', '♦'), card('Q', '♣')])
    ).toBe(false);
  });
});

describe('domino construction', () => {
  const redBlack = (a, b) => [card(a[0], a[1]), card(b[0], b[1])];

  it('orders halves lower-value first', () => {
    const domino = makeDomino(
      redBlack(['9', '♦'], ['5', '♠']),
      redBlack(['A', '♥'], ['K', '♣'])
    );
    expect(domino.value1).toBe('A-K');
    expect(domino.value2).toBe('5-9');
    expect(domino.cards).toHaveLength(4);
    expect(domino.inChain).toBe(false);
  });

  it('keeps each half with its own cards after ordering', () => {
    const domino = makeDomino(
      redBlack(['9', '♦'], ['5', '♠']),
      redBlack(['A', '♥'], ['K', '♣'])
    );
    expect(domino.pair1.map((c) => c.id).sort()).toEqual(['A♥', 'K♣']);
    expect(domino.pair2.map((c) => c.id).sort()).toEqual(['5♠', '9♦']);
  });

  it('normalises 5-9 and 9-5 to the same ordering', () => {
    expect(normalizeDominoValues('9-5', '2-Q')).toEqual({ value1: '2-Q', value2: '9-5' });
    expect(normalizeDominoValues('5-9', 'A-K')).toEqual({ value1: 'A-K', value2: '5-9' });
    expect(normalizeDominoValues('4-10', '7-7')).toEqual({ value1: '4-10', value2: '7-7' });
  });

  it('derives a stable id from its cards', () => {
    const a = makeDomino(redBlack(['A', '♥'], ['K', '♣']), redBlack(['7', '♦'], ['7', '♠']));
    const b = makeDomino(redBlack(['7', '♦'], ['7', '♠']), redBlack(['A', '♥'], ['K', '♣']));
    expect(a.id).toBe(b.id);
  });

  it('reads its halves in display order when flipped', () => {
    const domino = makeDomino(redBlack(['A', '♥'], ['K', '♣']), redBlack(['5', '♦'], ['9', '♠']));
    expect(orientedHalves(chained(domino)).values).toEqual(['A-K', '5-9']);
    expect(orientedHalves(chained(domino, true)).values).toEqual(['5-9', 'A-K']);
    expect(orientedHalves(chained(domino, true)).pairs[0]).toBe(domino.pair2);
  });
});

describe('chains', () => {
  const mk = (v1, v2) => ({ id: `${v1}|${v2}`, value1: v1, value2: v2, inChain: false });

  it('reports its end values', () => {
    const chain = [chained(mk('A-K', '5-9')), chained(mk('5-9', '2-Q'))];
    expect(getChainEndValues(chain)).toEqual({ start: 'A-K', end: '2-Q' });
    expect(getChainEndValues([])).toBeNull();
  });

  it('connects only on a matching end value', () => {
    const chain = [chained(mk('A-K', '5-9'))];
    expect(canConnectToChainEnd(mk('5-9', '2-Q'), chain)).toBe(true);
    expect(canConnectToChainEnd(mk('2-Q', '5-9'), chain)).toBe(true);
    expect(canConnectToChainEnd(mk('2-Q', '3-J'), chain)).toBe(false);
    expect(canConnectToChainStart(mk('A-K', '3-J'), chain)).toBe(true);
    expect(canConnectToChainStart(mk('2-Q', '3-J'), chain)).toBe(false);
  });

  it('treats an empty chain as open to anything', () => {
    expect(canConnectToChainEnd(mk('A-K', '5-9'), [])).toBe(true);
    expect(canConnectToChainStart(mk('A-K', '5-9'), null)).toBe(true);
  });

  it('lists every place a domino could land', () => {
    const chains = [
      [chained(mk('A-K', '5-9'))],
      [chained(mk('2-Q', '3-J'))]
    ];
    expect(getConnectableChains(mk('5-9', '3-J'), chains)).toEqual([
      { chainIndex: 0, position: 'end' },
      { chainIndex: 1, position: 'end' }
    ]);
    expect(getConnectableChains(mk('6-8', '4-10'), chains)).toEqual([]);
  });

  it('reverses, swapping the display values', () => {
    const chain = [chained(mk('A-K', '5-9')), chained(mk('5-9', '2-Q'))];
    const flipped = reverseChain(chain);
    expect(getChainEndValues(flipped)).toEqual({ start: '2-Q', end: 'A-K' });
  });

  it('joins when any two ends agree', () => {
    const a = [chained(mk('A-K', '5-9'))];
    const b = [chained(mk('5-9', '2-Q'))];
    const c = [chained(mk('3-J', '4-10'))];
    expect(canJoinChains(a, b)).toBe(true);
    expect(canJoinChains(a, c)).toBe(false);
    expect(canJoinChains(a, [])).toBe(false);
  });

  it('detects a circular chain', () => {
    const loop = [chained(mk('A-K', '5-9')), chained(mk('5-9', 'A-K'))];
    expect(checkCircular(loop)).toBe(true);
    expect(checkCircular([chained(mk('A-K', 'A-K'))])).toBe(false); // one domino is not a loop
    expect(checkCircular([chained(mk('A-K', '5-9'))])).toBe(false);
  });

  it('counts dominos across all chains', () => {
    expect(getTotalChainLength([[1, 2], [3], []])).toBe(3);
    expect(getTotalChainLength(null)).toBe(0);
  });
});

describe('checkWin', () => {
  const loopOf = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: `d${i}`,
      displayValue1: i === 0 ? 'A-K' : `v${i}`,
      displayValue2: i === count - 1 ? 'A-K' : `v${i + 1}`
    }));

  it('needs one circular chain of thirteen dominos', () => {
    expect(checkWin([loopOf(13)])).toBe(true);
  });

  it('refuses a short chain, an open chain, or several chains', () => {
    expect(checkWin([loopOf(12)])).toBe(false);
    expect(checkWin([loopOf(7), loopOf(6)])).toBe(false);
    const open = loopOf(13);
    open[open.length - 1].displayValue2 = 'not-a-k';
    expect(checkWin([open])).toBe(false);
    expect(checkWin([])).toBe(false);
    expect(checkWin(null)).toBe(false);
  });
});

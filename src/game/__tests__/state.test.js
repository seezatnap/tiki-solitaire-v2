import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_HISTORY,
  MAX_PAIRS,
  checkCircular,
  createDeck,
  getChainEndValues,
  makeDomino
} from '../rules.js';
import {
  STORAGE_KEY,
  addDominoToChainEnd,
  addDominoToChainStart,
  canUndo,
  clearSavedState,
  createDominoFromPairs,
  createInitialState,
  createNewChainWithDomino,
  createPairFromTableau,
  joinChains,
  loadState,
  moveCard,
  reducer,
  reorderChains,
  reorderDominos,
  reorderPairs,
  saveState,
  undo
} from '../state.js';

const card = (rank, suit) => {
  const values = { A: 1, J: 11, Q: 12, K: 13 };
  const value = values[rank] ?? Number(rank);
  return { rank, suit, value, isRed: suit === '♥' || suit === '♦', id: `${rank}${suit}` };
};

/** A tiny hand-built board: one card per column unless stated otherwise. */
const board = (columns) => ({
  tableau: [...columns, ...Array.from({ length: 8 - columns.length }, () => [])],
  pairs: [],
  dominos: [],
  chains: [],
  moveCount: 0,
  history: []
});

const pairAK = [card('A', '♥'), card('K', '♣')];
const pair77 = [card('7', '♦'), card('7', '♠')];
const pair59 = [card('5', '♦'), card('9', '♠')];
const pair3J = [card('3', '♥'), card('J', '♣')];
const pair2Q = [card('2', '♥'), card('Q', '♠')];
const pair410 = [card('4', '♦'), card('10', '♣')];

describe('createInitialState', () => {
  it('deals a full board with an empty workyard', () => {
    const state = createInitialState(createDeck());
    expect(state.tableau.flat()).toHaveLength(52);
    expect(state.pairs).toEqual([]);
    expect(state.dominos).toEqual([]);
    expect(state.chains).toEqual([]);
    expect(state.moveCount).toBe(0);
  });
});

describe('moveCard', () => {
  it('moves onto a matching rank', () => {
    const state = board([[card('9', '♥')], [card('9', '♠')]]);
    const next = moveCard(state, 0, 1);
    expect(next.tableau[0]).toHaveLength(0);
    expect(next.tableau[1].map((c) => c.id)).toEqual(['9♠', '9♥']);
    expect(next.moveCount).toBe(1);
  });

  it('moves onto a card summing to fourteen', () => {
    const state = board([[card('6', '♥')], [card('8', '♠')]]);
    expect(moveCard(state, 0, 1).tableau[1]).toHaveLength(2);
  });

  it('moves into an empty column', () => {
    const state = board([[card('6', '♥')]]);
    expect(moveCard(state, 0, 3).tableau[3].map((c) => c.id)).toEqual(['6♥']);
  });

  it('refuses an illegal landing and returns the same state', () => {
    const state = board([[card('6', '♥')], [card('3', '♠')]]);
    expect(moveCard(state, 0, 1)).toBe(state);
    expect(moveCard(state, 1, 0)).toBe(state);
    expect(moveCard(state, 0, 0)).toBe(state);
    expect(moveCard(state, 4, 5)).toBe(state); // both columns empty
  });

  it('only lifts the top card of a column', () => {
    const state = board([[card('2', '♣'), card('9', '♥')], [card('9', '♠')]]);
    const next = moveCard(state, 0, 1);
    expect(next.tableau[0].map((c) => c.id)).toEqual(['2♣']);
  });

  it('records history for undo', () => {
    const state = board([[card('9', '♥')], [card('9', '♠')]]);
    const next = moveCard(state, 0, 1);
    expect(canUndo(next)).toBe(true);
    const back = undo(next);
    expect(back.tableau[0].map((c) => c.id)).toEqual(['9♥']);
    expect(back.moveCount).toBe(0);
    expect(canUndo(back)).toBe(false);
  });

  it('caps the history at MAX_HISTORY entries', () => {
    let state = board([[card('9', '♥')], [card('9', '♠')]]);
    for (let i = 0; i < MAX_HISTORY + 12; i += 1) {
      state = moveCard(state, i % 2 === 0 ? 0 : 1, i % 2 === 0 ? 1 : 0);
    }
    expect(state.history).toHaveLength(MAX_HISTORY);
  });
});

describe('createPairFromTableau', () => {
  it('lifts both cards into the workyard, red first', () => {
    const state = board([[card('K', '♣')], [card('A', '♥')]]);
    const next = createPairFromTableau(state, 0, 1);
    expect(next.tableau[0]).toHaveLength(0);
    expect(next.tableau[1]).toHaveLength(0);
    expect(next.pairs).toHaveLength(1);
    expect(next.pairs[0].map((c) => c.id)).toEqual(['A♥', 'K♣']);
  });

  it('refuses same-colour or wrong-sum cards', () => {
    const sameColour = board([[card('K', '♠')], [card('A', '♣')]]);
    expect(createPairFromTableau(sameColour, 0, 1)).toBe(sameColour);
    const wrongSum = board([[card('Q', '♠')], [card('A', '♥')]]);
    expect(createPairFromTableau(wrongSum, 0, 1)).toBe(wrongSum);
  });

  it('refuses a seventh pair', () => {
    const state = {
      ...board([[card('K', '♣')], [card('A', '♥')]]),
      pairs: Array.from({ length: MAX_PAIRS }, () => pair77)
    };
    expect(createPairFromTableau(state, 0, 1)).toBe(state);
  });
});

describe('createDominoFromPairs', () => {
  it('consumes both pairs and forges one domino', () => {
    const state = { ...board([]), pairs: [pairAK, pair59] };
    const next = createDominoFromPairs(state, 0, 1);
    expect(next.pairs).toHaveLength(0);
    expect(next.dominos).toHaveLength(1);
    expect(next.dominos[0].value1).toBe('A-K');
    expect(next.dominos[0].value2).toBe('5-9');
    expect(next.dominos[0].cards).toHaveLength(4);
  });

  it('forges from unequal values as long as all four suits show', () => {
    const state = { ...board([]), pairs: [pair3J, pair59] };
    expect(createDominoFromPairs(state, 0, 1).dominos).toHaveLength(1);
  });

  it('refuses pairs that share suits', () => {
    const state = { ...board([]), pairs: [pairAK, [card('2', '♥'), card('Q', '♣')]] };
    expect(createDominoFromPairs(state, 0, 1)).toBe(state);
    expect(createDominoFromPairs(state, 0, 0)).toBe(state);
  });

  it('removes the right two pairs when others are present', () => {
    const state = { ...board([]), pairs: [pair2Q, pairAK, pair410, pair59] };
    const next = createDominoFromPairs(state, 1, 3);
    expect(next.pairs).toEqual([pair2Q, pair410]);
  });
});

describe('chains', () => {
  const withDominos = (...pairsets) => {
    const dominos = pairsets.map(([a, b]) => makeDomino(a, b));
    return { ...board([]), dominos };
  };

  it('starts a new chain from a domino', () => {
    const state = withDominos([pairAK, pair59]);
    const next = createNewChainWithDomino(state, 0);
    expect(next.chains).toHaveLength(1);
    expect(next.chains[0]).toHaveLength(1);
    expect(next.dominos[0].inChain).toBe(true);
    expect(getChainEndValues(next.chains[0])).toEqual({ start: 'A-K', end: '5-9' });
  });

  it('will not replay a domino that is already chained', () => {
    let state = withDominos([pairAK, pair59]);
    state = createNewChainWithDomino(state, 0);
    expect(createNewChainWithDomino(state, 0)).toBe(state);
  });

  it('adds to the end, flipping the domino when needed', () => {
    let state = withDominos([pairAK, pair59], [pair2Q, [card('9', '♦'), card('5', '♣')]]);
    state = createNewChainWithDomino(state, 0);
    state = addDominoToChainEnd(state, 1, 0);
    expect(state.chains[0]).toHaveLength(2);
    expect(getChainEndValues(state.chains[0])).toEqual({ start: 'A-K', end: '2-Q' });
  });

  it('adds to the start, flipping the domino when needed', () => {
    let state = withDominos([pairAK, pair59], [pair2Q, [card('K', '♦'), card('A', '♣')]]);
    state = createNewChainWithDomino(state, 0);
    state = addDominoToChainStart(state, 1, 0);
    expect(state.chains[0]).toHaveLength(2);
    expect(getChainEndValues(state.chains[0])).toEqual({ start: '2-Q', end: '5-9' });
  });

  it('refuses a domino that matches neither end', () => {
    let state = withDominos([pairAK, pair59], [pair2Q, pair410]);
    state = createNewChainWithDomino(state, 0);
    expect(addDominoToChainEnd(state, 1, 0)).toBe(state);
    expect(addDominoToChainStart(state, 1, 0)).toBe(state);
  });

  it('closes a loop when the last domino meets the first', () => {
    let state = withDominos(
      [pairAK, pair59],
      [pair2Q, [card('9', '♦'), card('5', '♣')]],
      [[card('Q', '♥'), card('2', '♠')], [card('K', '♦'), card('A', '♣')]]
    );
    state = createNewChainWithDomino(state, 0);
    state = addDominoToChainEnd(state, 1, 0);
    state = addDominoToChainEnd(state, 2, 0);
    expect(checkCircular(state.chains[0])).toBe(true);
  });

  it('joins two chains whose ends agree, keeping the earlier slot', () => {
    let state = withDominos([pairAK, pair59], [pair2Q, [card('9', '♦'), card('5', '♣')]]);
    state = createNewChainWithDomino(state, 0);
    state = createNewChainWithDomino(state, 1);
    expect(state.chains).toHaveLength(2);
    const joined = joinChains(state, 0, 1);
    expect(joined.chains).toHaveLength(1);
    expect(joined.chains[0]).toHaveLength(2);
    expect(getChainEndValues(joined.chains[0])).toEqual({ start: 'A-K', end: '2-Q' });
  });

  it('joins in the other direction too', () => {
    let state = withDominos([pairAK, pair59], [pair2Q, [card('9', '♦'), card('5', '♣')]]);
    state = createNewChainWithDomino(state, 0);
    state = createNewChainWithDomino(state, 1);
    const joined = joinChains(state, 1, 0);
    expect(joined.chains).toHaveLength(1);
    expect(getChainEndValues(joined.chains[0])).toEqual({ start: '2-Q', end: 'A-K' });
  });

  it('refuses to join chains that do not meet', () => {
    let state = withDominos([pairAK, pair59], [pair2Q, pair410]);
    state = createNewChainWithDomino(state, 0);
    state = createNewChainWithDomino(state, 1);
    expect(joinChains(state, 0, 1)).toBe(state);
    expect(joinChains(state, 0, 0)).toBe(state);
  });

  it('retires the undo history, because a chain cannot be unmade', () => {
    let state = { ...board([]), pairs: [pairAK, pair59] };
    state = createDominoFromPairs(state, 0, 1);
    expect(canUndo(state)).toBe(true);
    state = createNewChainWithDomino(state, 0);
    expect(canUndo(state)).toBe(false);
    expect(undo(state)).toBe(state);
  });

  it('keeps chains intact through an undo', () => {
    let state = { ...board([[card('K', '♣')], [card('A', '♥')]]), pairs: [pair3J, pair59] };
    state = createDominoFromPairs(state, 0, 1);
    state = createNewChainWithDomino(state, 0);
    state = createPairFromTableau(state, 0, 1);
    expect(state.pairs).toHaveLength(1);
    const back = undo(state);
    expect(back.pairs).toHaveLength(0);
    expect(back.chains).toHaveLength(1);
  });
});

describe('reordering', () => {
  it('reorders pairs, dominos and chains', () => {
    const state = { ...board([]), pairs: [pairAK, pair59, pair2Q] };
    expect(reorderPairs(state, 0, 2).pairs).toEqual([pair59, pair2Q, pairAK]);
    expect(reorderPairs(state, 1, 1)).toBe(state);
    expect(reorderPairs(state, 0, 9)).toBe(state);

    const dominoState = { ...board([]), dominos: [{ id: 'a' }, { id: 'b' }] };
    expect(reorderDominos(dominoState, 1, 0).dominos.map((d) => d.id)).toEqual(['b', 'a']);

    const chainState = { ...board([]), chains: [['a'], ['b'], ['c']] };
    expect(reorderChains(chainState, 2, 0).chains).toEqual([['c'], ['a'], ['b']]);
  });

  it('does not spend a move on tidying up', () => {
    const state = { ...board([]), pairs: [pairAK, pair59] };
    expect(reorderPairs(state, 0, 1).moveCount).toBe(0);
  });
});

describe('reducer', () => {
  it('routes every action', () => {
    const state = board([[card('9', '♥')], [card('9', '♠')]]);
    expect(reducer(state, { type: 'MOVE_CARD', fromCol: 0, toCol: 1 }).tableau[1]).toHaveLength(2);
    expect(reducer(state, { type: 'NEW_GAME', deck: createDeck() }).tableau.flat()).toHaveLength(52);
    expect(reducer(state, { type: 'NOPE' })).toBe(state);
  });

  it('adds to a chain start or end through one action', () => {
    let state = { ...board([]), dominos: [makeDomino(pairAK, pair59), makeDomino(pair2Q, [card('9', '♦'), card('5', '♣')])] };
    state = reducer(state, { type: 'NEW_CHAIN', dominoIndex: 0 });
    state = reducer(state, { type: 'ADD_TO_CHAIN', dominoIndex: 1, chainIndex: 0, position: 'end' });
    expect(state.chains[0]).toHaveLength(2);
  });
});

describe('persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a game', () => {
    const state = createInitialState(createDeck());
    saveState({ ...state, moveCount: 12 });
    const loaded = loadState();
    expect(loaded.tableau.flat()).toHaveLength(52);
    expect(loaded.moveCount).toBe(12);
    expect(loaded.history).toEqual([]);
  });

  it('returns null when there is nothing saved', () => {
    expect(loadState()).toBeNull();
  });

  it('shrugs off corrupted data', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tableau: 'nope' }));
    expect(loadState()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tableau: [[{ oops: true }], [], [], [], [], [], [], []] }));
    expect(loadState()).toBeNull();
  });

  it('clears on request', () => {
    saveState(createInitialState(createDeck()));
    clearSavedState();
    expect(loadState()).toBeNull();
  });
});

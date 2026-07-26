/**
 * Tiki Solitaire — state transitions.
 *
 * Every transition is a pure function of (state, args) -> state. A transition
 * that isn't legal returns the *same object* it was given, which is how the UI
 * detects a refused move (and answers with a shake and a thud).
 */

import {
  COLUMN_COUNT,
  MAX_HISTORY,
  MAX_PAIRS,
  canConnectToChainEnd,
  canConnectToChainStart,
  canFormDomino,
  canJoinChains,
  canJoinChainsAt,
  canPair,
  canStack,
  createDeck,
  dealTableau,
  getChainEndValues,
  makeDomino,
  orderPair,
  reverseChain,
  shuffleDeck
} from './rules.js';

export const createInitialState = (deck = shuffleDeck(createDeck())) => ({
  tableau: dealTableau(deck),
  pairs: [],
  dominos: [],
  chains: [],
  moveCount: 0,
  history: []
});

/* -------------------------------------------------------------- history -- */

// Chains are permanent, so they are deliberately left out of the snapshot.
const snapshot = (state) => ({
  tableau: state.tableau.map((column) => [...column]),
  pairs: state.pairs.map((pair) => [...pair]),
  dominos: state.dominos.map((domino) => ({ ...domino })),
  moveCount: state.moveCount
});

const pushHistory = (state) => {
  const history = [...state.history, snapshot(state)];
  return history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history;
};

export const undo = (state) => {
  if (!state.history.length) return state;
  const previous = state.history[state.history.length - 1];
  return {
    ...previous,
    chains: state.chains, // permanent — undo never rewinds a chain
    history: state.history.slice(0, -1)
  };
};

export const canUndo = (state) => state.history.length > 0;

/* -------------------------------------------------------------- tableau -- */

export const moveCard = (state, fromCol, toCol) => {
  if (fromCol === toCol) return state;
  const from = state.tableau[fromCol];
  const to = state.tableau[toCol];
  if (!from?.length || !to) return state;

  const card = from[from.length - 1];
  const target = to[to.length - 1];
  if (to.length !== 0 && !canStack(card, target)) return state;

  return {
    ...state,
    tableau: state.tableau.map((column, index) => {
      if (index === fromCol) return column.slice(0, -1);
      if (index === toCol) return [...column, card];
      return column;
    }),
    moveCount: state.moveCount + 1,
    history: pushHistory(state)
  };
};

export const createPairFromTableau = (state, fromCol, toCol) => {
  if (fromCol === toCol) return state;
  if (state.pairs.length >= MAX_PAIRS) return state;
  const from = state.tableau[fromCol];
  const to = state.tableau[toCol];
  if (!from?.length || !to?.length) return state;

  const cardA = from[from.length - 1];
  const cardB = to[to.length - 1];
  if (!canPair(cardA, cardB)) return state;

  return {
    ...state,
    tableau: state.tableau.map((column, index) =>
      index === fromCol || index === toCol ? column.slice(0, -1) : column
    ),
    pairs: [...state.pairs, orderPair(cardA, cardB)],
    moveCount: state.moveCount + 1,
    history: pushHistory(state)
  };
};

/* -------------------------------------------------------------- dominos -- */

export const createDominoFromPairs = (state, indexA, indexB) => {
  if (indexA === indexB) return state;
  const pairA = state.pairs[indexA];
  const pairB = state.pairs[indexB];
  if (!pairA || !pairB || !canFormDomino(pairA, pairB)) return state;

  const remaining = state.pairs.filter((_, index) => index !== indexA && index !== indexB);

  return {
    ...state,
    pairs: remaining,
    dominos: [...state.dominos, makeDomino(pairA, pairB)],
    moveCount: state.moveCount + 1,
    history: pushHistory(state)
  };
};

/* --------------------------------------------------------------- chains -- */

// Committing a domino to a chain is irreversible, and every earlier snapshot
// describes a world where those four cards were still loose. Retiring the
// history here is what keeps undo from conjuring duplicate cards.
const commitToChain = (state, dominoIndex, chains) => ({
  ...state,
  dominos: state.dominos.map((domino, index) =>
    index === dominoIndex ? { ...domino, inChain: true } : domino
  ),
  chains,
  moveCount: state.moveCount + 1,
  history: []
});

const orientForEnd = (domino, dominoIndex, endValue) => ({
  ...domino,
  originalIndex: dominoIndex,
  displayValue1: domino.value1 === endValue ? domino.value1 : domino.value2,
  displayValue2: domino.value1 === endValue ? domino.value2 : domino.value1
});

const orientForStart = (domino, dominoIndex, startValue) => ({
  ...domino,
  originalIndex: dominoIndex,
  displayValue1: domino.value2 === startValue ? domino.value1 : domino.value2,
  displayValue2: domino.value2 === startValue ? domino.value2 : domino.value1
});

export const createNewChainWithDomino = (state, dominoIndex) => {
  const domino = state.dominos[dominoIndex];
  if (!domino || domino.inChain) return state;

  const seed = {
    ...domino,
    originalIndex: dominoIndex,
    displayValue1: domino.value1,
    displayValue2: domino.value2
  };
  return commitToChain(state, dominoIndex, [...state.chains, [seed]]);
};

export const addDominoToChainEnd = (state, dominoIndex, chainIndex) => {
  const domino = state.dominos[dominoIndex];
  const chain = state.chains[chainIndex];
  if (!domino || domino.inChain || !chain) return state;
  if (!canConnectToChainEnd(domino, chain)) return state;

  const { end } = getChainEndValues(chain);
  const chains = [...state.chains];
  chains[chainIndex] = [...chain, orientForEnd(domino, dominoIndex, end)];
  return commitToChain(state, dominoIndex, chains);
};

export const addDominoToChainStart = (state, dominoIndex, chainIndex) => {
  const domino = state.dominos[dominoIndex];
  const chain = state.chains[chainIndex];
  if (!domino || domino.inChain || !chain) return state;
  if (!canConnectToChainStart(domino, chain)) return state;

  const { start } = getChainEndValues(chain);
  const chains = [...state.chains];
  chains[chainIndex] = [orientForStart(domino, dominoIndex, start), ...chain];
  return commitToChain(state, dominoIndex, chains);
};

/**
 * Splices `moving` onto one named end of `target`. The moving chain turns
 * around if that is what the junction needs; the target never moves, so the
 * player sees the chain they dropped onto stay where it was.
 */
export const joinChainsAt = (state, movingIndex, targetIndex, position) => {
  if (movingIndex === targetIndex) return state;
  const moving = state.chains[movingIndex];
  const target = state.chains[targetIndex];
  if (!moving || !target || !canJoinChainsAt(moving, target, position)) return state;

  const ends = getChainEndValues(moving);
  const meeting = getChainEndValues(target);
  const joined =
    position === 'end'
      ? [...target, ...(ends.start === meeting.end ? moving : reverseChain(moving))]
      : [...(ends.end === meeting.start ? moving : reverseChain(moving)), ...target];

  const chains = state.chains.map((chain, index) => (index === targetIndex ? joined : chain));
  chains.splice(movingIndex, 1);

  return { ...state, chains, moveCount: state.moveCount + 1 };
};

export const joinChains = (state, indexA, indexB) => {
  if (indexA === indexB) return state;
  const chainA = state.chains[indexA];
  const chainB = state.chains[indexB];
  if (!chainA || !chainB || !canJoinChains(chainA, chainB)) return state;

  const a = getChainEndValues(chainA);
  const b = getChainEndValues(chainB);

  let joined;
  if (a.end === b.start) joined = [...chainA, ...chainB];
  else if (a.end === b.end) joined = [...chainA, ...reverseChain(chainB)];
  else if (a.start === b.end) joined = [...chainB, ...chainA];
  else joined = [...reverseChain(chainB), ...chainA];

  // The surviving chain keeps the lower slot so the board doesn't jump around.
  const keep = Math.min(indexA, indexB);
  const drop = Math.max(indexA, indexB);
  const chains = state.chains.map((chain, index) => (index === keep ? joined : chain));
  chains.splice(drop, 1);

  return { ...state, chains, moveCount: state.moveCount + 1 };
};

/* ------------------------------------------------------------ reordering -- */

const reorder = (list, fromIndex, toIndex) => {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const reorderable = (list, fromIndex, toIndex) =>
  fromIndex !== toIndex &&
  fromIndex >= 0 &&
  fromIndex < list.length &&
  toIndex >= 0 &&
  toIndex < list.length;

export const reorderPairs = (state, fromIndex, toIndex) =>
  reorderable(state.pairs, fromIndex, toIndex)
    ? { ...state, pairs: reorder(state.pairs, fromIndex, toIndex) }
    : state;

export const reorderDominos = (state, fromIndex, toIndex) =>
  reorderable(state.dominos, fromIndex, toIndex)
    ? { ...state, dominos: reorder(state.dominos, fromIndex, toIndex) }
    : state;

export const reorderChains = (state, fromIndex, toIndex) =>
  reorderable(state.chains, fromIndex, toIndex)
    ? { ...state, chains: reorder(state.chains, fromIndex, toIndex) }
    : state;

/* -------------------------------------------------------------- reducer -- */

export const reducer = (state, action) => {
  switch (action.type) {
    case 'NEW_GAME':
      return createInitialState(action.deck);
    case 'UNDO':
      return undo(state);
    case 'MOVE_CARD':
      return moveCard(state, action.fromCol, action.toCol);
    case 'CREATE_PAIR':
      return createPairFromTableau(state, action.fromCol, action.toCol);
    case 'CREATE_DOMINO':
      return createDominoFromPairs(state, action.indexA, action.indexB);
    case 'NEW_CHAIN':
      return createNewChainWithDomino(state, action.dominoIndex);
    case 'ADD_TO_CHAIN':
      return action.position === 'start'
        ? addDominoToChainStart(state, action.dominoIndex, action.chainIndex)
        : addDominoToChainEnd(state, action.dominoIndex, action.chainIndex);
    case 'JOIN_CHAINS':
      return joinChains(state, action.indexA, action.indexB);
    case 'JOIN_CHAINS_AT':
      return joinChainsAt(state, action.movingIndex, action.targetIndex, action.position);
    case 'REORDER_PAIRS':
      return reorderPairs(state, action.fromIndex, action.toIndex);
    case 'REORDER_DOMINOS':
      return reorderDominos(state, action.fromIndex, action.toIndex);
    case 'REORDER_CHAINS':
      return reorderChains(state, action.fromIndex, action.toIndex);
    default:
      return state;
  }
};

/* ---------------------------------------------------------- persistence -- */

export const STORAGE_KEY = 'tiki-solitaire-v2';

export const saveState = (state) => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tableau: state.tableau,
        pairs: state.pairs,
        dominos: state.dominos,
        chains: state.chains,
        moveCount: state.moveCount
      })
    );
  } catch {
    /* storage unavailable — the game simply won't resume */
  }
};

const isCardish = (card) =>
  card && typeof card.rank === 'string' && typeof card.suit === 'string' && typeof card.value === 'number';

export const loadState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.tableau) || parsed.tableau.length !== COLUMN_COUNT) return null;
    if (!parsed.tableau.every((column) => Array.isArray(column) && column.every(isCardish))) return null;
    if (!Array.isArray(parsed.pairs) || !Array.isArray(parsed.dominos) || !Array.isArray(parsed.chains)) {
      return null;
    }

    return {
      tableau: parsed.tableau,
      pairs: parsed.pairs,
      dominos: parsed.dominos,
      chains: parsed.chains,
      moveCount: Number(parsed.moveCount) || 0,
      history: []
    };
  } catch {
    return null;
  }
};

export const clearSavedState = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
};

export const loadOrCreate = () => loadState() || createInitialState();

/**
 * Tiki Solitaire — rules.
 *
 * Pure, side-effect free predicates and constructors. These are a faithful port
 * of the original game's rules; nothing about how the game plays has changed.
 *
 *   1. Cards pair when they sum to FOURTEEN and are opposite colours.
 *   2. Two pairs forge a domino when between them they show all four suits.
 *   3. Dominos link into chains when a value at one end matches.
 *   4. A perfect game is one closed chain holding all 52 cards.
 */

export const SUITS = ['♥', '♦', '♣', '♠'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_VALUES = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13
};

export const TARGET_SUM = 14;
export const COLUMN_COUNT = 8;
export const MAX_PAIRS = 6;
export const MAX_HISTORY = 50;
export const DOMINOS_TO_WIN = 13;

/* ------------------------------------------------------------------ deck -- */

export const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        rank,
        suit,
        value: RANK_VALUES[rank],
        isRed: suit === '♥' || suit === '♦',
        id: `${rank}${suit}`
      });
    }
  }
  return deck;
};

export const shuffleDeck = (deck, rng = Math.random) => {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const dealTableau = (deck, columnCount = COLUMN_COUNT) => {
  const tableau = Array.from({ length: columnCount }, () => []);
  deck.forEach((card, index) => {
    tableau[index % columnCount].push(card);
  });
  return tableau;
};

/* ------------------------------------------------------------- movement -- */

/** A card may land on another of the same rank, or one that completes 14. */
export const canStack = (movingCard, restingCard) => {
  if (!movingCard || !restingCard) return false;
  return (
    movingCard.rank === restingCard.rank ||
    movingCard.value + restingCard.value === TARGET_SUM
  );
};

/** A pair is one red + one black card summing to 14. */
export const canPair = (cardA, cardB) => {
  if (!cardA || !cardB) return false;
  return cardA.isRed !== cardB.isRed && cardA.value + cardB.value === TARGET_SUM;
};

/* ---------------------------------------------------------------- pairs -- */

/** Pairs are always stored red-first so the eye can read them consistently. */
export const orderPair = (cardA, cardB) => (cardA.isRed ? [cardA, cardB] : [cardB, cardA]);

/** Normalised label, lower value first: "A-K", "5-9", "7-7". */
export const getPairLabel = (pair) => {
  const ordered = [pair[0], pair[1]].sort((a, b) => a.value - b.value);
  return `${ordered[0].rank}-${ordered[1].rank}`;
};

export const labelValue = (label) => {
  const rank = String(label).split('-')[0];
  return RANK_VALUES[rank] ?? Number.parseInt(rank, 10);
};

/* -------------------------------------------------------------- dominos -- */

/** Two pairs forge a domino only when they show all four suits between them. */
export const canFormDomino = (pairA, pairB) => {
  if (!pairA || !pairB) return false;
  const suits = new Set([pairA[0].suit, pairA[1].suit, pairB[0].suit, pairB[1].suit]);
  return suits.size === 4;
};

/** Lower-valued half first, so 5-9 and 9-5 are the same domino. */
export const normalizeDominoValues = (value1, value2) =>
  labelValue(value1) <= labelValue(value2) ? { value1, value2 } : { value1: value2, value2: value1 };

/** Stable identity derived from its cards — survives reloads without collisions. */
export const dominoId = (cards) =>
  `d:${cards
    .map((card) => card.id)
    .slice()
    .sort()
    .join('')}`;

export const makeDomino = (pairA, pairB) => {
  const labelA = getPairLabel(pairA);
  const labelB = getPairLabel(pairB);
  const { value1, value2 } = normalizeDominoValues(labelA, labelB);
  const first = labelA === value1 ? pairA : pairB;
  const second = labelA === value1 ? pairB : pairA;

  return {
    id: dominoId([...first, ...second]),
    pair1: first,
    pair2: second,
    value1,
    value2,
    cards: [...first, ...second],
    inChain: false
  };
};

/** The halves in the order a chained domino should be read. */
export const orientedHalves = (domino) => {
  const flipped =
    domino.displayValue1 !== undefined && domino.displayValue1 !== domino.value1;
  return flipped
    ? { pairs: [domino.pair2, domino.pair1], values: [domino.value2, domino.value1] }
    : { pairs: [domino.pair1, domino.pair2], values: [domino.value1, domino.value2] };
};

/* --------------------------------------------------------------- chains -- */

export const getChainEndValues = (chain) => {
  if (!chain || !chain.length) return null;
  const first = chain[0];
  const last = chain[chain.length - 1];
  return {
    start: first.displayValue1 || first.value1,
    end: last.displayValue2 || last.value2
  };
};

export const canConnectToChainEnd = (domino, chain) => {
  if (!domino) return false;
  if (!chain || !chain.length) return true;
  const { end } = getChainEndValues(chain);
  return domino.value1 === end || domino.value2 === end;
};

export const canConnectToChainStart = (domino, chain) => {
  if (!domino) return false;
  if (!chain || !chain.length) return true;
  const { start } = getChainEndValues(chain);
  return domino.value1 === start || domino.value2 === start;
};

/** Every place this domino could go: [{ chainIndex, position }]. */
export const getConnectableChains = (domino, chains = []) => {
  const spots = [];
  chains.forEach((chain, chainIndex) => {
    const ends = getChainEndValues(chain);
    if (!ends) return;
    if (domino.value1 === ends.start || domino.value2 === ends.start) {
      spots.push({ chainIndex, position: 'start' });
    }
    if (domino.value1 === ends.end || domino.value2 === ends.end) {
      spots.push({ chainIndex, position: 'end' });
    }
  });
  return spots;
};

export const canJoinChains = (chainA, chainB) => {
  if (!chainA?.length || !chainB?.length) return false;
  const a = getChainEndValues(chainA);
  const b = getChainEndValues(chainB);
  return a.end === b.start || a.end === b.end || a.start === b.start || a.start === b.end;
};

export const reverseChain = (chain) =>
  chain
    .slice()
    .reverse()
    .map((domino) => ({
      ...domino,
      displayValue1: domino.displayValue2 || domino.value2,
      displayValue2: domino.displayValue1 || domino.value1
    }));

/** A chain is circular when its two ends carry the same value. */
export const checkCircular = (chain) => {
  if (!chain || chain.length < 2) return false;
  const { start, end } = getChainEndValues(chain);
  return start === end;
};

/** Perfect game: one closed chain holding all 52 cards. */
export const checkWin = (chains) => {
  if (!chains || chains.length !== 1) return false;
  const chain = chains[0];
  return chain.length * 4 === 52 && checkCircular(chain);
};

export const getTotalChainLength = (chains) =>
  (chains || []).reduce((sum, chain) => sum + chain.length, 0);

export const countTableauCards = (tableau) =>
  (tableau || []).reduce((sum, column) => sum + column.length, 0);

export const topCardOf = (tableau, columnIndex) => {
  const column = tableau?.[columnIndex];
  return column?.length ? column[column.length - 1] : null;
};

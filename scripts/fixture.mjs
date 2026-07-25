/**
 * A mid-game board for the visual harnesses: three loose pairs, two forged
 * dominos, and a two-domino chain. Built by running the real transitions, so
 * the fixture can only ever be a state the game could actually reach.
 */
import { createDeck, dealTableau } from '../src/game/rules.js';
import {
  addDominoToChainEnd,
  createDominoFromPairs,
  createNewChainWithDomino,
  createPairFromTableau
} from '../src/game/state.js';

const deck = createDeck();
const byId = Object.fromEntries(deck.map((card) => [card.id, card]));
const grab = (...ids) => ids.map((id) => byId[id]);

const DOMINOS = [
  [grab('A♥', 'K♣'), grab('5♦', '9♠')], // A-K | 5-9
  [grab('9♥', '5♣'), grab('2♦', 'Q♠')], // 2-Q | 5-9
  [grab('Q♥', '2♣'), grab('A♦', 'K♠')], // A-K | 2-Q
  [grab('3♥', 'J♣'), grab('6♦', '8♠')] // 3-J | 6-8
];
const LOOSE = [grab('7♦', '7♠'), grab('4♥', '10♠'), grab('6♥', '8♣')];

const used = new Set([...DOMINOS.flat(2), ...LOOSE.flat()].map((card) => card.id));

const addPair = (state, [a, b]) => {
  const tableau = state.tableau.map((column, index) => {
    if (index === 0) return [...column, a];
    if (index === 1) return [...column, b];
    return column;
  });
  return createPairFromTableau({ ...state, tableau }, 0, 1);
};

let state = {
  tableau: dealTableau(deck.filter((card) => !used.has(card.id))),
  pairs: [],
  dominos: [],
  chains: [],
  moveCount: 46,
  history: []
};

DOMINOS.forEach((pairs) => {
  state = addPair(state, pairs[0]);
  state = addPair(state, pairs[1]);
  state = createDominoFromPairs(state, 0, 1);
});
state = createNewChainWithDomino(state, 0);
state = addDominoToChainEnd(state, 1, 0);
LOOSE.forEach((pair) => {
  state = addPair(state, pair);
});

const saved = {
  tableau: state.tableau,
  pairs: state.pairs,
  dominos: state.dominos,
  chains: state.chains,
  moveCount: state.moveCount
};

export default saved;

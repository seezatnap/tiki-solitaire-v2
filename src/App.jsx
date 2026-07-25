import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Backdrop,
  ConfirmModal,
  HelpModal,
  Panel,
  TopBar,
  WinModal
} from './components/Chrome.jsx';
import { Card, Chip, cx } from './components/Card.jsx';
import { Tableau } from './components/Tableau.jsx';
import { DominoTile, DominoTray, PairSlots, pretty } from './components/Workyard.jsx';
import { ChainList } from './components/Chains.jsx';
import { DragProvider, useDrag } from './lib/DragProvider.jsx';
import { captureRects, forgetRects, playFlips } from './lib/flip.js';
import { playSound, setSoundEnabled } from './lib/sound.js';
import { useFlash, usePersistentState } from './lib/hooks.js';
import {
  MAX_PAIRS,
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
  getPairLabel,
  getTotalChainLength,
  shuffleDeck,
  topCardOf
} from './game/rules.js';
import { loadOrCreate, reducer, saveState } from './game/state.js';

const connects = (domino, chain, pos) =>
  pos === 'start' ? canConnectToChainStart(domino, chain) : canConnectToChainEnd(domino, chain);

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadOrCreate);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [selectedColumn, setSelectedColumn] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);
  const [armed, setArmed] = useState(null); // { chainIndex, pos } — a socket waiting for a domino
  const [denied, flashDenied] = useFlash(520);

  const [soundOn, setSoundOn] = usePersistentState('tiki-solitaire-v2:sound', true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const wonRef = useRef(false);

  useEffect(() => setSoundEnabled(soundOn), [soundOn]);
  useEffect(() => saveState(state), [state]);
  useLayoutEffect(() => playFlips());

  useEffect(() => {
    const drop = () => forgetRects();
    window.addEventListener('resize', drop);
    return () => window.removeEventListener('resize', drop);
  }, []);

  useEffect(() => {
    if (checkWin(state.chains)) {
      if (!wonRef.current) {
        wonRef.current = true;
        setWinOpen(true);
        playSound('win');
      }
    } else {
      wonRef.current = false;
    }
  }, [state.chains]);

  const clearSelection = useCallback(() => {
    setSelectedColumn(null);
    setSelectedPair(null);
    setSelectedChain(null);
  }, []);

  /* ---------------------------------------------------------- dispatch -- */

  const soundFor = useCallback((action, before, after) => {
    switch (action.type) {
      case 'MOVE_CARD':
        return 'place';
      case 'CREATE_PAIR':
        return 'pair';
      case 'CREATE_DOMINO':
        return 'domino';
      case 'NEW_CHAIN':
      case 'ADD_TO_CHAIN': {
        const closed = after.chains.some(checkCircular);
        const wasClosed = before.chains.some(checkCircular);
        return closed && !wasClosed ? 'loop' : 'chain';
      }
      case 'JOIN_CHAINS':
        return after.chains.some(checkCircular) ? 'loop' : 'join';
      case 'NEW_GAME':
        return 'shuffle';
      case 'UNDO':
        return 'lift';
      default:
        return 'lift';
    }
  }, []);

  /** Runs the action if the rules allow it; answers with a thud if they don't. */
  const act = useCallback(
    (action, token) => {
      const before = stateRef.current;
      const after = reducer(before, action);
      if (after === before) {
        playSound('deny');
        if (token) flashDenied(token);
        return false;
      }
      captureRects();
      dispatch(action);
      playSound(soundFor(action, before, after));
      return true;
    },
    [flashDenied, soundFor]
  );

  /* ------------------------------------------------------------ derived -- */

  const visibleDominos = useMemo(
    () =>
      state.dominos
        .map((domino, index) => ({ domino, index }))
        .filter(({ domino }) => !domino.inChain),
    [state.dominos]
  );

  const combinablePairs = useMemo(() => {
    const set = new Set();
    state.pairs.forEach((pair, index) => {
      state.pairs.forEach((other, otherIndex) => {
        if (index !== otherIndex && canFormDomino(pair, other)) set.add(index);
      });
    });
    return set;
  }, [state.pairs]);

  const connectableDominos = useMemo(() => {
    const set = new Set();
    visibleDominos.forEach(({ domino, index }) => {
      if (armed) {
        if (connects(domino, state.chains[armed.chainIndex], armed.pos)) set.add(index);
        return;
      }
      const fits = state.chains.some(
        (chain) => canConnectToChainEnd(domino, chain) || canConnectToChainStart(domino, chain)
      );
      if (fits) set.add(index);
    });
    return set;
  }, [visibleDominos, state.chains, armed]);

  const joinableChains = useMemo(() => {
    const set = new Set();
    if (selectedChain === null) return set;
    state.chains.forEach((chain, index) => {
      if (index !== selectedChain && canJoinChains(state.chains[selectedChain], chain)) set.add(index);
    });
    return set;
  }, [state.chains, selectedChain]);

  const stats = {
    moves: state.moveCount,
    tableau: countTableauCards(state.tableau),
    pairs: state.pairs.length,
    dominos: visibleDominos.length,
    chained: getTotalChainLength(state.chains)
  };

  /* ------------------------------------------------------- interactions -- */

  const activateColumn = useCallback(
    (columnIndex) => {
      const { tableau, pairs } = stateRef.current;
      if (selectedColumn === null) {
        if (!tableau[columnIndex].length) return;
        setSelectedColumn(columnIndex);
        playSound('lift');
        return;
      }
      if (selectedColumn === columnIndex) {
        setSelectedColumn(null);
        return;
      }

      const from = topCardOf(tableau, selectedColumn);
      const to = topCardOf(tableau, columnIndex);

      if (from && to && canPair(from, to) && pairs.length < MAX_PAIRS) {
        act({ type: 'CREATE_PAIR', fromCol: selectedColumn, toCol: columnIndex }, `column:${columnIndex}`);
        setSelectedColumn(null);
        return;
      }
      if (!to || canStack(from, to)) {
        act({ type: 'MOVE_CARD', fromCol: selectedColumn, toCol: columnIndex }, `column:${columnIndex}`);
        setSelectedColumn(null);
        return;
      }
      // Not a legal landing — treat the click as picking up this column instead.
      setSelectedColumn(columnIndex);
      playSound('lift');
    },
    [act, selectedColumn]
  );

  const activatePair = useCallback(
    (index) => {
      if (selectedPair === null) {
        setSelectedPair(index);
        playSound('lift');
        return;
      }
      if (selectedPair === index) {
        setSelectedPair(null);
        return;
      }
      const { pairs } = stateRef.current;
      if (canFormDomino(pairs[selectedPair], pairs[index])) {
        act({ type: 'CREATE_DOMINO', indexA: selectedPair, indexB: index }, `pair:${index}`);
        setSelectedPair(null);
        return;
      }
      flashDenied(`pair:${index}`);
      playSound('deny');
      setSelectedPair(index);
    },
    [act, flashDenied, selectedPair]
  );

  const activateDomino = useCallback(
    (index) => {
      if (armed) {
        const { chains, dominos } = stateRef.current;
        if (connects(dominos[index], chains[armed.chainIndex], armed.pos)) {
          act(
            { type: 'ADD_TO_CHAIN', dominoIndex: index, chainIndex: armed.chainIndex, position: armed.pos },
            `domino:${index}`
          );
          setArmed(null);
          return;
        }
        playSound('deny');
        flashDenied(`domino:${index}`);
        return;
      }
      act({ type: 'NEW_CHAIN', dominoIndex: index }, `domino:${index}`);
    },
    [act, armed, flashDenied]
  );

  const activateSocket = useCallback(
    (chainIndex, pos) => {
      setSelectedChain(null);
      setArmed((prev) => (prev && prev.chainIndex === chainIndex && prev.pos === pos ? null : { chainIndex, pos }));
      playSound('lift');
    },
    []
  );

  const activateChain = useCallback(
    (index) => {
      setArmed(null);
      if (selectedChain === null) {
        setSelectedChain(index);
        playSound('lift');
        return;
      }
      if (selectedChain === index) {
        setSelectedChain(null);
        return;
      }
      const { chains } = stateRef.current;
      if (canJoinChains(chains[selectedChain], chains[index])) {
        act({ type: 'JOIN_CHAINS', indexA: selectedChain, indexB: index }, `chain:${index}`);
        setSelectedChain(null);
        return;
      }
      playSound('deny');
      flashDenied(`chain:${index}`);
      setSelectedChain(index);
    },
    [act, flashDenied, selectedChain]
  );

  /* -------------------------------------------------------------- drag -- */

  const canDrop = useCallback(
    (payload, target) => {
      const { tableau, pairs, dominos, chains } = stateRef.current;
      switch (payload.kind) {
        case 'card': {
          if (target.kind !== 'column' || target.index === payload.column) return false;
          const from = topCardOf(tableau, payload.column);
          const to = topCardOf(tableau, target.index);
          if (!to) return true;
          if (canPair(from, to) && pairs.length < MAX_PAIRS) return true;
          return canStack(from, to);
        }
        case 'pair':
          return target.kind === 'pair' && target.index !== payload.index;
        case 'domino': {
          const domino = dominos[payload.index];
          if (!domino) return false;
          if (target.kind === 'socket') return connects(domino, chains[target.index], target.pos);
          if (target.kind === 'new-chain') return true;
          if (target.kind === 'domino') return target.index !== payload.position;
          return false;
        }
        case 'chain':
          return target.kind === 'chain' && target.index !== payload.index;
        default:
          return false;
      }
    },
    []
  );

  const onDrop = useCallback(
    (payload, target) => {
      const { tableau, pairs, chains } = stateRef.current;
      clearSelection();

      switch (payload.kind) {
        case 'card': {
          const from = topCardOf(tableau, payload.column);
          const to = topCardOf(tableau, target.index);
          if (to && canPair(from, to) && pairs.length < MAX_PAIRS) {
            act({ type: 'CREATE_PAIR', fromCol: payload.column, toCol: target.index }, `column:${target.index}`);
          } else {
            act({ type: 'MOVE_CARD', fromCol: payload.column, toCol: target.index }, `column:${target.index}`);
          }
          return;
        }
        case 'pair': {
          const landing = pairs[target.index];
          if (landing && canFormDomino(pairs[payload.index], landing)) {
            act({ type: 'CREATE_DOMINO', indexA: payload.index, indexB: target.index }, `pair:${target.index}`);
          } else {
            act({
              type: 'REORDER_PAIRS',
              fromIndex: payload.index,
              toIndex: Math.min(target.index, pairs.length - 1)
            });
          }
          return;
        }
        case 'domino': {
          if (target.kind === 'socket') {
            act(
              { type: 'ADD_TO_CHAIN', dominoIndex: payload.index, chainIndex: target.index, position: target.pos },
              `domino:${payload.index}`
            );
            setArmed(null);
            return;
          }
          if (target.kind === 'new-chain') {
            act({ type: 'NEW_CHAIN', dominoIndex: payload.index }, `domino:${payload.index}`);
            return;
          }
          const landing = visibleDominos[target.index];
          if (landing) {
            act({ type: 'REORDER_DOMINOS', fromIndex: payload.index, toIndex: landing.index });
          }
          return;
        }
        case 'chain': {
          if (canJoinChains(chains[payload.index], chains[target.index])) {
            act({ type: 'JOIN_CHAINS', indexA: payload.index, indexB: target.index }, `chain:${target.index}`);
          } else {
            act({ type: 'REORDER_CHAINS', fromIndex: payload.index, toIndex: target.index });
          }
          return;
        }
        default:
      }
    },
    [act, clearSelection, visibleDominos]
  );

  /* ------------------------------------------------------------- chrome -- */

  const startNewGame = useCallback(() => {
    act({ type: 'NEW_GAME', deck: shuffleDeck(createDeck()) });
    clearSelection();
    setArmed(null);
    setWinOpen(false);
    setConfirmOpen(false);
    wonRef.current = false;
  }, [act, clearSelection]);

  const requestNewGame = useCallback(() => {
    const fresh = state.moveCount === 0;
    if (fresh) startNewGame();
    else setConfirmOpen(true);
  }, [startNewGame, state.moveCount]);

  const modalOpen = useRef(false);
  modalOpen.current = helpOpen || winOpen || confirmOpen;

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.tagName === 'INPUT' || event.metaKey || event.ctrlKey) return;
      if (modalOpen.current) return; // the open sheet owns the keyboard
      if (event.key === 'Escape') {
        clearSelection();
        setArmed(null);
      }
      if (event.key === 'u' || event.key === 'U') act({ type: 'UNDO' });
      if (event.key === '?' || (event.key === 'h' && !event.repeat)) setHelpOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, clearSelection]);

  return (
    <DragProvider canDrop={canDrop} onDrop={onDrop}>
      <Backdrop />
      <div className="app">
        <TopBar
          stats={stats}
          canUndo={state.history.length > 0}
          soundOn={soundOn}
          onNewGame={requestNewGame}
          onUndo={() => {
            act({ type: 'UNDO' });
            clearSelection();
          }}
          onToggleSound={() => setSoundOn((on) => !on)}
          onHelp={() => setHelpOpen(true)}
        />

        <Board
          state={state}
          stats={stats}
          selectedColumn={selectedColumn}
          selectedPair={selectedPair}
          selectedChain={selectedChain}
          armed={armed}
          denied={denied}
          combinablePairs={combinablePairs}
          connectableDominos={connectableDominos}
          joinableChains={joinableChains}
          visibleDominos={visibleDominos}
          activateColumn={activateColumn}
          activatePair={activatePair}
          activateDomino={activateDomino}
          activateSocket={activateSocket}
          activateChain={activateChain}
        />
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <WinModal open={winOpen} moves={state.moveCount} onPlayAgain={startNewGame} />
      <ConfirmModal
        open={confirmOpen}
        title="Deal a new game?"
        body="This board — every pair, domino and chain on it — will be swept away."
        confirmLabel="Deal again"
        onConfirm={startNewGame}
        onCancel={() => setConfirmOpen(false)}
      />
    </DragProvider>
  );
}

/**
 * The board proper. Split out so it can read the drag context that App
 * provides, and so drag state re-renders stop at the board.
 */
function Board({
  state,
  stats,
  selectedColumn,
  selectedPair,
  selectedChain,
  armed,
  denied,
  combinablePairs,
  connectableDominos,
  joinableChains,
  visibleDominos,
  activateColumn,
  activatePair,
  activateDomino,
  activateSocket,
  activateChain
}) {
  const drag = useDrag();
  const dragging = drag.payload;
  const heldColumn = dragging?.kind === 'card' ? dragging.column : selectedColumn;

  const guard = (fn) => (...args) => {
    if (drag.wasDragging()) return;
    fn(...args);
  };

  const toneFor = (columnIndex) => {
    if (drag.isTarget('column', columnIndex)) {
      const from = topCardOf(state.tableau, dragging?.column);
      const to = topCardOf(state.tableau, columnIndex);
      return to && canPair(from, to) ? 'pair' : 'move';
    }
    if (dragging?.kind === 'card' && dragging.column !== columnIndex) {
      const from = topCardOf(state.tableau, dragging.column);
      const to = topCardOf(state.tableau, columnIndex);
      if (!to) return 'open';
      if (canPair(from, to) && state.pairs.length < MAX_PAIRS) return 'pair-hint';
      if (canStack(from, to)) return 'move-hint';
      return null;
    }
    if (selectedColumn === null || selectedColumn === columnIndex) return null;
    const from = topCardOf(state.tableau, selectedColumn);
    const to = topCardOf(state.tableau, columnIndex);
    if (!to) return 'open';
    if (canPair(from, to) && state.pairs.length < MAX_PAIRS) return 'pair';
    if (canStack(from, to)) return 'move';
    return null;
  };

  const socketTone = (chainIndex, pos) => {
    if (drag.isTarget('socket', chainIndex, pos)) return 'target';
    if (armed && armed.chainIndex === chainIndex && armed.pos === pos) return 'armed';
    if (dragging?.kind === 'domino') {
      const domino = state.dominos[dragging.index];
      if (domino && connects(domino, state.chains[chainIndex], pos)) return 'ready';
    }
    return null;
  };

  const onCardPointerDown = (event, columnIndex, card) => {
    drag.arm(event, { kind: 'card', column: columnIndex }, <Card card={card} ghost tone="held" />);
  };

  const onPairPointerDown = (event, index) => {
    const pair = state.pairs[index];
    drag.arm(
      event,
      { kind: 'pair', index },
      <span className="ghost-pair">
        {pair.map((card) => (
          <Chip key={card.id} card={card} ghost />
        ))}
        <span className="ghost-pair__label">{pretty(getPairLabel(pair))}</span>
      </span>
    );
  };

  const onDominoPointerDown = (event, index, position) => {
    drag.arm(event, { kind: 'domino', index, position }, <DominoTile domino={state.dominos[index]} ghost />);
  };

  const onChainPointerDown = (event, index) => {
    drag.arm(
      event,
      { kind: 'chain', index },
      <span className="ghost-chain">
        <span className="ghost-chain__title">Chain {index + 1}</span>
        <span className="ghost-chain__count">{state.chains[index].length} dominos</span>
      </span>
    );
  };

  const dominoHint =
    armed !== null
      ? `Pick a domino for the ${armed.pos === 'start' ? 'start' : 'end'} of chain ${armed.chainIndex + 1}`
      : 'two pairs · all four suits';

  return (
    <>
      <main className="stage">
        <Tableau
          tableau={state.tableau}
          selectedColumn={heldColumn}
          toneFor={toneFor}
          onColumnActivate={guard(activateColumn)}
          onCardPointerDown={onCardPointerDown}
          denied={denied}
        />

        <aside className="rail">
          <Panel
            title="Pairs"
            count={`${stats.pairs}/${MAX_PAIRS}`}
            hint="opposite colours, summing to fourteen"
            tone="pairs"
          >
            <PairSlots
              pairs={state.pairs}
              selected={selectedPair}
              combinable={combinablePairs}
              denied={denied}
              onActivate={guard(activatePair)}
              onPointerDown={onPairPointerDown}
            />
          </Panel>

          <Panel title="Dominos" count={stats.dominos} hint={dominoHint} tone="dominos" className="panel--grow">
            {visibleDominos.length ? (
              <DominoTray
                dominos={visibleDominos}
                connectable={connectableDominos}
                denied={denied}
                onActivate={guard(activateDomino)}
                onPointerDown={onDominoPointerDown}
              />
            ) : (
              <p className="empty">
                Forge a domino from two pairs that show <strong>all four suits</strong> between them.
              </p>
            )}
          </Panel>
        </aside>
      </main>

      <section className={cx('reef', state.chains.length === 0 && 'reef--quiet')}>
        <Panel
          title="Chains"
          count={state.chains.length ? `${stats.chained}/13` : undefined}
          hint="match a value at either end"
          tone="chains"
        >
          <ChainList
            chains={state.chains}
            selected={selectedChain}
            joinable={joinableChains}
            denied={denied}
            socketTone={socketTone}
            onSocket={guard(activateSocket)}
            onActivate={guard(activateChain)}
            onPointerDown={onChainPointerDown}
            newChainReady={drag.isTarget('new-chain', -1)}
          />
        </Panel>
      </section>
    </>
  );
}

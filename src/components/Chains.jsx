import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cx } from './Card.jsx';
import { DominoTile, pretty } from './Workyard.jsx';
import { useElementSize } from '../lib/hooks.js';
import { checkCircular, getChainEndValues } from '../game/rules.js';

/**
 * A chain reads left to right between two sockets. The sockets show the value
 * each end is hungry for — click one to arm it, then pick a domino, or simply
 * drag a domino onto it.
 *
 * Dominos are never shrunk to make a chain fit: a long chain wraps onto more
 * rows instead, and a return line carries the eye from the end of one row back
 * to the start of the next.
 */

const TAIL = 20; // room reserved on a row for the outgoing return line
const HEAD = 20; // room reserved at the start of a continued row

const buildUnits = (chain, ends) => [
  { key: 'socket-start', kind: 'socket', pos: 'start', value: ends.start },
  ...chain.map((domino) => ({ key: domino.id, kind: 'domino', domino })),
  { key: 'socket-end', kind: 'socket', pos: 'end', value: ends.end }
];

/** Natural sizes of the pieces, read straight off the rendered chain. */
const measure = (fit) => {
  const dominos = [...fit.querySelectorAll('.domino')];
  const sockets = [...fit.querySelectorAll('.socket')];
  const link = fit.querySelector('.chain__link');
  const row = fit.querySelector('.chain__row');
  const gap = row ? Number.parseFloat(getComputedStyle(row).columnGap) || 5 : 5;
  return {
    domino: dominos.length ? Math.max(...dominos.map((el) => el.offsetWidth)) : 92,
    socketStart: sockets[0]?.offsetWidth || 54,
    socketEnd: sockets[sockets.length - 1]?.offsetWidth || 54,
    link: link?.offsetWidth || 13,
    gap
  };
};

const separator = (previous, unit, sizes) =>
  sizes.gap + (previous.kind === 'domino' && unit.kind === 'domino' ? sizes.link + sizes.gap : 0);

const widthOf = (unit, sizes) =>
  unit.kind === 'domino' ? sizes.domino : unit.pos === 'start' ? sizes.socketStart : sizes.socketEnd;

/** Greedy packing: how many units belong on each row. */
const packRows = (units, available, sizes) => {
  let straight = 0;
  units.forEach((unit, index) => {
    straight += widthOf(unit, sizes);
    if (index > 0) straight += separator(units[index - 1], unit, sizes);
  });
  if (straight <= available) return [units.length];

  const rows = [];
  let count = 0;
  let used = 0;
  units.forEach((unit, index) => {
    const width = widthOf(unit, sizes);
    if (count === 0) {
      used = width;
      count = 1;
      return;
    }
    // Every row but the last spends room on its return line; every row but the
    // first spends room on the line arriving into it.
    const budget = available - TAIL - (rows.length > 0 ? HEAD : 0);
    const gap = separator(units[index - 1], unit, sizes);
    if (used + gap + width <= budget) {
      used += gap + width;
      count += 1;
    } else {
      rows.push(count);
      count = 1;
      used = width;
    }
  });
  if (count) rows.push(count);
  return rows;
};

function Chain({
  chain,
  index,
  selected,
  joinable,
  denied,
  socketTone,
  onSocket,
  onActivate,
  onPointerDown
}) {
  // A chain card always spans the panel, so this width is fixed by the layout
  // rather than by the chain's own contents — packing against it can't chase
  // its own tail, and the rows can never be wider than the card holding them.
  const [observeFit, fitSize] = useElementSize();
  const node = useRef(null);
  const fitRef = useCallback(
    (element) => {
      node.current = element;
      observeFit(element);
    },
    [observeFit]
  );
  const [rowSizes, setRowSizes] = useState(null);
  const signature = useRef('');

  const ends = getChainEndValues(chain);
  const circular = checkCircular(chain);
  const units = buildUnits(chain, ends);

  useLayoutEffect(() => {
    const fit = node.current;
    if (!fit || !fitSize.width) return;
    const next = packRows(units, fitSize.width, measure(fit));
    const stamp = next.join(',');
    if (stamp !== signature.current) {
      signature.current = stamp;
      setRowSizes(next);
    }
  });

  const rows = [];
  let cursor = 0;
  for (const count of rowSizes || [units.length]) {
    rows.push(units.slice(cursor, cursor + count));
    cursor += count;
  }
  if (cursor < units.length) rows.push(units.slice(cursor));

  return (
    <article
      className={cx(
        'chain',
        circular && 'chain--closed',
        selected && 'is-selected',
        joinable && 'is-joinable',
        denied && 'is-denied'
      )}
      data-drop-kind="chain"
      data-drop-index={index}
    >
      <header className="chain__head-row">
        <button
          type="button"
          className="chain__grip"
          onPointerDown={(event) => onPointerDown(event, index)}
          onClick={() => onActivate(index)}
          aria-pressed={selected}
        >
          <span className="chain__name">Chain {index + 1}</span>
          <span className="chain__count">
            {chain.length} <em>{chain.length === 1 ? 'domino' : 'dominos'}</em>
          </span>
        </button>
        {circular && (
          <span className="chain__badge">
            <span className="chain__badge-dot" aria-hidden="true" />
            closed loop
          </span>
        )}
      </header>

      <div className="chain__fit" ref={fitRef}>
        {rows.map((row, rowIndex) => (
          <Fragment key={`row-${rowIndex}`}>
            <div className="chain__row">
              {rowIndex > 0 && <span className="chain__return-in" aria-hidden="true" />}
              {row.map((unit, unitIndex) => (
                <Fragment key={unit.key}>
                  {unitIndex > 0 &&
                    unit.kind === 'domino' &&
                    row[unitIndex - 1].kind === 'domino' && (
                      <span className="chain__link" aria-hidden="true" />
                    )}
                  {unit.kind === 'socket' ? (
                    <Socket
                      chainIndex={index}
                      pos={unit.pos}
                      value={unit.value}
                      tone={socketTone(index, unit.pos)}
                      onSocket={onSocket}
                    />
                  ) : (
                    <DominoTile domino={unit.domino} compact />
                  )}
                </Fragment>
              ))}
              {rowIndex < rows.length - 1 && <span className="chain__return-out" aria-hidden="true" />}
            </div>
            {rowIndex < rows.length - 1 && <span className="chain__return-span" aria-hidden="true" />}
          </Fragment>
        ))}
      </div>
    </article>
  );
}

function Socket({ chainIndex, pos, value, tone, onSocket }) {
  return (
    <button
      type="button"
      className={cx('socket', `socket--${pos}`, tone && `is-${tone}`)}
      data-drop-kind="socket"
      data-drop-index={chainIndex}
      data-drop-pos={pos}
      onClick={(event) => {
        event.stopPropagation();
        onSocket(chainIndex, pos);
      }}
      aria-label={`${pos === 'start' ? 'Start' : 'End'} of chain ${chainIndex + 1}, wants ${pretty(value)}`}
      aria-pressed={tone === 'armed'}
    >
      <span className="socket__value">{pretty(value)}</span>
      <span className="socket__plus" aria-hidden="true">
        +
      </span>
    </button>
  );
}

export function ChainList({
  chains,
  selected,
  joinable,
  denied,
  socketTone,
  onSocket,
  onActivate,
  onPointerDown,
  newChainReady
}) {
  if (!chains.length) {
    return (
      <div className={cx('chain-empty', newChainReady && 'is-ready')} data-drop-kind="new-chain" data-drop-index={-1}>
        <span className="chain-empty__rune" aria-hidden="true" />
        <p>
          Tap a domino to lay the first stone.
          <em>Chains are permanent — choose the opening well.</em>
        </p>
      </div>
    );
  }

  return (
    <div className="chains">
      {chains.map((chain, index) => (
        <Chain
          key={`chain-${index}`}
          chain={chain}
          index={index}
          selected={selected === index}
          joinable={joinable.has(index)}
          denied={denied === `chain:${index}`}
          socketTone={socketTone}
          onSocket={onSocket}
          onActivate={onActivate}
          onPointerDown={onPointerDown}
        />
      ))}
      <div className={cx('chain-new', newChainReady && 'is-ready')} data-drop-kind="new-chain" data-drop-index={-1}>
        <span aria-hidden="true">+</span>
        <p>Drop a domino here to start another chain</p>
      </div>
    </div>
  );
}

import { Fragment } from 'react';
import { cx } from './Card.jsx';
import { DominoTile, pretty } from './Workyard.jsx';
import { useFitScale } from '../lib/hooks.js';
import { checkCircular, getChainEndValues } from '../game/rules.js';

/**
 * A chain reads left to right between two sockets. The sockets show the value
 * each end is hungry for — click one to arm it, then pick a domino, or simply
 * drag a domino onto it.
 */
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
  const [outerRef, innerRef, fit] = useFitScale(0.44, [chain.length]);
  const ends = getChainEndValues(chain);
  const circular = checkCircular(chain);

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
      <header className="chain__head">
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

      <div className="chain__fit" ref={outerRef} style={fit.height ? { height: fit.height } : undefined}>
        <div className="chain__track" ref={innerRef} style={{ transform: `scale(${fit.scale})` }}>
          <Socket
            chainIndex={index}
            pos="start"
            value={ends.start}
            tone={socketTone(index, 'start')}
            onSocket={onSocket}
          />
          {chain.map((domino, position) => (
            <Fragment key={domino.id}>
              {position > 0 && <span className="chain__link" aria-hidden="true" />}
              <DominoTile domino={domino} compact />
            </Fragment>
          ))}
          <Socket
            chainIndex={index}
            pos="end"
            value={ends.end}
            tone={socketTone(index, 'end')}
            onSocket={onSocket}
          />
        </div>
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

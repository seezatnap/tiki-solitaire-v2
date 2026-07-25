import { Chip, cx } from './Card.jsx';
import { MAX_PAIRS, getPairLabel, orientedHalves } from '../game/rules.js';

export const pretty = (value) => String(value).replace('-', '–');

/* ---------------------------------------------------------------- pairs -- */

export function PairSlots({ pairs, selected, combinable, denied, onActivate, onPointerDown }) {
  return (
    <div className="slots">
      {Array.from({ length: MAX_PAIRS }).map((_, index) => {
        const pair = pairs[index];
        if (!pair) {
          return (
            <div key={`slot-${index}`} className="slot slot--empty" data-drop-kind="pair" data-drop-index={index}>
              <span className="slot__rune" aria-hidden="true" />
            </div>
          );
        }

        const label = getPairLabel(pair);
        return (
          <div
            key={`slot-${index}`}
            className={cx(
              'slot',
              'slot--filled',
              selected === index && 'is-selected',
              combinable.has(index) && 'is-ready',
              denied === `pair:${index}` && 'is-denied'
            )}
            data-drop-kind="pair"
            data-drop-index={index}
          >
            <button
              type="button"
              className="slot__grip"
              onPointerDown={(event) => onPointerDown(event, index)}
              onClick={() => onActivate(index)}
              aria-label={`Pair ${pretty(label)}`}
              aria-pressed={selected === index}
            >
              <span className="slot__cards">
                {pair.map((card) => (
                  <Chip key={card.id} card={card} />
                ))}
              </span>
              <span className="slot__label">{pretty(label)}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- dominos -- */

function DominoHalf({ pair, label, ghost }) {
  return (
    <span className="domino__half">
      <span className="domino__cards">
        {pair.map((card) => (
          <Chip key={card.id} card={card} ghost={ghost} />
        ))}
      </span>
      <span className="domino__label">{pretty(label)}</span>
    </span>
  );
}

export function DominoTile({ domino, compact = false, ghost = false, className }) {
  const { pairs, values } = orientedHalves(domino);
  return (
    <span
      className={cx('domino', compact && 'domino--compact', className)}
      data-flip={ghost ? undefined : `dom:${domino.id}`}
    >
      <DominoHalf pair={pairs[0]} label={values[0]} ghost={ghost} />
      <span className="domino__spine" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <DominoHalf pair={pairs[1]} label={values[1]} ghost={ghost} />
    </span>
  );
}

export function DominoTray({ dominos, connectable, denied, onActivate, onPointerDown }) {
  return (
    <div className="tray" data-drop-kind="tray" data-drop-index={-1}>
      {dominos.map(({ domino, index }, position) => (
        <div
          key={domino.id}
          className={cx(
            'tray__item',
            connectable.has(index) && 'is-connectable',
            denied === `domino:${index}` && 'is-denied'
          )}
          data-drop-kind="domino"
          data-drop-index={position}
        >
          <button
            type="button"
            className="tray__grip"
            onPointerDown={(event) => onPointerDown(event, index, position)}
            onClick={() => onActivate(index)}
            aria-label={`Domino ${pretty(domino.value1)} and ${pretty(domino.value2)}`}
          >
            <DominoTile domino={domino} />
          </button>
        </div>
      ))}
    </div>
  );
}

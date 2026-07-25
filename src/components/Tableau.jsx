import { useMemo } from 'react';
import { Card, cx } from './Card.jsx';
import { useElementSize, useMediaQuery } from '../lib/hooks.js';
import { COLUMN_COUNT } from '../game/rules.js';

const clamp = (min, value, max) => Math.max(min, Math.min(max, value));

// Keep in step with the flow-layout breakpoint in game.css.
const FLOWING = '(max-width: 700px)';

/**
 * The eight columns. Card size is derived from the measured width so all eight
 * always fit — no horizontal scrolling at any viewport. When a column grows
 * tall, the whole tableau tightens its overlap rather than overflowing.
 */
export function Tableau({ tableau, selectedColumn, toneFor, onColumnActivate, onCardPointerDown, denied }) {
  const [paneRef, size] = useElementSize();
  // Where the page flows, the table takes the height it needs and pushes the
  // rest down; elsewhere it lives inside a fixed frame and has to fit.
  const flowing = useMediaQuery(FLOWING);

  const metrics = useMemo(() => {
    const width = size.width || 900;
    const height = size.height || 460;
    const gap = clamp(5, width * 0.014, 14);
    const byWidth = (width - gap * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
    // In a fixed frame, a short pane means smaller cards so more of each
    // column stays legible. In flow, the cards simply take the width.
    const byHeight = flowing ? Infinity : Math.max(44, (height * 0.44) / 1.42);
    const cardW = Math.max(26, Math.min(byWidth, byHeight, 104));
    const cardH = cardW * 1.42;
    const tallest = tableau.reduce((max, column) => Math.max(max, column.length), 0);
    const roomy = cardH * 0.34;
    const tight = cardH * 0.15;
    const fitting = flowing || tallest < 2 ? roomy : (height - cardH - 8) / (tallest - 1);
    return { gap, cardW, cardH, stack: clamp(tight, fitting, roomy) };
  }, [size.width, size.height, tableau, flowing]);

  return (
    <section className="tableau" aria-label="Tableau">
      <div className="tableau__pane" ref={paneRef}>
        <div
          className="tableau__grid"
          style={{
            '--card-w': `${metrics.cardW}px`,
            '--card-h': `${metrics.cardH}px`,
            '--stack': `${metrics.stack}px`,
            '--col-gap': `${metrics.gap}px`
          }}
        >
          {tableau.map((column, columnIndex) => {
            const tone = toneFor(columnIndex);
            const empty = column.length === 0;
            // While a card is in hand, everything it can't reach steps back.
            const idle = selectedColumn !== null && selectedColumn !== columnIndex && !tone;
            const height = empty ? metrics.cardH : (column.length - 1) * metrics.stack + metrics.cardH;

            return (
              <div
                key={`column-${columnIndex}`}
                className={cx(
                  'column',
                  empty && 'column--empty',
                  tone && `column--${tone}`,
                  idle && 'column--idle',
                  selectedColumn === columnIndex && 'column--source',
                  denied === `column:${columnIndex}` && 'is-denied'
                )}
                style={{ height: `${height}px` }}
                data-drop-kind="column"
                data-drop-index={columnIndex}
              >
                <button
                  type="button"
                  className="column__slot"
                  onClick={() => onColumnActivate(columnIndex)}
                  aria-label={
                    empty
                      ? `Empty column ${columnIndex + 1}`
                      : `Column ${columnIndex + 1}, ${column.length} cards`
                  }
                >
                  <span className="column__rune" aria-hidden="true" />
                </button>

                {column.map((card, cardIndex) => {
                  const isTop = cardIndex === column.length - 1;
                  return (
                    <Card
                      key={card.id}
                      card={card}
                      tone={
                        selectedColumn === columnIndex && isTop
                          ? 'held'
                          : isTop && tone
                            ? tone
                            : 'idle'
                      }
                      className={cx('card--stacked', isTop && 'card--top')}
                      style={{ top: `${cardIndex * metrics.stack}px`, zIndex: cardIndex + 1 }}
                      role={isTop ? 'button' : undefined}
                      tabIndex={isTop ? 0 : undefined}
                      aria-label={isTop ? `${card.rank} of ${card.suit}` : undefined}
                      onPointerDown={isTop ? (event) => onCardPointerDown(event, columnIndex, card) : undefined}
                      onClick={isTop ? () => onColumnActivate(columnIndex) : undefined}
                      onKeyDown={
                        isTop
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onColumnActivate(columnIndex);
                              }
                            }
                          : undefined
                      }
                    />
                  );
                })}

                {tone === 'pair' && (
                  <span className="column__badge" aria-hidden="true">
                    14
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

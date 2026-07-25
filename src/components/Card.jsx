import { RANK_VALUES } from '../game/rules.js';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const COURT = new Set(['J', 'Q', 'K']);

/** A carved mask, used where a court card would normally wear a portrait. */
export function TikiMask({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 62" aria-hidden="true" focusable="false">
      <path
        d="M24 2c-9 0-14.4 4.4-14.4 12 0 3.6.5 6.8 1.2 9.7-2 .9-3 2-3 3.2 0 1.4 1.2 2.6 3.6 3.5 1.1 5.7 2.1 11.2 2.8 17.3.6 5 4.6 7.6 9.8 7.6s9.2-2.6 9.8-7.6c.7-6.1 1.7-11.6 2.8-17.3 2.4-.9 3.6-2.1 3.6-3.5 0-1.2-1-2.3-3-3.2.7-2.9 1.2-6.1 1.2-9.7C38.4 6.4 33 2 24 2Z"
        className="mask-shell"
      />
      <g className="mask-lines">
        {/* brow */}
        <path d="M10.6 20.4h26.8" strokeWidth="3.4" />
        {/* eyes */}
        <path d="M13.4 26.6c1.6-2.6 5-2.6 6.6 0-1.6 2.6-5 2.6-6.6 0Z" />
        <path d="M28 26.6c1.6-2.6 5-2.6 6.6 0-1.6 2.6-5 2.6-6.6 0Z" />
        {/* nose */}
        <path d="M24 23.4v9.2l-3.4 2.6h6.8L24 32.6" />
        {/* mouth */}
        <path d="M15.4 41.6h17.2" strokeWidth="2.6" />
        <path d="M15.4 41.6c5.6 6 11.6 6 17.2 0" />
      </g>
      <g className="mask-rays">
        <path d="M15.5 13.4 24 8.2l8.5 5.2" />
      </g>
    </svg>
  );
}

/**
 * A tableau card. `flipId` ties this element to the same card rendered as a
 * chip elsewhere, so the card animates continuously between the two.
 */
export function Card({ card, tone = 'idle', ghost = false, style, className, ...rest }) {
  const court = COURT.has(card.rank);
  return (
    <div
      {...rest}
      style={style}
      data-flip={ghost ? undefined : card.id}
      data-suit={card.suit}
      className={cx('card', card.isRed ? 'card--red' : 'card--black', `is-${tone}`, className)}
    >
      <span className="card__head">
        <span className="card__rank">{card.rank}</span>
        <span className="card__pip">{card.suit}</span>
        {/* Only the cards whose worth isn't written on their face need telling. */}
        {(court || card.rank === 'A') && (
          <span className="card__value" aria-hidden="true">
            {RANK_VALUES[card.rank]}
          </span>
        )}
      </span>
      <span className="card__mark">
        {court ? <TikiMask className="card__mask" /> : <span className="card__glyph">{card.suit}</span>}
      </span>
      <span className="card__foot">
        <span className="card__rank">{card.rank}</span>
        <span className="card__pip">{card.suit}</span>
      </span>
    </div>
  );
}

/** The card at workyard scale: rank over suit, nothing else. */
export function Chip({ card, ghost = false, className }) {
  return (
    <span
      data-flip={ghost ? undefined : card.id}
      className={cx('chip', card.isRed ? 'chip--red' : 'chip--black', className)}
    >
      <span className="chip__rank">{card.rank}</span>
      <span className="chip__suit">{card.suit}</span>
    </span>
  );
}

import { useEffect, useRef } from 'react';
import { cx } from './Card.jsx';
import { DOMINOS_TO_WIN } from '../game/rules.js';

/* ------------------------------------------------------------- backdrop -- */

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__glow backdrop__glow--dawn" />
      <div className="backdrop__glow backdrop__glow--ember" />
      <div className="backdrop__glow backdrop__glow--lagoon" />
      <div className="backdrop__tapa" />
      <div className="backdrop__grain" />
    </div>
  );
}

/* --------------------------------------------------------------- topbar -- */

function Mark() {
  return (
    <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M20 3c-6.6 0-10.5 3.4-10.5 9.2 0 2.8.4 5.2 1 7.4-1.6.7-2.4 1.6-2.4 2.6s1 1.9 2.9 2.7c.8 4.2 1.7 8.4 2.4 13.4h13.2c.7-5 1.6-9.2 2.4-13.4 1.9-.8 2.9-1.7 2.9-2.7s-.8-1.9-2.4-2.6c.6-2.2 1-4.6 1-7.4C30.5 6.4 26.6 3 20 3Z"
        className="brand__shell"
      />
      <g className="brand__lines">
        <path d="M10.8 15.6h18.4" strokeWidth="2.6" />
        <path d="M13.4 20.2c1.1-1.9 3.5-1.9 4.6 0-1.1 1.9-3.5 1.9-4.6 0Z" />
        <path d="M22 20.2c1.1-1.9 3.5-1.9 4.6 0-1.1 1.9-3.5 1.9-4.6 0Z" />
        <path d="M20 18v6.6l-2.4 1.8h4.8L20 24.6" />
        <path d="M14.6 30.4c3.6 3.6 7.2 3.6 10.8 0" />
      </g>
    </svg>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={cx('stat', accent && 'stat--accent')}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export function TopBar({ stats, canUndo, soundOn, onNewGame, onUndo, onToggleSound, onHelp }) {
  const progress = Math.min(1, stats.chained / DOMINOS_TO_WIN);

  return (
    <header className="topbar">
      <div className="brand">
        <Mark />
        <h1>
          Tiki <span>Solitaire</span>
        </h1>
      </div>

      <div className="stats" role="status" aria-live="polite">
        <Stat label="moves" value={stats.moves} />
        <Stat label="on board" value={stats.tableau} />
        <Stat label="pairs" value={`${stats.pairs}/6`} />
        <Stat label="dominos" value={stats.dominos} />
        <Stat label="chained" value={`${stats.chained}/${DOMINOS_TO_WIN}`} accent />
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={onUndo} disabled={!canUndo} title="Undo the last move">
          <Icon name="undo" />
          <span>Undo</span>
        </button>
        <button type="button" className="btn" onClick={onNewGame} title="Deal a new game">
          <Icon name="deal" />
          <span>New</span>
        </button>
        <button
          type="button"
          className={cx('btn', 'btn--icon', !soundOn && 'is-off')}
          onClick={onToggleSound}
          aria-pressed={soundOn}
          title={soundOn ? 'Mute' : 'Unmute'}
        >
          <Icon name={soundOn ? 'sound' : 'muted'} />
        </button>
        <button type="button" className="btn btn--icon" onClick={onHelp} title="How to play">
          <Icon name="help" />
        </button>
      </div>

      <div className="topbar__progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </header>
  );
}

function Icon({ name }) {
  const paths = {
    undo: <path d="M4 9h9a5 5 0 1 1 0 10H8M4 9l4-4M4 9l4 4" />,
    deal: (
      <>
        <rect x="3.2" y="6" width="11" height="14" rx="2.2" transform="rotate(-8 8.7 13)" />
        <rect x="9.6" y="4.6" width="11" height="14" rx="2.2" transform="rotate(8 15.1 11.6)" />
      </>
    ),
    sound: (
      <>
        <path d="M5 9.5h3.2L13 5.5v13l-4.8-4H5z" />
        <path d="M16.4 8.6a5.2 5.2 0 0 1 0 6.8M18.9 6a8.6 8.6 0 0 1 0 12" />
      </>
    ),
    muted: (
      <>
        <path d="M5 9.5h3.2L13 5.5v13l-4.8-4H5z" />
        <path d="M16.6 9.4l4.8 5.2M21.4 9.4l-4.8 5.2" />
      </>
    ),
    help: (
      <>
        <path d="M9 9a3 3 0 1 1 4.2 2.8c-.9.4-1.2 1-1.2 2v.4" />
        <circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none" />
      </>
    )
  };
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/* --------------------------------------------------------------- panels -- */

export function Panel({ title, count, hint, tone, children, className }) {
  return (
    <section className={cx('panel', tone && `panel--${tone}`, className)}>
      <div className="panel__head">
        <h2>
          {title}
          {count !== undefined && <span className="panel__count">{count}</span>}
        </h2>
        {hint && <p className="panel__hint">{hint}</p>}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

/* --------------------------------------------------------------- modals -- */

export function Modal({ open, onClose, labelledBy, children, className }) {
  const ref = useRef(null);
  // Held in a ref so a re-render mid-keypress can't tear down the listener
  // before the event reaches it.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="scrim"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {/* The shell holds the frame and never scrolls, so its hairline border
          stays on the edges; the content scrolls inside it. */}
      <div
        className={cx('sheet', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        ref={ref}
      >
        {onClose && (
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
        <div className="sheet__scroll">{children}</div>
      </div>
    </div>
  );
}

const Suit = ({ s }) => (
  <span className={s === '♥' || s === '♦' ? 'suit suit--red' : 'suit'}>{s}</span>
);

export function HelpModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="help-title" className="sheet--help">
      <h2 id="help-title">How to play</h2>
      <p className="sheet__lede">
        Everything in Tiki Solitaire is built out of <strong>fourteen</strong>. Pair to fourteen, forge
        pairs into dominos, then chain the dominos into one closed loop.
      </p>

      <div className="rules">
        <section>
          <h3>
            <span className="rules__num">1</span> Move cards
          </h3>
          <ul>
            <li>Only the top card of a column moves.</li>
            <li>It may land on a card of the same rank, or one that sums to fourteen.</li>
            <li>Any card may take an empty column.</li>
            <li>A = 1, J = 11, Q = 12, K = 13.</li>
          </ul>
        </section>

        <section>
          <h3>
            <span className="rules__num">2</span> Make pairs
          </h3>
          <ul>
            <li>Two top cards that sum to fourteen and are opposite colours become a pair.</li>
            <li>A+K, 2+Q, 3+J, 4+10, 5+9, 6+8, 7+7.</li>
            <li>The workyard holds six pairs at a time. Pairs never go back.</li>
          </ul>
        </section>

        <section>
          <h3>
            <span className="rules__num">3</span> Forge dominos
          </h3>
          <ul>
            <li>Two pairs forge a domino when between them they show all four suits.</li>
            <li>
              Their values don't have to match: 3<Suit s="♥" />+J<Suit s="♣" /> with 5
              <Suit s="♦" />+9<Suit s="♠" /> is fine.
            </li>
            <li>
              A<Suit s="♥" />+K<Suit s="♣" /> with 2<Suit s="♥" />+Q<Suit s="♣" /> is not — no
              diamonds, no spades.
            </li>
          </ul>
        </section>

        <section>
          <h3>
            <span className="rules__num">4</span> Build chains
          </h3>
          <ul>
            <li>Tap a domino to start a new chain with it.</li>
            <li>Drag a domino onto either socket of a chain to extend it, or tap the socket first and
              then tap the domino.</li>
            <li>Dominos join where their values match; they flip themselves to fit.</li>
            <li>To splice two chains, drag one onto the socket where you want it to
              join — or tap it, then tap that socket. Which end meets which is your
              choice, not the game's.</li>
            <li><strong>Chains are permanent.</strong> Nothing comes back out.</li>
          </ul>
        </section>
      </div>

      <p className="sheet__foot">
        <strong>Perfect game:</strong> all thirteen dominos in a single closed loop — fifty-two cards,
        both ends meeting.
      </p>
    </Modal>
  );
}

export function WinModal({ open, moves, onPlayAgain }) {
  return (
    <Modal open={open} labelledBy="win-title" className="sheet--win">
      <Confetti />
      <span className="sheet__crest" aria-hidden="true">
        <Mark />
      </span>
      <h2 id="win-title">The circle closes</h2>
      <p className="sheet__lede">
        Fifty-two cards, thirteen dominos, one unbroken loop. That is the perfect game.
      </p>
      <div className="win-stats">
        <div>
          <strong>{DOMINOS_TO_WIN}</strong>
          <span>dominos</span>
        </div>
        <div>
          <strong>52</strong>
          <span>cards</span>
        </div>
        <div>
          <strong>{moves}</strong>
          <span>moves</span>
        </div>
      </div>
      <button type="button" className="btn btn--primary" onClick={onPlayAgain}>
        Deal again
      </button>
    </Modal>
  );
}

export function ConfirmModal({ open, title, body, confirmLabel, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-title" className="sheet--confirm">
      <h2 id="confirm-title">{title}</h2>
      <p className="sheet__lede">{body}</p>
      <div className="sheet__row">
        <button type="button" className="btn" onClick={onCancel}>
          Keep playing
        </button>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function Confetti() {
  const bits = Array.from({ length: 28 }, (_, i) => i);
  const suits = ['♥', '♦', '♣', '♠'];
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((i) => (
        <span
          key={i}
          className={cx('confetti__bit', i % 2 ? 'confetti__bit--red' : 'confetti__bit--gold')}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 9) * 0.28}s`,
            animationDuration: `${3.4 + (i % 5) * 0.6}s`
          }}
        >
          {suits[i % 4]}
        </span>
      ))}
    </div>
  );
}

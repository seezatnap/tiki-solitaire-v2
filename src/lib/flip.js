/**
 * Continuous card identity.
 *
 * Every element carrying `data-flip="<id>"` is measured just before a state
 * change and animated from its old box to its new one just after. Because a
 * tableau card, a chip in a pair, a chip in a domino and a chip in a chain all
 * share the card's id, a single card glides — and shrinks — through its whole
 * journey across four completely different components.
 */

const DURATION = 420;
const EASING = 'cubic-bezier(0.22, 0.9, 0.28, 1)';

let pending = null;

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const measure = () => {
  const boxes = new Map();
  if (typeof document === 'undefined') return boxes;
  document.querySelectorAll('[data-flip]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) boxes.set(el.dataset.flip, rect);
  });
  return boxes;
};

/** Snapshot the board. Call immediately before dispatching a state change. */
export const captureRects = () => {
  if (reducedMotion()) return;
  pending = measure();
};

/** Animate everything that moved. Call in a layout effect after the commit. */
export const playFlips = () => {
  if (!pending) return;
  const before = pending;
  pending = null;
  if (typeof document === 'undefined' || !el_animateSupported()) return;

  const moved = [];
  document.querySelectorAll('[data-flip]').forEach((el) => {
    const from = before.get(el.dataset.flip);
    if (!from) return;
    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return;

    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const sx = from.width / to.width;
    const sy = from.height / to.height;

    const still =
      Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01;
    if (still) return;

    moved.push({ el, dx, dy, sx, sy });
  });

  // A domino tile and the chips inside it both carry an id. When the whole tile
  // is already flying, its chips must sit still or they'd travel twice.
  moved
    .filter(({ el }) => !moved.some((other) => other.el !== el && other.el.contains(el)))
    .forEach(({ el, dx, dy, sx, sy }) => {
      el.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
            zIndex: 90
          },
          { transformOrigin: 'top left', transform: 'none', zIndex: 90 }
        ],
        { duration: DURATION, easing: EASING }
      );
    });
};

const el_animateSupported = () => typeof Element !== 'undefined' && 'animate' in Element.prototype;

/** Drop a snapshot without playing it (e.g. after a resize). */
export const forgetRects = () => {
  pending = null;
};

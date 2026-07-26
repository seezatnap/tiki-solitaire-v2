import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * One drag system for mouse, pen and touch.
 *
 * Sources call `arm()` on pointerdown. What happens next depends on the device:
 *
 *  - Mouse and pen wake the drag as soon as the pointer has travelled further
 *    than a click would.
 *  - Touch waits for a short hold. Moving before that hold is a scroll, and the
 *    session is dropped so the page keeps it. Once the hold passes, the drag
 *    takes the gesture over and blocks scrolling outright — which is what stops
 *    a page scroll from tearing a drag away half-finished.
 *
 * While a drag is live the page auto-scrolls near the edges, so a domino can
 * reach a chain that started off screen.
 *
 * Targets are plain DOM nodes tagged `data-drop-kind` / `data-drop-index` /
 * `data-drop-pos`, so any component can become droppable without wiring
 * handlers through props.
 */

const DragContext = createContext(null);

const MOUSE_SLOP = 6; // movement that means "this is a drag, not a click"
const TOUCH_HOLD = 170; // ms of stillness before touch hands the gesture over
const TOUCH_SLOP = 10; // movement inside that window means "I meant to scroll"
const CLICK_GRACE = 240;
const EDGE = 68; // how close to the edge auto-scroll begins

const readTarget = (element) => ({
  kind: element.dataset.dropKind,
  index: element.dataset.dropIndex === undefined ? null : Number(element.dataset.dropIndex),
  pos: element.dataset.dropPos || null
});

export function DragProvider({ canDrop, onDrop, children }) {
  const [drag, setDrag] = useState(null); // { payload, ghost, target } — re-renders only on target change
  const session = useRef(null);
  const ghostRef = useRef(null);
  const point = useRef({ x: 0, y: 0 });
  const endedAt = useRef(0);
  const scrolling = useRef(null);

  const rules = useRef({ canDrop, onDrop });
  rules.current = { canDrop, onDrop };

  const findTarget = useCallback((x, y, payload) => {
    if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
    for (const element of document.elementsFromPoint(x, y)) {
      if (!element.dataset?.dropKind) continue;
      const target = readTarget(element);
      if (rules.current.canDrop?.(payload, target)) return target;
    }
    return null;
  }, []);

  const paintGhost = useCallback(() => {
    const node = ghostRef.current;
    const live = session.current;
    if (!node || !live) return;
    const x = point.current.x - live.grabX;
    const y = point.current.y - live.grabY;
    node.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${live.tilt}deg) scale(1.04)`;
  }, []);

  const aim = useCallback(() => {
    const live = session.current;
    if (!live?.active) return;
    const target = findTarget(point.current.x, point.current.y, live.payload);
    const same =
      (!target && !live.target) ||
      (target &&
        live.target &&
        target.kind === live.target.kind &&
        target.index === live.target.index &&
        target.pos === live.target.pos);
    if (!same) {
      live.target = target;
      setDrag((prev) => (prev ? { ...prev, target } : prev));
    }
  }, [findTarget]);

  // Touch scrolling is the browser's until a drag actually starts; from then on
  // it is ours, or the page slides out from under the card mid-drag.
  const blockScroll = useCallback((event) => {
    if (session.current?.active) event.preventDefault();
  }, []);

  const roll = useCallback(() => {
    const live = session.current;
    if (!live?.active) {
      scrolling.current = null;
      return;
    }
    const y = point.current.y;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (room > 1) {
      let step = 0;
      if (y < EDGE) step = -Math.ceil((EDGE - y) / 3);
      else if (y > window.innerHeight - EDGE) step = Math.ceil((y - (window.innerHeight - EDGE)) / 3);
      if (step) {
        const before = window.scrollY;
        window.scrollBy(0, step);
        if (window.scrollY !== before) aim(); // the board moved under a still finger
      }
    }
    scrolling.current = requestAnimationFrame(roll);
  }, [aim]);

  const activate = useCallback(() => {
    const live = session.current;
    if (!live || live.active) return;
    live.active = true;
    window.clearTimeout(live.hold);
    document.body.classList.add('is-dragging');
    try {
      live.source?.setPointerCapture?.(live.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    if (live.touch) navigator.vibrate?.(8);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    scrolling.current = requestAnimationFrame(roll);
    setDrag({ payload: live.payload, ghost: live.ghost, target: null });
    paintGhost();
  }, [blockScroll, paintGhost, roll]);

  const finish = useCallback(() => {
    const live = session.current;
    if (live) {
      window.clearTimeout(live.hold);
      try {
        live.source?.releasePointerCapture?.(live.pointerId);
      } catch {
        /* already gone */
      }
    }
    window.removeEventListener('touchmove', blockScroll);
    if (scrolling.current) cancelAnimationFrame(scrolling.current);
    scrolling.current = null;
    session.current = null;
    endedAt.current = Date.now();
    document.body.classList.remove('is-dragging');
    setDrag(null);
  }, [blockScroll]);

  const arm = useCallback(
    (event, payload, ghost, options = {}) => {
      if (event.button !== undefined && event.button !== 0) return;
      const source = event.currentTarget;
      const rect = source.getBoundingClientRect();
      const touch = event.pointerType === 'touch';
      point.current = { x: event.clientX, y: event.clientY };
      session.current = {
        pointerId: event.pointerId,
        source,
        touch,
        payload,
        ghost,
        startX: event.clientX,
        startY: event.clientY,
        grabX: event.clientX - rect.left,
        grabY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        tilt: options.tilt ?? -3,
        active: false,
        target: null,
        hold: touch ? window.setTimeout(activate, TOUCH_HOLD) : null
      };
    },
    [activate]
  );

  useEffect(() => {
    const move = (event) => {
      const live = session.current;
      if (!live || (live.pointerId !== undefined && event.pointerId !== live.pointerId)) return;
      point.current = { x: event.clientX, y: event.clientY };

      if (!live.active) {
        const travelled = Math.hypot(event.clientX - live.startX, event.clientY - live.startY);
        if (live.touch) {
          // Moved before the hold elapsed: the player is scrolling, not dragging.
          if (travelled > TOUCH_SLOP) {
            window.clearTimeout(live.hold);
            session.current = null;
          }
          return;
        }
        if (travelled < MOUSE_SLOP) return;
        activate();
      }

      paintGhost();
      aim();
    };

    const up = (event) => {
      const live = session.current;
      if (!live) return;
      if (live.active) {
        const target = findTarget(event.clientX, event.clientY, live.payload);
        if (target) rules.current.onDrop?.(live.payload, target);
        finish();
      } else {
        window.clearTimeout(live.hold);
        session.current = null;
      }
    };

    const cancel = () => {
      if (session.current?.active) finish();
      else if (session.current) {
        window.clearTimeout(session.current.hold);
        session.current = null;
      }
    };

    const key = (event) => {
      if (event.key === 'Escape') cancel();
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [activate, aim, findTarget, finish, paintGhost]);

  useEffect(() => () => finish(), [finish]);

  const isTarget = useCallback(
    (kind, index, pos = null) =>
      Boolean(
        drag?.target &&
          drag.target.kind === kind &&
          drag.target.index === index &&
          (pos === null || drag.target.pos === pos)
      ),
    [drag]
  );

  /** True just after a drag, so a released drag doesn't also fire a click. */
  const wasDragging = useCallback(() => Date.now() - endedAt.current < CLICK_GRACE, []);

  const value = useMemo(
    () => ({ arm, payload: drag?.payload || null, target: drag?.target || null, isTarget, wasDragging }),
    [arm, drag, isTarget, wasDragging]
  );

  return (
    <DragContext.Provider value={value}>
      {children}
      {drag ? <DragGhost ghostRef={ghostRef} session={session} paint={paintGhost} node={drag.ghost} /> : null}
    </DragContext.Provider>
  );
}

function DragGhost({ ghostRef, session, paint, node }) {
  useEffect(() => {
    paint();
  }, [paint]);

  const live = session.current;
  if (typeof document === 'undefined' || !live) return null;

  return createPortal(
    <div className="drag-layer" aria-hidden="true">
      <div
        className="drag-ghost"
        ref={ghostRef}
        style={{
          width: live.width,
          height: live.height,
          // The ghost lives in a portal, so it carries its own card metrics.
          '--card-w': `${live.width}px`,
          '--card-h': `${live.height}px`
        }}
      >
        {node}
      </div>
    </div>,
    document.body
  );
}

export const useDrag = () => useContext(DragContext);

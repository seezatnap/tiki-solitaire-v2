import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * One drag system for mouse, pen and touch.
 *
 * Sources call `arm()` on pointerdown; the drag only wakes up once the pointer
 * has travelled far enough that it can't be a click. Targets are plain DOM
 * nodes tagged with `data-drop-kind` / `data-drop-index` / `data-drop-pos`, so
 * any component can become droppable without wiring handlers through props.
 *
 * Touch scrolling is left to the browser: draggable surfaces declare which axis
 * belongs to the page (`touch-action: pan-y` and friends) and the browser hands
 * us the other one.
 */

const DragContext = createContext(null);

const THRESHOLD = 6;
const CLICK_GRACE = 240;

const readTarget = (element) => ({
  kind: element.dataset.dropKind,
  index: element.dataset.dropIndex === undefined ? null : Number(element.dataset.dropIndex),
  pos: element.dataset.dropPos || null
});

export function DragProvider({ canDrop, onDrop, children }) {
  const [drag, setDrag] = useState(null); // { payload, ghost, target } — only re-renders on target change
  const session = useRef(null);
  const ghostRef = useRef(null);
  const point = useRef({ x: 0, y: 0 });
  const endedAt = useRef(0);

  const rules = useRef({ canDrop, onDrop });
  rules.current = { canDrop, onDrop };

  const findTarget = useCallback((x, y, payload) => {
    if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
    const stack = document.elementsFromPoint(x, y);
    for (const element of stack) {
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

  const finish = useCallback(() => {
    session.current = null;
    endedAt.current = Date.now();
    document.body.classList.remove('is-dragging');
    setDrag(null);
  }, []);

  const arm = useCallback((event, payload, ghost, options = {}) => {
    if (event.button !== undefined && event.button !== 0) return;
    const source = event.currentTarget;
    const rect = source.getBoundingClientRect();
    point.current = { x: event.clientX, y: event.clientY };
    session.current = {
      pointerId: event.pointerId,
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
      target: null
    };
  }, []);

  useEffect(() => {
    const move = (event) => {
      const live = session.current;
      if (!live || (live.pointerId !== undefined && event.pointerId !== live.pointerId)) return;
      point.current = { x: event.clientX, y: event.clientY };

      if (!live.active) {
        const travelled = Math.hypot(event.clientX - live.startX, event.clientY - live.startY);
        if (travelled < THRESHOLD) return;
        live.active = true;
        document.body.classList.add('is-dragging');
        setDrag({ payload: live.payload, ghost: live.ghost, target: null });
      }

      paintGhost();
      const target = findTarget(event.clientX, event.clientY, live.payload);
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
    };

    const up = (event) => {
      const live = session.current;
      if (!live) return;
      if (live.active) {
        const target = findTarget(event.clientX, event.clientY, live.payload);
        if (target) rules.current.onDrop?.(live.payload, target);
        finish();
      } else {
        session.current = null;
      }
    };

    const cancel = () => {
      if (session.current?.active) finish();
      else session.current = null;
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
  }, [findTarget, finish, paintGhost]);

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

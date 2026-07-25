import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Live size of an element, via ResizeObserver. */
export const useElementSize = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const read = () => {
      const rect = node.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
          ? prev
          : { width: rect.width, height: rect.height }
      );
    };

    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
};

/** State mirrored into localStorage — used for preferences, not for the game. */
export const usePersistentState = (key, initial) => {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* preferences just won't stick */
    }
  }, [key, value]);

  return [value, setValue];
};

/**
 * Scales content down so it always fits its container — a thirteen-domino chain
 * stays readable end to end instead of disappearing off the edge.
 */
export const useFitScale = (min = 0.42, deps = []) => {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  const recalc = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const available = outer.clientWidth;
    const natural = inner.offsetWidth;
    const naturalHeight = inner.offsetHeight;
    if (!available || !natural) return;
    const scale = Math.max(min, Math.min(1, available / natural));
    setFit((prev) =>
      Math.abs(prev.scale - scale) < 0.005 && Math.abs(prev.height - naturalHeight * scale) < 0.5
        ? prev
        : { scale, height: naturalHeight * scale }
    );
  }, [min]);

  useLayoutEffect(recalc);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(recalc);
    if (outerRef.current) observer.observe(outerRef.current);
    if (innerRef.current) observer.observe(innerRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalc, ...deps]);

  return [outerRef, innerRef, fit];
};

/** Sets a flag for a beat, then clears it — for shakes and one-shot glows. */
export const useFlash = (duration = 480) => {
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);

  const trigger = useCallback(
    (token) => {
      window.clearTimeout(timer.current);
      setFlash(token);
      timer.current = window.setTimeout(() => setFlash(null), duration);
    },
    [duration]
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return [flash, trigger];
};

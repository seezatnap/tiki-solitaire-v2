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

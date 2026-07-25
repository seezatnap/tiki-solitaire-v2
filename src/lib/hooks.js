import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Live size of an element, via ResizeObserver.
 *
 * The ref is a callback so the element is measured whenever it arrives — an
 * element that mounts later (a panel that was empty a moment ago) is picked up
 * just the same as one present from the start.
 */
export const useElementSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observer = useRef(null);

  const ref = useCallback((node) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;

    const read = () => {
      const rect = node.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
          ? prev
          : { width: rect.width, height: rect.height }
      );
    };

    read();
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(read);
    observer.current.observe(node);
    // No effect cleanup here on purpose: React calls this ref with null when
    // the element goes, which disconnects above. Disconnecting from an effect
    // instead would kill the observer during StrictMode's remount rehearsal
    // and leave every measurement frozen at its first reading.
  }, []);

  return [ref, size];
};

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
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

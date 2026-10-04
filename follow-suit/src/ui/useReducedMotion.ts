import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

function reduced(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** True when the device asks for reduced motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reduced, () => false);
}

import { CONFIG } from '../config';
import { formatSeed, normalizeSeed } from '../engine';

/** A new seed from the browser's random source. The game's own generator takes over from there. */
export function randomSeed(): string {
  const values = new Uint32Array(CONFIG.seed.length);
  crypto.getRandomValues(values);
  return formatSeed([...values]);
}

/** The seed in the page address (`?seed=K7QX2M`), if there is one. */
export function seedFromUrl(): string | null {
  const seed = normalizeSeed(new URLSearchParams(window.location.search).get('seed') ?? '');
  return seed === '' ? null : seed;
}

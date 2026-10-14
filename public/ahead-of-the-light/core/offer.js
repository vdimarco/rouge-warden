// Ahead of the Light: the offer (final.md 12.2): rarity rows, pity, slots, fusions and legendaries due, rerolls,
// banishes, the RISK pick-two and the first offer.
// SPINE STUB (WP0): a safe do-nothing body with the 18.4 signature. WP5 owns this file. Pure.
import { TUNE } from './tune.js';

// The next offer: { cards: [{ id, r }], picks, skip }. Stub: an empty offer.
export function makeOffer(run, rng, tune = TUNE) { return { cards: [], picks: 1, skip: 'fuel' }; }

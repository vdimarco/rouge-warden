// Shop offers: charms by rarity weight, stamps, prices and rerolls.

import { CONFIG } from '../config';
import { CHARM_IDS, CHARMS, charmPrice } from './charms';
import type { Rng } from './rng';
import { STAMP_IDS } from './stamps';
import type { CharmId, Rarity, StampId } from './types';

export type ShopOffer =
  | { readonly kind: 'charm'; readonly id: CharmId; readonly price: number; readonly sold: boolean }
  | { readonly kind: 'stamp'; readonly id: StampId; readonly price: number; readonly sold: boolean };

export interface ShopState {
  readonly offers: readonly ShopOffer[];
  /** Rerolls bought in this shop. */
  readonly rerolls: number;
}

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare'];

/**
 * Picks a rarity by weight, then a charm of that rarity. Excluded charms never come up. A rarity with no
 * charms left drops out of the weights. Returns null when no charm is left.
 */
export function pickCharm(rng: Rng, excluded: readonly CharmId[]): CharmId | null {
  const available = CHARM_IDS.filter((id) => !excluded.includes(id));
  const rarities = RARITIES.filter((rarity) => available.some((id) => CHARMS[id].rarity === rarity));
  if (rarities.length === 0) return null;

  const weights = rarities.map((rarity) => CONFIG.shop.rarityWeights[rarity]);
  let roll = rng.next() * weights.reduce((sum, weight) => sum + weight, 0);
  let rarity = rarities[rarities.length - 1];
  for (let i = 0; i < rarities.length; i += 1) {
    if (roll < weights[i]) {
      rarity = rarities[i];
      break;
    }
    roll -= weights[i];
  }
  return rng.pick(available.filter((id) => CHARMS[id].rarity === rarity));
}

/** 2 charms the player does not own and 2 different stamps. */
export function rollOffers(rng: Rng, owned: readonly CharmId[]): ShopOffer[] {
  const offers: ShopOffer[] = [];
  const excluded = [...owned];
  for (let i = 0; i < CONFIG.shop.charmOffers; i += 1) {
    const id = pickCharm(rng, excluded);
    if (id === null) break;
    excluded.push(id);
    offers.push({ kind: 'charm', id, price: charmPrice(id), sold: false });
  }
  for (const id of rng.shuffle(STAMP_IDS).slice(0, CONFIG.shop.stampOffers)) {
    offers.push({ kind: 'stamp', id, price: CONFIG.shop.stampPrice, sold: false });
  }
  return offers;
}

/** $2, plus $1 for each earlier reroll in the same shop. */
export function rerollCost(rerolls: number): number {
  return CONFIG.shop.rerollBase + rerolls * CONFIG.shop.rerollStep;
}

import { describe, expect, it } from 'vitest';
import { CHARM_IDS, CHARMS } from './charms';
import { createRng, seedState } from './rng';
import { pickCharm, rerollCost, rollOffers } from './shop';
import type { CharmId } from './types';

const rngFor = (seed: string) => createRng(seedState(seed));

describe('shop offers', () => {
  it('offers 2 charms and 2 stamps', () => {
    const offers = rollOffers(rngFor('SHOP01'), []);
    expect(offers.filter((offer) => offer.kind === 'charm')).toHaveLength(2);
    expect(offers.filter((offer) => offer.kind === 'stamp')).toHaveLength(2);
  });

  it('never offers the same charm or stamp twice in one shop', () => {
    for (const seed of ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8']) {
      const offers = rollOffers(rngFor(seed), []);
      const charms = offers.filter((o) => o.kind === 'charm').map((o) => o.id);
      const stamps = offers.filter((o) => o.kind === 'stamp').map((o) => o.id);
      expect(new Set(charms).size).toBe(2);
      expect(new Set(stamps).size).toBe(2);
    }
  });

  it('never offers a charm the player owns', () => {
    const owned: CharmId[] = ['lantern', 'crown', 'pocket', 'knot', 'tidy'];
    for (let i = 0; i < 200; i += 1) {
      for (const offer of rollOffers(rngFor(`OWN${i}`), owned)) {
        if (offer.kind === 'charm') expect(owned).not.toContain(offer.id);
      }
    }
  });

  it('gives the same offers for the same generator state', () => {
    expect(rollOffers(rngFor('SAME'), [])).toEqual(rollOffers(rngFor('SAME'), []));
  });

  it('prices charms by rarity and stamps at $3', () => {
    for (const offer of rollOffers(rngFor('PRICE'), [])) {
      if (offer.kind === 'stamp') expect(offer.price).toBe(3);
      else expect(offer.price).toBe({ common: 4, uncommon: 6, rare: 8 }[CHARMS[offer.id].rarity]);
      expect(offer.sold).toBe(false);
    }
  });
});

describe('charm rarity', () => {
  it('follows the weights common 60, uncommon 30, rare 10', () => {
    const rng = rngFor('WEIGHTS');
    const counts = { common: 0, uncommon: 0, rare: 0 };
    const draws = 6_000;
    for (let i = 0; i < draws; i += 1) counts[CHARMS[pickCharm(rng, [])!].rarity] += 1;
    expect(counts.common / draws).toBeCloseTo(0.6, 1);
    expect(counts.uncommon / draws).toBeCloseTo(0.3, 1);
    expect(counts.rare / draws).toBeCloseTo(0.1, 1);
  });

  it('falls back to the other rarities when every charm of one rarity is out', () => {
    const commons = CHARM_IDS.filter((id) => CHARMS[id].rarity === 'common');
    const rng = rngFor('FALLBACK');
    for (let i = 0; i < 100; i += 1) expect(commons).not.toContain(pickCharm(rng, commons));
  });

  it('gives no charm when every charm is out', () => {
    expect(pickCharm(rngFor('NONE'), [...CHARM_IDS])).toBeNull();
  });
});

describe('rerolls', () => {
  it('cost $2, plus $1 for each earlier reroll in the same shop', () => {
    expect([0, 1, 2, 3].map(rerollCost)).toEqual([2, 3, 4, 5]);
  });
});

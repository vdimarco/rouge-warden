// The 5 hosts. Their follow limits live in chain.ts, and The Jeweler's score rule lives in scoring.ts.

import { CONFIG } from '../config';
import type { Rng } from './rng';
import type { HostId } from './types';

export interface HostDef {
  readonly id: HostId;
  readonly name: string;
  readonly rule: string;
}

export const HOSTS: Readonly<Record<HostId, HostDef>> = {
  purist: { id: 'purist', name: 'The Purist', rule: 'No switches. An 8 must name the current suit.' },
  zebra: { id: 'zebra', name: 'The Zebra', rule: 'Each card must be the opposite color of the previous card.' },
  climber: { id: 'climber', name: 'The Climber', rule: 'Each card must outrank the previous card. 8s obey this rule too.' },
  miser: { id: 'miser', name: 'The Miser', rule: '8s are not wild. They follow the normal rules.' },
  jeweler: { id: 'jeweler', name: 'The Jeweler', rule: 'A chain scores only if it closes into a ring. Other chains score 0.' },
};

export const HOST_IDS: readonly HostId[] = ['purist', 'zebra', 'climber', 'miser', 'jeweler'];

/** One host for each stop. Hosts come from shuffled bags of all 5, so none repeats until all 5 have appeared. */
export function hostSequence(rng: Rng, count: number): HostId[] {
  const hosts: HostId[] = [];
  while (hosts.length < count) hosts.push(...rng.shuffle(HOST_IDS));
  return hosts.slice(0, count);
}

export function hostScale(host: HostId | null): number {
  return host === null ? 1 : CONFIG.run.hostScale[host];
}

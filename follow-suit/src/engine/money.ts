import { CONFIG } from '../config';

export interface Payout {
  readonly table: number;
  readonly unusedChains: number;
  readonly powerOfTen: number;
  readonly total: number;
}

/**
 * $1 for each power of ten the total beats the target by: floor(log10(total / target)) once the total
 * is at least 10 times the target. Whole-number compares avoid rounding slips at exact powers.
 */
export function powerOfTenBonus(total: number, target: number): number {
  if (target <= 0) return 0;
  let powers = 0;
  for (let threshold = target * 10; total >= threshold; threshold *= 10) powers += 1;
  return powers * CONFIG.money.perPowerOfTen;
}

interface ClearedTable {
  readonly tableIndex: number;
  readonly total: number;
  readonly target: number;
  readonly chainsLeft: number;
}

/** What a cleared table pays. */
export function tablePayout({ tableIndex, total, target, chainsLeft }: ClearedTable): Payout {
  const table = CONFIG.money.tablePay[tableIndex] ?? 0;
  const unusedChains = chainsLeft * CONFIG.money.perUnusedChain;
  const powerOfTen = powerOfTenBonus(total, target);
  return { table, unusedChains, powerOfTen, total: table + unusedChains + powerOfTen };
}

import { describe, expect, it } from 'vitest';
import { powerOfTenBonus, tablePayout } from './money';

describe('table pay', () => {
  it('pays $3, $4 and $5 for the first, second and host table', () => {
    for (const [tableIndex, pay] of [[0, 3], [1, 4], [2, 5]]) {
      expect(tablePayout({ tableIndex, total: 100, target: 100, chainsLeft: 0 }).table).toBe(pay);
    }
  });

  it('pays $1 for each unused chain', () => {
    expect(tablePayout({ tableIndex: 0, total: 150, target: 150, chainsLeft: 2 }).unusedChains).toBe(2);
    expect(tablePayout({ tableIndex: 0, total: 150, target: 150, chainsLeft: 0 }).unusedChains).toBe(0);
  });

  it('adds it all up: a first table cleared with the first chain at 1,600 against 150 pays $6', () => {
    expect(tablePayout({ tableIndex: 0, total: 1_600, target: 150, chainsLeft: 2 })).toEqual({
      table: 3,
      unusedChains: 2,
      powerOfTen: 1,
      total: 6,
    });
  });
});

describe('the power-of-ten bonus', () => {
  it('pays nothing below 10 times the target', () => {
    expect(powerOfTenBonus(1_499, 150)).toBe(0);
    expect(powerOfTenBonus(150, 150)).toBe(0);
  });

  it('pays $1 for each power of ten beaten', () => {
    expect(powerOfTenBonus(1_500, 150)).toBe(1);
    expect(powerOfTenBonus(14_999, 150)).toBe(1);
    expect(powerOfTenBonus(15_000, 150)).toBe(2);
    expect(powerOfTenBonus(150_000, 150)).toBe(3);
  });

  it('pays no bonus against a target of 0', () => {
    expect(powerOfTenBonus(500, 0)).toBe(0);
  });

  it('counts exact powers of ten with no rounding slips', () => {
    expect(powerOfTenBonus(1_000, 100)).toBe(1);
    expect(powerOfTenBonus(99_999, 100)).toBe(2);
    expect(powerOfTenBonus(3_750_000, 3_750)).toBe(3);
  });
});

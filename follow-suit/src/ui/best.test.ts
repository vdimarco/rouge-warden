// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BEST_CHAIN_KEY, readBestChain, recordBestChain } from './best';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('best chain save', () => {
  it('reads 0 when nothing is saved', () => {
    expect(readBestChain()).toBe(0);
  });

  it('saves a chain score as a JSON number that the arcade can read', () => {
    recordBestChain(360);
    expect(window.localStorage.getItem(BEST_CHAIN_KEY)).toBe('360');
    expect(JSON.parse(window.localStorage.getItem(BEST_CHAIN_KEY)!)).toBe(360);
    expect(readBestChain()).toBe(360);
  });

  it('keeps the higher score', () => {
    recordBestChain(300);
    recordBestChain(360);
    expect(readBestChain()).toBe(360);
    recordBestChain(90);
    expect(readBestChain()).toBe(360);
  });

  it('ignores scores that are not positive finite numbers', () => {
    recordBestChain(0);
    recordBestChain(-5);
    recordBestChain(Number.NaN);
    recordBestChain(Number.POSITIVE_INFINITY);
    expect(window.localStorage.getItem(BEST_CHAIN_KEY)).toBeNull();
  });

  it('reads a junk save as 0 and replaces it with the next score', () => {
    for (const junk of ['not json', '-5', '0', '1e999', '"x"', '{}', '[1,2]', 'null', 'true']) {
      window.localStorage.setItem(BEST_CHAIN_KEY, junk);
      expect(readBestChain()).toBe(0);
    }
    recordBestChain(50);
    expect(readBestChain()).toBe(50);
  });

  it('keeps the game playable when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readBestChain()).toBe(0);
    expect(() => recordBestChain(360)).not.toThrow();
  });
});

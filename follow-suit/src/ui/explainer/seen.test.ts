// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INTRO_SEEN_KEY, introSeen, markIntroSeen } from './seen';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('intro seen key', () => {
  it('is not set on a first visit, and is set after the explainer closes', () => {
    expect(introSeen()).toBe(false);
    markIntroSeen();
    expect(window.localStorage.getItem(INTRO_SEEN_KEY)).toBe('1');
    expect(introSeen()).toBe(true);
  });

  it('counts the explainer as seen when storage is blocked, so it does not open on every visit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(introSeen()).toBe(true);
    expect(() => markIntroSeen()).not.toThrow();
  });
});

// The best chain score of all runs, kept in this browser. The Cottage Arcade shows it on the Follow Suit machine,
// so the value is a whole number in JSON that the arcade can parse.

export const BEST_CHAIN_KEY = 'follow-suit:best-chain';

const isScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function readBestChain(): number {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(BEST_CHAIN_KEY) ?? '0');
    return isScore(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** Saves the score when it beats the saved one. */
export function recordBestChain(score: number): void {
  if (!isScore(score) || score <= readBestChain()) return;
  try {
    window.localStorage.setItem(BEST_CHAIN_KEY, String(Math.round(score)));
  } catch {
    // Private windows can block storage. The game plays on without the save.
  }
}

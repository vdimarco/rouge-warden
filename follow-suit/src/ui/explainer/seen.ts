// Whether this browser has seen the explainer. The game opens it by itself only until then.

export const INTRO_SEEN_KEY = 'follow-suit:intro-seen';

/** True when the explainer was closed in this browser. Blocked storage counts as seen, so it does not open on every visit. */
export function introSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markIntroSeen(): void {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Private windows can block storage. The How to play button still opens the explainer.
  }
}

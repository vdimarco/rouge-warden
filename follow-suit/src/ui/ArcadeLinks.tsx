import { IN_ARCADE, openGameSwitch } from './arcade';

/** Switch game and Arcade. Only the arcade copy of the game shows them. */
export function ArcadeLinks() {
  if (!IN_ARCADE) return null;
  return (
    <nav className="arcade-links" aria-label="Cottage Arcade" data-testid="arcade-links">
      {/* switch.js wires [data-switch] buttons once at load, before React draws this one, so the click opens it here */}
      <button type="button" className="btn" onClick={openGameSwitch}>
        Switch game
      </button>
      <a className="btn" href="/">
        Arcade
      </a>
    </nav>
  );
}

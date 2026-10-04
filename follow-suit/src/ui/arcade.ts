// The Cottage Arcade serves a copy of the game at /follow-suit/, built with `npm run build:arcade`. Vite replaces
// MODE at build time, so the standalone build holds none of the arcade's controls.
export const IN_ARCADE = import.meta.env.MODE === 'arcade';

interface GameSwitch {
  open(): void;
}

/** Opens the arcade's game switcher, or the arcade itself when the switcher did not load. */
export function openGameSwitch(): void {
  const gameSwitch = (window as Window & { GameSwitch?: GameSwitch }).GameSwitch;
  if (gameSwitch !== undefined) gameSwitch.open();
  else window.location.href = '/';
}

# Design

## The arcade copy

`npm run build:arcade` in `follow-suit/` runs `vite build --mode arcade`. In that mode the base path is `/follow-suit/` and the output goes to `public/follow-suit/`, which is committed, as for Olympus. A small Vite plugin adds `<script src="/arcade/quiet.js"></script>` after the charset tag, so it is the first script, and adds `<script src="/arcade/switch.js"></script>` after it. The standalone build keeps the base path `/` and loads neither script, because the Vercel project `follow-suit` has no `/arcade/` folder.

The constant `IN_ARCADE` is `import.meta.env.MODE === 'arcade'`. Vite replaces it at build time, so the standalone bundle holds no arcade buttons. The Switch game button calls `window.GameSwitch.open()`. It does not use the `data-switch` attribute, because `switch.js` wires those buttons once when the page loads, before React draws the screens. If `GameSwitch` is missing, the button opens the arcade.

The buttons go on the start screen and the run end screen. Those are the places where a player starts or ends a run. During a run, the browser back button goes to the arcade, and the switcher warns that the run ends.

## The save

The key is `follow-suit:best-chain`, next to the mute key `follow-suit:muted`. The value is a whole number in JSON, so the arcade reads it with its own `store.get`. Follow Suit writes it when the player plays a chain, from `RunState.bestChain`, and only when the new score is higher. A blocked storage leaves the game playable. The arcade shows the line only for a positive finite number.

## The machine

- It goes last in the row, so the index of every other machine stays the same. It joins the Strategy group with BREAKTHROUGH, because both are turn-based games of planning.
- Colors come from the game: the cloth green `#1f4b40` and the gold `#e9c46a`.
- Marquee: FOLLOW SUIT, A CARD ROGUELIKE. Plain line: 8 STOPS · 5 HOSTS.
- Art: one WebP frame of a ring from the real game, under 60 KB. The machine screen and the switcher tile use it. `follow-suit/qa/cabinet-art.mjs` makes it again from the arcade copy. The game itself still uses no image files.

## Checks

- `qa/arcade/machines.mjs` finds the new page and needs its machine and switcher entry. This change adds the save key to the junk and real save checks, and the new art to the WebP size check.
- `qa/arcade/quiet.mjs` scans the new page for `quiet.js` first. This change adds the page to the list of pages it plays: start table 1, tap a card, play the chain.
- The Follow Suit browser checks run against the arcade copy with `BASE_URL=http://127.0.0.1:8765/follow-suit/`. A new check covers the arcade buttons and the save.

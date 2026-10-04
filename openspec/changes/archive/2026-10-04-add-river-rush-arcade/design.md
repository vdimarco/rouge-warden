# Design

Reuse the already approved River Rush art and implementation. Adapt asset URLs through Vite's base path and add a reproducible `build:arcade` command with output to `public/river-rush/`. Commit both source and generated bundle because Rouge Warden serves `public/` without a root build.

Append the cabinet to preserve order-dependent selection. Reuse the arcade's existing cabinet markup, Action group and shared switcher registry. Save key `river-rush-best` is shared on the same origin; reject invalid or nonpositive scores in both game and cabinet.

The game keeps the approved long-haired character, facial likeness and loincloth. Existing full-bleed forest/ivory/gold visual direction and keyboard/touch mechanics are retained. New links use the same menu typography and fit 390×844.

Load `/arcade/quiet.js` first, then `/arcade/switch.js`. Wire React-rendered buttons after screen changes. Switching from a native result dialog first returns to the menu and then opens the shared switcher, so the overlay remains visible above all game content.

Verify engine tests, subpath asset loading, desktop/mobile input, cabinet selection/start, saved-score fallback, switcher identity and shared audio quieting. Confirm Vercel reports success for the pushed commit before declaring deployment live.

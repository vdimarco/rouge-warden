# Design

The standalone Vite build is committed under `public/ascii-front/` with relative asset paths; Warden already deploys `public/` through its Git-connected Vercel project. Reuse the existing cabinet, ASCII Scenes collection and shared switcher. Keep source under `games/ascii-front/` so a future edit can rebuild the deployed copy.

The art direction uses a dark monospace battlefield, character-based terrain and tanks, a bright green player and warm orange enemies. The original SVG cabinet art is local and requires no remote font or generation service.

Gameplay adds independent pointer aim, normalized diagonal movement, fast sampled projectiles, dash, a limited EMP and between-wave upgrades to the base-defense loop. Campaign and endless modes share the same simulation. Deliberate start, pause, hide/switch pause, restart and readable desktop/phone controls are part of the game lifecycle.

Validation combines deterministic engine checks, a focused registration/local-asset check and browser play/layout checks. Physical devices and non-Chromium browsers must be reported separately. Deployment is handled after these checks, through the existing Git-to-Vercel workflow.

## Verified result

- `node qa/ascii-front/arcade.test.mjs` passes: all 33 catalog/cabinet pairs retain matching ids, names, routes and existing art; ASCII Front appears once in ASCII Scenes; its deployed shell and HTML-referenced assets exist.
- `npm test` in `games/ascii-front/` passes all three engine/renderer checks. Independent feel checks cover diagonal normalization, aiming, wall sliding, exact dash duration, fast piercing/corner collision and headquarters pressure from all three lanes.
- The parent verified the production arcade build, relative bundled fonts, desktop play/independent aim, 390×844 touch fire/dash/EMP/pause, and no horizontal overflow at 320px, 390px and 844×390. The packaged local arcade menu opens and pauses the game, Keep Playing returns safely, fonts load, and the browser reports no console errors.
- The landscape check used a fine pointer. Physical touch devices, landscape touch hardware, non-Chromium browsers and extended human balance testing remain unverified.
- JavaScript syntax, original SVG XML and whitespace checks pass; OpenSpec strict validation passes. Source dependencies are installed with `npm ci` before rebuilding, as documented. Deployment is a subsequent release action and is not claimed by these local checks.

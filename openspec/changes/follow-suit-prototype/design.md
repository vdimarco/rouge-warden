# Design

`follow-suit/DECISIONS.md` records each rule that needed a reading. This file records how the code is built.

## Engine

- `follow-suit/src/engine/` imports nothing from React or the DOM. Each action takes a state and returns a new state, so tests and the simulator use the same code as the UI.
- One generator, mulberry32, makes every random choice. The run state stores its state as one number. A function that shuffles gets a generator made from that number, and the caller stores the new number back.
- A chain is a list of links. Each link holds the card, the current suit after that card and how the card followed: first, suit, rank, eight, turncoat or bridge. Undo drops the last link. Once-per-chain charms look at the links, so undo gives the charm back.
- Scoring returns the totals and a list of steps with running Value and Mult. The UI replays the steps for the reveal and never calculates a score itself.
- `follow-suit/src/config.ts` holds every tunable number: rule numbers, targets, prices, charm amounts, timings and sound pitches.

## UI

- React state holds the engine state. The UI calls engine functions for legal cards, live numbers and every action.
- The layout starts from 390 by 844 portrait. The hand shows 2 rows of 4 cards above an action bar at the bottom, where one thumb reaches. Every tap target is at least 44 px.
- Cards, suits and badges are CSS and text. Suit symbols use the text variation selector so that phones do not show them as emoji.
- Motion uses CSS transitions and keyframes. No animation library.

## Look

A calm card table for a solitaire pace: deep green-blue cloth, ivory cards with serif ranks, and soft shadows. Value uses amber and Mult uses teal. The look avoids the brief's reference game: no pixel art, no screen effects and no swirling background.

## Checks

- Vitest covers the follow rules, 8s and named suits, switches, rings, scoring, the table flow and, from milestone 3, each charm, each host and money.
- Playwright scripts in `follow-suit/qa/` drive the built app at 390 by 844 with touch input. They use the Chromium that is already in the container. They check legal-card highlights, the 8 picker, undo, redraw, play, clear or lose, tap target sizes and horizontal overflow.
- Real phones, sound output and motion settings on a device need a person. The task list records each check that a person still has to do.

## Deploy

The preview is a separate Vercel project named `follow-suit` in the `vdimarcos-projects` team. It builds the `follow-suit/` folder with the Vite preset from a pushed commit. It has no Git link, so pushes to the repository do not build it. The arcade project `warden` does not change. The first deploy became the project's production deploy at `follow-suit.vercel.app`, which is public. Later deploys are previews unless they target production. On 4 October 2026, a production deploy of `main` at 5349084 replaced the milestone 2 build at that domain. Each deployment URL needs a Vercel login.

# Plan

Follow Suit is a single-player card roguelike for phones in portrait. The rules live in `src/engine/` as pure TypeScript. The React UI in `src/ui/` calls the engine and holds no rules. Every tunable number lives in `src/config.ts`.

The OpenSpec change for this work is `openspec/changes/follow-suit-prototype/` at the repository root. It holds the requirements, the scenarios and the task checklist.

## Milestone 1: engine and tests

Write the tests first. Then write the engine until all tests pass.

Project setup:

- `package.json`, `package-lock.json`: Vite, React, TypeScript, Vitest.
- `tsconfig.json`, `vite.config.ts`: one config for the build and the tests.
- `index.html`: the page that loads the app.
- `src/main.tsx`: the entry point. In milestone 1 it shows only the title.
- `.gitignore`
- `PLAN.md`, `DECISIONS.md`, `IDEAS.md`, `README.md`

Engine:

- `src/config.ts`: every rule number, target and price.
- `src/engine/types.ts`: cards, suits, chain links, hosts and charm names.
- `src/engine/rng.ts`: one seeded generator. Its state is a single number that the run state stores.
- `src/engine/cards.ts`: the 52-card deck, card points, rank order, colors and labels.
- `src/engine/chain.ts`: follow rules, 8s and named suits, switches, rings, add and undo.
- `src/engine/scoring.ts`: the scoring order, with a step list that the UI can replay.
- `src/engine/index.ts`: the public engine API.

Tests:

- `src/engine/test-helpers.ts`: makes cards from short labels such as `7S` or `KH`.
- `src/engine/rng.test.ts`
- `src/engine/cards.test.ts`
- `src/engine/chain.test.ts`
- `src/engine/scoring.test.ts`: includes the 252 test case.

## Milestone 2: one table

- `src/engine/table.ts`, `src/engine/table.test.ts`: deal, legal cards, add, undo, play, redraw, refill, clear and lose.
- `src/App.tsx`: holds the table state. `src/main.tsx` mounts it.
- `src/styles.css`: the table, the cards and the layout for 390 by 844.
- `src/ui/CardFace.tsx`: a card drawn with CSS.
- `src/ui/TopBar.tsx`: stop, table, target, total, money, chains, redraws and seed.
- `src/ui/ChainArea.tsx`: the chain in progress, live Value and Mult, ring marker.
- `src/ui/Hand.tsx`: the hand, with legal cards raised and the rest dimmed.
- `src/ui/ActionBar.tsx`: Undo, Play chain and Redraw, then Confirm and Cancel in redraw mode.
- `src/ui/SuitPicker.tsx`: the 4 suit buttons for an 8.
- `src/ui/TableEnd.tsx`: the clear or lose panel.
- `src/ui/seed.ts`: makes a new random seed, or reads `?seed=` from the page address.
- `src/ui/text.ts`: card names and number formats for labels.
- `qa/table.e2e.mjs`: a Playwright check of one table at 390 by 844 with touch.
- `vercel.json`: static build settings.

Stop after the preview deploy and wait for the go-ahead.

## Milestone 3: full run

- `src/engine/hosts.ts`, `src/engine/hosts.test.ts`: the 5 hosts and the host order for a seed.
- `src/engine/charms.ts`, `src/engine/charms.test.ts`: the 13 charms and the charm slots.
- `src/engine/stamps.ts`, `src/engine/stamps.test.ts`: the 4 stamps and the deck size limit.
- `src/engine/money.ts`, `src/engine/money.test.ts`: table pay, unused chains and the power-of-ten bonus.
- `src/engine/shop.ts`, `src/engine/shop.test.ts`: offers, rarity weights, prices, rerolls, buy, sell and move.
- `src/engine/run.ts`, `src/engine/run.test.ts`: 8 stops, 3 tables each, shop after each clear, win and loss.
- `src/engine/solver.ts`, `src/engine/solver.test.ts`: the best legal chain for a hand. This moved here from milestone 5, because the run check plans its chains with it.
- `src/ui/StartScreen.tsx`: New run and a seed field.
- `src/ui/StopIntro.tsx`: the stop number and the host for that stop.
- `src/ui/HostBanner.tsx`: the host rule under the top bar.
- `src/ui/CharmBoard.tsx`: the 4 suit slots and the table slot. Tap a charm to read it.
- `src/ui/ShopScreen.tsx`: offers, prices, Reroll, Sell, slots and Next table.
- `src/ui/StampPicker.tsx`: the deck picker that applies a stamp.
- `src/ui/DeckView.tsx`: every card in the run deck, grouped by suit.
- `src/ui/RunEnd.tsx`: win or loss, stop reached, best chain, seed and New run.
- `src/ui/Sheet.tsx`: the bottom panel that the 8 picker, charm details, deck view and stamp picker share.
- `src/ui/ClearedPanel.tsx`: the pay for a cleared table, then Open the shop. It replaces `TableEnd.tsx`.
- `qa/lib.mjs`: the parts that the browser checks share.
- `qa/run.e2e.ts`: a Playwright check of a full run. It plans with the engine, plays on screen and compares the two after each tap.

## Milestone 4: feel

- `src/ui/reveal.ts`, `src/ui/reveal.test.ts`: turn the scoring steps into timed beats, about 180 ms for each card, and place the ring cards on an ellipse.
- `src/ui/useReveal.ts`, `src/ui/useReveal.test.tsx`: run the beats, play the sounds, count the total up and commit the new run state at the end.
- `src/ui/ChainArea.tsx`: card points above each card, Mult bumps and flashes, the ring loop or fade, and the chain score.
- `src/ui/music.ts`: pitches on the major scale.
- `src/ui/audio.ts`: Web Audio notes, the ring chord, coin sounds and the mute state.
- `src/ui/SoundToggle.tsx`: the mute toggle in the top bar.
- `src/ui/useReducedMotion.ts`: swaps the ring move for a fade.
- `qa/feel.e2e.mjs`: checks the reveal order and timing, the notes, the mute toggle, reduced motion and the ring layout.

## Milestone 5: balance

- `scripts/simulate.ts`: plays 1,000 seeds with no charms and no redraws and reports the clear rate of each table in stops 1 to 3. `--calibrate` reports the 3-chain totals for each kind of table, and `--buy-charms` tries a player who buys charms.
- `BALANCE.md`: the simulator report and the final targets.
- `src/config.ts`: the tuned targets and host scales.

## After the milestones: the arcade machine

- `vite.config.ts`: the arcade build mode, which writes `public/follow-suit/`.
- `src/ui/arcade.ts` and `src/ui/ArcadeLinks.tsx`: the Switch game button and the Arcade link.
- `src/ui/best.ts`: the best chain save that the machine shows.
- `qa/arcade.e2e.mjs` and `qa/cabinet-art.mjs`: the arcade check and the machine art.
- Outside this folder: the machine in `public/index.html`, its entry in `public/arcade/switch.js`, its art in `public/arcade/follow-suit.webp`, and the arcade checks in `qa/arcade/`.

## Checks for each milestone

- `npm test`: all Vitest tests pass.
- `npm run typecheck`: no type errors.
- `npm run build`: the production build succeeds.
- From milestone 2: `npm run qa` runs the Playwright checks against `npm run preview`.
- Commit after each milestone.

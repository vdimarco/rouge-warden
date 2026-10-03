# Tasks

## Milestone 1: engine and tests

- [x] Write `PLAN.md`, `DECISIONS.md` and `IDEAS.md`.
- [x] Set up Vite, React, TypeScript and Vitest in `follow-suit/`.
- [x] Write tests for the generator, cards, follow rules, 8s and named suits, switches, rings and the 252 case.
- [x] Write the engine until all tests pass. Commit.

## Milestone 2: one table

- [x] Write table tests: deal, legal cards, add, undo, play, refill, redraw, clear and lose.
- [x] Write the table engine until the tests pass.
- [x] Build the table screen: top bar, chain area, hand, action bar, 8 picker, redraw mode and the clear or lose panel.
- [x] Check one table in Chromium at 390 by 844 with touch.
- [x] Deploy a Vercel preview and post the URL. Commit.
- [ ] Get the user's go-ahead for milestone 3.

## Milestone 3: full run

- [ ] Write tests for each host, each charm, each stamp, money, the shop and the run flow. Then write the code.
- [ ] Build the start screen, stop intro, host banner, charm board, shop, stamp picker, deck view and run end screen.
- [ ] Check a run through a shop and a host table in Chromium. Commit.

## Milestone 4: feel

- [ ] Replay the scoring steps at about 180 ms for each card, with points above each card.
- [ ] Bump Mult and play a scale note on each switch. Move ring cards into a circle and flash the Mult change.
- [ ] Count the table total up. Play one coin sound for each power-of-ten dollar.
- [ ] Add the mute toggle and the reduced-motion fade. Commit.

## Milestone 5: balance

- [ ] Write the solver and its tests.
- [ ] Write `scripts/simulate.ts` and run 1,000 seeds with no charms and no redraws.
- [ ] Tune the targets until stop 1 clears at least 90% of the time and stop 2 about half the time.
- [ ] Write `BALANCE.md`. Commit.

## Close

- [ ] All tests pass and the production build succeeds.
- [ ] A Vercel preview URL is live.
- [ ] A person plays a full run on a phone in portrait with one thumb.
- [ ] Validate the specs and archive this change.

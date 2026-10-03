# Verification

## Milestone 1

- `npm test` in `follow-suit/`: the engine tests pass, including the 252 case (Value 42, Mult 6).
- `npm run typecheck` and `npm run build` pass.

## Milestone 2

- `npm test`: 105 tests pass. The table tests cover the deal, legal cards, add, undo, play, refill, redraw, clear, loss, an empty draw pile, an empty hand and replay from a seed.
- `npm run qa`: 11 checks pass against the local build in Chromium 141 with touch input. The checks play seed K7QX2M: legal cards rise and the rest dim, a tap on a dimmed card does nothing, the 8 picker names a suit and Cancel leaves the chain alone, Undo gives the old suit back, a ring lights the marker and clears the table at 192, redraw Cancel and Confirm work, Redraw is off while a chain is in progress, and three weak chains end the run.
- Layout checks pass at 390 by 844, 375 by 667, 360 by 740 and 430 by 932: every button and hand card is at least 44 by 44 px, the action bar is in the lower third, and the page does not scroll in either direction.
- The build holds only HTML, CSS and JavaScript files. The console shows no errors.
- The same checks pass against https://follow-suit.vercel.app (10 checks; the build file check runs only on a local build).

## Milestone 3

- `npm test`: 217 tests pass. They cover each host, each charm, each stamp, money, the shop, the run flow and the solver. The solver matches a brute-force search on random hands with no host, under each host and with charms.
- `npm run qa` runs both browser checks against the local build. The table check passes 11 checks. Seed K7QX2M now deals 7♠ 8♠ 5♥ A♥ 6♣ A♣ 6♦ 7♦, and the ring 6♣ 6♦ 7♦ 7♠ 8♠ named clubs, then A♣ clears the first table at 360.
- The run check passes 3 checks. It finds seed QA0001, where a fixed policy reaches stop 2. It then plays 37 steps on screen: the stop intros, 3 shops with a charm buy, stamps, a reroll, a move and a sell, the deck view, a charm sheet, The Miser's host table and a loss at the stop 2 host table. After each tap the hand, the legal cards, Value, Mult, the ring marker, the totals, the money, the offers and the charm slots match the engine.
- Layouts pass at 390 by 844, 375 by 667, 360 by 740 and 430 by 932 for the start screen, a stop intro, a host table, the shop, the deck view, a stamp picker and the run end screen.

## Milestone 4

- `npm test`: 232 tests pass. `src/ui/reveal.test.ts` checks the beat order, 180 ms for each card, the scale steps for switches, the coin beats and the ring ellipse. `src/ui/useReveal.test.tsx` runs the reveal hook in jsdom with fake timers: switch notes 0 then 1, one ring chord, two coins for a clear at 252 against a target of 1, a total that counts through middle values, and the new run state only at the end.
- `qa/feel.e2e.mjs` passes 10 checks in Chromium. On seed K7QX2M the 360 ring shows +6, +6, +1 Mult, +7, +7, +1 Mult, +8, +1 Mult and +11 above the cards, then Ring ×2, with cards about 180 ms apart. Mult shows 1, 2, 3, 4, then 8. The spy hears 392, 440.01 and 493.89 Hz for the 3 switches and a chord at 784, 987.78 and 1174.66 Hz. The total counts up through middle values to 360. Mute silences every note and survives a reload. With reduced motion the cards stay in one line under a fading gold ring. The ring loop stays clear of the hand and the charm board at all 4 phone sizes.
- 300 policy runs on seeds QA0001 to QA0300 never cleared a table with a power-of-ten bonus, so the browser check cannot reach the coins. The hook test covers them.

## Not checked yet

- A real phone with a thumb. Chromium emulates touch here.
- Sound through real speakers. The checks read each oscillator's pitch but cannot hear the mix.
- The reduced-motion setting on a real phone. Chromium emulates it here.

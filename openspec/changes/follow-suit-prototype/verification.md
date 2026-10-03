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

## Not checked yet

- A real phone with a thumb. Chromium emulates touch here.
- Sound and motion settings on a device. Milestone 2 has no sound.

# Verification

Run with `public/` served at http://127.0.0.1:8765/ and Playwright 1.56.1 from `/opt/node22/lib/node_modules`.

- `npm run check` in `follow-suit/`: the typecheck passes, 263 tests in 20 files pass, and the build succeeds. The explainer tests cover `pose` with and without reduced motion, the scene clock, the stored key, the story against the engine, and the screen in jsdom. The story tests check that every chain follows the rules, and that the ring chain scores Value 45 and Mult 4, then Mult 8 with the ring, for 360 against a target of 150. The screen tests check the play-through, Next, Back, the arrows, Escape, the held finger, Space, the notes and the two end-card exits.
- `node qa/explainer.e2e.mjs` passes 15 checks on the standalone build and 15 on the arcade copy:
  - A first visit opens the explainer, and it moves to scene 2 by itself. A seed link opens the stop intro instead.
  - Skip closes it, a reload opens the start screen, and How to play opens it again.
  - The end card lists 5 rules, and Play starts a run. From a stop intro, Back to the game returns to the same stop intro.
  - A held finger stops the scene bar, and it moves again after the finger lifts.
  - The screen shows Value 45, Mult 4, a ♣ badge on the 8♠, Mult 8 after the ring, 360, Target 150 and Total 360.
  - The notes are 392, 440 and 493.88 Hz for the 3 changes of suit, and the ring chord is 784, 987.77 and 1174.66 Hz.
  - With reduced motion the 7♠ is seen at 2 places only and fades in. Without it, the card is seen at 4 or more places.
  - At 375 by 667 every visible card, chip, pop and panel stays inside the animation area in all 7 scenes.
  - At 390 by 844, 375 by 667, 360 by 740 and 430 by 932: 44 px targets, no scroll, and the animation, the caption and the buttons in order.
- `npm run qa` passes 39 checks on the standalone build, and `BASE_URL=http://127.0.0.1:8765/follow-suit/ npm run qa:url` passes 38 on the arcade copy. The other checks store the seen key first, so they open the start screen as before.
- `npm run qa:arcade` passes 9 checks. It now also fails when the start screen hides part of itself. With the old styles, the title of the arcade copy started 2 px above the window on a 375 by 667 phone.
- `node qa/arcade/quiet.mjs --only=follow-suit --skip=unit` passes 31 checks on the new arcade copy: the sound stops while the page is hidden.
- `openspec validate follow-suit-explainer --type change --strict` reports the change as valid.

## Not checked

- A real phone, and sound through real speakers.
- Whether a new player understands the game after the explainer. A person who has not played should watch it once.

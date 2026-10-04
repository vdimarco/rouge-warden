# Verification

Run on the final tree, with `public/` served at http://127.0.0.1:8765/ and Playwright 1.56.1 from `/opt/node22/lib/node_modules`.

- `npm run check` in `follow-suit/`: the typecheck passes, 242 tests in 16 files pass, and the standalone build succeeds. `src/ui/best.test.ts` covers the save: an empty save, a higher score, a weaker score, junk saves and blocked storage. `src/ui/arcade.test.tsx` covers the arcade buttons: hidden outside the arcade copy, and Switch game calls the switcher.
- `npm run qa` passes 24 checks on the standalone build. The run end screen there has no arcade buttons.
- `BASE_URL=http://127.0.0.1:8765/follow-suit/ npm run qa:url` passes 23 checks on the arcade copy, including a full run on seed QA0024. The run end screen there has the arcade buttons.
- `npm run qa:arcade` passes 9 checks: `quiet.js` is the first script and `switch.js` the second; Switch game and Arcade fit with 44 px targets and no scroll on the start screen and the run end screen at 390 by 844, 375 by 667, 360 by 740 and 430 by 932; Switch game opens the switcher with Follow Suit marked; the 360 ring saves 360 and a one-card chain keeps it; the machine then shows BEST CHAIN 360 in the Strategy group; Arcade opens the arcade; no console errors.
- `node qa/arcade/quiet.mjs --only=follow-suit --skip=unit` passes 31 page checks: the sound starts with the first chain, stops while the page is hidden (emulated, pagehide, another tab on top, a frozen page) and starts again when the page is visible. The scan finds `follow-suit/index.html` with `quiet.js` first.
- `node qa/arcade/machines.mjs`: every part passes except one step.
  - The file checks and the walk pass, 374 checks. The new page has a machine and a switcher entry with the same id and name, its art is a WebP of 12.5 KB, and at 390 by 844 and 1280 by 720 a token and START go to `/follow-suit/`.
  - The switcher, saves, credits, focus and back-link parts pass, 330 checks. The switcher shows 22 tiles. Junk saves leave every line plain. A save of 5432 shows BEST CHAIN 5,432 on the Follow Suit machine and changes no other line.
  - The layout part passes at 360 by 740, 390 by 844, 430 by 932, 768 by 1024, 1280 by 720 and 1920 by 1080.
  - At 375 by 667 the swipe step of the layout part stops: Chromium in this container stops answering mouse moves while the row is dragged. `main` stops at the same step when a copy of House Rules is added as a 22nd machine, and `main` with 21 machines passes. With the blurred glow under the marquees turned off, the swipes finish. The stop comes from 22 machines on the software GPU of this container, whichever machine is added.
- `npm run build:arcade` gives the same file names again, so the committed copy matches the source.
- `openspec validate follow-suit-arcade --type change --strict` reports the change as valid.
- After the merge of the explainer, `node qa/arcade.e2e.mjs` with `BASE_URL=https://warden-alpha-wheat.vercel.app/follow-suit/` passes 9 checks on the production arcade.

## Not checked

- A real phone, Safari on iOS and a home-screen install. A real phone drags the row of 22 machines on its own GPU, which this container does not have.
- Sound through real speakers.

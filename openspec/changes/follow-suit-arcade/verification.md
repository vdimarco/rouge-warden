# Verification

Run on the final tree, with `public/` served at http://127.0.0.1:8765/ and Playwright 1.56.1 from `/opt/node22/lib/node_modules`.

- `npm run check` in `follow-suit/`: the typecheck passes, 242 tests in 16 files pass, and the standalone build succeeds. `src/ui/best.test.ts` covers the save: an empty save, a higher score, a weaker score, junk saves and blocked storage. `src/ui/arcade.test.tsx` covers the arcade buttons: hidden outside the arcade copy, and Switch game calls the switcher.
- `npm run qa` passes 24 checks on the standalone build. The run end screen there has no arcade buttons.
- `BASE_URL=http://127.0.0.1:8765/follow-suit/ npm run qa:url` passes 23 checks on the arcade copy, including a full run on seed QA0024. The run end screen there has the arcade buttons.
- `npm run qa:arcade` passes 9 checks: `quiet.js` is the first script and `switch.js` the second; Switch game and Arcade fit with 44 px targets and no scroll on the start screen and the run end screen at 390 by 844, 375 by 667, 360 by 740 and 430 by 932; Switch game opens the switcher with Follow Suit marked; the 360 ring saves 360 and a one-card chain keeps it; the machine then shows BEST CHAIN 360 in the Strategy group; Arcade opens the arcade; no console errors.
- `node qa/arcade/quiet.mjs --only=follow-suit --skip=unit` passes 31 page checks: the sound starts with the first chain, stops while the page is hidden (emulated, pagehide, another tab on top, a frozen page) and starts again when the page is visible. The scan finds `follow-suit/index.html` with `quiet.js` first.
- `node qa/arcade/machines.mjs`: the file checks and the walk pass, 374 checks. The new page has a machine and a switcher entry with the same id and name, its art is a WebP of 12.5 KB, and at 390 by 844 and 1280 by 720 a token and START go to `/follow-suit/`. The other parts run one at a time, because a long run on the software GPU stopped answering mouse moves in the swipe step.
- `npm run build:arcade` gives the same file names again, so the committed copy matches the source.
- `openspec validate follow-suit-arcade --type change --strict` reports the change as valid.

## Not checked

- A real phone, Safari on iOS and a home-screen install.
- Sound through real speakers.

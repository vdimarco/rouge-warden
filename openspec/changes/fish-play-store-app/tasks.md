# Tasks

## Files of the page

- [x] Copy three.js r170 to `public/fish/lib/` with its MIT licence, and point the import map at it.
- [x] Copy the Nunito and Alfa Slab One files and their OFL texts to `public/fish/fonts/`. Add the `@font-face` blocks to the first `<style>`, a preload link for Nunito, and remove the Google Fonts links.
- [x] Draw the icons (`play/fish/make-icons.mjs`) and read them at 512, 256, 192, 96, 48 and 32 px, round and square.
- [x] Write `manifest.webmanifest`, link it, and use the fish icons in the head.
- [x] Write `privacy.html`.
- [x] Reword the page description (no "in your browser").

## App mode and words

- [x] Add the app-mode script after `quiet.js`, the `arcade-only` class and its CSS rule, and load `switch.js` outside app mode only.
- [x] Show the place name alone on the title in app mode.
- [x] Add the app words: sensors denied, blocked, buzz, a cut-off touch, WebGL failure with a Try again button.
- [x] Add the Back button state machine and the one call to `navigator.storage.persist()`.
- [x] Add Reset progress (asks first) and the Privacy card to Settings, and the Privacy link to the title.

## Offline

- [x] Write `sw.js` (cache first, atomic, Range, no `skipWaiting`, claim on the first install) and register it after the title shows.
- [x] Write `play/fish/stamp-sw.mjs` and run it.

## Tests

- [x] Write `qa/fish/pwa.mjs` with a `--static` part, and `.github/workflows/fish-app.yml`.
- [x] Add `serviceWorkers: "block"` to `qa/fish/lib.mjs` and `qa/fish/motion.e2e.mjs`.
- [x] Run `pwa.mjs` in full, and the existing fish tests and `qa/arcade/quiet.mjs --only=fish` and its scan, and compare them with the same tests on the base commit (a copy made with `git archive`). `desk`, `screens` and `reel.ui` fail on the base commit too, with the same failures. `cartoon.render` failed on the base commit (a stale route) and on this tree (a count that depends on timing); both are fixed in the test.
- [x] Prove that each new check can fail (a changed copy of the folder for each check: 74 changed copies, 40 for the static part and 34 for the browser part; each was caught by the check that was meant to catch it, except one that does not change the game, because `pause()` already ignores the catch card).
- [x] Look at the title, Settings, the Reset question and the privacy card at 390 by 844 and 375 by 667, in plain mode and in app mode, and read `privacy.html` at 390 wide.

## Docs

- [x] README: fix the line about full screen, add "Reel It In as an app", add `pwa.mjs` to the test table, add the new files to the file table.
- [x] This change.
- [ ] Validate the spec with the OpenSpec CLI when it is available (the CLI is not installed; it did not run).

## Not checked (no device, no store)

- [ ] DEVICE: the real Back button in a TWA, `display-mode` in a TWA, a video that seeks while offline (the test browser has no H.264, so only the 206 answer is tested), `storage.persist()` in the TWA, what uninstall does to the save, the sensor rate, the safe area and the cutout at API 36, a WebGL draw after ten minutes in the background.
- [ ] UNCONFIRMED: the route in the sensor note (App info, Storage, Manage space). The Bubblewrap template adds the activity behind it, but no device showed it.
- [ ] Owner: put a real email address in `privacy.html` in place of `OWNER_CONTACT_EMAIL`.

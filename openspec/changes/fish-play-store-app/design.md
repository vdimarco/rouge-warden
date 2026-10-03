# Design

## One folder, no other origin

`public/fish/lib/three.module.min.js` is a copy of `public/crimson/lib/three.module.min.js` (r170, sha256 `08fd7545d13d2c7fb65ab691530a802dafefd638596501854f267d0fb13c39e7`) with the MIT licence in `lib/LICENSE`. The import map is `{"imports":{"three":"./lib/three.module.min.js"}}`. The game imports nothing from `three/addons`. The vendored r185 build in `public/vr/lib` is not used: the game was tuned on r170.

The fonts are the `latin` subset of Nunito and Alfa Slab One, with their OFL texts. Nunito is one variable file. The page declares three faces (600, 800, 900) that point at that file, as the Google CSS did, so weight 700 still renders as 800 and the look does not change. The `@font-face` blocks sit in the first `<style>` of `index.html`, because `qa/fish/reel.ui.mjs` copies that block. They use `font-display: swap`, and the page preloads the Nunito file.

## Icons

`play/fish/make-icons.mjs` draws one SVG (a brass fish leaps out of a dark lake, a red and white bobber floats beside it) and takes PNGs of it with Playwright. The colours are the game's. The maskable icon draws the art at 70 % about the centre, and the script measures that the art stays inside the central 80 % circle. The favicon uses a heavier outline and fewer parts.

## App mode

A small script follows `quiet.js` in the `<head>` (`quiet.js` stays the first script) and sets `<html data-app="1">` before the first paint. It turns on for `source=play`, `source=pwa`, `app=1`, a standalone, fullscreen or minimal-ui display mode, or an `android-app://` referrer. `app=0` wins. The answer is kept in `sessionStorage`, never in `localStorage`, because a TWA shares `localStorage` with Chrome and the website must keep its arcade links.

CSS hides `.arcade-only` in app mode. The class is on the title row (Switch game and Back to the arcade), the pause Switch game button, and both Fullscreen buttons. `/arcade/switch.js` is added by a script only outside app mode. `main.js` reads `data-app` once (`APP`) and takes its app words from one object, `APP_TEXT`. Outside app mode every existing text is byte for byte the same.

## The Back button

In app mode, the first tap (`pointerup`) pushes one history entry (`history.state.fish`). Chrome skips history entries that a page adds before any tap, so the push waits for a tap. A Back press pops that entry, and `popstate` runs. The handler puts the entry back, then acts like Escape:

1. a card is open: close it (the privacy card returns to Settings);
2. the game is paused: resume;
3. a cast or a fight is running: pause;
4. the title: warn and put no entry back;
5. the results: go to the title;
6. the catch card, a trip, the arrival card, the unlock card: do nothing.

On the title the first Back shows "Press Back again to leave" and does not push again. The history is then back at its first entry, so the second Back closes the app. The entry returns 2.4 s later, when the words have gone, so a late Back warns again. A tap also puts it back. The page reads `history.state.fish` at load, so a reload on the entry stays armed.

Playwright's `goBack()` does not apply Chrome's history rule, so the tests send `popstate` events and use one real `goBack()`. The real Back button on a phone is a DEVICE check.

## Storage, privacy and reset

In app mode the first tap also calls `navigator.storage.persist()` once and ignores any error.

Reset progress sits in Settings. A first tap shows a question ("You cannot undo this"). Delete removes `fish.v1`, `fish.haptics` and `reel-it-in-guide-v1`, keeps `arcade.sound` (the whole arcade shares it), and reloads the page. A reload is the safe way to leave no old state in memory. A flag stops any write to the save in the short time before the reload. The page opens on the title.

The Privacy row opens a short card inside the game, so a fight is never lost by leaving the page. The card does not link away. Its Done button goes back to Settings and keeps the screen under Settings (`returnTo`), so the pause menu is still there. The full page, `privacy.html`, is linked from the title only. It follows `public/vr/privacy.html` and names the web host's logs, the sensors, the buzz and the wake lock, the delete routes, and the age line. The contact is the placeholder `OWNER_CONTACT_EMAIL`, and the test prints a warning while it is there.

## The service worker

`public/fish/sw.js` is a classic worker with scope `/fish/`. `VERSION` is `<app version>+<10 hex>`, and the cache is `reelitin-<VERSION>`. The hash covers every file the worker caches. `play/fish/stamp-sw.mjs` computes it and rewrites the line, and `qa/fish/pwa.mjs` fails when the line is old.

- Install: `cache.addAll` for the required set (page, styles, every file in `js/`, `lib/`, `fonts/` and `icons/`, the manifest, `privacy.html`, the five art files, `/arcade/quiet.js`). If one fails, the cache is deleted and the install fails: the cache is all or nothing. The four clips are best effort (`cache.add`, errors ignored). Requests use `cache: "no-cache"`, so a new version never keeps a stale file and an unchanged file costs a 304.
- Fetch: cache first, same origin only, GET only. Files outside `/fish/` that are not listed go to the network untouched. A page is matched with `ignoreSearch`, `/fish/` means `index.html`, and an unknown page offline falls back to `index.html`. A network answer is stored only when it is a 200, basic, not redirected, and inside `/fish/`. A 206 is never stored.
- Range: for a cached file with a `Range` header the worker returns a 206 cut from the cached body, with `Content-Range`, `Content-Length` and `Accept-Ranges`. A start past the end gives a 416.
- Update: no `skipWaiting`. A new version installs into its own cache, waits until the app closes, and takes over at the next launch. Activate deletes only caches that start with `reelitin-` and are not current, and calls `clients.claim()` only when no older cache of ours exists, which is the first install.
- Registration: a script at the end of `index.html` waits until the title shows, then registers `sw.js`. `?nosw` skips it.

## Tests

`qa/fish/pwa.mjs` has a static part (no browser: manifest, icon sizes, the list of cached files against the disk, the stamp, no other origin, the three.js hash, the first script, the privacy page, the workflow) and a browser part (app mode, words, Back, Reset, the privacy card, control, an offline start that plays to the first cast, a 206, an update). `--static` runs in CI with Node only. `qa/fish/lib.mjs` and `qa/fish/motion.e2e.mjs` open their contexts with `serviceWorkers: "block"`, so a worker never answers a request that `page.route()` must see.

## Risks

- The word "Site settings" in the sensor note may not match the real route on Android. It sits in one line of `main.js`.
- Chrome may skip the entry that the Back handler puts back, if it counts that push as made without a tap. Then Back closes the app. A device test settles it.
- The clips are cached once. A clip that failed on the first install stays missing until the next `VERSION`. The guide falls back to its drawing, and the pull-back demo shows its poster.

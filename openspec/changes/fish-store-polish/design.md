# Design

The audit reports and their evidence are the source for this change. Each package below owns a set of files. Packages that share `main.js`, `index.html`, or `style.css` change separate parts of those files, and they merge in rounds.

## Store build flag and the native bridge

- A small classic script at the top of `index.html` sets `<html data-build="store">` when `window.Capacitor?.isNativePlatform?.()` is true. The app build script also writes `data-build="store"` into its copy of `index.html`, so the flag is on from the first frame in the app. CSS hides `[data-switch]`, the arcade link, and `[data-fullscreen]` in a store build. `main.js` reads the flag for the kicker, the copy, and the arcade script.
- `js/native.js` is the only module that talks to Capacitor. It gets plugins with `Capacitor.registerPlugin(name)` or `Capacitor.Plugins[name]`, because the site has no bundler and the native runtime injects `window.Capacitor`. Every call is wrapped so a missing plugin does nothing. It gives: `isNative`, `platform`, `isStore`, `haptics`, `onBack(fn)`, `onPause(fn)`, `onResume(fn)`, `keepAwake(on)`, `hideSplash()`, `hideStatusBar()`, `minimize()`, and `prefs.get/set`.
- `haptics.js` gets a third platform kind, `native`, for iOS in the app. It keeps the priority, rate, mute, and busy gates, and maps each pattern to impacts and notifications. Android keeps `navigator.vibrate`; the plugin adds the VIBRATE permission.
- The save mirror: `persist()` also writes the JSON to Preferences. At boot, when web storage has no save, `main.js` waits for at most 400 ms for Preferences and loads that save.

## Boot

- `public/fish/lib/three.module.min.js` is a copy of the r170 file in `public/crimson/lib/`. The import map points at `./lib/three.module.min.js`. The fish code uses no addons.
- `public/fish/fonts/` holds the latin subsets of Alfa Slab One and Nunito (variable weight) as woff2, with the SIL Open Font License. `@font-face` uses `font-display: swap`. No stylesheet blocks the first draw.
- `#boot` is plain HTML and CSS in `index.html`: the logo, a moving bar, and "Loading the lake.". A classic script shows an error card with "Try again" on a module error, on missing WebGL, or when the title is not ready after 15 s. `main.js` removes `#boot` when the title shows.
- The render scale drops only after slow frames for a time, and it climbs back after fast frames for a time, in steps. A context loss calls `pause()`, and a restore forces a full redraw, also under the pause screen.

### What round 1 and the app project settled

- The render scale (`js/render-scale.js`) works from the 75th-percentile frame time of the last 30 drawn frames. Frame times come in whole vsyncs, so a steady 33 ms counts as slow: the scale tests one step down, and when that does not help it marks the screen as capped at 30 Hz and goes back. A climb that turns slow returns at once, and the next try waits 8 s, doubling up to 2 minutes.
- `resume()` waits while the GL context is lost. The pause card says "The lake is coming back." until the restore.
- The save mirror never writes a blank save over a native one. When Preferences answers after the 400 ms race, native writes wait for that answer. A native save with more progress loads, with one reload on the boot screen or the title.
- The splash uses `launchAutoHide: true` with a 6 s fallback, because Capacitor 8 skips the show-duration timer when auto-hide is off. The game hides it sooner when the title or the error card shows.
- The status bar: Capacitor 8's built-in SystemBars and `MainActivity` hide the bars. The app does not install `@capacitor/status-bar`.
- The app build strips every `<script src="/arcade/...">` (the switcher and the arcade's quiet script). The game pauses its own sound on hide and on app pause.

## Casting

- Touch and mouse release: `unpinLine` pushes a virtual sample at the lift point, and `atRaw` does not extrapolate virtual samples.
- Above the press point, the rod angle moves at 0.4 of the finger travel: `theta = 80 + (dy < 0 ? dy * 0.4 : dy) / h * 150`.
- The touch hit area grows to cover the rod, the reel, and the lower lake. The press decides after 12 px: up and down pins the line, sideways aims.
- A press low on the screen gets its own span, fixed at the press (`touchSpanAt`): the room below the press, less 4 px, reaches 125°, past full power. The span is never shorter than 48 px or longer than `touchSpan`. The rail draws its marks with the same span. A hold cast (the mouse, Space) keeps the full span, because the clock moves its rod.
- The motion window is graded by time on both sides. An early lift reads the swing for up to 100 ms after the lift. A thumb held through the swing is graded as a late lift.

## Fight numbers

These come from the audit's sandbox runs. The sims set the final values.

- Grind ramp: when the spool slips, the grind drops to 0 and comes back with `smooth(0, 0.5, slipT)`.
- Easy mode jump rise: +0.2 s, not for legends unless the legend bands still hold.
- Beaten: stamina under 0.12 in the last stage removes the trick moves and multiplies the long-slack throw chance by 0.3.
- Prompt hold: 0.35 s, and urgent prompts (strike, snap risk, jump) skip the hold.

### What the fight package settled

- Grind ramp: `smooth(0, 0.6, slipT)`, and `slipT` runs down 10 times as fast while the spool holds, so each run starts fresh. Cranking never locks the spool past 0.85 of the line's break. Measured: a steady crank into a run snaps a median 0.78 s after the first slip (p25 0.52 s), and a grinder still snaps 36% of the time.
- The first fish of a fresh save is "eager": it ignores lure speed and always strikes before the lure gets home. The gift is used up on the strike, not on the cast.
- The legends kept their original bands and were retuned in `species.js`, so the casual landing rate falls from the first legend (67%) to the last (52%).
- The fight cue carries an explicit crank pace (slow, fast, or steady), so the prompt, the guide, and the rod cue use the same words.
- The toast queue keeps each toast up 1.2 s, holds up to 2, and drops a toast that waited 3 s.

## Goals and the save

- `goals.js` holds the pure tables and helpers: `PLACE_GOALS`, `goalMet(goal, ctx)`, `DAILY` and `dailyGoal(day, save)`, `nextGoal(save, id)`, and `progressNote()`. `journey.js` holds `nextRank(id, kg)`.
- New save fields: `places[id].g` (a bitmask from 0 to 63), `today: { d, k, n, done }`, `days: { n, run, best, last }`, and `bestRun`. `loadSave` cleans each one and keeps old saves working.
- `?day=YYYY-MM-DD` sets the day for QA. Like `?open`, it is never saved.

### What round 2 settled

- Touch and mouse: the cast is graded at the finger's angle when it lifts, and virtual samples are never projected forward. Above the press point the rod turns against a fixed 240 px span on every screen, so the slam edge is 200 px above the press point at any size. A press anywhere decides after 12 px: up and down takes the line, sideways aims. A swipe that never tipped the rod back casts nothing and spends no derby cast.
- Motion: every lift is graded by time; an early lift waits up to 100 ms for the samples. A thumb held through the swing casts at a fixed 30 degrees. Easy mode pulls the release toward the ideal over -15 to 95 degrees.
- The keyboard: holding Space tips the rod back, then swings it forward at 240 degrees a second; letting go grades the cast like a finger.
- The sensor stall is timed from the last real sample, 3 s.
- The report line comes from `reportNote()`: the sweet streak first, then a ring hit, a near miss, the goal hint, the back-swing tip, the Loon "farther out" hint, the longest cast, and the zone.
- The short-caster help: after 20 water casts with the unlock goal open, one big ring at a time rises within reach, stays at least 90 s, and returns after a lost fish, until a big ring's fish is landed. Measured with real rings: median 23 casts and p90 34 to open Stump Bay.
- Every derby cast onto land is given back, and the report says so.
- A catch's news (first fish of the day, goals done, today's goal) shows in one toast with one line each.
- `?day` progress stays in that page load; `persist()` writes the loaded `today` and `days`.

## Feedback

- The hook-set hit: 70 ms freeze of `world.update`, a field-of-view punch of 8% for 120 ms, a rod-tip whip, a "Fish on!" banner, a 70 Hz thump, and a stronger buzz. The jump zoom blends the field of view toward about 10 m of lake across the view at the fish.
- New sounds made in code: `newSpecies`, `stage`, `newPlace`, a derby close, and stronger far splashes.

### What round 3 and the turnaround settled

- Feedback: the hook set freezes `world.update` for 70 ms, punches the view in 8%, whips the rod tip, and shows the "Fish on!" banner. Its sound has a 76 to 62 Hz thump (rms 0.118 against the strike's 0.094), and its buzz is 170 ms on. The strike scales with how hard the fish hit, and the iPhone strike is always two heavy impacts. The jump zoom keeps the leap at 0.64 of the view height and out of the top half (`WORLD.JUMP_ZOOM.at` and `.free`), and the rod is drawn through its matrix, squeezed into the narrow view. A splash at a position that is not a number is ignored, so the water never loses a ripple slot.
- Stingers: a plain fish gets the landed sound; a new kind `newSpecies` (0.62 s); a record `recordCall`; a trophy the fanfare and the shutter; a legend the fanfare and its place's call; a legend's later stage `stage` with no fanfare; a new place `newPlace`; a derby the count-up and the fanfare or `derbyClose`.
- Menus: "Go fishing" is the only red button. The style is "painted" in the save; any value but "original" loads as painted, and the art files are `painted-sky.webp` and `painted-lake.webp`. The app build runs with `--strict`. Larger text is one 1.25 step through `--ui-scale`, `--gauge-w` and `--gauge-h`; it cannot back the App Store Larger Text label, which needs 200%. Calm effects sets `html[data-calm="1"]`; `js/calm.js` reads it with the reduced-motion query. The version lives in `js/version.js`.
- Cutscenes: `js/cutscenes.js` and `cutscenes.css`, with `world.cutCamera(fn | null)`. Ending a cutscene snaps the camera to `camTarget()`, so play never starts during a fly-back. Escape and back skip at once; a tap, Space, or Enter skips after 0.5 s. `#cut` eats only the pointer events that started on it. The save keeps `cuts`; an old save marks as seen the places and legends it has passed. QA pages start with every cutscene seen (`qa/fish/lib.mjs` `SEEN`) unless a check asks for them.
- Turnaround: "Nothing this time" 1 s, the shore 0.9 s, a loss 3.4 s (a legend 4.5 s). A cast input skips after 350 ms (800 ms for a loss) and flows into the next grab; a press on the reel controls ends the beat but never casts. An empty retrieve skips home after 3 s, up to 3 times sooner with a fast crank.
- The mouse: a press that stays within 12 px for 150 ms is a hold cast, timed like the Space cast; sideways movement aims at 0.2 degrees a pixel. A click on the lake feathers the line in the flight.

## Menus and access

- Style names: on screen the "ghibli" value shows as "Painted". `normalizeStyle` accepts `painted` and `ghibli`, so old saves keep their look.
- Larger text sets a `--ui-scale` on `#game`. Calm effects sets `data-calm`, and the CSS treats it like `prefers-reduced-motion`.

## Cutscenes

- `js/cutscenes.js` holds the scripts and the player. A script is a list of shots: camera position, look point, field of view, time, an optional event (a legend breach, a loon call), and a caption. The player eases the camera between keys and draws the live scene, so each place keeps its own look, light, and hour.
- `world.js` gets one small hook, `world.cutCamera(fn | null)`: while a function is set, it gives the camera pose each frame in place of `camTarget()`. The reel camera, the punch, and the jump zoom stay as they are.
- `main.js` starts a cutscene at four points: the first "Go fishing" on a fresh save, the first arrival at a place (before the arrival card), the first gold ring of a legend outside a fight, and the landing of a legend (before the catch card). While one plays, `step()` holds the sim, the clock, and the derby.
- The save keeps `cuts`, a small set of seen ids, cleaned in `loadSave`. An old save marks as seen the arrivals of the places it already opened and the reveals of the legends it already found.
- Calm effects and reduced motion: still shots with fades.
- CSS in `cutscenes.css`: the bars, the caption, the Skip hint, and the fade.

## The app project

- `apps/fish/` holds `package.json` (Capacitor 8.5 and the plugins), `capacitor.config.json`, `scripts/build-www.mjs`, `resources/` (icon and splash sources), the generated `ios/` and `android/` projects, `store/` (listing and data safety), and `README.md`.
- The web bundle `www/` and the copies inside the native projects are made by the build and are not in git.
- The privacy policy is `public/fish/privacy.html`, so the web serves it and the app shows it offline.

## Order of work

1. Boot and shell, and the fight (in parallel).
2. Casting, goals, and the app project.
3. Feedback, and the menus and access.
4. README, full checks, review, and archive.

Each round runs in separate git worktrees. Each worktree serves its own `public/` on its own port for browser checks.

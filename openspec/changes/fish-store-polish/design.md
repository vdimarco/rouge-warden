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

## Casting

- Touch and mouse release: `unpinLine` pushes a virtual sample at the lift point, and `atRaw` does not extrapolate virtual samples.
- Above the press point, the rod angle moves at 0.4 of the finger travel: `theta = 80 + (dy < 0 ? dy * 0.4 : dy) / h * 150`.
- The touch hit area grows to cover the rod, the reel, and the lower lake. The press decides after 12 px: up and down pins the line, sideways aims.
- The motion window is graded by time on both sides. An early lift reads the swing for up to 100 ms after the lift. A thumb held through the swing is graded as a late lift.

## Fight numbers

These come from the audit's sandbox runs. The sims set the final values.

- Grind ramp: when the spool slips, the grind drops to 0 and comes back with `smooth(0, 0.5, slipT)`.
- Easy mode jump rise: +0.2 s, not for legends unless the legend bands still hold.
- Beaten: stamina under 0.12 in the last stage removes the trick moves and multiplies the long-slack throw chance by 0.3.
- Prompt hold: 0.35 s, and urgent prompts (strike, snap risk, jump) skip the hold.

## Goals and the save

- `journey.js` holds the pure tables: `PLACE_GOALS`, `goalMet(goal, ctx)`, `dailyGoal(day, save)`, `nextGoal(save, id)`, and `nextRank(id, kg)`.
- New save fields: `places[id].g` (a bitmask from 0 to 63), `today: { d, k, n, done }`, `days: { n, run, best, last }`, and `bestRun`. `loadSave` cleans each one and keeps old saves working.
- `?day=YYYY-MM-DD` sets the day for QA. Like `?open`, it is never saved.

## Feedback

- The hook-set hit: 70 ms freeze of `world.update`, a field-of-view punch of 8% for 120 ms, a rod-tip whip, a "Fish on!" banner, a 70 Hz thump, and a stronger buzz. The jump zoom blends the field of view toward about 10 m of lake across the view at the fish.
- New sounds made in code: `newSpecies`, `stage`, `newPlace`, a derby close, and stronger far splashes.

## Menus and access

- Style names: on screen the "ghibli" value shows as "Painted". `normalizeStyle` accepts `painted` and `ghibli`, so old saves keep their look.
- Larger text sets a `--ui-scale` on `#game`. Calm effects sets `data-calm`, and the CSS treats it like `prefers-reduced-motion`.

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

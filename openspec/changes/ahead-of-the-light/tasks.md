# Tasks

Tick a task only when its work is done and its checks pass. Groups follow the build spec's work packages (24.1); WP0
goes first, and the contracts let the rest run in parallel. Milestones: M0 the toy, M1 the course (legs 1 and 2), M2
the run, M3 the field, M4 the build, M5 the road home, M6 tune and ship.

## 0. WP0 Spine

- [ ] 0.1 Create `public/ahead-of-the-light/` with `index.html` (`/arcade/quiet.js` first in `<head>`, `/arcade/switch.js`, the import map for three.js r185, a WebGL canvas under a 2D overlay canvas, `touch-action: none`, `viewport-fit=cover`) and a `style.css` skeleton.
- [ ] 0.2 Write `core/tune.js` (`SLUG`, one frozen `TUNE`, `parseOverrides`) and port lab A's geometry to `core/ringmath.js` with `burstPx`, `rivalPx`, `wingsPx` and label placement.
- [ ] 0.3 Write `core/race.js` with `createRace` and `stepRace` in the step order of `design.md`, the event list, stubs for every module API, and the `window.__race` skeleton in `main.js`.
- [ ] 0.4 Write this change's proposal and tasks.
- [ ] 0.5 Check that plain `node` imports every core module (no window, document, storage, three.js, timers, `Date` or `Math.random`) and that the page boots to a blank ring.

## 1. WP1 Handling

- [ ] 1.1 Write `core/handle.js`: steering, pass checks through `kinds.resolve`, the chain, the burn and OBERTH, the whip (window, latch, sweep, red zone, LET GO, release, scorch, one tether per well), draft and tow, contact, gears and hits.
- [ ] 1.2 Write `ui/input.js`: the drag with its gain curve and re-grip, the flick copied from v3's `createFlick`, the press in a window, the latch cancel, keys replayed on the 120 Hz steps, mouse, pad, the scheme lock, the frozen input state, `?button=1`, `?scheme=halves` and `?burn=tap`.
- [ ] 1.3 Pass `qa/ahead-of-the-light/handle.test.mjs`.
- [ ] 1.4 Build the toy at `?toy=30` with minimal drawing, pass its bot pass, and put a tester-ready page on the preview (M0).

## 2. WP2 Course

- [ ] 2.1 Write `core/course/kinds.js` (every kind with `blocked` and `resolve`, the `pair` and `tail` builders) and `legs.js` (`LEG_TYPES`, `ROUTE`, `CONDITIONS`).
- [ ] 2.2 Write `gen.js` (`buildLeg`, `legSeed`), `validate.js` (R1 to R13 on packed rows), `director.js` and `strip.js`.
- [ ] 2.3 Write the pieces for legs 1 and 2 and every gate (`common.js`, `web.js`, `coma.js`, `gates.js`) and `dev/strip.html`.
- [ ] 2.4 Pass `course.test.mjs` on legs 1 and 2, and have the mid bot clear both legs (M1).

## 3. WP3 Survival

- [ ] 3.1 Write `core/survival.js`: gap and TTC, push-backs and the cap, the light's states, the stumble floor, hull and shield, fuel and pickups, the red zone's cost, gates, docks and the dock strip, the landing and years, with the lead items for fuel at full tanks and push-back lost at the cap.
- [ ] 3.2 Pass `survival.test.mjs`.

## 4. WP4 Rivals

- [ ] 4.1 Write `core/rivals.js`: the roster with silhouettes, motifs, knobs and barks as data, `pickRegulars`, `createField`, the perception snapshots, modes, the cost function, mistakes, the lean, standings and the Nemesis.
- [ ] 4.2 Write `core/bosses.js`: the WHALE, MAKO (ties to the nearest ship) and MANTA.
- [ ] 4.3 Pass `rivals.test.mjs`, including the honesty audit and the AI time budget (M3).

## 5. WP5 Run and build

- [ ] 5.1 Write `core/run.js`, `chart.js` (lanes and conditions), `offer.js` (rarity, pity, slots, RISK, SKIP, REROLL, BANISH, place setting the rarity row) and `cards.js` (36 cards and `applyBuild` within the caps).
- [ ] 5.2 Write `core/meta.js`, `save.js` (with the mid-leg snapshot on `pagehide`), `log.js` and `route.js` (facts copied from `light-years-home` with their card ids).
- [ ] 5.3 Pass `run.test.mjs`, `save.test.mjs`, `meta.test.mjs` and `copies.test.mjs` (M2 and M4).

## 6. WP6 Render

- [ ] 6.1 Write `render/scene.js` (the tube camera with `setViewOffset`, sky, dust, headlight, tiers, `adapt()`), `render/hazards.js` (one pooled points buffer) and `render/overlay.js` (ring, ticks, ship, wings, shield, the light's ring and label, rivals, wakes, arcs, bands, red zone, gate lines, dock arc, labels).
- [ ] 6.2 Write `render/vista.js`, `render/chart.js` and `render/landmarks.js` for legs 1 and 2.
- [ ] 6.3 Shoot legs 1 and 2 at 390 × 844, 844 × 390 and 1440 × 900 and review the shots by eye.

## 7. WP7 UI and sound

- [ ] 7.1 Write `ui/hud.js` (speed digits, place, captions through `captions.js`, the caption priority) and `ui/screens.js` (title, break, dock strip, cards, chart chips, result, pause, settings, log, hangar).
- [ ] 7.2 Write `ui/sound.js`, `ui/haptics.js`, `ui/store.js` and `main.js` (boot, the 120 Hz loop, URL options, idle scheduling, the hook).
- [ ] 7.3 Play a whole run by hand at all three sizes.

## 8. WP8 Content

- [ ] 8.1 Write the pieces and backdrops for legs 3 and 4 (`virgo.js`, `local.js`) with the WHALE's road and the VOID.
- [ ] 8.2 Write the pieces and backdrops for legs 5 and 6 (`milkyway.js`, `orion.js`) with the dust and MAKO's field.
- [ ] 8.3 Write the pieces and backdrops for legs 7 and 8 (`neighbours.js`, `earth.js`) with Saturn, the Moon and the landing.
- [ ] 8.4 Pass `course.test.mjs` on every leg and lane and review the contact sheet by eye (M5).

## 9. WP9 Bots and tuning

- [ ] 9.1 Write `core/bots.js` (drivers, presets, run policies, `playRun`) and `qa/ahead-of-the-light/bot.mjs`.
- [ ] 9.2 Write `sim.test.mjs`, `cards-drive.test.mjs` and `toy.test.mjs`.
- [ ] 9.3 Tune `core/tune.js` until every bot target holds or is written up as a known gap, and record the before and after numbers in `design.md`.

## 10. WP10 Ship

- [ ] 10.1 Pass the browser checks `smoke.e2e`, `input.e2e`, `layout.e2e`, `perf.e2e` and `feedback.e2e` at all three sizes.
- [ ] 10.2 Add the arcade machine: the `GAMES` entry, the article and its colours, the Action group, the cabinet screen, the cabinet line, the save key in `qa/arcade/machines.mjs`, `data-switch` on the title and pause menus, and drop `noindex`; pass `qa/arcade/machines.mjs` and `qa/arcade/quiet.mjs`.
- [ ] 10.3 Write the README section with its tests section and add one line to AGENTS.md.
- [ ] 10.4 Make the screenshots and contact sheets and share the preview link.
- [ ] 10.5 Run the user's playtest on real phones, or say plainly what did not run: the flick and press latency, audio and the silent switch, haptics, 60 fps, the whip's spinning world and the first 30 seconds.
- [ ] 10.6 Bring the specs and `design.md` up to date with the code and the bots' numbers, pass `openspec validate ahead-of-the-light --strict`, archive the change after merge and review the canonical specs in `openspec/specs/`.

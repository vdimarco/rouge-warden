# Tasks

## 1. Grey box

- [ ] 1.1 Write `core/physics.js`: rapidity helpers, stereographic `aberrate`, Doppler, `lnY`, `seen`, `blackbodyRGB`, `lutData`, `qGas`, `qCmb`, `heatRatio`, `zoneLimit`, `viewRapidity`, `zoneDistance` and the HUD formatters.
- [ ] 1.2 Write `core/objects.js` and `core/route.js` with chapter I (Coma, Virgo, Fornax): clues, targets, decoys, reveals, zones and coaching; `legLengthLy`, `routeLengthLy`, `zonesFor` and `resolve`.
- [ ] 1.3 Write `core/captions.js` (chunks of at most 3 words and 18 characters, word timings, `wordAt`, Slow ×1.5).
- [ ] 1.4 Write `core/save.js` for best, progress, settings and seen, each with a `storage` argument and junk handling.
- [ ] 1.5 Write `core/engine.js`: phases, actions, events, throttle, heat, cracks, carried heat, clocks, scoring, chapter checkpoints, lost and retry, pause freeze.
- [ ] 1.6 Write `core/pick.js`, `core/project.js`, `core/labels.js`, `core/geo.js` and `core/bot.js` (careful, skilled, reckless).
- [ ] 1.7 Write `ui/input.js` and `ui/hud.js` with plain dots and rings; `index.html`, `style.css` and `main.js` with the fixed 1/60 s loop and `window.__lyh`.
- [ ] 1.8 Add `physics`, `captions`, `save`, `engine`, `geo` and `pure` node tests and `bot.mjs`; all pass.
- [ ] 1.9 Play chapter I at 390×844.

## 2. Light-speed view

- [ ] 2.1 Write `render/view.js` (layers, floating origin, crossfades, tiers, context loss) and `render/points.js` (relativistic point material, Doppler LUT, energy-conserving sprite, headlight).
- [ ] 2.2 Write `core/gen/web.js` (seeded Voronoi cosmic web) and its tests in `gen.test.mjs`.
- [ ] 2.3 Write `ui/overlay.js`: rings, leaders, labels, chevrons and crack lines through `core/project.js`.
- [ ] 2.4 Build the flight strip: shortfall, time rate, throttle bar with notch and next-notch ticks, heat, panes and route bar.
- [ ] 2.5 Add `smoke.e2e.mjs` and `layout.e2e.mjs`; both pass at 1440×900, 390×844 and 844×390.

## 3. Chapters II to IV

- [ ] 3.1 Add chapters II to IV to `core/route.js` and `core/objects.js`: every stop, both spots, the fork, passes, and a source URL for every object.
- [ ] 3.2 Write `core/gas.js`: density model, Reid 2019 arms, named clouds, Local Bubble, Local Interstellar Cloud, solar wind, zone checks, `armsPassed`.
- [ ] 3.3 Write `core/milestones.js` (at most 30, each with a date and source) and `core/timeline.js` (Earth date, milestones between, heard year, arrival text).
- [ ] 3.4 Add the `EARTH · RADIO` clock line for chapter IV.
- [ ] 3.5 Add `route`, `gas` and `timeline` node tests, including the 6-word narration check; all pass.

## 4. Art

- [ ] 4.1 Write `core/gen/galaxy.js` and `render/galaxy.js`: impostor bakes, the Milky Way particle fly-in, dust.
- [ ] 4.2 Write `render/sky.js`: the galactic band cube bake and the aberrated sky.
- [ ] 4.3 Write `render/nebula.js`: domain-warped emission, reflection and dark nebulae.
- [ ] 4.4 Write `core/gen/stars.js` and the named stars at their real places and colours.
- [ ] 4.5 Write `render/planets.js`: Sun, Earth with atmosphere, Moon, Jupiter, Saturn, Neptune, Venus, Mars.
- [ ] 4.6 Write `render/lens.js` for the telescope view on cards.
- [ ] 4.7 Add `visual.e2e.mjs` with the pixel assertions in `design.md`; it passes.

## 5. Ending, audio and performance

- [ ] 5.1 Build the ending (approach, today, two clocks, address pull-back, score card) and the lost ending.
- [ ] 5.2 Write `ui/audio.js`: chapter drones, flight rush, heat, crack, find, cards, drop-out, radio, ending; mute through `arcade.sound`.
- [ ] 5.3 Write `ui/perf.js` and the `?perf` readout; add step-down in `view.adapt()`.
- [ ] 5.4 Add `play.e2e.mjs` and `perf.e2e.mjs`; both pass.
- [ ] 5.5 Make `art/share.jpg` (at most 80 KB) and, with `keyart.mjs`, `public/arcade/light-years-home.webp` (480×270, under 60 KB).

## 6. Arcade integration

- [ ] 6.1 Add the switcher entry to `public/arcade/switch.js` after River Rush.
- [ ] 6.2 Add the cabinet, its colours and its best line to `public/index.html`, and append `light-years-home` to the Action group.
- [ ] 6.3 Update `qa/arcade/groups.e2e.mjs` (Action lists seven games), `qa/arcade/machines.mjs` (keys, good and wanted lines, name pattern) and `qa/arcade/quiet.mjs` (page entry).
- [ ] 6.4 Add `arcade.mjs` for the cabinet best line and launch; it passes.

## 7. README and AGENTS.md

- [ ] 7.1 Add Light Years Home to the README: the arcade paragraph, a section on the quest, controls, best score, physics and art sources, the Files rows and a tests table.
- [ ] 7.2 Add one test line for the game to `AGENTS.md` in the existing pattern.

## 8. QA runs

- [ ] 8.1 Run every `qa/light-years-home/*.test.mjs` and `bot.mjs careful 5`; record the output.
- [ ] 8.2 Run `smoke`, `play`, `layout`, `visual` and `perf` e2e checks and `arcade.mjs` against the local server.
- [ ] 8.3 Rerun the arcade-wide checks: `analytics.test.cjs`, `launch-counts.test.cjs`, `ascii-front/arcade.test.mjs`, `lab/links.mjs`, `groups.e2e.mjs`, `machines.mjs` and `quiet.mjs` (full scan and `--only=light-years-home`).
- [ ] 8.4 Run `openspec validate add-light-years-home --strict`.

## 9. Review

- [ ] 9.1 Review `contact.png` from the visual check at all three layouts, fix what looks wrong, and link it in the PR.
- [ ] 9.2 State in the PR which checks could not run here: real GPU frame times, real phones, touch feel, iOS audio unlock, vibration and listening to the audio. Add the copied `?perf` JSON if a device was available.
- [ ] 9.3 Update `design.md` and the spec for any decision that changed during the build.

## 10. Archive

- [ ] 10.1 Archive this change and review the new canonical `openspec/specs/light-years-home/spec.md`.

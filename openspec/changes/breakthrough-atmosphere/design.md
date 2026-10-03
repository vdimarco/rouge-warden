# Design

## Approach

Keep the existing simulation in `public/breakthrough/game.js`. Derive a presentation look from the current state and paint it in `scene.js`. Cards, portraits, and the reveal live in the page and CSS. No new image files. Motion respects `prefers-reduced-motion` and the existing `?fast=1` class, which already disables CSS animation for QA.

The homepage has no BREAKTHROUGH cabinet today. Add one featured cabinet whose `data-url` is `/breakthrough/`. Do not point it at `breakthrough2`.

## World look

Stress is presentation-only:

`stress = clamp(emissions/110 * 0.40 + (warming-1.35)/1.55 * 0.38 + (1 - ecology/100) * 0.22, 0, 1)`

Warming stays on the existing formula. Labels, using the same stress value the painter blends through:

- Thriving: below 0.30
- Transitioning: below 0.52
- Strained: below 0.74
- Damaged: 0.74 and above

Colors interpolate across four palette stops so the states stay distinct while in-between turns blend. Ecology still thickens forest, water, and fields on its own. Owned clean-energy technologies and the matching synergies add wind, solar, transmission, geothermal, and electrified transit. High stress adds haze, dry ground, wildfire scars, and heat shimmer.

## Breakthroughs

Synergy detection is unchanged. The four named meta-breakthroughs use a full-screen bloom, title, short explanation, scientist line, and particles. The other synergies use the same overlay at a slightly quieter scale. The world re-renders underneath immediately. `?fast=1` closes the overlay when the run ends so the existing end-screen check still sees the ending.

## Scientists

Seven advisors, each an inline SVG portrait. They comment on the current event or the turn's offers, frame the Idea Lab, and react to breakthroughs. No roster, leveling, or assignment system. Comments are chosen from the turn index so they do not consume the game RNG.

## Endings

`finish()` still uses the existing ending thresholds. The end screen paints the final look, then a grade unique to each ending name, plus the log as a timeline and the seed in the stat block.

## Test seam

`window.__test` gains `look`, `preview`, `showEnding`, and `reveal` for inspection. They do not run during a normal game and do not add RNG calls. `preview` does not redraw offers, so it does not advance the seeded shuffle.

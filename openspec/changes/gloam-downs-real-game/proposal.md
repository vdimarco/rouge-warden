# Gloam Downs: a real game

## Why
The player plays on a laptop at 120 Hz with a mouse. They asked for "better music and gameplay" so that Gloam Downs "feels like a real game", and they chose all four parts below. Today a run is the same five places with the same foes each time. The music is good but thin in the low end. A death gives little to keep, and a win has nothing after it.

## What changes
### A. Adaptive music
- Each place keeps its own theme. A new cello carries each explore melody.
- When foes see the lamplighter, low drums come in on the next bar line. When the fight starts, the strings come in on the next bar line. After the fight they fade out on the bar.
- An awake elite adds a hurdy-gurdy drone.
- The boss music builds in six steps as the boss loses health. A fall sting plays when it falls.
- Four new sampled instruments: cello, hurdy-gurdy, low drum and frame drum. We make them by offline synthesis in Node. No paid generation is used. The bank grows from 500 KB to 800 KB at most.

### B. Relics and builds
- Each place has one elite foe with a special move. It drops a relic.
- There are eight relics. Each one clearly changes one move: the roll leaves fire, the finisher throws a spark, and so on.
- Four relic and wick pairs kindle into a stronger effect. So two runs with other picks play differently.

### C. Lasting upgrades and harder levels
- A death always keeps 25% of the glim carried, and Ash pocket raises that to 55%. So every run moves you forward.
- The Lamp-room sells seven lasting unlocks: three new wicks, a starting wick, a flask that an elite refills, and two new moves. It also sells a third Flask level.
- A win opens Ember 1. Each Ember level opens the next one, up to Ember 5. Each level adds one clear rule and pays 15% more glim.

### D. Game feel and variety
- Hit stop stays. The camera shake becomes gentle: it shows on heavy hits only, and it is never more than 0.15 m. The pause panel gets a Shake switch, which is off by default under reduced motion.
- Heavy foes and elites have poise. They stagger when it breaks.
- A combo meter counts the hits that land. Its tiers raise the glim that foes drop and brighten the lamp.
- Seeded runs: the seed picks the foe mix in each zone, which zone holds the elite, the relics, and from Ember 1 the order of places II to IV. The pause panel shows a seed code.
- A guard zone rises again in a second, smaller wave, so each beacon is a real fight.

## Capabilities
- Modified: `gloam-downs-run`, the run capability of the `add-gloam-downs` change. The run's music, Lamp-room, wicks, feel, save and pacing requirements live there. The delta is `specs/gloam-downs-run/spec.md`.
- The explorer capability, `gloam-downs`, does not change. Wander and the Gilt Lattice do not change.

## Scope
- The art direction stays: dusk and night, and fire is always the brightest colour. Every new effect uses the place's palette slots, and fire slot 37 is never passed.
- Every input stays: mouse, keyboard, touch and gamepad. The new moves use the buttons that exist. The layouts at 390, 320 and 1280 stay.
- The smooth camera stays. `play.js` camera code does not change. The shake goes through `world.anim.kick` as it does now, and `qa/lab/gloam-downs-camera.test.mjs` must still pass.
- The baked places, foes and boss files do not change. Elites are the baked foe types at a larger size, with an ember crown from the spark pool.
- Names of elites, relics, unlocks and Ember rules are our own. No name, item or layout comes from Dead Cells, Hades, Slay the Spire or any other game.
- No Higgsfield or other paid generation.

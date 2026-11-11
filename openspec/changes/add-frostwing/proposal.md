# Frostwing: a four-on-four team dogfight over a frozen moon

Add Frostwing at `/frostwing/`, an original 3D arcade air-combat game with a cabinet in the Action group of the Cottage Arcade.

## Why

The request was a one-to-one replica of a Nintendo game, built from a screenshot of a team match over snow, with that series' character James McCloud added. The arcade cannot ship another company's game, characters, names or art. Frostwing keeps what made the screenshot fun: two squadrons fight over a snowy valley with old ruins, both teams score on one board against a clock, a meteor shower drops energy to collect, and the HUD has a systems bar, a bomb count, a kill feed with portraits, radar and an objective banner. Everything else is new. James McCloud's place goes to Captain Silas Vane, an original veteran pilot: the retired founder of Lantern Squadron who returns for one more season.

## Scope

- One static page in `public/frostwing/` with no build step. `sim.js` holds the whole match and has no DOM, so node tests and bots can run full matches. `game.js` draws it with the vendored three.js r170 and adds input, sound and screens.
- Lantern Squadron (Juno Reyes, Pip Okafor, Brann Hale, Silas Vane) against the Corvid Pack (Vex Morrow, Nyra Kade, Grell, Sable). The player picks one Lantern pilot. Bots fly the other seven.
- A four-minute match. A down scores 10. Meteor showers come every 50 seconds. Energy orbs score 5 each, and the team that gathers more energy in a shower earns 25.
- Lasers, a charged homing shot with lock-on, smart bombs, boost, brake, barrel roll and U-turn.
- Three rival difficulties. The pitch direction can be set either way.
- Keyboard, mouse, gamepad and touch controls. The page fits desktop, portrait phone and landscape phone screens.
- Pilot portraits and key art generated with Higgsfield (`gpt_image_2_6`), all original designs.
- A synthesized score and sound effects from the Web Audio API.
- A cabinet at the end of the Action row, a Switch game entry, a cabinet line read from the save, and a `quiet.mjs` entry.

## Out of scope

- Online or same-screen multiplayer.
- A story campaign. Frostwing has one match type.
- Any name, character, ship, emblem, music or art from the Nintendo series.

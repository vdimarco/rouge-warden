# Primordia

A Lenia arcade game. You are a small glowing protist in a living dish. Eat the cyan Orbium gliders to keep your light up. Red hunters stalk you, wind up, show their lane, glint and lunge. Dash out of the lane, dash into the glint to parry and slow the dish, or dash across a body to cut it. A torn or parried hunter reels gold: swim into it for a Glory Bite, then catch the live prey it drops. Fighting fills a Burst that blasts every hunter near you.

Every meal and kill fills the GROW bar, and you get bigger. At half the bar, swarms and eggs turn gold and become food. A full bar grows the dish: the red hunters turn blue, the whole dish shrinks into the middle of a dish twice its size, and each old hunter lives on as an Orbium you can eat. Then you pick a mutation, and a bigger red hunter with a new move comes for you:

- Size I: *Paraptera*.
- Size II: *Pentapteryx*. It strikes twice.
- Size III: *Hexapteryx*. It lays eggs. A full bar calls the Leviathan, and the dish grows when it leaves.
- Size IV: *Heptapteryx*. It strikes fast.
- Size V and up: every hunter uses every move.

The first PLAY opens a short How to play intro: the same moves, played out on the real dish with captions. HOW TO PLAY (or H) on the title screen replays it.

Every creature is a real pattern from Bert Chan's [Lenia](https://chakazul.github.io/Lenia/JavaScript/Lenia.html) catalogue, simulated live:

- Prey: *Orbium unicaudatus* (R=13, bump4 kernel, growth gaus(0.15, 0.017)).
- Hunters, from the max-fleet compilation (growth gaus(0.337, 0.057)), run at R=10:
  - *Paraptera* and *Pentapteryx*: lancers.
  - *Hexapteryx*: heavy lancer.
  - *Heptapteryx*: a heavy lancer from Size IV, and the Leviathan on Sizes III, VI, IX and up, torn apart wing by wing.
  - *Discutium*: swarms that rush you.
  - *Circium*: eggs that hatch a Discutium unless you pop them.

## Controls

- Swim: mouse, WASD or arrows, left stick, or drag anywhere on touch.
- Dash, cut, parry: Space, Z, J or left click; gamepad A; DASH on touch. Two charges; eating refills one.
- Burst: Shift, X, K, F or right click; gamepad B; BURST on touch, when it glows.
- Pause: Escape or P. Mute: M. Restart after death: R or Enter, or tap.
- Intro: Next, Enter, a tap on the dish or gamepad A for the next scene; Skip, Escape or gamepad B to leave.

## Files

- `lenia.js`: the two-channel Lenia world (FFT convolution, agar, quorum toxin, advection, whole-cell roll, the 2x zoom-out, blob tracking and shape, pattern decoder).
- `species.js`: the creature patterns in Lenia's zip encoding.
- `core.js`: game rules with no DOM (`TUNE` holds every tuning value): the player, the hunters' state machine, damage, Burst, the wave director, the Leviathan, mutations, growth, the grow sequence and the size tiers.
- `game.js`, `render.js`, `audio.js`: the browser shell, the WebGL2 dish shader and the Web Audio score.
- `intro.js`: the How to play scenes. Each scene sets up the dish and steers the player with ordinary input; no DOM code.
- `attract.js`: the small live dish on the arcade cabinet screen.

## Checks

```sh
node qa/primordia/lenia.test.mjs          # Lenia behaviour and core rules
node qa/primordia/combat.test.mjs         # the combat mechanics
node qa/primordia/growth.test.mjs         # growth, the dish zoom, sizes and their moves
node qa/primordia/intro.test.mjs          # each intro scene shows its move
node qa/primordia/bot.mjs 160 7 ref       # a bot plays a run (policies: ref, blind, idle, asap)
NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs   # needs the static server on :8765
```

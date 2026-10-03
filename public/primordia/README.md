# Primordia

A Lenia arcade game. You are a small glowing protist in a living dish. Eat the cyan Orbium gliders to keep your light up. Avoid the red hunters, which stalk you and sting. Fill the Frenzy meter, and then you can eat the hunters while they flee.

Every creature is a real pattern from Bert Chan's [Lenia](https://chakazul.github.io/Lenia/JavaScript/Lenia.html) catalogue, simulated live:

- Prey: *Orbium unicaudatus* (R=13, bump4 kernel, growth gaus(0.15, 0.017)).
- Hunters: *Paraptera*, *Pentapteryx*, *Hexapteryx* and *Heptapteryx* from the max-fleet compilation (growth gaus(0.337, 0.057)), run at R=10.

## Files

- `lenia.js`: the two-channel Lenia world (FFT convolution, agar, quorum toxin, advection, blob tracking, pattern decoder).
- `species.js`: the creature patterns in Lenia's zip encoding.
- `core.js`: game rules with no DOM (player, eating, Frenzy, spawns, epochs, mutations).
- `game.js`, `render.js`, `audio.js`: the browser shell, the WebGL2 dish shader and the Web Audio score.

## Checks

```sh
node qa/primordia/lenia.test.mjs          # Lenia behaviour and game rules
node qa/primordia/bot.mjs 200 7           # a bot plays a 200 s run on seed 7
NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs   # needs the static server on :8765
```

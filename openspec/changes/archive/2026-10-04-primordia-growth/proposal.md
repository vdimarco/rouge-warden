# Primordia: Eat to Grow

## Why

After The Hunt merged, the user asked for three things in a row:

1. "As you eat, you get bigger. And you grow into a bigger and bigger entity. And fight bigger and bigger enemies."
2. "The world itself should grow. It should feel like the whole petri dish is expanding as you eat more enemies."
3. "And the enemies from the previous round become kind of like the blue ones, and the new red, harder, more interesting enemies emerge."

Primordia had no sense of growth. A run advanced on a 40-second timer, the player stayed the same size, and the dish never changed.

## What Changes

- **GROW bar.** Every meal and kill fills it, hunters most. The player's cell grows 1.5x within a size, with a wider mouth and a wider cut. At half the bar, swarms and eggs become food.
- **The dish grows.** A full bar freezes play for about 2 seconds. A cyan wave turns the red hunters blue, the whole dish shrinks into the middle quarter of a dish twice its size, and the camera pulls back. Each old hunter becomes a living Orbium prey. The grid stays 256x128, so the cost per frame does not change.
- **Sizes replace the 40-second epochs.** Each size ends when the dish grows, then the mutation cards appear. Each size brings a bigger red arc with one new move: Paraptera (Size I), Pentapteryx that strikes twice (II), Hexapteryx that lays eggs, with the Leviathan as the apex (III), and Heptapteryx that strikes fast (IV). An outgrown arc does not come back red in Sizes II to IV.
- HUD, sound, shader cues, results and the How to play intro follow the new loop.

A design workflow produced this plan: five designers (zoom games, mass games, food-chain games, evolution games, roguelites), two Lenia lab technicians on the real engine (the fractal zoom, the tier roster), three judges and a synthesizer. design.md keeps the decisions and the lab numbers.

## Scope

- `public/primordia/lenia.js`: `World.zoomOut`, a disc fill.
- `public/primordia/core.js`: growth, outgrow, the grow sequence, sizes, tiers, moves, apex.
- `public/primordia/game.js`, `render.js`, `audio.js`, `index.html`, `style.css`: camera zoom, molt wave, GROW HUD, cues.
- `public/primordia/intro.js`: a GROW scene and the end card.
- QA: a new `qa/primordia/growth.test.mjs`; updates to the combat, Lenia and intro tests, the bot, the metrics and the browser smoke.

## Out of scope

New Lenia species (Octapteryx and up need a separate change with in-game fusion tests), a bigger grid or a third channel, a follow camera, per-tier hue shifts, and size penalties on speed or hunger.

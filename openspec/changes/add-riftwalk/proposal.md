# Riftwalk

## Why
The user shared a video by Ian Curtis of World Labs: "Portal jumping through gaussian splat worlds with WebGPU". The user asked for something inspired by that video for the arcade, made with Viggle PINOC.

## What changes
- A new Lab game, Riftwalk, at `/lab/riftwalk/`. The player stands in a painted Gaussian splat world, catches three wisps, and steps through the rift that opens into the next world. Four worlds make a loop that ends at the cottage, with a time.
- The four worlds are PINOC scenes. A packer makes each one small enough for the arcade.
- The game has its homepage cabinet in the Lab row, its switcher entry, its Corridor piece and its Lab page card.

## Scope
Riftwalk is an original game. It takes one idea from the video: a ring-shaped opening between splat worlds that the player can see through and walk through. It copies no world, no art and no sound from the video. The game has no sound.

It is not a WebGPU project. It draws with WebGL2, which the arcade already uses on phones.

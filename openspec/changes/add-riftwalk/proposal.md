# Riftwalk

## Why
The user shared a video by Ian Curtis of World Labs: "Portal jumping through gaussian splat worlds with WebGPU". The user asked for something inspired by it for the arcade.

The first version was a walk between four PINOC splat worlds with wisps to catch. The user played it and said two things: the worlds looked low fidelity, and the game was boring. The user then asked for this: a Gaussian splat world made with World Labs that mimics a cyberpunk arcade, to showcase the arcade's games and open portals that launch them.

## What changes
- Riftwalk at `/lab/riftwalk/` becomes a hall of portals. The hall is one splat world made with Marble by World Labs. A ring of portals stands around the visitor: one for each of the six collections, then one for each game of the open collection. A game's portal launches the game.
- The wisp game, its four PINOC worlds, its packer and its tests are removed.
- The cabinet, the switcher entry, the Corridor piece and the Lab card keep the id `riftwalk`, the title "Riftwalk" and the route, with new words and new art.

## Scope
The hall is a way into the games. It has no score and no fail state. It has no sound. It does not replace the homepage.

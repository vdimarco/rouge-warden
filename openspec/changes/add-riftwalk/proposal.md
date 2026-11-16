# Riftwalk

## Why
The user shared a video by Ian Curtis of World Labs: "Portal jumping through gaussian splat worlds with WebGPU". The user asked for something inspired by it for the arcade.

The first version was a walk between four PINOC splat worlds with wisps to catch. The user played it and said two things: the worlds looked low fidelity, and the game was boring. The user then asked for this: a Gaussian splat world made with World Labs that mimics a cyberpunk arcade, to showcase the arcade's games and open portals that launch them.

## What changes
- Riftwalk at `/lab/riftwalk/` becomes a hall of machines. The hall is one splat world made with Marble by World Labs: a dark neon den with ten cabinets in a circle. The user saw a first hall with floating portals and asked for a darker, denser, more cyberpunk world, with each machine's main screen as the portal, with a live edge. Each screen now shows one game of the collection that is on, and a tap on the screen launches the game.
- The user then asked for "a bigger hall where you can move between zones", "of game categories", and "higher fidelity". The hall now has one zone for each game category: Cottage, Action, ASCII Scenes, Strategy, GTA and Lab. Each zone is its own Marble world with its own machines. Two rift doors in each zone show the zones next to it and take the visitor there. Every zone ships its full-resolution world, and the next zones load ahead.
- The user then asked for clusters: machines next to each other in sections, with a rift above, beside or behind each section, and agreed to one hall made with World Labs Atlas. The six rooms are replaced by one hall of 2,000,000 splats. Each category has its own cluster of machines, every machine shows a game at once, and a rift ring over each cluster glides the visitor to it.
- The wisp game, its four PINOC worlds, its packer and its tests are removed.
- The cabinet, the switcher entry, the Corridor piece and the Lab card keep the id `riftwalk`, the title "Riftwalk" and the route, with new words and new art.

## Scope
The hall is a way into the games. It has no score and no fail state. It has no sound. It does not replace the homepage.

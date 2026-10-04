# Moonwell: endless side-scrolling pinball

The user said Moonwell is boring. The table is one small corner of a still painting, and nothing changes from one dungeon to the next. The user asked for horizontal pinball: the ball moves from left to right, the screen scrolls with it, and the level never ends. A later message asked us to go as far as we can and to follow good practice for fun, engaging game design.

## Scope

- Replace the fixed table with an endless row of islands made from a seed. Gold flippers guard the water gap between two islands. The left flipper sends the pearl forward over the next ridge. The right flipper passes it back into the bowl.
- Scroll the camera with the pearl, look ahead, and zoom out when the pearl flies high.
- Close a moon gate on each ridge the pearl crosses, so the run only goes forward.
- Fill the air above the islands with stars, bumpers, lanterns, mills, gold rails, moon portals and big pearls. A director picks them so the run keeps changing and gets harder.
- Score with a streak multiplier, a moon meter that starts Moonrise, long shots, swift clears and clutch saves.
- Put a moonwell shrine at the end of every region. The pearl must enter the well. The player picks one of three charms, and the next region starts.
- Show the best distance as a flag in the world, and save the best run in this browser. The arcade machine shows it.
- Play with the keyboard, touch (each half of the screen is a flipper), or a gamepad. Teach the controls on the first island.
- Add procedural sound and music, screen shake, hit pauses, particles and a trail. Respect reduced motion and mute.
- Add node checks for the world, the physics and the rules, a bot that plays real runs, and browser checks.

## Out of scope

- New painted art. The game uses the existing painting and sprites, and draws the islands in code.
- A daily seed and online scores.
- Changes to other games.

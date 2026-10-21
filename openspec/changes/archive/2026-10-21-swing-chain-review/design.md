# A held swing skips the building it left

Marvel's Spider-Man 2 (Insomniac, 2023) chains a held swing onto the next structure. It does not regrab the tower just left, and it does not drop a web over open water while the button is still down. The words and the city stay the ones already in this game. None of the grass, water, outline, or painted-look sources fit: this is the swing, not a water shader.

## Decisions

- A building's tiers share one `bid`. An antenna on that roof uses the same `bid` and its own collider id. The chain remembers the `bid`, and the easy search skips every collider with that `bid`.
- Comparing collider ids stays wrong: the upper tier and the antenna are different ids on the same building.
- A sky rope lets go on the cue only when a building is already ahead to catch. Over open water nothing is ahead, so the sky rope stays while the button is held. The button coming up still releases it.
- The cue still has to be showing for a third of a second before a building rope lets go. Phone, toggle hold, headset, clogs, pipes, and the crack are unchanged.

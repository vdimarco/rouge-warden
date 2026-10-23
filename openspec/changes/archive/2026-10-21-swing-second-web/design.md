# A second web takes a different building

Marvel's Spider-Man 2 (Insomniac, 2023) puts a second web on a different structure. The words and the city stay the ones already in this game. None of the grass, water, outline, or painted-look sources fit: this is the swing, not a shader.

The chase view already picks an auto anchor. `playerEasy` now takes the building id to skip, from the other rope when it is already on, or from the shot that landed earlier in the same frame. The kick is recorded at the shot, before physics attaches both ropes, so two presses in one frame can still kick once each, and a later second web does not.

The easy web is an ink line. `ropes.info()` reports that line's hand and anchor so a check can see where it starts.

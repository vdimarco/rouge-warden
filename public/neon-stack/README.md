# Neon Stack

A lab toy. One rainy night block, drawn with raw WebGL2 as stacks of flat slices. There is no build step and no image file in the scene. Serve `public` and open `/neon-stack/`.

`?seed=` fixes the building heights and which wall each sign stands on. The same seed is the same block.

The page starts on a slow spin. The first tap or click drops you in the alley. After that, tap or click a tile to walk there at 3 tiles a second, around the buildings and the parked car. One finger, or the right mouse button, turns the view. A second finger dragged vertically, or the wheel, tilts it. Tilt stays between 20 and 87 degrees and starts at 55. Q and E turn, and WASD walks, on a wide screen. A drag never also walks.

The runner wears ochre. Idle and the two run poses are a stack of horizontal slices that turns to face the walk. Crouch, hack, and spotted stay a flat card. The stack is darker at the feet and casts a contact shadow on the street, away from the sun. A building between the camera and the runner loses its upper slices. Where a wall still covers the runner, the hidden part is a flat paper silhouette.

Five signs and the car's underglow are steady lights. The open eye is the only sign that flicks off, for about 80 ms every few seconds. The barrel is the amber light, flickering beside a sign. `window.__test` can aim the camera, move the runner, force the cutaway, and switch a sign off. A switched-off sign's tubes go mid-grey and its light fades over 150 ms.

Coordinates: `player.x` and `player.y`, and each light's `x` and `y`, are tile positions on the 6 by 6 block. A light's `z` is its height in world units. One tile is 32 units.

A browser without WebGL2 gets a line of text saying so.

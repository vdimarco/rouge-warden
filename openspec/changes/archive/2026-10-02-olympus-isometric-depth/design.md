# Design

Use a reversible affine projection: isometric rotates the world 45 degrees and compresses its vertical plane; top-down uses identity. World collisions and timing remain unchanged. Inverse-project screen input, then normalize to preserve the joystick magnitude and world speed. Project velocity for sprite facing.

Draw textures, circles, charge lanes and floor shadows with one ground transform. Draw upright sprites at projected foot anchors. Sort props and actors by projected floor depth. Ruin plinths have separate illuminated tops and shaded sides. Fade tall props when their screen silhouette covers the player. Bound terrain generation using inverse-projected viewport corners.

Store the camera setting independently from legacy progression. Apply view changes at title/pause and clear input. Verify projection math and actual engine input/state, render all three realms in portrait/landscape/desktop, inspect live toggle/reload, and run the production build. Physical phone testing remains manual. OpenSpec CLI is unavailable; inspect Markdown structure manually.

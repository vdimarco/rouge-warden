# Splat Isle

## Why
The user shared a post by JungleSilicon about Gaussian splats made with no scan and no image model: each object is written as signed distance shapes, splats are laid on their surface like brush strokes with the light baked in, and a pixel-art pass with a tight palette goes on last, so the scene reads as 16-bit art that can be turned round. Because the shapes stay underneath, the splats can be moved, melted and broken apart. The user asked: "can we play with this idea?"

## What changes
- A new Lab toy at `/lab/splat-isle/`: a small island at sunset with a cottage, a lighthouse, trees, rocks, clouds, the sea, and a goat that walks a path.
- Every object is written as distance shapes in `scene.js`. `sdf.js` lays splats on their surface and bakes a warm sun, a soft shadow, the sky and ambient occlusion into each one. Spark draws them.
- A pixel pass draws the scene small and snaps it to a palette with an ordered dither. It can be turned off to show the plain soft splats.
- Play: tap a thing to break it apart, and it pops back on the shapes underneath; Goop changes the size of every stroke; Shapes shows the math underneath; Ride the goat puts the view on its back; New island paints another layout.
- The toy gets its cabinet at the end of the Lab row, its switcher entry (Lab only), its Corridor piece after Riftwalk, its Lab card and its dates.

## Scope
A toy, with no score and no sound. The island is built in the page each time it loads (about 3 seconds on a desktop); no splat file ships.

# Design

## Art direction
The user's direction is the video: warm and cold painted rooms, seen through a bright ring with loose motes. The four worlds take their subjects from the arcade: a lakeside cottage room, a shore ruin at golden hour (Shore of the Ancients), an ice cavern under an aurora (Frostwing), and a moonlit well in a forest (Moonwell).

The first cottage scene from PINOC had arcade machines whose marquees and screens copied the look of real games. It was replaced by a room with no machines and no writing.

## Sources looked up, and what was adapted
- Gaussian splat drawing: Spark 2.4.0 by World Labs (sparkjs.dev, MIT), a splat renderer for three.js. World Labs is where the video's author works, and Spark is the open library for this kind of scene. The arcade's three.js is r185, and Spark needs r180 or later. Spark is vendored at `public/lab/riftwalk/lib/spark.module.min.js` with its licence, and three's `postprocessing/Pass.js` (r185) beside it, because Spark imports it.
- Portals: Spark's own `SparkPortals` class. It draws the scene twice: first from a second camera placed in the far world, clipped to the disc; then from the walker's camera, with every fragment behind the disc thrown away. It also moves the camera's parent frame when the walker crosses the disc. Riftwalk uses that class as it is. This is the stencil-free "two cameras, clip in the fragment shader" form of the classic portal method (as in Valve's Portal talks), which fits splats because splats write no depth.
- The ring: no source fit, so it is new. One quad with a noise band on the disc edge hides the hard cut, and 260 points circle and drift outward. The angle is fed to the noise as a point on a circle, so the band has no seam.
- Scene scale: PINOC's own rule. The capture point is the origin and the floor is about 1.5 m below it, so the nearest ground under the origin gives the metres in one file unit.

## Worlds
`games/riftwalk/tools/pack-world.mjs` reads a raw PINOC scene (about 1,050,000 splats, 17 MB), scales it to metres with the floor on y = 0, keeps 300,000 splats chosen with a seeded shuffle, widens the kept ones by the square root of the thinning (capped at 1.8) so surfaces stay closed, and writes a gzip `.spz` with no spherical harmonics. Each world is about 4.7 to 5.0 MB. The first two load before Start, and the other two load during play.

The same tool makes 6,000-splat copies in `worlds/lite/` (about 100 KB each). The browser check loads them with `?worlds=lite`, because software WebGL draws a full world at a frame in many seconds.

The four worlds stand 400 m apart in one scene. Only the world the walker is in, and the one behind an open rift, are drawn.

## Rules
`public/lab/riftwalk/rules.js` holds the rules with no drawing: where each rift stands and which way it fronts, the walk circle, the lane to an open rift, and the rays that catch a wisp or pick the rift. A splat world is sharp near its capture point and falls apart far from it, so the walker stays in a circle of 1.1 to 2.0 m around that point.

## Controls
- Look: drag the view (mouse or one finger). The view follows the finger.
- Wisps and rift: tap or click. Space or Enter catches the wisp in the middle of the view, or enters the open rift.
- Walk: W A S D and the arrow keys (left and right turn). On a touch screen, a walk pad at the lower left.
A player can finish the game with taps alone, or with the keyboard alone.

## Reduced motion
The ring's motes and the wisps' bob stop, the rift opens at once, and a crossing by tap or key is one cut with no glide.

## Not done
No sound. No WebGPU. No fill of the scenes' unseen sides (PINOC "expand"), because the walker stays near the capture point.

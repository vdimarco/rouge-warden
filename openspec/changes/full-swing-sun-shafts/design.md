# Sun shafts

## Source

Kenny Mitchell, "Volumetric Light Scattering as a Post-Process", GPU Gems 3, chapter 13. A radial gather toward the sun, keeping only samples that are the far sky, so geometry occludes the light. The decay and the sample count are shortened (10 steps) so the pass stays one full-screen draw. The added light is capped. Nothing is taken from Spider-Man 2.

## Decisions

- The gather rides the existing flat composite. When bloom and the Verse pass are both off, the scene still renders to the offscreen target so the shafts have a depth buffer.
- A headset does not run this pass.
- The sky is the only light source in the gather: a sample must be at the far depth and warmer than it is blue, so windows and lane paint do not throw shafts.

# Design

## The idea, in the user's words
"can we play with this idea?", about JungleSilicon's post (x.com/JungleSilicon/status/2121782359901212987): objects written as SDF primitives, Gaussian splats laid along their surface like brush strokes with the light baked into each one, a pixel-art post-process with a tight palette last, and the shapes underneath used to rig, resize or rip the objects apart.

## Shapes (`sdf.js`)
- Primitives: sphere, ellipsoid, box with round edges, capsule, cylinder, capped cone, torus. Each has a place, an Euler turn (x, then y, then z) and a material. A shape can blend into the shapes before it with a smooth minimum of width `k`, or cut a hole (`cut: true`), as the cottage's door and windows do.
- Source: Inigo Quilez, "distance functions" and "smooth minimum" (iquilezles.org/articles/distfunctions, /smin). The ellipsoid is his bound, which is close near the surface.

## Strokes
- Random points in a part's box are kept when they fall within a thin shell (5 cm) round the surface, then pulled onto it along the gradient. A uniform density in the shell gives a uniform density on the surface, whatever the shape. The test checks that a sphere with twice the area gets twice the strokes, and that every stroke is on the surface within 1 cm.
- A stroke is a flat Gaussian: about 0.62 of the spacing across, 1.6 times longer one way, and a fifth as thick along the normal. Its long axis follows the part's stroke direction (up for bark and the lighthouse, a slant for the sea) or a random way, so the surface reads as brush work.
- The owner of a stroke is the nearest shape, or a cut shape whose face it is on, and that shape's material gives the colour, with a small random change per stroke.
- Searches found work that projects Gaussians onto an SDF's zero set in training (a survey summary of SDF-regularized splatting) and NURBS Splatting, which fills shapes with SDF-controlled Gaussians, but no pipeline that paints procedural content this way, so the sampler is my own.

## Light, baked in
- A warm low sun, a blue sky from above and a little bounce from below, with Quilez's soft shadow (/rmshadows) toward the sun and his five-step ambient occlusion along the normal.
- The shadows march through a grid of the island's distances (about 0.16 m a cell) in place of every shape, which makes the bake quick. The goat and the clouds move, so they get no cast shadow.
- A lamp material (windows, the lighthouse lamp) keeps its own colour.

## The pixel pass
- The scene draws into a target about 270 lines high. A full-screen pass reads it with no smoothing, adds a 4×4 Bayer dither in gamma space and snaps each pixel to the nearest colour of a palette, then the browser shows it larger with no smoothing.
- Palettes, all made for this toy: Dusk (24 colours), Meadow (16) and Pocket (4 greens). The fewer the colours, the stronger the dither.
- Sources: the GameDev.net "Pixel Art Palette Filter" (gamedev.net/shaderlab/39-pixel-art-palette-filter), which keeps the spatial and the colour steps apart and uses a 4×4 Bayer matrix, and Maxime Heckel's "The Art of Dithering and Retro Shading for the Web" (blog.maximeheckel.com), a Bayer dither as a post-process on a three.js scene.

## Moving the splats
- Each part is one Spark `SplatMesh` built from a `PackedSplats` in a group at its joint. The goat's legs, head and tail turn about their joints, so its strokes walk with it. Clouds turn slowly round the island and the sea bobs.
- Break: a tap on a thing sends its strokes out along their normals and up, then down under gravity, smaller and fainter, over 0.9 s. The page writes the strokes again each frame with `setSplat`. After 1.1 s the strokes pop back from the object's middle onto the shapes with an overshoot.
- Goop: one number scales every stroke (0.3 to 3). Small strokes show the dots; large ones melt into each other. The sea keeps its size, because it is the background.
- Shapes: each shape as a few clean lines (rings and edges), over the strokes. A dense wireframe turned into blobs in the pixel pass.
- Ride the goat: the camera sits on its back and looks ahead along its path.

## Layout
- The goat walks a ring path at 4.15 m. Trees and rocks keep clear of it, and the lighthouse stands on the far side from the sun, so the first view, from the sun's side, sees the island lit and the lighthouse behind.
- New island: another seed for the layout, the trees and the rocks.

## Size and speed
- Desktop: about 135,000 strokes, built in about 3 s. A touch device: 0.6 of that. `?q=low` (the browser check): about 45,000.
- The ground stops at the water line (`clip`), so no strokes go under the sea.

## Not done
- No sound.
- The light is baked once: a moved goat keeps the light it was painted with.
- Not seen on a real phone or a real graphics card.

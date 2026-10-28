# Design

## Sources

- **The user's build guide** ("Spider-Verse Style Game Build Guide"): its shader checklist (interior lines by edge detection on depth, hatching in the dark bands, mood grading as a float that drives the background's hue and saturation) and its animation checklist (velocity smears: stretch along the velocity past a threshold, clamped).
- **Edge detection on depth.** The usual post-process outline: compare a pixel's depth with its neighbours and ink a large step. We use the four neighbours' differences divided by the pixel's own distance, so the threshold means the same near and far. No normal buffer exists, so creases inside a flat face get no line; the ink hulls still draw the objects' outlines.
- **Smears.** Sony Pictures Imageworks drew smears and multiples in place of motion blur ("Swing into Another Dimension", SIGGRAPH 2019). The guide's vertex-shader stretch needs every skinned material patched; a stretch of the whole body by one matrix, about the chest, gives the same read at no cost.

## All of it rides on the Verse pass

The lines read the depth texture the plates already read: four more depth reads per pixel. The hatching and the mood are arithmetic on the colour. Nothing new draws. `bloom.render` takes `lines`, `hatch`, `mood` and `moodTint` in its `verse` object.

## The mood is real time

`verseFrame` eases `moodFight` (goons fighting) and `moodHurt` (1 at one heart, 0 at four) at 1.2/s in real time, so a hit-stop does not hold it. The tint is the stronger one's colour, and the amount is 45 % of the stronger one. The mood leaves the light (luminance over 0.9) as it is and acts most on the shadows.

## The smear is a matrix between the tilt and the holder

`hero.js` puts a `smear` group between `tilt` (the hang about the chest) and `holder` (the model, squashed about the feet). Its matrix is R · S · Rᵀ, where R turns x to the velocity in the tilt's frame, and S stretches x by 1 + s and the other two axes by 1/√(1 + s). The tilt's origin is the chest, so the stretch is about the chest. The hands, the head and the feet are read after it, so ropes still start at the hands. A multiple copies `holder`'s world matrix, so it keeps the smear it was made with.

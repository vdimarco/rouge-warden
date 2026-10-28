# Hero read at a chase distance

## Source

Jason Mitchell, Moby Francke, and Dhabih Eng, "Illustrative Rendering in Team Fortress 2" (Valve, 2007). Their diffuse warp is a warp of the albedo, so a material keeps its identity inside the bands. This keeps 30 percent of the hero's painted colour under the existing three-band warp. The sharper sample is a mip bias of −1.25 on that colour map only. `toonify`'s default is unchanged.

The hair and the collar are original forms. A mip bias cannot invent a silhouette on a head that is about twenty pixels tall, and no cited technique fitted that. They sit in the head bone's frame, in metres: +y up the skull, +z toward the face.

## Decisions

- The mix and the bias are on the hero material only. The lit-sphere check still sees the stock cel.
- The colour map's triangle count stays inside the crew5 load check (10k to 14k triangles). The forms are a second mesh, not extra vertices on the skinned body.
- One mesh holds the crown, the fringe, and the collar, plus the existing ink hull. The hero stays at four draws: body, hull, forms, outline.
- The forms copy the head bone's world position and turn each pose, so they are not children of the centimetre-scale bone.
- They hide once the body's close fade drops below 0.9, so a solid crown does not linger over the dither.
- The ink hull of the body is not biased and not mixed. It stays flat ink.
- The built-in figure has no colour map and already has hair. It does not get these forms.

# Design

## Sources

- **The user's build guide** ("Spider-Verse Style Game Build Guide", a Claude Docs page): the list of gaps, the numbers (squash 0.8 with 1.1 across, snap zoom 10 % to 15 % back over six frames, a finisher word a third of the screen, wall words for 20 s), and its VR rules.
- **Two rates in one shot.** Sony Pictures Imageworks, SIGGRAPH 2019 production session "Swing into Another Dimension": characters on twos, some on ones, in one shot. Guilty Gear Xrd (Arc System Works, Junya Motomura, GDC 2015 "GuiltyGearXrd's Art Style: The X Factor Between 2D and 3D"): 3D characters on stepped key poses with no in-betweens, and a hit that freezes on a clear key pose. We adapted both: the gang steps at 8 poses a second against the hero's 12, and the hit-stop holds the strike's full reach.
- **Squash and stretch.** The first of the twelve principles in Thomas and Johnston, "The Illusion of Life" (1981): keep the volume. The scale is 1 + 0.8 s along the height and 1 / sqrt of that across.
- **Multiples.** The film's multiples. No public shader fits: we copy the skinned pose with three's `SkeletonUtils.clone` and draw it see-through in one colour.
- **Paper grain.** None fit; a hash of the pixel and of 9 px cells, multiplied into the mid-tones only.

## The gang steps in main, not in the shader

`streetview.js` poses every figure in one instanced draw from a few numbers each. A step in the shader would step the people of the street too. `goonOnThrees` in `main.js` hands the figures a view object per goon: its pose numbers (walk phase, pose clock, fall pitch, facing) refresh 8 times a second or when the pose or the state changes, and its place every frame. The street people keep their own rate.

Goons never advanced their walk phase (`combat.js` only set `stride`), so they slid. `C.update` now advances it as `street.js` does for people: `phase += dt * stride * 2.2`.

## Squash and stretch is a spring on the holder

`holder` (the model under the hang tilt) is scaled about its origin, the feet. A landing gives the spring a velocity down (6 times the landing strength), a launch (ground or wall to air at over 3 m/s up) a velocity up. The spring (stiffness 300, damping 16) steps in 1/120 s pieces, so a pose on twos (1/12 s) stays stable. The squash is clamped to ±0.25 and is zero on a wall and in a roll, where the feet are planted by the climb or the body tucks.

## Multiples cost two draws while they show

The first copy is made on the first blow, with `SkeletonUtils.clone(holder)`: the ink hull is removed and the body gets an unlit see-through material. There are two copies at most. A new copy takes the bones' positions, turns and scales and the holder's world matrix. A copy fades over 0.16 s of game time, so a hit-stop freezes it in the frame. While none shows, they cost nothing.

## The snap zoom is drawn only

`flatcam.post` narrows `camera.fov` before the draw and `restore` puts it back, like the bank and the shake. The zoom decays as exp(−30 t): from 12 % to under 2 % in 0.06 s, about four frames at 60 Hz.

## Wall words stay in `fx.js`

A word's `life` may be longer than the 0.8 s default. Such a word does not drift, fades over its last 1.5 s, and at most six stay (the oldest is aged to its end). The pool of 16 still holds every word, so the draw stays one.

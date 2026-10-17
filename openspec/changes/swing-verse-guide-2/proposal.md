# Swing: the Spider-Verse build guide, part two

The user asked to continue with the "Spider-Verse Style Game Build Guide" after `swing-verse-guide`. This change builds four more of its items for Full Swing (`public/vr/`), in flat play.

## Why

- **Lines stop at the objects.** Ink hulls outline the hero, the gang and the props, but the city's edges (a roof against the sky, a curb, a corner) have no line. The guide asks for interior lines from depth.
- **Shadows are flat.** The guide asks for hatching in the dark bands.
- **The colour never tells the story.** The guide asks for mood grading: the world's colour follows how the fight goes.
- **Speed has no shape.** The guide asks for velocity smears: the body stretches along a fast move.

## What changes

Flat play only, with Comic motion Full or Calm. The headset does not change.

- **Ink lines.** The Verse pass inks a line where the depth jumps by over 12 % of the distance between neighbouring pixels: roof edges, corners, curbs, a body against the street. None toward the sky and the far haze.
- **Hatching.** The darkest shadows (luminance under 0.16) get diagonal ink lines 6 px apart, denser where it is darker.
- **Mood.** While goons fight the hero, the shadows and mid-tones lean red. As his hearts run low (two or fewer), they lean blue. The stronger mood wins, at most 45 %, and it eases over about a second. The light stays as it is.
- **Smear.** Faster than 16 m/s, the hero's body stretches along its flight, up to 30 % longer at 40 m/s, thinner across, about the chest. None on a wall or in a roll. The smear steps with the pose (on twos).
- The version goes to 1.24.0 (Quest APK code 31).

## Out of scope

From the same guide: a look per universe (the world switch), comic panels, a beat clock for the fights, face sprites, authored smear meshes.

## Capabilities

- `swing-verse-guide-2`: the items above.

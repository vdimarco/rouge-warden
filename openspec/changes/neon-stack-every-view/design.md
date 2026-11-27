# Design

## Source

[Sprite stacking](https://github.com/danielwh2/sprite-stacking/blob/main/skills/sprite-stacking/SKILL.md), section 3. Two of its rules were not applied to the runner yet:

- Ground shadow: the footprint at z = 0, offset a few art pixels, drawn before slice 0.
- Shade by height (`--shade` in its slicer, 0.12 to 0.15 for views that already carry shading): low slices darker, the top at full value.

Its outline rule (outline the finished stack once, never per slice) is what pull request 859 already does.

## Shadow

One more kind-1 flat slice, sign -1, at y 0.3. It uses slice 8 of the pose, the widest, at 1.15 size, pushed 2.5 art pixels away from the sun in the ground plane. The shader draws its footprint in ink (18, 18, 26). It rides the same instanced draw: three draws, one more slice.

## Shade

Each stack slice carries its height in `sign`, 0 at the feet and 1 at the hood. The shader multiplies the colour by 0.86 at the feet, rising to 1 at half height. Ochre stays above the 200 red the checks count as runner.

## Corridor

Cabinet 47, the last of THE LAB, after Gloam Downs. GTA Montréal moves to 48. The screen is a crop of the game at 390, seed 7. `labOnly` is removed from the switcher entry so All Games lists it.

# Two wall hues

Alexis Van Hurkman, *Color Correction Look Book*, chapter 7, describes a duotone as one hue in the darker portions and another in the lighter portions. A duotone on the comic node would also tint the crosswalk, the sky, and the crew, so that grade does not fit.

The wall shader already picks one body per building. The split goes there. Brick paper moves from `(0.19, 0.085, 0.055)`–`(0.31, 0.17, 0.105)` to `(0.36, 0.14, 0.08)`–`(0.62, 0.30, 0.14)`. Stone paper moves from `(0.25, 0.265, 0.25)`–`(0.40, 0.39, 0.345)` to `(0.40, 0.44, 0.47)`–`(0.62, 0.66, 0.68)`. Course lines, grain, mortar, rails, doors, and the lamp apron are unchanged.

Unreal is not installed here. The offline picture is a straight elevation of `city_facade.hlsl` with both bodies in frame. It is not an engine capture.

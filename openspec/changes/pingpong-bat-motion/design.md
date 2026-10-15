# Bat motion

## Mapping

Angles are relative to the neutral pose captured for 0.3 s after the gate, the same average as before. In portrait, gamma is side tilt (roll) and beta is forward and back. Landscape swaps those axes, the same way Lawn Tennis does in `mapAxes`.

| Phone, from neutral | Bat |
| --- | --- |
| gamma inside ±2.5° | x stays at 0 |
| gamma ±20° | x ±0.74 m (most of the 0.76 m half-width) |
| beta inside ±2.5° | depth stays at 0.30 m, the old hit plane |
| beta +16° (top of the phone away) | depth 0.48 m, a short lean toward the net |
| beta -16° | depth 0.12 m, a short lean back |

Past those angles the bat holds the end of the travel. The dead zone applies to position only. Side travel uses a power 1.5 curve, so the middle of the tilt is gentle and the last degrees cover more of the table. Full tilt still reaches ±0.74 m.

Aim is the old map, sampled from the filtered angle at the swing, not from where the bat is standing:

- gamma ±30° still lands at x ±0.7 m
- beta +20° still lands 0.3 m past the net, and beta -20° on the far baseline

Position follows the tilt the whole time. Aim is the angle when the swing peaks. A lean that moves you wide also aims wide, and they do not overwrite each other.

## Filter

The first pass used one exponential pole at 16 ms, the fixed-cutoff form of the smoothing factor in Géry Casiez, Nicolas Roussel, and Daniel Vogel, "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems", CHI 2012. On a phone that felt twitchy. The pose is now a critically damped spring, the standard step `y = (1 + w t) e^(-w t)`, with `w` about 69 rad/s. From rest it does not overshoot. A step is about 95% settled by 70 ms, inside the 60 to 80 ms window, and one 16 ms sample is still well short of the new angle.

While the bat is near the middle and the phone is still (under about 6 deg/s, and the angle is within 3.5° of neutral), the neutral pose follows the phone with a 2 s time constant. A grip that creeps does not leave the bat off centre. A swing, or a bat out at the side, does not move the neutral.

## Depth

Forward and back is a small lean, ±0.18 m around 0.30 m. The rest is a gentle step toward where the incoming ball will bounce, blended at 0.45, and clamped between 0.08 m and 0.95 m. The player does not have to rock the phone to chase a short ball. Aim is still the angle at the swing, not this depth.

The constants for the curve, the spring, the drift, the lean, and the hover sit on one object, `BAT` in `rules.js`.

## Drawing

The bat is placed with the table's existing `project()`. Its size uses that point's scale. No separate bat shader fit this view. The bat hovers just above the table, about 5 cm at the middle and a little higher at the sides, and the face opens slightly there, the way a forehand and a backhand clear the table. A soft double shadow sits on the table under it.

The face rotates by the filtered side tilt, clamped to ±50°. Forward tilt squashes the face a little (`scaleY` about 0.88 at +16°) and shears it, so the pitch reads and the paddle still looks like a paddle. Tilting back opens the face. That affine squash is the pitch.

The gyro rate (the size of `rotationRate`) drives `swingPush`. Above about 80 deg/s the bat's drawn depth moves up to 0.42 m toward the net, then eases back over roughly 200 ms when the rate drops. The shove is drawn only. Reach stays on the pose, so the jab does not throw the contact off the ball.

## Assist and reach

On casual motion, while the ball is coming in, the bat's x is `0.85 * pose + 0.15 * ball.x`. Depth is not assisted. The player's lean is the main motion.

The contact plane is the bat's depth. A swing connects only when the ball is within 0.22 m in x and 0.50 m in z of the bat. The z band is wide enough for the ±120 ms timing window at the speeds already in the tests. A ball on the other side of the table, or already well past a bat that stepped in, is a whoosh with `reason: 'reach'`.

The average bot places its bat on the ball's x at the 0.30 m plane before it swings, so the 1,000-point win rate still measures timing and the Neighbour's mistakes.

Swipe and mouse keep one drag path. In that mode the bat follows 85% of the ball's x at the old hit plane, so a swipe can still reach. `__test.tilt(beta, gamma)` holds the phone at that angle with no assist, which is how the range is checked on screen. Live orientation applies the assist.

## Count-in and pace

Every serve, including the first after the gate, waits on a 3, 2, 1 count. Each beat is 0.75 s, with a tick. The ball does not move until the last beat ends. The word Ready sits under the number.

Neighbour serves leave the hand at 3.5 m/s, high, and land on the near half if they are left. Gravity on that flight is a little under normal, because a true 3.5 m/s lob cannot cross the table in the air. For the first 0.4 s the horizontal speed eases from half to full, so the ball floats as it comes off the far end. Returns stay between 6 and 7 m/s. Player shot speeds are unchanged: push 6, drive 11, smash 17. The point-1 hook is still a perfect drive that the Neighbour does not answer. With the count, that point lands in well under 7 s.

## Picture

The room was already the look-sheet palette: deep sea-blue table, ochre floor, ember, gold lamp, ink and paper. This pass keeps that limited set and draws it harder. The table, the net, and the bat have a crisp ink outline. A paper grain is painted once into the static layer, with the vignette, and blitted. The ball has a soft glow plus the shadow that was already there. The Neighbour keeps the cardigan and the ember cap, and now has a face. Hits leave a short ink-brush slash of about 6 quadratic curves, fading in 250 ms: sea for a push, ochre for a drive, ember for a smash, with a gold edge on perfect. Bounce marks sit on their own canvas at low opacity and fade over 600 ms when the point ends. Nothing here needed a shader. The static room is still one blit.

The device pixel cap stays 2. If the frame rate sits under 60 for three samples, the trail shortens and the cap drops to 1.5.

## Painted sheets

The hall, Neighbour and bat sheets were supplied with this change. No published shader or engine writeup fit a request to drop those exact paintings in, so the room stays a single static blit. The hall is cover-fit to the portrait canvas after a crop past its paper frame (about 12 px on the sides and 24 px on the top and bottom of the 780 by 1398 sheet). The code table, net, ball, shadow and slash stay on top, so the ball path is the flat sea table and not the painting. A table texture washes that top at 35% opacity. The ball shadow is still drawn after the blit, darker than the wash.

The Neighbour is the ready sheet, swapped for the forehand or backhand sheet for 250 ms after his strike. The forehand sheet holds the bat on the right, so a ball with x >= 0 uses it, and x < 0 uses the backhand sheet. He is 60 px tall at the far end. A point he wins still nudges the sprite up by 6 px. The player bat uses the same translate, roll, shear and pitch as the code bat, with the neck of the sheet on that origin, and the same soft shadow. Each image is preloaded. If one fails, that part falls back to the code drawing and the others stay.

## Checks

`qa/pingpong/bat.test.mjs` covers the width, the short lean, the dead zone, the spring (no overshoot, settled by about 80 ms), the drift, the assist weight, the face, and a hit that uses the bat. `qa/pingpong/rally.test.mjs` covers the count-in (the ball stays put, three ticks) and the 3.5 m/s serve. The older rules, gate, and win-rate tests stay. Screenshots at 390x844 show the count, a slash in a rally, and the bat at both sides. This machine cannot tilt a real iPhone; the mapping is what `__test.tilt` drives.

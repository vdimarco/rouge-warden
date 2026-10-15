# Bat motion

## Mapping

Angles are relative to the neutral pose captured for 0.3 s after the gate, the same average as before. In portrait, gamma is side tilt (roll) and beta is forward and back. Landscape swaps those axes, the same way Lawn Tennis does in `mapAxes`.

| Phone, from neutral | Bat |
| --- | --- |
| gamma inside ±2.5° | x stays at 0 |
| gamma ±20° | x ±0.74 m (most of the 0.76 m half-width) |
| beta inside ±2.5° | depth stays at 0.30 m, the old hit plane |
| beta +16° (top of the phone away) | depth 1.05 m, toward the net, still on the player's half |
| beta -16° | depth 0.02 m, at the near baseline |

Past those angles the bat holds the end of the travel. The dead zone applies to position only.

Aim is the old map, sampled from the filtered angle at the swing, not from where the bat is standing:

- gamma ±30° still lands at x ±0.7 m
- beta +20° still lands 0.3 m past the net, and beta -20° on the far baseline

Position follows the tilt the whole time. Aim is the angle when the swing peaks. A lean that moves you wide also aims wide, and they do not overwrite each other.

## Filter

The pose uses one exponential pole, `alpha = 1 - exp(-dt / tau)`, with `tau` 16 ms. That is the exponential form of the smoothing factor in Géry Casiez, Nicolas Roussel, and Daniel Vogel, "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems", CHI 2012. The paper's at-rest cutoff is slower than this bat can afford, so the cutoff here is fixed and the time constant stays at 16 ms. At 60 Hz one sample moves about 65% of the way. There is no spring and no overshoot. Perceived lag is the time constant, under 50 ms. A 30 Hz sample takes a larger step so the same 16 ms constant still holds.

## Drawing

The bat is placed with the table's existing `project()`. Its size uses that point's scale, so a bat near the net is smaller and higher on the screen than a bat at the baseline. No separate bat shader fit this view.

The face rotates by the filtered side tilt, clamped to ±50°. Forward tilt squashes the face a little (`scaleY` about 0.88 at +16°) and shears it, so the pitch reads and the paddle still looks like a paddle. Tilting back opens the face. That affine squash is the pitch.

The gyro rate (the size of `rotationRate`) drives `swingPush`. Above about 80 deg/s the bat's drawn depth moves up to 0.42 m toward the net, then eases back over roughly 200 ms when the rate drops. The shove is drawn only. Reach stays on the pose, so the jab does not throw the contact off the ball.

## Assist and reach

On casual motion, while the ball is coming in, the bat's x is `0.85 * pose + 0.15 * ball.x`. Depth is not assisted. The player's lean is the main motion.

The contact plane is the bat's depth. A swing connects only when the ball is within 0.22 m in x and 0.50 m in z of the bat. The z band is wide enough for the ±120 ms timing window at the speeds already in the tests. A ball on the other side of the table, or already well past a bat that stepped in, is a whoosh with `reason: 'reach'`.

The average bot places its bat on the ball's x at the 0.30 m plane before it swings, so the 1,000-point win rate still measures timing and the Neighbour's mistakes.

Swipe and mouse keep one drag path. In that mode the bat follows 85% of the ball's x at the old hit plane, so a swipe can still reach. `__test.tilt(beta, gamma)` holds the phone at that angle with no assist, which is how the range is checked on screen. Live orientation applies the assist.

## Checks

`qa/pingpong/bat.test.mjs` covers the width, the depth, the dead zone, the filter lag, the assist weight, the face, and a hit that uses the bat. The older rally, rules, gate, and win-rate tests stay. Screenshots at 390x844 show the bat left, right, near, and far. This machine cannot tilt a real iPhone; the mapping is what `__test.tilt` drives.

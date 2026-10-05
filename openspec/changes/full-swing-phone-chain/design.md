# Design

## The press

`mobile.js` sends a fire edge for every press of SWING. `main.js` (`aimAndFire`) already moved a rope that is out to the
building a tap finds (`phoneAim`), and kept the rope when only its own building qualified (`same`). The press now takes the
same path. A press while the rope is `flying` (0.3 s at most) does nothing: a new shot then would cancel the cup before it
lands.

## The catch (`phoneCatch` in main.js, on the attach event)

- Speed: with n the unit vector from the anchor to the chest and v the velocity, out = v·n. When out > 0 the rope would
  stop it. The catch takes it out of v and adds it along the tangent toward the view yaw (the direction `kick` uses). The
  speed is the same; its direction follows the rope. Then the usual attach kick (PHONE.attachSpeed) adds speed if needed.
- Height: the lowest point of the arc is anchor.y - len (the chest). The catch sets lenTarget to at most
  anchor.y - chest - PHONE.catch.clear, unless that is under PHONE.catch.min (8 m): a low point cannot keep the hero off
  the street. The rope gets a per-rope rate (`r.rate`, PHONE.catch.rate = 30 m/s) in `physics.js`, which `constrain`
  uses in place of SWING.lenRate. The winch part of the constraint moves the chest in at that rate and keeps no momentum,
  so the pull stops when the length arrives. The rate clears when the length arrives (a later reel or yank moves at
  lenRate) and in `idle()`.

## The marker

`target.js` `score()` adds PHONE.high.bonus (1) for a point at least PHONE.high.y m up and PHONE.high.up m over the chest
when `ctx.high` is set. Tier 1 scores are about 0 to 1.5, so any high point beats any low one, and a low one still wins
when it is all there is. main.js sets `ctx.high` only on a phone. A tap on an exact point is the player's choice and is
not changed.

## How it was measured

A bot presses SWING at a steady beat from the start roof toward the gold ring, 12 s per beat (`phone-swing.e2e`):

| beat | before: mean, distance, feet under 8 m | after |
|---|---|---|
| 0.5 s | 16.3 m/s, 167 m, 5.6 s | 21.9 m/s, 162 m, 0 s |
| 0.8 s | 13.2 m/s, 78 m, 7.3 s | 23.1 m/s, 183 m, 0.8 s |
| 1.2 s | 11.4 m/s, 78 m, 5.7 s | 19.8 m/s, 142 m, 0 s |

A wider probe (three start bearings, 15 s) gave on average 13.3 to 21.7 m/s, 146 to 202 m, and 8.3 to 0.9 s near the
street.

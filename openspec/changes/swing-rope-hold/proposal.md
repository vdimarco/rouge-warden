# Swing: a held rope, the gold ring, and a sky point inside 16h

Live checks on 26 Oct found ropes letting go while the button was still down, the gold-ring lesson landing on a nearer tower, and sky anchors past 16 body-heights.

## What changes

- A held rope has no timer. It lets go when the finger lifts or the button comes up. A wall grab does not take it.
- The gold-ring lesson aims at the face the ring is painted on (collider 952), not the nearest tower along the view.
- Sky is 10 body-heights ahead along the velocity and 12 up, and never farther than 16 body-heights from the chest. A building inside 6 body-heights still wins over sky. A mission or ring inside 16 body-heights wins over that building.
- The chase-view rope stays one ink line, #2B2A33, 2 CSS px at 1280 wide and 1.5 CSS px at 390 wide, from the hand toward the anchor, fading over 150 ms. The headset rope is unchanged.

## Out of scope

- A rope that runs through a wall still snaps. That safety is not a hold timer.

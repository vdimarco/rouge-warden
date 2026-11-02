# Design

The sky point is computed in `easyAnchor` and then scaled toward the chest when it would sit past 16 body-heights. No new helper. The farther building searches (10h and 16h balls, then the lock-on) are removed so a building outside 6 body-heights does not beat sky.

The gold ring is resolved by a short ray from just outside the published face, so the collider is the tower the ring sits on. A building between the head and the ring does not replace it while the ring is in reach.

A finger that is still down returns from the phone release before the roof, stall, and arc timers. A wall the chest touches does not grab while a hand is holding an attached rope.

The chase line is the existing world-space cylinder. Its radius is half of 2 CSS px at 1280 and 1.5 CSS px at 390. Nothing new was adapted from a paper or a shader; the painted ink and the 150 ms fade were already there.

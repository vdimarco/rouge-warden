# Design

The sky point is computed in `easyAnchor` and, only when the result is sky, scaled toward the chest so it never sits past 16 body-heights. The building search still looks in the wider balls after the 6h ball, so a real tower beats sky. Sky is what remains when those miss.

The gold ring is resolved by a short ray from just outside the published face, so the collider is the tower the ring sits on. A building between the head and the ring does not replace it while the ring is in reach.

A finger that is still down returns from the phone release before the roof, stall, and arc timers. A wall the chest touches does not grab while a hand is holding an attached rope.

The chase line is the existing world-space cylinder. Its radius is half of 2 CSS px at 1280 and 1.5 CSS px at 390. Nothing new was adapted from a paper or a shader; the painted ink and the 150 ms fade were already there.

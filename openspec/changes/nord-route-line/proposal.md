# Route line on the mission card

## Why
Fun is the missions loop's next target. Every beat still plays as a name, a distance, and a diamond. Nothing on the card says which way to turn, and the radar does not draw the way to the stop.

## What changes
- While a diamond is showing, the mission card names the turn (ahead, left, right, behind, or here) and draws a gold needle in that direction. On foot the turn follows the camera yaw, so ahead is walk forward. In a car it follows the nose.
- The radar draws a gold stroke from the player to that diamond, inset so it clears the player arrow and the diamond.
- When the open beat has a sequenced next stop, a fainter stroke continues from the current stop toward it. An any-order rescue does not invent that continuation. The ovation's either-order choice does not either. After one station, the stroke leads to the curtain, not back to the station that is already set. A side-job guide keeps the turn line and drops the continuation.
- When the world diamond leaves the safe view, a gold chevron sits on the inset edge and points toward the stop. A stop behind the camera leaves through the bottom of the frame.

## Out of scope
A new ground decal, a new save field, stream latency, and a new art technique.

# A car that keeps the lane

No new rendering technique. The marks are the same flat slabs the other beats already use. None of the usual art references fit this change.

Mission 15's car follows the player. This one does not. It drives the surveyed avenue from `(7749.923, -21373.440)` to `(-7289.778, -11630.714)`, about 179m, at 650 cm/s. That is the traffic straight-line speed, `570 + 40 * (paint % 4)` with paint 2. It starts 28m ahead. Catch is 8m, so the near end is outside the opening circle. Recover is 18m behind the near end, outside that circle.

A real car is ride kind 0. One long frame only spends a quarter of a second. Reaching the end plays the checkpoint and does not write the slot. The purse is 460 once, only when a car is alongside. Link stays -1. No extra car is spawned. The mesh rides the avenue the way the courier rides its road.

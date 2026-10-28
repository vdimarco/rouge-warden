# A screen gather under the lamp head

A deferred light volume does not fit. The comic node is after tonemap and it cannot see the lamp list, so it cannot evaluate the 18 m point light in `QuebecSky.cpp`. None of the lighting papers surveyed fit that constraint.

The gather is the street-sheen column widened. A road pixel looks up the screen on a 5 by 7 grid. A sample counts only when it is brighter than a lit window and warmer than a headlight. The weight falls off with the distance of that tap, and the mix follows NightFactor, so a clear day is unchanged. The edge is scalloped because the taps are points.

The shade places the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) on a La Fontaine street and draws the OSM lamp heads as 55 cm globes. That radius is a stand-in. The level's globe was not measured, and a head that falls between the 16 px steps can be missed. Unreal is not installed, so the comic material was not rebuilt.

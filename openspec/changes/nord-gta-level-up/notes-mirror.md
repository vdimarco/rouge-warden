# Follow-up: the mirrored Montréal world

## What is wrong
`prepare_lafontaine.py` maps OSM to centimetres with +X east and +Y north. Unreal is left-handed: a camera facing +X has +Y on its right. So in the game, a player facing east has north on the right, and the whole district is a mirror image of the real Plateau. Facing north on Papineau, the park is on the player's right; in Montréal it is on the left.

The radar draws real north-up geography (`QuebecGameplay.cpp:2154`, `FVector2D(Position.X - Here.X, Here.Y - Position.Y)`), and the arrow uses `Nose(Facing.X, -Facing.Y)` (`:2199`). So when the player turns right in the 3D view, the radar arrow turns counter-clockwise. Players can see this today.

## Size of a full fix (inventory at base 6c9e97ee)
- Generated coordinate headers: `LaFontaineMap.h` (667 `FVector`), `LaFontaineExtensionMap.h` (953), `LaFontaineLamps.h` (267), `LaFontaineWater.h` (5). Regenerate them with Y negated; flip `RoadParkingSides` (left and right swap).
- Hand-written coordinates: `QuebecCampaign.cpp` (59 `FVector(` literals) and `QuebecCampaign.h` (5), race gates, routes and directions; the car spawn yaw 77.53 becomes −77.53; new side-job markers, respawn points and pickups from this change.
- Sky: `QuebecSkyModel.h` works in (east, north, up). Its conversion to Unreal must negate north.
- Radar: after the flip, Unreal Y is −north, so the radar becomes `FVector2D(Position.X - Here.X, Position.Y - Here.Y)` and the arrow `Nose(Facing.X, Facing.Y)`.
- Saved map: every actor in `/Game/Maps/LaFontaine` needs location Y → −Y, yaw → −yaw, roll → −roll, and scale Y → −scale Y. The Plateau meshes hold world-space vertices at identity transforms, so a negative Y scale mirrors them in place. Actor properties that hold world points also need Y negated: resident `Route` arrays and pedestrian routes. Unreal renders and collides negative-scale static meshes; Nanite, distance fields and Lumen with negative scale need a visual check.
- QA: 75 of 207 Python scripts under `Scripts/` contain coordinates (verify, capture, story-slice, car-collision and map tests). `verify_lafontaine.py:15` asserts `road.origin.y > 0` and must invert.
- Toronto (`CollegeBathurstMap.h`, 894 `FVector`) has the same defect and can be fixed the same way in the same pass or separately.

## Cheaper interim option
Mirror only the radar so it agrees with the 3D world: about two lines. Navigation becomes consistent, but the radar then shows mirrored geography. It does not make the streets match Montréal.

## Recommendation
Do the full fix as its own change after this PR lands, with an editor script for the saved map and a generator flag for the headers. Then rerun every host suite. The new replica layer in this change uses the current frame, so the same pass also fixes it, with one rule. Mesh batches that hold world-space vertices (streets, plex fronts, soul) take the negative Y scale. Prop instances and the 424 street-name texts take only position Y → −Y and yaw → −yaw, never a negative scale, or their lettering would read backwards and the light-bar colours would swap (see `Data/Plateau/ReplicaGeometry/Props/README.md`).

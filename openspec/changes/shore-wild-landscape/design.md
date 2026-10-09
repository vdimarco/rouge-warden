# Design

Broad asymmetric hill crests span 1,054.7 world units above the dry lowlands. Dry side roads climb 360.8 and 478.7 units between level defenses. Rock faces have large stepped strata with worn edges and moss on the upper shelf. Eight existing cover islands receive rock bluffs; six contain hollow cave shells, shaded walls, a recessed rear and a visible floor. Cave mouths face the gameplay camera; both teams keep the same collision footprints and elevation geometry.

The cave shell is open geometry, not a painted black oval. Its opening is wide enough to read beside a hero, and extends into the rock. Geometry stays inside each realm's existing cover rectangle, and its floor meets the sampled terrain. The existing obstacles define the cave approach limit; this change adds no underground traversal rules.

Rock vertices and their shadow depth materials sample the same signed terrain texture. Small floor triangles follow uneven ground across the entrance. Trees on a bluff use the actual roof triangles plus the displaced ground for their support height. Terrain sampling remains constant time. A bounded 39-sample camera check raises the normal follow view only when a crest would hide its ground target, and expands culling and shadow coverage with that lift.

Groves contain more mature trees with mixed crowns, clearings and undergrowth. Tree instances use the existing camera culling, realm transition, shadows and hero see-through shader. All geology shares those controls. High ground uses the same terrain triangles for actors, pointer intersection and ground warnings.

Highland banks now permit a maximum sampled slope of 3.2, measured at 2.717 for seed 49; the earlier shallow-ground limit was 1.6. Combat still uses the shared planar rules. Defense pads, gate rings, camp clearings and bridge approaches retain their original low surfaces. Only terrain shape and scenery change.

Verify measurable changes in playable hill and road ranges, cave depth and open mouths, bounded geometry and grounded scene transforms. Run regression suites and a browser check that records cliffs, caves and forests at landscape and portrait sizes. Actual visual checks remain open when WebGL2 is unavailable.

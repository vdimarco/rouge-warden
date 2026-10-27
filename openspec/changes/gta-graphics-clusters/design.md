# Design: use the clustered canopy

## Source

`Scripts/prepare_environment_refresh.py`, `broadleaf_mesh`. The comment there says an alpha-card pipeline does not fit this mesh, so the gaps are carved in the leaf field and the masses stay on the limbs. Leaf0, Leaf1 and Leaf2 are the shaded underside, the mid mass, and the sunlit cap. This round uses that mesh. It does not add a second card technique.

## Choice

`canopy_name` picks `Canopy{style}_{variant}.obj`. Variant is `(seed // 11) % 4` for a broadleaf and 0 for a conifer, the same split as `tree_profile`. The mesh is scaled so its top is the tree height and its width is `crown_radius_cm`. The vertical span stays the old ellipsoid span, from 23 percent of the height to the top. Leaf0, Leaf1 and Leaf2 multiply the tree's leaf colour by 0.48, 0.82 and 1.08. The falling-leaf actor still has ten slots. The opening look stays at pitch −16 and the socket at (0, 70, 110).

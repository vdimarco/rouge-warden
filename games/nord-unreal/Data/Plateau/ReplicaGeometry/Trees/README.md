# Plateau species trees

Street, park and yard trees for the Plateau replica: seven kinds in late-October dress, and a young
street tree for each kind but small, so the streets stop reading as one small green tree repeated.
Every street and park tree of the city inventory (`Streets/street_trees.json`, 4,707 trees) and
every Plex yard tree stands on one of these meshes in the game (`Scripts/apply_plateau_replica.py`).

- Generator: `Scripts/blender/plateau_trees.py` (stdlib Python; Blender only renders the sheet).
- Output: `Tree_<kind>.obj` (git-ignored, rebuilt byte for byte), the autumn leaf atlas and the bark
  texture (`T_Replica_TreeLeaves_*`, `T_Replica_TreeBark_*`, three maps each in the
  `Scripts/plateau_textures.py` format) and `manifest.json`.
- Preview: `Preview/Replica/trees_contact_sheet.png` (Cycles CPU, 2000 x 1000: the seven kinds, the
  six young trees, a street row and the atlas).
- Check: `Scripts/test_plateau_tree_kinds.py` (stdlib; `--rebuild` also builds twice and compares bytes).

```bash
# from games/nord-unreal
python3 Scripts/blender/plateau_trees.py --no-render     # OBJs, textures, manifest (about 15 s)
<blender-python> Scripts/blender/plateau_trees.py        # the same, then the contact sheet
<blender-python> Scripts/blender/plateau_trees.py --render-only   # the sheet from the files on disk
python3 Scripts/test_plateau_tree_kinds.py --rebuild
```

## Manifest

`kinds[kind]` holds `obj`, `materials {bark, leaves}` (material keys), `height_cm`, `trunk_cm`
(diameter at 1.3 m, or 15 cm under a lower fork; `trunk_at_cm` says where), `crown_width_cm`,
`crown_base_cm`, `prune_cm`, `leaf_retention`, `triangles`, `bounds_cm` and the Weber and Penn
parameters, and for every kind but small `young`, the same fields for its young street tree
(`Tree_<kind>_young.obj`, the kind's own materials). Each OBJ has two material groups,
`<model>_bark` and `<model>_leaves`. `aliases` maps the old yard-tree kind `maple` to
`norway_maple`; Plex's `elm` is the vase kind now (it was `linden`). `texture_sets` describes the
two texture sets; the leaves are masked (clip 0.5) and two-sided, and their UVs address the atlas
directly: 8 x 4 cells of 256 px on a 2048 x 1024 map, 19 used. Pivot at the trunk base,
centimetres, z up; `bounds_cm` are Unreal-local (x, -y, z).

| Kind | Species | Height | Trunk | Crown width | Triangles |
| --- | --- | ---: | ---: | ---: | ---: |
| `norway_maple` | Acer platanoides | 14.6 m | 48 cm | 16.0 m | 14,716 |
| `silver_maple` | Acer saccharinum | 17.0 m | 58 cm | 17.6 m | 13,177 |
| `honey_locust` | Gleditsia triacanthos var. inermis | 13.6 m | 40 cm | 16.2 m | 7,390 |
| `linden` | Tilia cordata / T. americana | 14.0 m | 42 cm | 8.6 m | 16,756 |
| `ash` | Fraxinus pennsylvanica | 15.6 m | 44 cm | 12.7 m | 8,939 |
| `elm` | Ulmus americana, U. pumila, Celtis occidentalis (vase) | 16.5 m | 52 cm | 17.6 m | 14,231 |
| `small` | Amur maple / serviceberry type | 6.6 m | 17 cm | 7.4 m | 5,188 |
| `<kind>_young` (six) | the kind, a few years after planting | 4.9–5.1 m | 7 cm | 2.5–3.3 m | 1,688–2,360 |

Every mature kind is under the 30,000-triangle target, the small kind under 15,000 and each young
tree under 8,000. Crowns are pruned up: no limb starts under the pruned height (3.0–3.3 m, 1.6 m for
the small kind, 2.1 m for the young trees) and no leaf card hangs more than 25 cm below it. Late
October: most cards are yellow to orange, the small kind red, some sheltered cards stay green, and
46–80 % of the cards are kept (honey locust and ash thinnest, the elm 60 %).

The elm is the vase the Plateau's elms and hackberries make: the trunk forks at about 3.8 m into
five leaders that hold a 31° lean (almost no AttractionUp), its limbs follow the inverse-conical
ShapeRatio (long high on the leaders, short at the fork) and arch out, and its twigs droop
(AttractionUp -0.5), so the crown is as wide as the tree is tall and widest at the top. Its leaf
cells are small, doubly serrate, lopsided blades in clear and dull yellow. The young trees are the
inventory's new plantings (DHP 5 cm, about 4.3 m by `research-plateau.md` §10.4): one straight
leader, no fork, a narrow crown over 2.1 m, the kind's own leaves on smaller cards.

## In the game

`Scripts/apply_plateau_replica.py` imports each mesh once (`/Game/Plateau/Replica/Trees/SM_Tree_<kind>[_young]`,
Nanite with Preserve Area, no collision), before any other mesh so a slot problem stops it early.
Each row of `Streets/street_trees.json` stands on its kind's mesh: the height scale is the row's
height over the mesh's (0.55–1.65), a tree under 55 % of its kind's mature height uses the young
mesh (0.6–1.6 of its 5 m; 1,520 trees), and the crown and trunk take the height scale ×
√((DHP / mesh trunk) / height scale), within 0.8–1.25 of it. The old summer tree (`tree_small_02`
on `QuebecVegetation`) is cleared once they stand.

## Technique and sources

- Branching: Jason Weber and Joseph Penn, "Creation and Rendering of Realistic Trees",
  SIGGRAPH 1995 ([paper](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)):
  ShapeRatio crown envelopes, trunk flare, clones (leaders), RatioPower radii, down angles with the
  negative-variation rule, helical or opposite rotation, curvature and AttractionUp. Blender's
  [Sapling Tree Gen](https://docs.blender.org/manual/en/4.1/addons/add_curve/sapling.html)
  implements the same model, but it is not bundled with the bpy module, so the recursion is
  written here.
- Leaves: alpha-masked cluster cards from one atlas, the usual game-foliage approach. Card normals
  are blended toward the crown ellipsoid and kept from pointing down, after the "puffiness" and
  normal-range controls of SpeedTree's
  [leaf generator](https://docs.unity3d.com/speedtree-modeler/manual/leaf-generator-properties.html)
  and its notes on [lighting leaves](https://docs.unity3d.com/speedtree-modeler/manual/lighting-leaves-and-fronds.html).
  In Unreal the leaves use the
  [Two Sided Foliage](https://dev.epicgames.com/documentation/unreal-engine/shading-models-in-unreal-engine)
  shading model.
- Textures: painted by code with the `plateau_textures.py` primitives (signed-distance serrated
  leaflets, Worley bark plates), not scanned.
- Species and pruning: the borough's street trees are mostly Norway maple and honey locust, with
  silver maples and lindens ([Spacing Montréal](https://spacing.ca/montreal/wp-json/wp/v2/posts/1453),
  [Ville de Montréal tree inventory](https://donnees.montreal.ca/dataset/arbres)).
- The elm's vase: "the trunk divides into several erect limbs strongly arched above and terminating
  in numerous slender, pendulous branchlets" (Lady Bird Johnson Wildflower Center,
  [Ulmus americana](https://www.wildflower.org/plants/result.php?id_plant=ULAM); the
  [Minnesota DNR](https://dnr.state.mn.us/trees/american-elm.html) and Flora of North America describe the
  same vase with drooping branch ends), built with the Weber and Penn parameters above. No code or
  preset was taken.

`Scripts/refine_plateau_trees.py` gives the old summer tree's leaf material (and the falling leaf
cards `QuebecVegetation` draws with it) the same late-October palette by default; `apply(unreal,
autumn=False)` or the editor flag `-NordTreeSummer` keeps the summer green to gold.

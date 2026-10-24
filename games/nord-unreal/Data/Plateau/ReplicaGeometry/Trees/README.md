# Plateau species trees

Street, park and yard trees for the Plateau replica: nine kinds in late-October dress, two of them
conifers, and a young tree for each kind but small, so the streets stop reading as one small green
tree repeated.
Every street and park tree of the city inventory (`Streets/street_trees.json`, 4,682 trees) and
every Plex yard tree stands on one of these meshes in the game (`Scripts/apply_plateau_replica.py`).

- Generator: `Scripts/blender/plateau_trees.py` (stdlib Python; Blender only renders the sheet).
- Output: `Tree_<model>.obj` (git-ignored, rebuilt byte for byte) and its material library
  `Tree_<model>.mtl`, the autumn leaf atlas and the bark texture (`T_Replica_TreeLeaves_*`,
  `T_Replica_TreeBark_*`, three maps each in the `Scripts/plateau_textures.py` format) and
  `manifest.json`.
- Preview: `Preview/Replica/trees_contact_sheet.png` (Cycles CPU, 2400 x 1000: the nine kinds, the
  eight young trees, a street row and the atlas).
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
parameters, and for every kind but small `young`, the same fields for its young tree
(`Tree_<kind>_young.obj`, the kind's own materials). Each OBJ has two material groups,
`<model>_bark` and `<model>_leaves`, and a `mtllib` line naming `Tree_<model>.mtl` (`mtl` and
`mtl_sha256` in the manifest). The library defines those two names with a plain diffuse colour, so an
importer that reads it still names the bark and leaves slots; the apply step imports without
materials and sets them by slot name. `aliases` maps the old yard-tree kind `maple` to
`norway_maple`; Plex's `elm` is the vase kind now (it was `linden`). `texture_sets` describes the
two texture sets; the leaves are masked (clip 0.5) and two-sided, and their UVs address the atlas
directly: 8 x 4 cells of 256 px on a 2048 x 1024 map, 26 used. Pivot at the trunk base,
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
| `conifer` | Pinus, Picea, Abies, Thuja, Tsuga (pine, spruce, fir, cedar, hemlock) | 14.0 m | 38 cm | 8.2 m | 18,948 |
| `larch` | Larix laricina, L. decidua (gold in late October) | 14.4 m | 34 cm | 8.2 m | 11,483 |
| `<kind>_young` (eight) | the kind, a few years after planting | 4.9–5.1 m | 7 cm | 2.5–3.3 m | 1,688–4,744 |

Every mature kind is under the 30,000-triangle target, the small kind under 15,000 and each young
tree under 8,000. Street crowns are pruned up: no limb starts under the pruned height (3.0–3.3 m,
1.6 m for the small kind, 2.1 m for the young street trees) and no leaf card hangs more than 25 cm
below it. Park conifers are limbed up lower (1.9 m for the conifer, 2.2 m for the larch), and a young
conifer keeps its branches almost to the ground, as a nursery tree on a lawn does. Late October: most
cards are yellow to orange, the small kind red, some sheltered cards stay green, and 46–80 % of the
cards are kept (honey locust and ash thinnest, the elm 60 %). The conifer keeps 94 % of its needle
cards and the larch 74 %.

The elm is the vase the Plateau's elms and hackberries make: the trunk forks at about 3.8 m into
five leaders that hold a 31° lean (almost no AttractionUp), its limbs follow the inverse-conical
ShapeRatio (long high on the leaders, short at the fork) and arch out, and its twigs droop
(AttractionUp -0.5), so the crown is as wide as the tree is tall and widest at the top. Its leaf
cells are small, doubly serrate, lopsided blades in clear and dull yellow. The young trees are the
inventory's new plantings (DHP 5 cm, about 4.3 m by `research-plateau.md` §10.4): one straight
leader, no fork, a narrow crown over 2.1 m, the kind's own leaves on smaller cards.

The conifer and the larch stand for the inventory's 263 conifers, nearly all on park lawns: 99 pines
(63 Austrian pines), 83 larches (77 tamaracks), 48 spruces and 28 eastern white cedars. Both are
Weber and Penn's conical shape 0 on one leader to the top. Their limbs grow in whorls of three to
seven, each whorl turned about the golden angle from the one below. Low whorls lean about 20° below
level and high ones rise. Each limb droops and turns its tip up (nCurve, then nCurveBack), and the
conifer's laterals lie flat, alternately left and right, so each limb ends in a spray. Needle-cluster
cards cover the twigs and the outer two thirds of the limbs. The conifer's cells are a dark spruce
spray, a glaucous blue spruce spray, a pine tuft of long needles and a sparse inner spray whose old
needles yellow before they drop. The larch's cells are branchlets of short-shoot rosettes in gold and
amber, one of them half bare.

The silver maple's leaf is palmately lobed: five deep, pointed lobes join over a central blade two
thirds of the way in, instead of five leaflets meeting at the petiole.

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
- Conifer whorls: Sapling's Branch Rings option, which snaps the trunk's child points to `nrings`
  heights (`add_curve_sapling/utils.py` in
  [blender-addons](https://github.com/blender/blender-addons/blob/main/add_curve_sapling/utils.py)).
  Here each ring's limbs are also spread evenly round the trunk. Daniel Wesslén and Stefan Seipel,
  "The Virtual Forest", SIGRAD 2004 ([paper](https://ep.liu.se/ecp/013/016/ecp01316.pdf)), adapted
  Weber and Penn to spruce and pine with a health parameter that drops leaves at random. This
  generator's `leaf_retention` does the same. Their paper is a one-page summary with no parameter
  values, so the conifer's values are set here.
- Silver maple lobes: Inigo Quilez's polynomial smooth minimum
  ([smin](https://iquilezles.org/articles/smin)) joins the lobes' signed distances and an ellipse
  round the leaf base, so each sinus ends in a rounded crease.
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

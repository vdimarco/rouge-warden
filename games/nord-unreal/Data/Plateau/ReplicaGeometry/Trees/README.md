# Plateau species trees

Street, park and yard trees for the Plateau replica: six kinds in late-October dress, so the
streets stop reading as one small green tree repeated.

- Generator: `Scripts/blender/plateau_trees.py` (stdlib Python; Blender only renders the sheet).
- Output: `Tree_<kind>.obj` (git-ignored, rebuilt byte for byte), the autumn leaf atlas and the bark
  texture (`T_Replica_TreeLeaves_*`, `T_Replica_TreeBark_*`, three maps each in the
  `Scripts/plateau_textures.py` format) and `manifest.json`.
- Preview: `Preview/Replica/trees_contact_sheet.png` (Cycles CPU, 1600 x 1000).
- Check: `Scripts/test_plateau_tree_kinds.py` (stdlib; `--rebuild` also builds twice and compares bytes).

```bash
# from games/nord-unreal
python3 Scripts/blender/plateau_trees.py --no-render     # OBJs, textures, manifest (about 10 s)
<blender-python> Scripts/blender/plateau_trees.py        # the same, then the contact sheet
<blender-python> Scripts/blender/plateau_trees.py --render-only   # the sheet from the files on disk
python3 Scripts/test_plateau_tree_kinds.py --rebuild
```

## Manifest

`kinds[kind]` holds `obj`, `materials {bark, leaves}` (material keys), `height_cm`, `trunk_cm`
(diameter at 1.3 m, or 15 cm under a lower fork; `trunk_at_cm` says where), `crown_width_cm`,
`crown_base_cm`, `prune_cm`, `leaf_retention`, `triangles`, `bounds_cm` and the Weber and Penn
parameters. Each OBJ has two material groups, `<kind>_bark` and `<kind>_leaves`. `aliases` maps the
old yard-tree kinds (`maple` to `norway_maple`, `elm` to `linden`). `texture_sets` describes the
two texture sets; the leaves are masked (clip 0.5) and two-sided, and their UVs address the atlas
directly. Pivot at the trunk base, centimetres, z up; `bounds_cm` are Unreal-local (x, -y, z).

| Kind | Species | Height | Trunk | Crown width | Triangles |
| --- | --- | ---: | ---: | ---: | ---: |
| `norway_maple` | Acer platanoides | 14.6 m | 48 cm | 16.0 m | 14,716 |
| `silver_maple` | Acer saccharinum | 17.0 m | 58 cm | 17.6 m | 13,177 |
| `honey_locust` | Gleditsia triacanthos var. inermis | 13.6 m | 40 cm | 16.2 m | 7,390 |
| `linden` | Tilia cordata / T. americana | 14.0 m | 42 cm | 8.6 m | 16,756 |
| `ash` | Fraxinus pennsylvanica | 15.6 m | 44 cm | 12.7 m | 8,939 |
| `small` | Amur maple / serviceberry type | 6.6 m | 17 cm | 7.4 m | 5,188 |

Every mature kind is under the 30,000-triangle target and the small kind under 15,000. Crowns
are pruned up: no limb starts under the pruned height (3.0–3.3 m, 1.6 m for the small kind) and no
leaf card hangs more than 25 cm below it. Late October: most cards are yellow to orange, the small kind red,
some sheltered cards stay green, and 46–80 % of the cards are kept (honey locust and ash thinnest).

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

The street and park trees already in the map keep the old model; `Scripts/refine_plateau_trees.py`
can shift their leaves to the same autumn palette with `apply(unreal, autumn=True)` or the editor
flag `-NordTreeAutumn` (off by default).

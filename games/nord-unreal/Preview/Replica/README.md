# Plateau replica previews

These are Blender previews of the generated replica layers. They are not Unreal captures. The layers have not been imported or checked in Unreal yet, so the editor captures listed in `Data/Plateau/ReplicaGeometry/README.md` are still owed.

## The game frame, not the real city

The game world is a mirror image of the real Plateau (`openspec/changes/nord-gta-level-up/notes-mirror.md`). These images show it the way the player will see it in Unreal, not the way the street looks in Montréal. For example:

- Facing Montréal-north on Papineau, the park is on your right. In the real city it is on your left.
- Signs that stand on the right of the lane in Montréal stand on the left of the lane here.
- Text still reads left to right: the props are modelled for the mirrored world (`Props/README.md`).

When the mirror fix lands, every view flips left to right.

## Views

All street views put the camera at 1.7 m eye height above the walking surface. On a sidewalk that is 1.88 m above the floor; on the asphalt it is 1.77 m. The horizontal field of view is the game camera's 85°. Each image is 1280 x 720, rendered in Cycles on the CPU at 24–32 samples with OpenImageDenoise and the AgX view.

| File | What it shows |
| --- | --- |
| `mentana.jpg` | **Rue de Mentana**, a classic plex street west of the park, looking along the street. Plex fronts with exterior stairs, balconies and cornices, parterres with low iron fences, grey concrete sidewalks with an 18 cm curb, street trees, curb bins and parking signs. |
| `rachel.jpg` | **Rue Rachel at the park edge**, from the park-side sidewalk looking north-east. The 3 m cycle track with its green 1.16 m `VC-BA-1` bollards every 4 m, paint, a locked bike, and the park-facing perimeter fronts across the street. |
| `corner.jpg` | **Rue Napoléon at Rue de Mentana**, from the Napoléon roadway approaching the junction. The ARRÊT sign at the mapped stop, the stop bar and two-line crosswalk, the white street-name blades ("Rue / de Mentana", "Rue / Napoléon") on their post, one-way and parking signs. |
| `ruelle.jpg` | **The ruelle behind Rue Rachel** (OSM way 21062511), looking south-west along it. Wooden utility poles with sagging wires, a laundry line across the lane, the concrete gutter, asphalt patches. |
| `papineau.jpg` | **Avenue Papineau, facing the park**, from the far sidewalk looking across the avenue and along it. |
| `fabre_before.jpg`, `fabre.jpg` | **Before and after on Rue Fabre**, north of Rachel, from the same camera. *Before* is the current map without the replica layers: plain brick boxes with window cards, beige paver floor and the narrow OSM road strip. *After* adds Streets, Plex, Soul and the Furniture and Soul props; the orange cones of the Rue Fabre chantier are in the distance. |
| `aerial.jpg` | **About two blocks of Rue de Mentana from 60 m up**, a three-quarter view over fronts, yards and the ruelle behind them. |
| `dormer_closeup.jpg` | A check of the slate *fausse mansarde* dormers on Rue de Mentana. The sun was moved to light this façade. |
| `brick_mix_before_after.jpg` | The `plateau_plex.py` masonry change, from the aerial camera: the committed mix on top, the new mix below. |
| `props_contact_sheet.png` | The prop kit, rendered by `Scripts/blender/plateau_props.py` (not part of this preview set). |

## How they are made

`Scripts/blender/plateau_replica_preview.py` builds each view. Run it with a Python that can `import bpy` (Blender 5.1), from `games/nord-unreal`:

```bash
<blender-python> Scripts/blender/plateau_replica_preview.py --list
<blender-python> Scripts/blender/plateau_replica_preview.py --view fabre            # fabre.jpg
<blender-python> Scripts/blender/plateau_replica_preview.py --view fabre --before   # fabre_before.jpg
```

- **Geometry.** Every OBJ is placed as written, (x, −y, z) of a game-frame point. Blender is right-handed and Unreal is left-handed, so this shows the mirrored world as Unreal does. Each view loads the faces inside its camera wedge, usually out to 170 m.
- **Existing layers** are the ones visible in the game: Background masses, `OSM Road`, `OSM Path`, `OSM Glass`, `OSM Grass`, the ground, park, perimeter, context and landmark batches. The hidden `OSM Brick/Cream/Sage/Roof` masses and old canopies are left out. `OSM Marking` is shown only in *before* images, because the replica apply step hides it.
- **Replica layers** are `Streets`, `Plex` and `Soul` from their manifests. The Furniture and Soul `placements.json` rows are instanced from the `Props` meshes, at position (x, −y, z) and yaw −yaw. The street-name text that the apply step adds as `TextRender` is drawn as flat black text in the same `text_slots`.
- **Trees** are the 4,571 mapped trees: the same Poly Haven `tree_small_02` instanced at the OSM tree nodes, with the scale and yaw of `plateau_rendering.py` and the leaf material of `refine_plateau_trees.py` (35% desaturated, a per-tree blend from green to gold, cutout at 1/3).
- **Colours.** Replica materials use their manifest colours. As `apply_plateau_replica.py` does, asphalt and brick multiply their Poly Haven texture by the target colour divided by the texture mean, capped at `TINT_LIMIT`. Every other replica material is a flat colour, including `Stone`, whose manifest names a texture that the apply step does not use. Existing materials use the colours and textures that `upgrade_plateau.py` gives them. Daylight emissive lenses are dimmed to 8% of their Unreal strength.
- **Light.** An autumn afternoon: a Hosek-Wilkie sky and a warm sun from the south-south-west, 31° up (Mentana: west-south-west, 24°, so its sunlit side faces the camera).

These previews used the Streets, Soul and Furniture output that `Scripts/plateau_replica.py` built at 16:02 (source sha256 `ea53868a6174…`). That script is being changed (curb winding and other fixes), so these views need a re-render after it is rebuilt. The Plex output is the one with the new masonry mix (below).

## Review against the research

Reference: `research-plateau.md` and the owner's "soul" brief.

**What reads as the Plateau.** Plex rows with steep black exterior stairs, wooden balconies on every upper floor, painted cornices with brackets, stone sills and lintels and raised ground floors. Parterres with low iron fences. Grey saw-cut sidewalks with a real curb. Street trees, blue and brown bins at the curb, locked bikes, R-PF parking signs, the ARRÊT with its stop bar, white street-name blades, the green bollards on Rachel, orange chantier cones, utility poles with laundry in the ruelle. The Fabre pair shows the step from the current map.

**Fixed here.**

- **Brick was mostly red.** 616 of 1,307 fronts were red, dark red or orange. The 1880s were 85% red clay, and red was the largest share in every later era. `plateau_plex.py` now gives brown, buff and limestone a few points from red within each era (`Plex/README.md` lists the split). The new count is 434 red or orange, 358 brown, 182 buff and 333 limestone fronts. `brick_mix_before_after.jpg` shows the same blocks before and after. `test_plateau_plex.py` passes, with 827 batches (limit 860) and 2,139,575 triangles.

**Checked, no change needed.**

- **Dormers.** The lead saw slate dormer windows as flat red panels in a render from 06:30. The dormers in the current Plex output (`plateau_plex.py` from 06:31) have glass, white frames, sills and a slate cap (`dormer_closeup.jpg`). On a burgundy-painted front the dormer surround is burgundy, which is correct for painted wood.
- **Buff brick in the apply step.** With the old 4x tint cap, buff brick (`#CCB07F`) came out salmon over the red brick texture. `apply_plateau_replica.py` in the working tree now caps at 8 (`TINT_LIMIT`), and these previews use 8. `fabre.jpg` and `fabre_before.jpg` were rendered before that change, with the old cap.

**Left for the host or a follow-up.**

1. **Ruelles are brick canyons.** Rear and lane façades are not treated (`Plex/README.md`). There are no wooden rear galleries, spiral stairs, sheds, fences or climbing plants (research §13). Utility poles and laundry are present, but the laundry hangs between bare walls. This is the largest gap at street level.
2. **Floating window cards.** The `OSM Glass` cards on the retained masses show as dark or mirror-like panes on blank side and rear walls. This shows in the ruelle and wherever a mass side wall faces a street.
3. **Flat greystone and slate.** `Stone` (`#8F8C85`) and `Slate` are flat colours in the game, because the apply step only gives asphalt and brick a texture. Greystone fronts read as grey render, and mansards read as grey stucco in sun. They need stone coursing and slate courses or pattern bands (research §3, §8). This needs a stone or slate parent material on the host, or courses as geometry.
4. **Low autumn sun on narrow streets.** At 24–31° the sun leaves most of Mentana in shade. This is true to late October, but the game's exposure and sky fill will decide how dark it reads.
5. **Mirror.** Until the mirror fix, signs stand on the left of the lane as the player sees it, and the park is on the wrong side of Papineau and Rachel.
6. **Street names are text actors.** These previews draw them in Blender. In the game they come from the apply step's `TextRender`s, which have not been seen in the editor yet.

## Limits of these previews

- Shading is Cycles path tracing, not Lumen. There is no comic post-process, wet street, exposure adaptation or fog.
- Only the faces inside each camera wedge are loaded, so distant ends of long streets can stop at bare ground.
- Unreal's Nanite, LOD, culling distances and shadow settings are not reproduced. Small props keep their shadows here.

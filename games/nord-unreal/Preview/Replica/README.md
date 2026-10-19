# Plateau replica previews

These are Blender previews of the generated replica layers, not Unreal captures. The layers have not been imported or checked in Unreal yet, so the editor captures listed in `Data/Plateau/ReplicaGeometry/README.md` are still owed.

## The game frame, not the real city

The game world is a mirror image of the real Plateau (`openspec/changes/nord-gta-level-up/notes-mirror.md`). These images show it the way the player will see it in Unreal, not the way the street looks in Montréal. For example:

- Facing Montréal-north on Papineau, the park is on your right. In the real city it is on your left.
- Signs that stand on the right of the lane in Montréal stand on the left of the lane here, as the ARRÊT in `corner.jpg` does.
- Text still reads left to right: the props are modelled for the mirrored world (`Data/Plateau/ReplicaGeometry/Props/README.md`).

When the mirror fix lands, every view flips left to right.

## Views

The street views put the camera at 1.7 m eye height above the walking surface: 1.88 m above the floor on a sidewalk, 1.77 m on the asphalt. The horizontal field of view is the game camera's 85°. The street views are 1280 x 720 JPEGs at quality 88, rendered in Cycles on the CPU with OpenImageDenoise and the AgX view, at 24 samples unless noted.

| File | What it shows |
| --- | --- |
| `mentana.jpg` | **Rue de Mentana**, a classic plex street west of the park, looking along the street from the shady sidewalk. Black exterior stairs and balconies on the near fronts; across the street, sunlit brick, buff and limestone fronts with cornices, parterres and stoops. Grey concrete sidewalk with an 18 cm curb, street trees, curb bins, a parking sign. |
| `rachel.jpg` | **Rue Rachel at the park edge**, from the park-side sidewalk looking north-east. The cycle track along the far curb with green 1.16 m `VC-BA-1` bollards every 4 m, yellow centre dashes, a red hydrant with its marker post, an R-PF sign ("9h-23h EXCEPTÉ S3R") with a bike locked to it, the park lawn and paths on the left, the perimeter fronts and Le Neuville across the street. |
| `corner.jpg` | **Rue Napoléon at Rue de Mentana**, from the Napoléon roadway approaching the junction. The ARRÊT sign at the mapped stop, the white stop bar, the white block crosswalk across Mentana, the white street-name blades and one-way sign on their post, sealed cracks in the asphalt, a buff-brick plex and a slate mansard with dormers. |
| `ruelle.jpg` | **The ruelle behind Rue Rachel** (OSM way 21062511), looking south-west along it. Wooden utility poles with sagging wires, a laundry line across the lane, the concrete centre gutter, an asphalt patch. Sun 228°/24°, exposure 0.35. |
| `papineau.jpg` | **Avenue Papineau, facing the park**, from the far sidewalk looking across the multi-lane avenue and along it. Lane lines, saw-cut sidewalk joints, street trees, the park's mapped trees on the lawn. |
| `fabre_before.jpg`, `fabre.jpg` | **Before and after on Rue Fabre**, north of Rachel, from the same camera. *Before* (32 samples) is the current map without the replica layers: plain brick boxes with window cards, beige paver floor, and the narrow OSM road strip. *After* adds Streets, Plex, Soul and the Furniture and Soul props: plex fronts with straight stairs, balconies and bracketed cornices, parterres behind low iron fences, a stoop, a blue recycling bin, a bike locked to a sign post, the parking line, and the orange cones of the Rue Fabre chantier in the distance. |
| `aerial.jpg` | **About two blocks around Rue de Mentana from 60 m up**, a three-quarter view over the plex fronts on one street, the rear yards and the ruelle behind them with a pole and laundry. |
| `dormer_closeup.jpg` | 800 x 600, 16 samples. A check of the slate *fausse mansarde* dormers on Rue de Mentana. The sun was moved to light this façade. It was rendered from the Plex output before the masonry change below; this front's brick is now dark red, and the dormers did not change. |
| `brick_mix_before_after.jpg` | 1280 x 652. The `plateau_plex.py` masonry change on six plex streets: one swatch per front in street order, the committed mix on top and the new mix below, with the count of red or orange fronts. |
| `props_contact_sheet.png` | The prop kit, rendered by `Scripts/blender/plateau_props.py`. It is not part of this preview set. |

All street views use the current Streets, Soul and Furniture output (`Scripts/plateau_replica.py` source sha256 `83658d6512ce…`, built at 18:36) and the Plex output with the new masonry mix. Rebuild and re-render after either generator changes again.

## How they are made

`Scripts/blender/plateau_replica_preview.py` builds each view. Run it with a Python that can `import bpy` (Blender 5.1), from `games/nord-unreal`:

```bash
<blender-python> Scripts/blender/plateau_replica_preview.py --list
<blender-python> Scripts/blender/plateau_replica_preview.py --view fabre --samples 24            # fabre.jpg
<blender-python> Scripts/blender/plateau_replica_preview.py --view fabre --before --samples 32   # fabre_before.jpg
```

The other views are `mentana`, `rachel`, `corner`, `ruelle`, `papineau` and `aerial`. The first run indexes the OBJ bounds and saves the tree model into `Saved/ReplicaPreview/`.

- **Geometry.** Every OBJ is placed as written: (x, −y, z) of a game-frame point. Blender is right-handed and Unreal is left-handed, so this shows the mirrored world the way Unreal does. Each view loads the faces inside its camera wedge, usually out to 170 m.
- **Existing layers** are the ones visible in the game: the background masses, `OSM Road`, `OSM Path`, `OSM Glass`, the ground and park lawn (`GroundGeometry`), and the park, perimeter, context and landmark batches. The script leaves out what the game hides or replaces: the `OSM Brick/Cream/Sage/Roof` masses, the old canopies, and `OSM Grass`, whose mesh `plateau_ground.py` replaces with `ParkGrass`. `OSM Marking` appears only in *before* images, because the replica apply step hides it.
- **Replica layers** are `Streets`, `Plex` and `Soul`, read from their manifests. The Furniture and Soul `placements.json` rows are instanced from the `Props` meshes at position (x, −y, z) and yaw −yaw. The street-name text that the apply step adds as `TextRender` is drawn as flat black text in the same `text_slots`.
- **Trees** are the 4,571 mapped trees: the Poly Haven `tree_small_02` instanced at the OSM tree nodes, with the scale and yaw from `plateau_rendering.py` and the leaf material from `refine_plateau_trees.py`. That material desaturates the leaves 35%, blends each tree from green to gold, and cuts out at 1/3.
- **Colours.** Replica materials use their manifest colours. Asphalt and brick follow `apply_plateau_replica.py`: they multiply their Poly Haven texture by the target colour divided by the texture mean, capped at `TINT_LIMIT` (8). Every other replica material is a flat colour. That includes `Stone`: its manifest names a texture, but the apply step does not use it. Existing materials use the colours and textures that `upgrade_plateau.py` gives them. Daylight emissive lenses are dimmed to 8% of their Unreal strength.
- **Light.** An autumn afternoon: a Hosek-Wilkie sky and a warm sun from the south-south-west, 31° up, unless the view says otherwise.

## Review against the research

Reference: `research-plateau.md` and the owner's "soul" brief.

**What reads as the Plateau.** Rows of plexes with steep black exterior stairs, wooden balconies on the upper floors, bracketed cornices, stone sills and lintels and raised ground floors. Parterres with low iron fences. Grey saw-cut sidewalks with a real curb. Street trees, blue bins at the curb, locked bikes, R-PF parking signs, a red hydrant, the ARRÊT with its stop bar, white street-name blades, green bollards on Rachel, orange chantier cones, and utility poles with laundry in the ruelle. The Fabre pair shows how far this is from the current map.

**Fixed here.**

- **Brick was mostly red.** Of 1,307 fronts, 616 were red, dark red or orange. The 1880s were 85% red clay, and red was the largest share in every later era. `plateau_plex.py` now gives brown, buff and limestone a few points from red within each era; `Plex/README.md` lists the split. The new count is 434 red or orange, 358 brown, 182 buff and 333 limestone fronts. On the six plex streets in `brick_mix_before_after.jpg`, red or orange fronts fall from about 50% to about 35%. `test_plateau_plex.py` passes with 827 batches (the limit is 860) and 2,139,575 triangles.

**Checked, no change needed.**

- **Dormers.** The slate dormer windows that read as flat red panels were in a render from 06:30. The current Plex output, from `plateau_plex.py` as of 06:31, gives each dormer glass, white frames, a sill and a slate cap (`dormer_closeup.jpg`). On a burgundy-painted front the dormer surround is burgundy, which is right for painted wood.
- **Buff brick.** With the old 4x tint cap in the apply step, buff brick (`#CCB07F`) came out salmon over the red brick texture. `apply_plateau_replica.py` now caps the tint at 8, and these previews do the same. The buff front in `corner.jpg` reads as buff.

**Still in the generators or the host.**

1. **Ruelles and rear yards are bare.** Rear and lane façades are not treated (`Plex/README.md`). There are no wooden rear galleries, spiral stairs, sheds, fences or climbing plants (research §13), and the rear yards are the bare floor (`aerial.jpg`, `ruelle.jpg`). The poles and laundry are there, but the laundry hangs between bare walls. This is the largest gap.
2. **Floating window cards.** The `OSM Glass` cards on the retained masses show as dark or mirror-like panes on blank side and rear walls (`ruelle.jpg`, `aerial.jpg`, `fabre_before.jpg`).
3. **Flat greystone and slate.** `Stone` and `Slate` are flat colours in the game, because the apply step gives only asphalt and brick a texture. Greystone fronts read as grey render, and mansards read as grey stucco in sun (`dormer_closeup.jpg`). They need stone coursing and slate courses or pattern bands (research §3, §8), either from a stone or slate parent material on the host or as geometry.
4. **One tree for everything.** Every street and park tree is the same small Poly Haven tree, so the park in `papineau.jpg` reads as an orchard of clones. The autumn tint also stays mostly green. Mature maples and other species with larger canopies would read much more like Parc La Fontaine.
5. **Empty streets.** There are no parked cars or people here. The game adds 32 parked cars and traffic at runtime, so the parking lanes will look less bare in Unreal.
6. **Low autumn sun on narrow streets.** At 24–31° the sun leaves most of Mentana in shade. That is true to late October; the game's exposure and sky fill will decide how dark it reads.
7. **Mirror.** Until the mirror fix, signs stand on the left of the lane as the player sees it, and the park sits on the wrong side of Papineau and Rachel.
8. **Street names are text actors.** These previews draw them in Blender. In the game they come from the apply step's `TextRender`s, which no one has seen in the editor yet.

## Limits of these previews

- Shading is Cycles path tracing, not Lumen. There is no comic post-process, wet street, exposure adaptation or fog.
- Only faces inside each camera wedge are loaded, so the far side of the park in `papineau.jpg` and the ends of long streets stop at bare ground.
- Unreal's Nanite, LOD, cull distances and shadow settings are not reproduced. Small props keep their shadows here.

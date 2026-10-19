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
| `mentana.jpg` | **Rue de Mentana**, a classic plex street west of the park, looking along the street from the shady sidewalk. Black exterior stairs and balconies on the near fronts, with the coursed greystone base under the near front; across the street, brick, buff and limestone fronts with cornices, parterres and stoops. Grey concrete sidewalk with an 18 cm curb, street trees, curb bins, a parking sign. |
| `rachel.jpg` | **Rue Rachel at the park edge**, from the park-side sidewalk looking north-east. The cycle track along the far curb with green 1.16 m `VC-BA-1` bollards every 4 m, yellow centre dashes, a red hydrant with its marker post, an R-PF sign ("9h-23h EXCEPTÉ S3R") with a bike locked to it, the park lawn and paths on the left, the perimeter fronts and Le Neuville across the street. |
| `corner.jpg` | **Rue Napoléon at Rue de Mentana**, from the Napoléon roadway approaching the junction. The ARRÊT sign at the mapped stop, the white stop bar, the white block crosswalk across Mentana, the white street-name blades and one-way sign on their post, sealed cracks in the asphalt, a buff-brick plex on a coursed greystone base, and a mansard in the slate texture with dormers. Across Mentana, the side wall on Napoléon now carries a cream siding skin with windows instead of window cards. |
| `ruelle.jpg` | **The ruelle behind Rue Rachel** (OSM way 21062511), looking south-west along it. Wooden utility poles with sagging wires, a laundry line across the lane, the concrete centre gutter, an asphalt patch. On the left, the lane wall of a plex now has a cream siding skin with windows over a greystone base. The right side is a background mass this layer does not cover, so it keeps its old window cards. Sun 228°/24°, exposure 0.35. |
| `ruelle_mentana.jpg` | **The ruelle between Rue de Mentana and Rue Saint-André** (OSM way 204859680), at eye height on the lane, looking north-west. The Plex yard side: galleries on both sides with board guards and square posts, gallery roofs, straight wooden stairs on the right, board fences with a gate, a shed behind the fence on the left, rear doors and windows in red brick. Exposure 0.8, because the lane is in shade. |
| `papineau.jpg` | **Avenue Papineau, facing the park**, from the far sidewalk looking across the multi-lane avenue and along it. Lane lines, saw-cut sidewalk joints, street trees, the park's mapped trees on the lawn. |
| `fabre_before.jpg`, `fabre.jpg` | **Before and after on Rue Fabre**, north of Rachel, from the same camera. *Before* (32 samples) is the current map without the replica layers: plain brick boxes with window cards, beige paver floor, and the narrow OSM road strip. *After* adds Streets, Plex, Soul and the Furniture and Soul props: plex fronts with straight stairs, balconies and bracketed cornices, parterres behind low iron fences, a stoop, a blue recycling bin, a bike locked to a sign post, the parking line, and the orange cones of the Rue Fabre chantier in the distance. |
| `aerial.jpg` | **About two blocks around Rue de Mentana from 60 m up**, a three-quarter view over the plex fronts on one street, the rear yards and the ruelle behind them with a pole and laundry. Bottom left: rear façades with wooden galleries, straight stairs and a spiral, a lane fence with a shed. Right: the long blank cream side and dark slate cap of a deep conciergerie, a cream-sided rear with grey galleries beyond it, and the black steel galleries of a taller block. The row along the park at the top is outside this layer and keeps its window cards. |
| `dormer_closeup.jpg` | 800 x 600, 16 samples. A check of the slate *fausse mansarde* dormers on Rue de Mentana. The sun was moved to light this façade. It was rendered from the Plex output before the masonry change below; this front's brick is now dark red, and the dormers did not change. |
| `brick_mix_before_after.jpg` | 1280 x 652. The `plateau_plex.py` masonry change on six plex streets: one swatch per front in street order, the committed mix on top and the new mix below, with the count of red or orange fronts. |
| `props_contact_sheet.png` | The prop kit, rendered by `Scripts/blender/plateau_props.py`. It is not part of this preview set. |

`ruelle.jpg`, `ruelle_mentana.jpg`, `aerial.jpg`, `corner.jpg` and `mentana.jpg` use the current output: Streets, Soul and Furniture from `Scripts/plateau_replica.py` source sha256 `0075c83d1ba8…`, and Plex with the yard side from `Scripts/plateau_plex.py` source sha256 `b90134fc00e3…` (manifest hashes checked against the OBJs), with greystone and slate in the `Textures/` maps. `rachel.jpg`, `papineau.jpg`, `fabre.jpg`, `fabre_before.jpg` and `dormer_closeup.jpg` are older: they show the Plex output before the yard side, with flat stone and slate. Rebuild and re-render after any generator changes again.

## How they are made

`Scripts/blender/plateau_replica_preview.py` builds each view. Run it with a Python that can `import bpy` (Blender 5.1), from `games/nord-unreal`:

```bash
<blender-python> Scripts/blender/plateau_replica_preview.py --list
<blender-python> Scripts/blender/plateau_replica_preview.py --view fabre --samples 24            # fabre.jpg
<blender-python> Scripts/blender/plateau_replica_preview.py --view fabre --before --samples 32   # fabre_before.jpg
```

The other views are `mentana`, `rachel`, `corner`, `ruelle`, `ruelle_mentana`, `papineau` and `aerial`. The first run indexes the OBJ bounds and saves the tree model into `Saved/ReplicaPreview/`.

- **Geometry.** Every OBJ is placed as written: (x, −y, z) of a game-frame point. Blender is right-handed and Unreal is left-handed, so this shows the mirrored world the way Unreal does. Each view loads the faces inside its camera wedge, usually out to 170 m.
- **Existing layers** are the ones visible in the game: the background masses, `OSM Road`, `OSM Path`, `OSM Glass`, the ground and park lawn (`GroundGeometry`), and the park, perimeter, context and landmark batches. The script leaves out what the game hides or replaces: the `OSM Brick/Cream/Sage/Roof` masses, the old canopies, and `OSM Grass`, whose mesh `plateau_ground.py` replaces with `ParkGrass`. `OSM Marking` appears only in *before* images, because the replica apply step hides it.
- **Replica layers** are `Streets`, `Plex` and `Soul`, read from their manifests. The Furniture and Soul `placements.json` rows are instanced from the `Props` meshes at position (x, −y, z) and yaw −yaw. The street-name text that the apply step adds as `TextRender` is drawn as flat black text in the same `text_slots`.
- **Trees** are the 4,571 mapped trees: the Poly Haven `tree_small_02` instanced at the OSM tree nodes, with the scale and yaw from `plateau_rendering.py` and the leaf material from `refine_plateau_trees.py`. That material desaturates the leaves 35%, blends each tree from green to gold, and cuts out at 1/3.
- **Colours.** Replica materials use their manifest colours. Asphalt and brick follow `apply_plateau_replica.py`: they multiply their Poly Haven texture by the target colour divided by the texture mean, capped at `TINT_LIMIT` (8). Greystone and slate follow the same step: the script asks `apply_plateau_replica.base_material` which keys take a texture set (today the Plex `Stone` and `Slate`), then uses the `Textures/` maps from `Scripts/plateau_textures.py` with UV tiling 1 / tile size from `textures.json`, base colour = diffuse × (colour / `mean_linear`) capped at 8, roughness from the red channel of the `rough` map, and the `nor_dx` map read with the Normal Map node's DirectX convention, as Unreal reads it. Every other replica material is a flat colour, `Stone_Cast` included. Existing materials use the colours and textures that `upgrade_plateau.py` gives them. Daylight emissive lenses are dimmed to 8% of their Unreal strength.
- **Light.** An autumn afternoon: a Hosek-Wilkie sky and a warm sun from the south-south-west, 31° up, unless the view says otherwise.

## Review against the research

Reference: `research-plateau.md` and the owner's "soul" brief.

**What reads as the Plateau.** Rows of plexes with steep black exterior stairs, wooden balconies on the upper floors, bracketed cornices, stone sills and lintels and raised ground floors. Parterres with low iron fences. Grey saw-cut sidewalks with a real curb. Street trees, blue bins at the curb, locked bikes, R-PF parking signs, a red hydrant, the ARRÊT with its stop bar, white street-name blades, green bollards on Rachel, orange chantier cones, and utility poles with laundry in the ruelle. The Fabre pair shows how far this is from the current map.

**Fixed here.**

- **Brick was mostly red.** Of 1,307 fronts, 616 were red, dark red or orange. The 1880s were 85% red clay, and red was the largest share in every later era. `plateau_plex.py` now gives brown, buff and limestone a few points from red within each era; `Plex/README.md` lists the split. The new count is 434 red or orange, 358 brown, 182 buff and 333 limestone fronts. On the six plex streets in `brick_mix_before_after.jpg`, red or orange fronts fall from about 50% to about 35%. `test_plateau_plex.py` passes with 827 batches (the limit is 860) and 2,139,575 triangles.
- **The rear of the blocks was bare.** `plateau_plex.py` now builds the yard side of 1,094 lots: rear façades with a door on every floor, 1,566 galleries on 749 lots, 380 straight and 435 spiral stair stacks, fences with gates on the ruelles, sheds and garages, hedges, cedars and creepers (`Plex/README.md`). `ruelle_mentana.jpg` and the bottom of `aerial.jpg` show it. `test_plateau_plex.py` passes with 853 batches and 2,444,527 triangles.
- **Window cards on blank walls.** Every exposed back wall of a Plex lot now has an opaque skin 16 cm proud of the mass, with applied windows on rear, lane and street walls, so the old `OSM Glass` cards sit behind it. The side wall on Napoléon in `corner.jpg` and the lane wall on the left of `ruelle.jpg` were cards on brick before.
- **Flat greystone and slate.** `Stone` and `Slate` now use the `Textures/` maps from `plateau_textures.py`. Greystone bases, stoops and limestone fronts show rock-faced courses (`mentana.jpg`, `corner.jpg`, `ruelle.jpg`, `aerial.jpg`); mansards show slate rows (`corner.jpg`). The fish-scale band is too small to see in these views.

**Checked, no change needed.**

- **Dormers.** The slate dormer windows that read as flat red panels were in a render from 06:30. The current Plex output, from `plateau_plex.py` as of 06:31, gives each dormer glass, white frames, a sill and a slate cap (`dormer_closeup.jpg`). On a burgundy-painted front the dormer surround is burgundy, which is right for painted wood.
- **Buff brick.** With the old 4x tint cap in the apply step, buff brick (`#CCB07F`) came out salmon over the red brick texture. `apply_plateau_replica.py` now caps the tint at 8, and these previews do the same. The buff front in `corner.jpg` reads as buff.

**Still in the generators or the host.**

1. **Siding reads as render.** A quarter of the rear walls are siding (`Wood_Cream`, `Wood_Grey`, `Trim`, `Wood_Green`), drawn as one flat colour without lap lines, so they read as stucco, and the `Trim` white glares in sun: the left of `ruelle.jpg`, the cream wall across Mentana in `corner.jpg`, the white wing in `aerial.jpg` (about x 350–420, y 430–590). Siding needs a lap-board texture or lap lines.
2. **A long side wall becomes a blank box.** The Mentana conciergerie with id 356220851 in `Plex/fronts.json` has a 14 m front and two exposed walls of about 49 m but no rear wall, so both long walls are `side` walls: blank and in the lot's siding colour (cream), under a 14 x 49 m slate cap. It is the large featureless box in the right half of `aerial.jpg`. Long exposed walls should get windows, or at least stay brick.
3. **Flat roofs are slate.** The `top_extensions` caps use `Slate`, so every capped plex has a slate-textured flat roof (the dark roofs in `aerial.jpg`). From 60 m the rows average out, but Plateau flat roofs are gravel or membrane, and from a higher camera the slate rows would show.
4. **Galleries read as concrete.** The guards are solid boards in one flat colour, with no balusters, lattice or rail cap, so the galleries read as concrete balconies from the lane and from above (left of `ruelle_mentana.jpg`, bottom left of `aerial.jpg`). Where an upper flight passes through a deck opening, its dark soffit cuts a diagonal slash across the solid guard (top right of `ruelle_mentana.jpg`, about x 980–1030, y 0–120).
5. **Spiral stairs nearly vanish.** Spiral treads are top faces with no soffit, so a spiral reads as a pole and a few dark lines (behind the near gallery on the left of `ruelle_mentana.jpg`, about x 190–250, y 145–230; the spiral beside the orange galleries near the lane in `aerial.jpg`, about x 450–460, y 480–540).
6. **Fences are flat panels.** A board fence is one plane per side in one colour, with no boards, rails or weathering, so the fences read as painted hoarding (both sides of `ruelle_mentana.jpg`).
7. **Bare yards, little green.** Yards are still the bare tan floor: about 20 x 25 m of it behind the left block in `aerial.jpg`. There is no lawn, paving, garden, bin or clutter. The creepers and cedars are in the data but barely show in these views, so the ruelle reads grey-brown rather than as a *ruelle verte*. The laundry still hangs from the poles, not from the galleries.
8. **Window cards outside the layer.** The park-side row at the top of `aerial.jpg` (`OSM Glass` on the base masses, about 150 m out) and the background mass on the right of `ruelle.jpg` keep their dark, mirror-like cards. The park-perimeter rows, the Panet/Visitation route and the 100 skipped buildings are not covered by the yard side.
9. **Floating stoop steps.** The front stoop of the buff plex in `corner.jpg` (bottom left, about x 70–205, y 465–525) is drawn as slabs with dark gaps under them and no risers. This is front geometry; it did not change here.
10. **One tree for everything.** Every street and park tree is the same small Poly Haven tree, so the park in `papineau.jpg` reads as an orchard of clones. The autumn tint also stays mostly green. Mature maples and other species with larger canopies would read much more like Parc La Fontaine.
11. **Empty streets.** There are no parked cars or people here. The game adds 32 parked cars and traffic at runtime, so the parking lanes will look less bare in Unreal.
12. **Low autumn sun on narrow streets.** At 24–31° the sun leaves most of Mentana and the ruelles in shade. That is true to late October; the game's exposure and sky fill will decide how dark it reads.
13. **Mirror.** Until the mirror fix, signs stand on the left of the lane as the player sees it, and the park sits on the wrong side of Papineau and Rachel.
14. **Street names are text actors.** These previews draw them in Blender. In the game they come from the apply step's `TextRender`s, which no one has seen in the editor yet.
15. **Texture checks owed on the host.** Slate orientation (the previews assume the OBJ importer flips V, so image row 0 is up), course joints running through the 23 cm `Stone` lintels, and the small bright glints on the mansard slate near the eave in `corner.jpg` (about x 500–520, y 97–105) all need a look in Lumen.

## Limits of these previews

- Shading is Cycles path tracing, not Lumen. There is no comic post-process, wet street, exposure adaptation or fog.
- Only faces inside each camera wedge are loaded, so the far side of the park in `papineau.jpg` and the ends of long streets stop at bare ground.
- Unreal's Nanite, LOD, cull distances and shadow settings are not reproduced. Small props keep their shadows here.

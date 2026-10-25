# Plateau replica props

Street props and living-street companions for the Plateau replica layers. Each prop is a small
kit of low-poly, comic-friendly meshes with real dimensions, built from code in Blender.

- Generator: `Scripts/blender/plateau_props.py` (Blender 5.1 Python module or `blender -b`).
- Output: one OBJ per prop part (one material each) and `manifest.json` in this folder. The
  OBJs are git-ignored and rebuild byte for byte; the manifest records each OBJ's SHA-256.
- Preview: `Preview/Replica/props_contact_sheet.png` (Cycles CPU, 1600 x 1500).
- Check: `Scripts/test_plateau_props.py` (stdlib).

```bash
# from games/nord-unreal
<blender-python> Scripts/blender/plateau_props.py               # OBJs, manifest, contact sheet (about 1 min)
<blender-python> Scripts/blender/plateau_props.py --no-render   # OBJs and manifest only (2 s)
blender -b --factory-startup -P Scripts/blender/plateau_props.py -- --no-render
python3 Scripts/test_plateau_props.py --blender <blender-python>  # checks plus two rebuilds compared byte for byte
```

`<blender-python>` is any interpreter that can `import bpy` (the cloud session used the bpy 5.1.2
wheel). The manifest stores the Blender version. A different Blender version may round a few
vertices differently, so rebuild with 5.1 if the hashes must match the committed manifest.

## Axes, pivot and placement

- Props are authored in Blender's axes, in centimetres: +X forward, +Y left, +Z up. The pivot is
  the base centre: the pole or post base for lamps, signs and poles, otherwise the bounding-box
  bottom centre. The lowest point of every prop is exactly z = 0.
- The OBJ stores those coordinates unchanged. This is the same file convention as
  `Scripts/plateau_mesh.py`: the file holds (x, -y, z) of a game-frame point, with
  counter-clockwise outward winding in file space. Unreal's OBJ import flips Y, so a prop looks
  in Unreal exactly as it does in Blender and on the contact sheet. Text reads left to right, and
  the red light-bar lenses sit on the car's left.
- Every position in the manifest (`bounds_cm`, `anchors`, `colliders_cm`, `attach_cm`,
  `slots`, `text_slots`) is in **Unreal-local** axes: X forward, Y right, Z up. Unreal-local
  equals the game frame of the map scripts (x east, y north) once the actor's yaw is applied.
- To face a prop along the game-frame direction (dx, dy), spawn it at the game position with
  yaw = atan2(dy, dx) in degrees. Signs face +X, so aim +X at approaching traffic. The one-way
  arrow points along Unreal local +Y, so its yaw is the traffic heading minus 90°.
- To bake a prop into a `plateau_mesh.Mesh` batch instead of instancing it, read the OBJ, use
  game-local (x, -y_file, z), reverse each triangle's vertex order, then rotate by the yaw and
  translate. `Mesh.write` restores the file convention.
- The world itself is mirrored (see `openspec/changes/nord-gta-level-up/design.md`). The props
  are authored to read correctly in that mirrored world. Do not mirror them again.

## Manifest

The manifest follows the shared ReplicaGeometry contract (`layer`, `generator`, `frame`,
`batches`, `materials`, `counts`, `source_sha256`), with these additions:

- `batches[].prop` and `batches[].part` name the prop and part. `batches[].sha256` is the OBJ
  hash. `batches[].variants` lists the alternative material keys for that part.
- `materials[key]` adds `emissive_srgb` and `emissive_strength` for the lamp lens, the park globe,
  the BIXI screen, the amber flasher and the light-bar lenses.
- `props[key]` holds `kind`, `description`, `pivot`, `triangles` (all non-merged parts),
  `budget`, `bounds_cm`, `parts {name: {mesh, material, attach_cm?, joint?, merged?}}`,
  `anchors`, `colliders_cm`, and prop-specific data:
  - `lamp_cobra` and `lamp_park`: `light` and `anchors.light_cm`, for a 3000 K (#FFB46B) light.
  - `lamp_cobra`: the davit arm and its brace are their own part (`arm`), so a cobra head hangs from a city wooden utility pole without the steel pole: a placement row may name parts to leave out (`"without": ["pole"]`), which the apply step and the preview skip. A sign hung on a city pole leaves out its `post` the same way.
  - `hydrant`: `clear_radius_cm` (150, SIM). The marker post parts are optional.
  - `sign_parking`: `plate_faces {face: {family, plate, size_cm, symbol, crown, parts, text, example_code,
    catalogue_page, triangles}}`, `plate_arrows {left|right|both: {short|tall: part}}`, `plate_default` and
    `face_budget`. A placement shows one face and at most one arrow; see "Parking-sign plates" below.
  - `bixi_dock`: six `slots`, each with a position and yaw for a `bixi_bike` instance.
  - `utility_pole`: `anchors.wire_attach_cm` for sagging wires between poles.
  - `laundry_line`: `anchors.line_start_cm` and `line_end_cm`, and `span_cm`. Scale X by
    span / 600, within 0.7–1.4.
  - `ac_unit` and `flower_box`: `anchors.wall_plane_x_cm` gives the façade plane.
  - `bike_locked`: `anchors.lean_contact_cm` is where the post or railing touches.
  - `police_lightbar`: `anchors.light_red_cm` and `light_blue_cm`.
  - `grocery_bag` and `stroller`: `anchors.hand_grip_cm`.
  - `chair_patio`: `seat_cm` (44).
  - `satellite_dish`: `anchors.clamp_cm` is the clamp centre; set it on the gallery guard's cap rail
    (107 cm) or a wall. `anchors.aim_cm` is the beam direction (+X, 26° up), so yaw +X to 190–230°
    azimuth. `anchors.reflector_cm` and `lnb_cm` place the reflector centre and the feed: the arm
    leaves the lower rim and holds the LNB in front of and below the axis, as on an offset dish.
  - `bike_gallery`: `anchors.lean_contact_cm` is where the guard touches (12° lean toward -Y).
  - `leaf_bag` and `pumpkin`: `forms` lists the sibling keys a placement picks from, with a share
    each (`leaf_bag_mid`, `leaf_bag_low`, `pumpkin_carved`). Each form has `form_of`. The pumpkin
    has `sizes` and `scale_range` for the placement `scale`. Each bag has `fill_cm`.
- `colliders_cm` boxes are Unreal-local like `bounds_cm`, so the leaning bikes' boxes sit on their
  -Y side. The check keeps every box within 10 cm of its prop's bounds.
- Material keys are new. The apply step creates them by duplicating an existing material, such
  as a `M_*` constant-colour material, and setting the manifest colour. Never rebuild the
  existing `M_*` materials, because that removes their weather wrappers. Variants are extra
  material keys. Pick one per placement from the placement seed.

## Props

Each triangle count is for one assembled prop and excludes the duplicate merged meshes.

| Key | Triangles | Parts | Size cm (X x Y x Z) |
| --- | ---: | ---: | --- |
| `lamp_cobra` | 468 | 4 | 256 x 30 x 816 |
| `lamp_park` | 630 | 2 | 44 x 44 x 422 |
| `hydrant` | 498 | 4 | 43 x 52 x 150 (barrel 78) |
| `sign_stop` | 184 | 4 | 7 x 75 x 251 |
| `sign_street` | 272 | 7 | 100 x 100 x 300 |
| `sign_oneway` | 86 | 4 | 7 x 90 x 241 |
| `sign_parking` | 2,219 (all 8 faces; one face 224 to 814) | 23 | 7 x 30 x 236 |
| `bixi_dock` | 928 | 10 | 83 x 558 x 361 |
| `bixi_bike` | 1,472 | 4 | 183 x 55 x 110 |
| `bin_recycling` | 327 | 5 | 81 x 64 x 104 |
| `bin_compost` | 268 | 2 | 46 x 50 x 54 |
| `bin_garbage` | 522 | 1 | 70 x 69 x 73 |
| `cone` | 282 | 3 | 38 x 38 x 71 |
| `barrier_chantier` | 366 | 5 | 70 x 204 x 120 |
| `utility_pole` | 766 | 5 | 37 x 240 x 1,053 |
| `laundry_line` | 692 | 7 | 626 x 8 x 120 |
| `bike_locked` | 1,240 | 4 | 174 x 53 x 108 |
| `ac_unit` | 428 | 3 | 54 x 92 x 40 |
| `flower_box` | 1,416 | 5 | 26 x 92 x 41 |
| `bench` | 588 | 2 | 61 x 184 x 88 |
| `mailbox` | 240 | 4 | 51 x 56 x 115 |
| `police_lightbar` | 376 | 5 | 26 x 124 x 15 |
| `dog_small` | 1,028 | 9 | 54 x 18 x 43 |
| `dog_medium` | 1,136 | 9 | 91 x 26 x 58 |
| `dog_large` | 1,136 | 9 | 120 x 34 x 76 |
| `stroller` | 1,376 | 7 | 87 x 61 x 108 |
| `grocery_bag` | 320 | 5 | 26 x 31 x 61 |
| `chair_patio` | 472 | 1 | 54 x 58 x 85 |
| `bbq` | 1,000 | 7 | 63 x 120 x 119 |
| `satellite_dish` | 818 | 3 | 56 x 46 x 81 |
| `potted_plant` | 1,176 | 6 | 36 x 36 x 63 |
| `bike_gallery` | 1,524 | 5 | 181 x 53 x 117 |
| `leaf_bag` | 294 | 3 | 33 x 42 x 81 |
| `leaf_bag_mid` | 314 | 3 | 33 x 42 x 67 |
| `leaf_bag_low` | 334 | 3 | 33 x 42 x 51 |
| `pumpkin` | 390 | 2 | 30 x 29 x 30 |
| `pumpkin_carved` | 596 | 3 | 30 x 28 x 30 |

Targets met: each lamp has at most 800 triangles, the hydrant at most 500, each dog at most 1,500,
the stroller at most 1,500, the patio chair at most 700, the barbecue at most 1,600, the dish at
most 1,200, the potted plant at most 1,500, each leaf bag at most 400, the pumpkin at most 450
and the carved pumpkin at most 700. Each assembled parking-sign face, with its post and arrow, has at most 1,000.
The folder holds 201 meshes, 30,858 triangles in all and 131 material keys. Every mesh is under 65,000 triangles.

Gallery life (`kind: gallery`) furnishes the back galleries, the outdoor rooms the Plex layer
records on each deck: a white resin stacking armchair, a two-burner propane grill on its cart with
a 20 lb tank, a small offset satellite dish with a guard clamp, a terracotta pot with a geranium
past its season (a dome of leaf discs on petioles, a few yellowed, three flower umbels), and a
commuter bike with fenders, a rack and a wire basket leaning on the guard. The chair, the grill
and the bike have box colliders; the dish and the plant do not. The contact sheet's
"gallery deck" tile shows them together.

Colour variants (first key is the default): blue and brown bins (3 each), garbage bags
(black, green, grey), the cone (fresh, faded), the wooden pole (3), insulators (green glass,
white), the AC case (3), the flower box and flowers (3 each), bench wood (3), locked-bike frames
(4), laundry garments (3 per garment), dog coats (3 per dog), collars (3), the stroller frame
(2), the stroller seat and canopy fabric (3 each), the lamp pole (galvanised, grey), the resin chair
(white, green, beige), the grill body (black, red, steel), the dish (white, grey, dark), the pot
(terracotta, black, grey) and the geranium leaves (green, dry, rust).

## Parking-sign plates

`sign_parking` carries one plate face per sign family of the city's clip (`Inventory/park_signs.json`). Before the
seventh pass every plate showed the R-PF face. The apply step picks the face from each Furniture row's code
(`apply_plateau_replica.parking_face`, `row_without`) and leaves the other faces and arrows out, as a hung sign leaves
out its post. The preview takes the same rule. The contact sheet's "parking faces" tile shows all eight.

| Face | Family (code group) | Plate (mm) | Face | Copies | Rows |
| --- | --- | --- | --- | --- | ---: |
| `no_stopping` | no stopping (A) | 300 x 450 | red crown and bar over a black octagon | AD-TT | 74 |
| `no_stopping_hours` | no stopping (A) | 300 x 450 | the same, "6h - 20h / LUN À VEN" | AV-JL | 13 |
| `no_parking` | no parking (S) | 300 x 450 | red crown and bar over a black P | SD-TT | 34 |
| `no_parking_hours` | no parking (S) | 300 x 450 | the same, "8h - 9h / MARDI / 1 AVRIL AU 1 DÉC." | SU-MA-A | 90 |
| `limited` | limited parking (P) | 300 x 450 | black P, no crown, "15 min" and its hours | PV-QE | 20 |
| `reserved` | no parking except (R) | 300 x 450 | barred P, "EXCEPTÉ" | R-SI | 10 |
| `permit` | residents' permit zone (R, SRRR) | 300 x 600 | barred P, "9h - 23h", the permit panel and a red SECTEUR box | R-PF | 287 |
| `disabled` | disabled space (R) | 300 x 600 | barred P over a green crown with the wheelchair symbol | R-TD | 20 |

- **Family.** The family is the first letter of the code, the group of the city's codification. In group R, the
  codes of the catalogue's page 1-5-2 are the disabled spaces, and a description that says "EXCEPTE S3R" is a
  residents' permit zone. The bus zone's LAC-8 ("ARRÊT INTERDIT") is a no-stopping face. A no stopping or no parking
  description with a time shows the face with hours.
- **Text.** One mesh serves every plate of a face, so its text is that of the family's commonest code in the clip.
  The symbol, the crown and the plate height are right for every row. The hours may differ from the row's own, and
  the permit box carries no sector number.
- **Geometry.** Every plate hangs from the same top (222.5 cm), so the props keep their old bounds and collider, and
  one crown part (`face_red`) serves every prohibition face. The layers stand off the white face as the old plate's
  did: black at 0.08 cm, the crowns at 0.13 cm, the bar at 0.16 cm. The bar runs from the reader's top left to the
  bottom right. The arrow lies 5.5 cm over the plate bottom and points to the reader's left or right, as the row's
  `arrow` says.
- **Sources.** Ville de Montréal, *Catalogue des panneaux, signalisation écrite* (2015 edition), a resource of the
  open dataset *Signalisation (stationnement sur rue)*, <https://donnees.montreal.ca/dataset/stationnement-sur-rue-signalisation-courant>:
  the faces, the plate sizes and the code groups (pages 1-1-1, 1-2-1-1, 1-4-2-2, 1-5-1, 1-5-2, 1-5-3, 1-7-1-4).
  The city's drawings apply the Quebec standard: the *Règlement sur la signalisation routière* (RLRQ c. C-24.2,
  r. 41; Gazette officielle du Québec, 23 June 1999), articles 2 (a prescription sign is white), 5 (a green crown
  is an obligation), 6 (a red crown and diagonal bar forbid), 29 (P-150, parking) and 30 (P-160, stopping); and the
  MTQ's *Tome V, Signalisation routière*, chapter 2, as its *Répertoire des dispositifs de signalisation routière*
  draws P-150-1 (no parking), P-150-5 (disabled), P-150-7 (time limit: a black P, no crown) and P-160-3 (no
  stopping: a barred black octagon).

## Late-October dressing (leaf bags and pumpkins)

`kind: season`. The Soul layer places them, and the apply step instances them like any other prop.

- `leaf_bag`, `leaf_bag_mid` and `leaf_bag_low` are the 30 gallon two-ply kraft lawn and leaf
  bag, 41 x 30 cm, filled to 64, 48 and 32 cm. The side gussets tuck in above the fill line and
  the top is folded over toward +X. A bag filled less has more paper to fold, so it stands lower
  (81, 67 and 51 cm) under a fatter roll. Parts: `body` (kraft: fresh, rain-dark, sun-bleached),
  `print` (a green leaf and a band on both wide faces, ±X) and `leaves` (two to four leaves
  caught in the fold: ochre, rust, brown). One box collider on `body`.
- Place bags on the sidewalk at the curb edge beside the bins of a collection row, or against a
  front fence or stoop: one to four per door, a wide face toward the street. Pick the form by
  `props.leaf_bag.forms[].share` (full .45, three quarters .35, half .2), the colour by
  `variant_seed`, and keep `scale` within `scale_range` (.97 to 1.03). A bag is never in the
  roadway.
- `pumpkin` is a carving pumpkin about 30 cm across with ten ribs and a woody stem: orange, deep
  orange or white by `variant_seed`. `pumpkin_carved` is the same pumpkin as a jack-o'-lantern:
  triangle eyes and nose, a grin with two teeth and the lid cut, in a dark `face` part. Its
  face looks along +X, so yaw +X toward the sidewalk. No colliders.
- Place pumpkins on stoop steps and landings, front-yard ledges and balcony floors: one to three
  per door, carved for .3 of them. Sizes come from the placement `scale`: `sizes` gives pie .6,
  carving 1 and large 1.4, within `scale_range` (.55 to 1.45).
- The contact sheet tile "october curb" shows the three bags beside a brown bin and pumpkins at
  the three sizes.

## Street-name sign text

`sign_street` ships with blank blades. Blade A runs along Y and is read from ±X. Blade B runs
along X and is read from ±Y. It sits under blade A on the same post, so one prop whose yaw
follows street A also labels the perpendicular street B. On the Plateau grid the two street
directions are about 90° apart. Each face is white, with a thin black border and a red
four-lobed rosette placeholder at the viewer's right end. The rosette is not the City's logo
artwork.

The apply step adds the text per corner from the OSM `name` of each street:

1. Split the name into the generic (`Rue`, `Avenue`, `Boulevard`, `Place`, `Ruelle`) and the
   specific (`de Mentana`, `Rachel Est`). Keep Est and Ouest, as the Commission de toponymie
   requires.
2. For every entry in `props.sign_street.text_slots.blade_a` and `blade_b` (two faces each),
   add two `UTextRenderComponent`s to the sign actor, black (#111111), at
   `generic.center_cm` and `specific.center_cm`. Each text's reading direction is `right`, its
   up is `up`, and it faces `face_normal`. Use world size about 4.2 cm for the generic and 9 cm
   for the specific, and shrink the specific to fit `specific.size_cm[0]`. Centre both texts
   horizontally and vertically. If a text renders mirrored, turn that component 180° about Z.
   The slot vectors already account for Unreal's left-handed axes.
3. Corners with only one named street use blade A only. Hide blade B's meshes or use a second
   sign rotated 90°.

TextRender keeps the text sharp and costs no OBJs. For a baked alternative, the generator's
`text_geo()` can emit the same glyphs as flat meshes. The contact sheet tile "sign_street
blades" uses it for the "Rue / de Mentana" and "Avenue / Duluth Est" demo, which is not
exported. The ARRÊT and parking lettering is modelled the same way and is part of the
exported meshes.

## Companions (dogs, stroller, grocery bag)

- Each dog has articulated parts: `body` and `collar` in root space, plus `head`, `head_dark`
  (eyes and nose), `leg_fl`, `leg_fr`, `leg_rl`, `leg_rr` and `tail`. Every part has its pivot at
  its joint. Place part *p* at its `attach_cm` in the dog's local frame. Left legs (`*_l*`) are on
  Unreal -Y.
- `joint` gives the swing axis in Unreal-local axes, an amplitude and a phase in cycles. For a
  trot, swing the legs about Y in diagonal pairs (fl with rr, fr with rl), with a stride period of
  about 0.45 s. Wag the tail about Z. Nod the head about Y.
- `merged_coat`, `merged_dark` and `merged_collar` are the same dog, assembled, for static or
  distant use. `extra.leash_collar_cm` is where the leash attaches.
- The stroller has `frame`, `seat` and `canopy` in root space, plus four wheels with axle pivots
  (`joint.spin`, `radius_cm`). `merged_*` meshes are provided too. `anchors.hand_grip_cm` is the
  handlebar.
- Suggested Unreal paths, if the apply step imports into `/Game/Plateau/Replica/Props`:
  `/Game/Plateau/Replica/Props/SM_Props_dog_medium_body`, `..._leg_fl`, and so on. The mesh name
  of every part is in `props[key].parts[name].mesh`.

## Apply notes (host)

- Import every `batches[]` OBJ with the `upgrade_plateau.import_mesh` options
  (`FbxImportUI`, `combine_meshes`, no auto collision) into `/Game/Plateau/Replica/Props`,
  named by `batches[].mesh`.
- The OBJs carry `vn` normals. Smooth shading is kept on curved surfaces and hard edges between
  primitives.
- Instance props with one ISM/HISM per part mesh, all sharing the prop transform. Do not use
  `QuebecParkInstances`, because `upgrade_plateau` rejects it.
- Collision: every batch is `collision: none`. Add the boxes in `colliders_cm` as simple box
  collision on the instanced prop, or as invisible blockers. Keep them out of the ±300 cm traffic
  band and 150 cm clear of hydrants.
- Turn shadows off for small props (signs' faces, lettering, cones, bags) beyond about 30 m.
  Emissive parts should not cast shadows.

## Sources and technique

- Dimensions, colours and designs come from `research-plateau.md` §9 (palette), §11 (ARRÊT,
  street-name and R-PF parking signs, Québec one-way sign), and §12 (3000 K LED cobra heads,
  black fluted park lamps with white globes, red Montréal hydrants with marker posts, BIXI
  docks). These rest on Wikimedia Commons photos checked by eye, which were not copied into
  assets. Bins follow the City's blue recycling wheelie bin and 45 L brown organics bin.
- Leaf bags: the 30 gallon two-ply kraft lawn and leaf bag, 16 x 12 x 35 in (Uline S-22522,
  https://www.uline.com/Product/Detail/S-22522; Duro at Costco Business Centre). Montréal takes
  leaves in compostable paper bags, and a borough notice on montreal.ca ("Les sacs de plastique
  interdits dans la collecte des résidus verts", RDP-PAT) bans plastic bags from green-waste
  collection since 1 January 2024. The leaf print is a generic shape, not a brand mark.
- Pumpkin: adapted from bflanagin, "How to: Spooky Jack-o-Lantern (Modeling)"
  (https://steemit.com/art/@bflanagin/how-to-spooky-jack-o-lantern-modeling): a squashed sphere,
  every third line of vertices pulled in for the ribs, the stem drawn out of the top ring and the
  face cut in the front. Here a lathe with a radius factor per side makes the ribs, and the face
  is a dark decal laid 4 mm over the shell (the lid cut 1.5 mm) instead of a hole with a
  solidified wall, which keeps the carved pumpkin under 600 triangles. The CG Cookie beginner
  low-poly pumpkin tutorial uses the same ribbed-sphere idea. Pumpkins on stoops in the last week
  of October are an art-direction choice; no data source places them.
- Technique: a procedural kit of parts (lathe, swept tube, chamfered box, extruded outline, flat
  glyphs) written for this layer. No external modelling breakdown fit this small-prop
  low-poly style better than the existing `plateau_streets.py` prop helpers, which this kit
  extends with chamfers, smoothing groups and articulated companions.

## Limits

- Not checked in Unreal. The import orientation follows the `plateau_mesh.py` convention and
  `verify_lafontaine.py`'s north check, but no host import has run yet.
- The ARRÊT size (75 cm), the street-blade size and the mailbox are estimates, as noted in
  `research-plateau.md` §18.
- The dogs and stroller are static meshes with joints for procedural motion. There is no skeleton.
- The mirror follow-up (`openspec/changes/nord-gta-level-up/notes-mirror.md`) mirrors the
  baked layers with a negative Y scale. Prop instances must only have their position Y and yaw
  negated, never their scale. Otherwise the ARRÊT, parking and street-name lettering reads
  backwards and the light-bar colours swap sides.

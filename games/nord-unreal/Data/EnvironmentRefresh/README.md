# Parc La Fontaine appearance correction

This layer reuses the 1,161 municipal building shells and roof-photo sections, mapped pond/path and landmark geometry, and 4,586 municipal tree IDs, XY positions and trunk diameters. It changes canopy geometry, trunk heights, materials and decorative architecture, and adds court and neighbourhood details. The counts below describe the current prepared sources and imported map. The final apply passes. Final fresh-load/native repeats pass. Both corrected 21-view matrices and bounded visual review pass; current package play and all eleven packaged lifecycle checks pass, while all six current packaged p95 budgets fail. The 2016 building survey and processed roof photos do not establish a present-day street-level reconstruction.

## Prepared geometry and materials

There are **12 original OBJ models**: eight broadleaf canopies (four variants for each of two styles), one conifer canopy, `ArchitectureAccents`, `CourtSurfaces` and `CourtDetails`. Broadleaf models contain 7,324–10,451 triangles each; the conifer has 672, architecture 82,142, court surfaces 60 and court details 22,504. The importer enables **Nanite for all nine canopy models and ArchitectureAccents**, and imports explicit shared-vertex canopy normals. These settings do not establish a frame-time result.

The 4,330 broadleaf trees use asymmetric boughs, supporting forks and open gaps; 256 conifers retain a separate silhouette. Deterministic variation produces 32 crown groups, with yaw, unequal XY scaling and mostly green/ochre early-autumn colour. Nominal diameter-derived broadleaf spreads are 6.44–20 m (median 10.31 m), before unequal XY scaling; these are authored targets, not measured crowns. Source checks require spread at least as wide as leafy crown height, rather than full tree height. Foliage remains opaque volumes without individual leaves. Tree height, spread, species classification and seasonal colour are estimates. The existing trunk `BlockAll` profile remains active; its vertical scale changes. Crowns use explicit `NoCollision`.

The shared façade shader illustrates subdued limestone/brick, basement courses, narrow sash windows, lintels and sills. Accents cover **80 valid exterior edges on 67 unique building shells** along four park-perimeter streets:

| Street | Edges | Buildings | Door units | Balconies | Exterior stair flights |
| --- | ---: | ---: | ---: | ---: | ---: |
| Parc-La Fontaine | 31 | 30 | 29 | 59 | 4 |
| Rachel | 33 | 26 | 28 | 63 | 7 |
| Sherbrooke | 13 | 11 | 10 | 27 | 0 |
| Papineau | 3 | 2 | 3 | 3 | 1 |
| **Total** | **80** | **67 unique** | **70** | **152** | **12** |

Buildings can appear in more than one street row. Selection uses the full municipal footprint union to omit interior/overlapping seams and frontages facing through other shells. Actual municipal wall triangles cap upper details across the whole selected edge, omitting unsupported gaps and low wings; 60 edges support a flat cornice. The 67 contributing OBJ hashes are retained. Door centers share the imported wall UV window-bay phase, with a 190 cm stone portal surround. Generated entry/balcony/stair convex footprints fit within a 160 cm outward clearance strip (actual maximum depth 154 cm), clear mapped asphalt/full shell union within 1 cm² intersection tolerance, and avoid inventory trunks by half the measured diameter plus 20 cm. Source geometry checks do not substitute for the final native visual review. A door unit is an illustrated doorway, not a usable interior or surveyed address. Residential entries include shallow stoops, transoms and iron rails; institutional classifications omit residential balconies/exterior stairs and use ground-level entries. Unspecified OSM building uses, façade rhythms, doorway counts, stairs, balconies and materials are estimates. The chalet gains pond-facing glazing/terrace cues and the theatre a lightweight perimeter frame. Added architecture and court geometry use `NoCollision`; base buildings remain individually flattened to the game's ground plane.

All **14 mapped tennis footprints** remain in place, with seven illustrated carpet and seven acrylic surfaces. Assignment to the two existing seven-court rows is estimated: the retained OSM tags call all fourteen `artificial_turf`, whereas the [current City listing](https://montreal.ca/en/places/parc-la-fontaine-tennis-and-pickleball-courts) distinguishes carpet/acrylic. Numbered court and pickleball locations are not reconstructed. New nets use 8 cm cells, 0.5 cm diameter cords and a sagging top band (91.4 cm at center). The importer retires all 731 original tennis backing/grid/post parts, keeping court boundary fences and lines. An earlier correction removed the 717 remaining grid/post parts after fourteen backings had already been removed; the latest idempotent apply records zero new removals. Fresh-load verification must establish all retired parts absent, rather than requiring the removal counter to be nonzero on every import.

The [City lists two sand volleyball courts at one venue](https://montreal.ca/en/places/beach-volleyball-courts-parc-la-fontaine). Two estimated **16×8 m** playing areas and open-wire nets fit inside retained in-park sand way `311018514` (about 35.20×28.72 m / 1011 m²), each with a nonoverlapping **2 m free-zone buffer** inside the mapped polygon. Arrangement/numbering is inferred, not separately surveyed or exact current placement. The importer suppresses the original three-piece single net/posts; outside-park way `1180093558` is excluded. On a repeated import, those already removed parts need not be removed again.

Pond shading keeps a quiet green-grey base `(0.035, 0.085, 0.075)`, roughness `0.28` and metallic `0`. Shared `Scripts/pond_normal.hlsl` blends three low-amplitude directions with unequal speeds/frequencies to avoid synchronized XY grid ripples. Water polygons/elevations remain untouched. Terrain remains flat and both ponds share a level, omitting the real banks and cascade.

The dependent [NeighbourhoodDetails layer](../NeighbourhoodDetails/README.md) supplies six shared models, 445 bicycle/bus-stop/junction/terrace instances and 199 text signs. Its placement provenance, authored offsets, explicit `NoCollision`, shadow settings and 65–85 m mesh / 50 m text culling are documented separately.

## Prepare and apply

From `games/nord-unreal/`, use the existing geographic Python environment with NumPy and Shapely:

```bash
/home/von/.cache/nord-geo-venv/bin/python Scripts/prepare_environment_refresh.py
/home/von/.cache/nord-geo-venv/bin/python Scripts/test_environment_refresh.py
/home/von/.cache/nord-geo-venv/bin/python Scripts/prepare_neighbourhood_details.py
/home/von/.cache/nord-geo-venv/bin/python Scripts/test_neighbourhood_details.py
```

The environment source checks cover four input hashes (park, city, district and OSM), 67 contributing municipal OBJ hashes, finite/nondegenerate geometry, distinct canopy variants/bounds/normals, valid exterior selection, low-wing/gap support, UV-aligned door bays, full accent footprints, institutional exclusions, retained tennis polygons and buffered volleyball containment/nonoverlap. The dependent neighbourhood test also checks transformed mesh hulls against mapped road/building/water geometry. These assertions do not establish attractive rendering, clearance against every prop or usable gameplay.

Close other editors for this project and build the current editor module. Existing ParkComic palette/text materials and the prepared base map are prerequisites. Apply serially with `/Game/Maps/LaFontaine` loaded:

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -NullRHI -unattended -nop4 -ExecutePythonScript="$(pwd)/Scripts/apply_environment_refresh.py"
```

The importer requires both layouts and their matching OSM/park/building hashes. It saves the map and copies it plus existing `ParkComic`, `CityBuildings`, `Art`, `EnvironmentRefresh` and `NeighbourhoodDetails` folders to a timestamped `Saved/Recovery/environment-*` backup. Before/after SHA-256 checks protect original and neutral crew sources, `/Game/ParkComic/Crew` packages, municipal shell OBJ/uassets, retained mapped data and the generated map header. Shared city materials are intentionally updated; preservation of shell packages does not mean every material is unchanged.

A saved gameplay snapshot compares Pawns, PlayerStarts and `Mission ` actors by identity, class, label and numeric transform. It does not compare every actor property or later runtime behavior. Rerunning replaces crowns, architecture, court and furniture groups and updates trunk transforms. It does not call `build_park_comic.py`, which recreates residents/cars. Run this layer again after a full original park rebuild, then cook a new package before sharing.

`Saved/Tests/EnvironmentRefresh.json` records the actual apply outcome, tree/crown/perimeter/entry/balcony/stair counts, neighbourhood counts, replaced net parts, backup path, gameplay snapshot count and protected-file hashes. `facade_edges` is the Sherbrooke subset; `perimeter_facade_edges` is the full four-street count. A fresh-load `Scripts/verify_park_comic.py` checks saved counts/assets, architecture Nanite, decoration collision, neighbourhood transforms/culling/shadows and retained tree XY/diameters. The final apply retains 2,774 protected hashes and 19 saved gameplay actors. It records zero newly removed retired parts on the last idempotent apply. Fresh-load verification passes all **734 retired parts** absent (731 tennis plus three volleyball). Automated assertions remain separate from visual likeness acceptance.

## Native render and gameplay review

Run the actual Vulkan renderer with the current editor module, serially:

```bash
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -RenderOffscreen -unattended -nop4 -nosound -NordEnvironmentOnly -NordCaptureWidth=1280 -ExecutePythonScript="$(pwd)/Scripts/capture_park_comic.py"
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -RenderOffscreen -unattended -nop4 -nosound -NordEnvironmentOnly -NordCaptureWidth=1920 -ExecutePythonScript="$(pwd)/Scripts/capture_park_comic.py"
```

Require `passed: true` and **21 views per resolution** in `Verification/EnvironmentRender1280.json` and `EnvironmentRender1920.json`. Review their actual `Environment*.png` outputs in `Preview/Environment1280/` and `Preview/Environment1920/`: the seven original Theatre/Chalet/Centre/Courts/Pond/Overview/Sherbrooke cameras; seven neighbourhood close-ups StreetCorner (Sherbrooke), ChaletTerrace, SportsGround (tennis), Rachel, ParcLaFontaine, Papineau and SandCourts; and those same seven after the actual F2 handler, with `_F2` filenames. Sports close-ups use eye-level 180 cm cameras. FOV remains 65°. Root-level `Preview/Environment*.png` files and earlier seven-view reports are historical; omitting the width flag retains the legacy 1600×900 output location.

The harness deletes each old screenshot before capture and records position/target, FOV, comic state, dimensions/size and PNG signature/IHDR/IEND completion. It restores the cold-start configured PlayNetMode and original client count. Capture completion is separate from visual acceptance: inspect façade/material scale, crown gaps, landmark visibility, café/furniture placement, tennis and sand nets, text legibility and full mesh clearance in both styles. No frame-time acceptance comes from these screenshots. The current player/environment inspection uses temporary 1024 MiB streaming/2048 VSM pages at 720p and 512 MiB/1024 pages at 1080p; packaged Epic settings remain unchanged.

The first neighbourhood native suite passed map/collision/network and minute-long population checks. The latest resident change staggers hub turnaround points and focuses nearby name labels. Fresh `Population.json` passes 13 checks after that correction: all 88 mobile actors move at least 2,625.2 cm and pause over the minute, while eight social actors hold; all other final native cases also pass in `NeighbourhoodQA.json`. The first 21-view 720p matrix failed visually; [the corrected both-size review](../../Verification/NeighbourhoodVisualReview.md) now accepts the bounded camera/frontage/net/terrace improvements, with thin-line aliasing/shadow/likeness limits. Both 21-view matrices are reviewed. Current build/cook, package play and all eleven packaged lifecycle checks pass; all six warmed 1280×720/1920×1080 Epic performance scenes were measured and fail the p95 gate. See [current performance](../../Verification/README.md) for the full table and shared-GPU limits. The active quality gate stays open for failed performance acceptance and documented art limits.

## Reference and fidelity limits

The [primary-reference gap review](../../Verification/NeighbourhoodReferences.md) links the City park/heritage/court sources, [Lemay's 2022 Théâtre de Verdure](https://lemay.com/projects/theatre-de-verdure/) and [ékm's chalet renovation](https://www.ekmarchitecture.com/data-projects/1021-lafontaine-eng). They establish local character rather than exact façade dimensions. The supplied Google share and Street View pixels were inaccessible with the available tools; no photographs from those pages are copied into game textures. Fountain operation and present-day construction are not reconstructed. Procedural masonry, opaque foliage, flat terrain, equal pond levels and estimated decoration remain material resemblance limits.

# Parc La Fontaine appearance correction

This appearance pass reuses the 1,161 checked-in municipal building shells and their existing roof-photo material sections, the mapped pond/path and landmark geometry, and 4,586 municipal inventory tree IDs, XY coordinates and trunk diameters. It changes canopy geometry, trunk heights, materials and decorative architecture. The building and park source manifests are unchanged. Building bases remain individually flattened to the game's ground plane; the 2016 survey and processed roof photos are not a present-day street-level reconstruction.

Six broadleaf variants use blended asymmetric bough clusters, supporting forks and open gaps; a seventh mesh handles the 256 conifers. Explicit shared-vertex normals and Nanite are enabled for the canopy imports. The 4,330 broadleaf trees have nominal diameter-derived target spreads of 7.08–20 m (median 10.25 m), with additional yaw and unequal XY scaling. These are authored dimensions, not measured crown extents. Source checks compare nominal spread with leafy crown height, rather than full tree height. Foliage remains opaque volumes without individual leaves. Early-autumn colour is mostly green/ochre, with russet reserved for species names containing `rubrum` or `rubra`. Height, spread, shape and seasonal colour remain estimates. Trunk XY and diameter are retained, but vertical scale changes; the existing trunk `BlockAll` collision profile remains active. Crowns have `NoCollision`.

The shared municipal façade shader varies subdued limestone and brick, basement courses, narrow sash windows, lintels and sills. Along Sherbrooke, 81 selected exterior edges across 37 surveyed building footprints gain shallow plinth/cornice art. Each selected building receives one estimated door and glazed transom. Of those, 35 have a 72 cm raised entrance, four 18 cm risers, a 150 cm deep stoop and narrow iron rails; two have ground-level entrances. The mapped chalet gains terrace-side glazing and the theatre a lightweight dark perimeter frame. These added details have `NoCollision` and do not provide usable interiors. Façade rhythms and entries are illustrations rather than surveyed details; institutional buildings still share the procedural masonry treatment.

Pond shading uses a quiet green-grey base `(0.035, 0.085, 0.075)`, roughness `0.28` and metallic `0`. `Scripts/pond_normal.hlsl`, shared by the initial material generator and this refresh, blends three low-amplitude ripple directions with unequal speeds and frequencies. This replaces the synchronized XY grid. Only the material normal changes: water polygons and elevation remain untouched. Terrain remains flat and both ponds share a level, omitting the real banks and cascade.

Primary references were checked for this correction: [City park and amenities](https://montreal.ca/en/places/parc-la-fontaine), [City heritage guide](https://ville.montreal.qc.ca/pls/portal/docs/PAGE/CONS_PAT_MTL_FR/MEDIA/DOCUMENTS/GUIDE%20PARC%20LA%20FONTAINE_DEPT_CPM_15JUIN2012.PDF), [City heritage assessment: Sherbrooke house alignment](https://ocpm.qc.ca/sites/default/files/pdf/P62/5c2.pdf), [Lemay's 2022 Théâtre de Verdure](https://lemay.com/projects/theatre-de-verdure/), and [ékm's chalet and terrace renovation](https://www.ekmarchitecture.com/data-projects/1021-lafontaine-eng). These establish park/architectural character, not exact façade dimensions. No photographs from those pages are imported as game textures. The supplied Google share resolves to 1334 Rue Sherbrooke Est; Street View pixels could not be inspected with the available tools. Fountain operation and present-day construction are not reconstructed.

The [City tennis listing](https://montreal.ca/en/places/parc-la-fontaine-tennis-and-pickleball-courts) distinguishes seven carpet and seven acrylic courts; the retained map uses a shared surface. The [City volleyball listing](https://montreal.ca/en/places/beach-volleyball-courts-parc-la-fontaine) describes two courts; the retained combined polygon has one illustrated net. Those representation gaps remain.

## Prepare and apply

From `games/nord-unreal/`, run the existing geographic environment:

```bash
/home/von/.cache/nord-geo-venv/bin/python Scripts/prepare_environment_refresh.py
/home/von/.cache/nord-geo-venv/bin/python Scripts/test_environment_refresh.py
```

Close other editors for this project and build the current editor module. Run the appearance importer serially with `/Game/Maps/LaFontaine` loaded:

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -NullRHI -unattended -nop4 -ExecutePythonScript="$(pwd)/Scripts/apply_environment_refresh.py"
```

The importer saves and copies the map plus the existing `ParkComic`, `CityBuildings` and `Art` folders to a new timestamped `Saved/Recovery/environment-*` directory before changes. Hash guards compare the park layout and city manifest with `Data/EnvironmentRefresh/layout.json`; the OSM snapshot is a preparation input but is not included in those two hash guards. A before/after snapshot checks saved Pawns, PlayerStarts and `Mission ` actors for identity, class, label, location, rotation and scale. This does not verify every actor property, collision volume or later runtime population behavior. Re-running replaces the crown/accent groups and updates trunk transforms. It never calls `build_park_comic.py`, which also recreates residents/cars. After any full original geographic/park rebuild, run this pass last. Repackage before sharing; an earlier package does not contain subsequent refreshes.

## Render review

Run with an actual Vulkan renderer and the current editor module, with no competing game/render process:

```bash
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -RenderOffscreen -unattended -nop4 -nosound -NordEnvironmentOnly -NordCaptureWidth=1280 -ExecutePythonScript="$(pwd)/Scripts/capture_park_comic.py"
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -RenderOffscreen -unattended -nop4 -nosound -NordEnvironmentOnly -NordCaptureWidth=1920 -ExecutePythonScript="$(pwd)/Scripts/capture_park_comic.py"
```

Review the seven `Environment*.png` files in `Preview/Environment1280/` and `Preview/Environment1920/`: Theatre, Chalet, Centre, Courts, Pond, Overview and Sherbrooke. The first six retain the corresponding older `ParkComic*.png` camera positions and 65° FOV; resolutions differ. Sherbrooke uses the saved spawn plus 70 cm in Z and the saved road yaw. Root-level `Preview/Environment*.png` images are earlier 1600×900 captures and do not establish the final render state. Omitting the width flag preserves that legacy output mode.

Require `passed: true` and seven views in each `Verification/EnvironmentRender1280.json` and `EnvironmentRender1920.json`. Each entry records position/target, horizontal FOV, file dimensions/size and PNG signature/IHDR/IEND completion checks. The harness removes the old file before requesting a shot; it restores the cold-start configured PlayNetMode and original client count afterward. This report verifies capture completion, not visual resemblance, shader quality or performance. Inspect pond outline, theatre island, chalet placement and sports layout; canopy branching/gaps and landmark visibility; and Sherbrooke masonry, doors, stoops and cornices. The environment captures use the default comic view; F2 realistic appearance still needs the walking/driving regression.

The importer writes `Saved/Tests/EnvironmentRefresh.json` with tree/crown/facade counts, the saved gameplay actor count, backup path and stated limits; retained copies may be placed in `Verification/`. It does not embed source hashes: those live in `Data/EnvironmentRefresh/layout.json`. Retain accepted images/reports with the QA change. Run existing park/map verification, gameplay smoke and car traversal checks after applying, then repeat packaged gameplay and warmed 1280×720/1920×1080 performance scenes. Tree counts are unchanged but crown bounds/overdraw and trunk collision heights differ, so an earlier performance or traversal report does not verify this pass.

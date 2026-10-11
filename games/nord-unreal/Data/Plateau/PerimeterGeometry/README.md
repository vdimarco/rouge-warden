# Park-facing Plateau fronts

This additive visual layer extends the existing detailed Panet–Visitation route to **154 mapped building fronts** facing Parc La Fontaine: 73 on Avenue du Parc-La Fontaine, 45 on Rachel, 28 on Papineau and eight on Sherbrooke. It contains 305 spatial mesh batches, 725,808 decorative triangles, 1,141 illustrated windows, 255 balcony decks and 88 decorative exterior stair flights. Frontages use existing procedural cornices, recessed windows, curtains/blinds, doors and ironwork, with narrower sash proportions and a varied limestone/red/brown/ochre palette. Named shops are not added.

Selected edges are within 65 m of the checked-in park boundary and face toward it. All 100 existing detailed-route building IDs are excluded. Original footprints, shells, roofs, gameplay actors and collision remain separate and unchanged. This layer deliberately has **NoCollision**; its stairs/balconies illustrate architecture and do not provide new walkable interiors/decks. All batch sources and retained geographic inputs have SHA-256 records in `perimeter.json`.

Run from `games/nord-unreal` after preparing the existing Plateau sources:

```sh
python3 Scripts/plateau_perimeter.py
python3 Scripts/test_plateau_facades.py
python3 Scripts/test_plateau_perimeter.py
```

In a backed-up, already merged LaFontaine map, use `plateau_perimeter.apply(unreal, import_mesh, nanite)` with the existing importer helpers, then save/reopen and run `plateau_perimeter.verify(unreal)`. The helper refreshes only actors labelled `Plateau perimeter ` / `Plateau survey landmark Le Neuville` / `Plateau survey landmark École Le Plateau` and meshes under `/Game/Plateau/Perimeter`; it validates source/geometry digests before importing. A separately duplicated `M_PerimeterStone` material gives the new stone fronts a cooler grey tint without altering existing verified route materials. The caller owns map recovery, the integrated-map guard, preserving gameplay/collision snapshots and saving the map.

The full `upgrade_plateau.py` regeneration also applies this layer after the existing environment components. Regenerate `perimeter.json` after changing the base survey or `Data/Plateau/layout.json`; stale digests are rejected.

These are original architectural illustrations informed by [municipal Plateau references](../../../Verification/GraphicsBuildingSources.md). All 85 untagged heights use the existing three-storey estimate; the other 69 derive from tagged storeys at 3.2 m/storey. Individual finishes, doors, windows, cornices and stair designs are estimates. The grey-stone emphasis on Avenue du Parc-La Fontaine is an authored composition, not a surveyed material classification. No Google imagery, reference photograph textures or exact Street View match is claimed. Native visual and performance acceptance belongs to the current graphics QA report, not this source manifest.

The Le Neuville tower at 1101 Rue Rachel Est is excluded from the three-storey frontage generator. A separate 256-triangle copy of retained municipal survey feature `2317003` restores its 57.44 m roof silhouette, with 425 authored modern window bays and 64 balcony runs over 17 storeys. Concrete, dark glazing, natural-metal frames and anthracite railings use separate materials; the retained roof material is duplicated. Original municipal assets are unchanged. Its original 9.6 m OSM collider remains: this is an exterior visual correction with no upper-floor access. The footprint join is strong but not cadastral identity; low-roof seam/placement and rendered quality require native review.

École Le Plateau, 3700 Avenue Calixa-Lavallée, receives a separate owned visual copy of municipal feature `2316935` (626 triangles). It retains the surveyed U-shaped plan, 15.57 m lower wing, 20.88 m main walls and 24.02 m roof maximum. The new tan PBR masonry, 539 classroom/basement windows, sills and white trim are an illustration, not a surveyed elevation. Its roof instance and parent are separately duplicated; original survey assets and the old 9.6 m OSM collider are SHA guarded and unchanged. Both school cameras are recorded in `Saved/Tests/GraphicsBuildingCameras.json` for native before/after review. Total new visual geometry is 726,690 triangles including both surveyed bodies.

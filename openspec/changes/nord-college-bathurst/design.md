# Design

All paths are relative to `games/nord-unreal/` unless they start with `openspec/`.

## Sources

- OpenStreetMap snapshot from the OSM API `map` call, bounding box −79.4140, 43.6528, −79.4010, 43.6598 (about 1,050 m × 780 m), © OpenStreetMap contributors, ODbL 1.0. Stored as `Data/CollegeBathurst/osm.xml`.
- City of Toronto "3D Massing" 2025 shapefile (WGS84, Web Mercator coordinates), <https://open.toronto.ca/dataset/3d-massing/>, Open Government Licence – Toronto. Clipped by footprint centroid to the same box and stored as `Data/CollegeBathurst/massing.geojson` (polygon rings in lon/lat, plus `MIN_HEIGHT`, `MAX_HEIGHT`, `AVG_HEIGHT`, `HEIGHT_SRC`, `BLDG_SRC`).
- Anchors read from the OSM API: Sneaky Dee's is way 678313322 (amenity=pub, 431 College Street, building:levels 2) on the south-east corner. The College × Bathurst traffic signal is node 29690663 at 43.6564664, −79.4077041.

No Google imagery, Street View or GTA material is used.

## Projection and frame

Same formula as `prepare_lafontaine.xy()`: x = (lon − lon0) × 111,320 × cos(lat0) × 100, y = (lat − lat0) × 111,320 × 100, in centimetres, +X east, +Y north. Origin is the intersection node (43.6564664, −79.4077041), so College × Bathurst sits at (0, 0). Bounds for gameplay are 43.6530, −79.4135, 43.6595, −79.4015. The OBJ writer flips y the same way `prepare_lafontaine.py` does, so the Unreal import matches the header coordinates.

## Preparation (`Scripts/prepare_college_bathurst.py`)

Pure Python with the standard library plus shapely and numpy, which the existing geo environment has.

- **Roads.** OSM `highway` in the Montréal road set. Unlike Montréal, ways that cross the bounds are clipped with `clip_segment`, not dropped, so College and Bathurst reach the edge. Width from `road_width_cm`. One-way carriageway pairs are kept as separate ways with their `oneway` flag recorded; the header keeps the same `RoadSegments` and `RoadSegmentWidths` arrays.
- **Paths.** Footways, paths, cycleways, pedestrian ways and steps, for the walking spawn and later crowds.
- **Streetcar tracks.** `railway=tram` ways, as thin strips in their own `Tram` material and a `tram_lines` list.
- **Buildings.** OSM building footprints whose centre lies inside the bounds, cut at the edge. A massing polygon matches when the intersection covers at least 50% of the smaller footprint. Height priority: massing `AVG_HEIGHT` (`MAX_HEIGHT` only when the average is under 2.5 m), then OSM `height`, then `building:levels × 3.2 m`, then 3 storeys (9.6 m); clamp 2.5–100 m. `MAX_HEIGHT` is the highest lidar return, so it counts signs, parapets and roof equipment; the average is closer to a roof for a box extrusion. Matching parts are applied tallest first; parts more than 3 m from the main height keep their own heights as `<osm>/massing-<i>` buildings, and leftover pieces become `<osm>/part-<n>`, so the hospital block is not flattened to one height. Each building records `height_source`, `massing_field`, `massing_index`, `massing_area_m2` and `massing_shared` (how many buildings share that massing footprint). Massing polygons with a height and no OSM footprint are added tallest first as their own buildings, so no measured building is lost.
- **Landmarks.** Sneaky Dee's (footprint, height, address), the intersection, and named amenities and shops (name, kind, position) for later signage.
- **Street lamps and trees.** `highway=street_lamp` nodes at z = 470 and `natural=tree` nodes.
- **Spawn.** The College Street sidewalk point nearest the Sneaky Dee's entrance side (the north face of its footprint, toward College), at z = 120. The car is parked at the kerb on the spawn side, past the spawn and away from the corner, facing with traffic. Its whole 440 × 216 cm body (the `AQuebecCar` collision box) stays at least 1.27 m (half a streetcar's width) from every track.
- **Outputs.**
  - `Data/CollegeBathurst/layout.json`: origin, bounds, roads, road widths, one-way flags, paths, tram lines, buildings (id, footprint, height, height source, levels), landmarks, lamps, trees, spawn, car, car yaw, street names, counts, attribution.
  - `Data/CollegeBathurst/Geometry/*.obj` (git-ignored, like `Data/LaFontaine/Geometry/`): Road, Marking, Path, Tram, Grass, Roof, Brick, Cream, Sage, Glass, Landmark.
  - `Source/Quebec/CollegeBathurstMap.h`: `namespace CollegeBathurst { Spawn, CarSpawn, SneakyDees, RoadSegments[][2], RoadSegmentWidths[], StreetLamps[] }`, generated, with the licence lines in its first comment in ASCII ("(c) OpenStreetMap contributors, ODbL 1.0" and "Open Government Licence - Toronto"). The README, layout and previews keep the exact attribution text.
  - `Data/CollegeBathurst/README.md`: sources, licences, method, counts and limits.
- **Previews.** `Scripts/preview_college_bathurst.py` writes `Preview/CollegeBathurst/plan.png` (roads, tram, buildings shaded by height, lamps, Sneaky Dee's and the spawn) and `Preview/CollegeBathurst/massing.png` (an oblique extrusion view looking north-west over the intersection).

## Greybox map (`Scripts/create_college_bathurst.py`)

Editor Python, patterned on `create_lafontaine.py`. It refuses to run if `/Game/Maps/CollegeBathurst` exists. It creates a new level, imports the OBJ groups to `/Game/CollegeBathurst/SM_<group>`, reuses the existing Plateau materials (`M_Asphalt`, `M_Concrete`, `M_BrickRed`, `M_Limestone`, `M_Roof`, `M_Glass`, `M_ParkGrass`, plus `M_Yellow` for markings, `M_Iron` for streetcar rails and `M_SageBackground` for sage walls), adds a hidden collision floor and hidden edge walls, four player starts at the spawn, one parked car at the car spawn, the sun, sky atmosphere, sky light (real-time capture), height fog, volumetric clouds and an unbound post-process volume with the Montréal exposure, then saves. Buildings, the floor and the edge walls block; roads and markings do not; there are no curbs yet. It is meant to start on `/Engine/Maps/Entry`, and it stops if the La Fontaine map has unsaved edits. It never loads or saves `/Game/Maps/LaFontaine`.

## Gameplay places that still assume La Fontaine

For the next step (not this change): `AQuebecGameMode::BeginPlay` returns early unless the map name contains `LaFontaine`; `MansionSpawn` and `LaFontaine::CarSpawn` drive fall recovery and parking; the radar draws `LaFontaine::RoadSegments` with Montréal credits; the HUD title says `NORD · MONTRÉAL`; the campaign coordinates and save slot are Montréal-only; `Config/DefaultGame.ini` cooks only La Fontaine; `Scripts/launch.sh` and `browser_streaming.py` start `/Game/Maps/LaFontaine`. The sky actor from `nord-sky-water` already reads lamps and latitude by map name.

## Tests (`Scripts/test_college_bathurst.py`)

Pure Python: projection equals the Montréal formula at a shared origin; College Street and Bathurst Street are present and reach the bounds; Sneaky Dee's footprint contains its OSM centroid, and its height comes from the massing `AVG_HEIGHT` rule (7.5 m); the hospital block keeps a part of at least 40 m; the spawn is within 25 m of Sneaky Dee's and on the College side; the car sits inside the College strip with the kerb on its right and clears every track; all road segments are finite and inside the bounds; the 40 cm endpoint snap and dead-end pruning (ported from `PruneTrafficBranches`) leave one connected component that includes College and Bathurst; the checked-in layout and header match an in-memory rebuild, so the test does not need the git-ignored geometry; the header is ASCII and compiles; lamp count matches the OSM nodes in bounds.

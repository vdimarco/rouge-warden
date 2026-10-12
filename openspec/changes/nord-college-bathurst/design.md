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
- **Buildings.** OSM building footprints. A massing polygon matches when the intersection covers at least 50% of the smaller footprint. Height priority: massing `MAX_HEIGHT` (lidar or model), then OSM `height`, then `building:levels × 3.2 m`, then 3 storeys (9.6 m); clamp 2.5–100 m. Each building records `height_source`. Massing polygons without an OSM footprint are added as their own buildings, so no lidar building is lost.
- **Landmarks.** Sneaky Dee's (footprint, height, address), the intersection, and named amenities and shops (name, kind, position) for later signage.
- **Street lamps and trees.** `highway=street_lamp` nodes at z = 470 and `natural=tree` nodes.
- **Spawn.** The College Street sidewalk point nearest the Sneaky Dee's entrance side (the north face of its footprint, toward College), at z = 120. Car spawn on the nearest College road segment, facing along the street.
- **Outputs.**
  - `Data/CollegeBathurst/layout.json`: origin, bounds, roads, road widths, one-way flags, paths, tram lines, buildings (id, footprint, height, height source, levels), landmarks, lamps, trees, spawn, car, car yaw, street names, counts, attribution.
  - `Data/CollegeBathurst/Geometry/*.obj` (git-ignored, like `Data/LaFontaine/Geometry/`): Road, Marking, Path, Tram, Grass, Roof, Brick, Cream, Sage, Glass, Landmark.
  - `Source/Quebec/CollegeBathurstMap.h`: `namespace CollegeBathurst { Spawn, CarSpawn, SneakyDees, RoadSegments[][2], RoadSegmentWidths[], StreetLamps[] }`, generated, with the ODbL and Toronto licence lines in its first comment.
  - `Data/CollegeBathurst/README.md`: sources, licences, method, counts and limits.
- **Previews.** `Scripts/preview_college_bathurst.py` writes `Preview/CollegeBathurst/plan.png` (roads, tram, buildings shaded by height, lamps, Sneaky Dee's and the spawn) and `Preview/CollegeBathurst/massing.png` (an oblique extrusion view looking north-west over the intersection).

## Greybox map (`Scripts/create_college_bathurst.py`)

Editor Python, patterned on `create_lafontaine.py`. It refuses to run if `/Game/Maps/CollegeBathurst` exists. It creates a new level, imports the OBJ groups to `/Game/CollegeBathurst/SM_<group>`, reuses the existing Plateau materials (`M_Asphalt`, `M_Concrete`, `M_BrickRed`, `M_Limestone`, `M_Roof`, `M_Glass`, `M_ParkGrass`), adds a collision floor, four player starts at the spawn, one parked car at the car spawn, the sun, sky atmosphere, sky light (real-time capture), height fog, volumetric clouds and an unbound post-process volume with the Montréal exposure, then saves. Buildings, the floor and the curbs block; roads and markings do not. It never loads or saves `/Game/Maps/LaFontaine`.

## Gameplay places that still assume La Fontaine

For the next step (not this change): `AQuebecGameMode::BeginPlay` returns early unless the map name contains `LaFontaine`; `MansionSpawn` and `LaFontaine::CarSpawn` drive fall recovery and parking; the radar draws `LaFontaine::RoadSegments` with Montréal credits; the HUD title says `NORD · MONTRÉAL`; the campaign coordinates and save slot are Montréal-only; `Config/DefaultGame.ini` cooks only La Fontaine; `Scripts/launch.sh` and `browser_streaming.py` start `/Game/Maps/LaFontaine`. The sky actor from `nord-sky-water` already reads lamps and latitude by map name.

## Tests (`Scripts/test_college_bathurst.py`)

Pure Python: projection equals the Montréal formula at a shared origin; College Street and Bathurst Street are present and reach the bounds; Sneaky Dee's footprint contains its OSM centroid, its height comes from the massing layer and is between 6 and 15 m; the spawn is within 25 m of Sneaky Dee's and on the College side; all road segments are finite and inside the bounds; the 40 cm endpoint snap and dead-end pruning (ported from `PruneTrafficBranches`) leave one connected component that includes College and Bathurst; the header arrays match the layout; lamp count matches the OSM nodes in bounds.

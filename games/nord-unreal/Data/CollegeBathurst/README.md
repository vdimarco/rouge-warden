# College and Bathurst geographic source

The Toronto district starts at College Street and Bathurst Street, around Sneaky Dee's at 431 College Street. It is a separate data set; the Montréal map, its data and its generated header are unchanged.

## Sources and licences

- `osm.xml`: OpenStreetMap API `map` call, downloaded 2026-10-12, unmodified:
  <https://api.openstreetmap.org/api/0.6/map?bbox=-79.4140,43.6528,-79.4010,43.6598>

  © OpenStreetMap contributors, ODbL 1.0

  Source and derived geographic data from OpenStreetMap are available under the Open Database License 1.0: <https://opendatacommons.org/licenses/odbl/1-0/>, <https://www.openstreetmap.org/copyright>.
- `massing.geojson`: City of Toronto "3D Massing" 2025 shapefile (WGS84), <https://open.toronto.ca/dataset/3d-massing/>. The 1,198 footprints whose centroid lies in the same box as the OSM snapshot were kept, with their rings in longitude and latitude and the properties `MIN_HEIGHT`, `MAX_HEIGHT`, `AVG_HEIGHT`, `HEIGHT_MSL`, `SURF_ELEV`, `HEIGHT_SRC` and `BLDG_SRC`. Heights are metres.

  Contains information licensed under the Open Government Licence – Toronto

  Licence: <https://open.toronto.ca/open-data-licence/>.

No Google imagery, Street View or GTA material is used.

## Method

`python3 Scripts/prepare_college_bathurst.py` writes `layout.json`, `Geometry/*.obj` (git-ignored; rebuild it from the snapshot) and `Source/Quebec/CollegeBathurstMap.h`. `python3 Scripts/preview_college_bathurst.py` draws `Preview/CollegeBathurst/plan.png` and `massing.png`. `python3 Scripts/test_college_bathurst.py` checks the result. The scripts need Python 3 with Shapely and Pillow.

- **Frame.** The projection formula is the one in `prepare_lafontaine.xy()`. The origin is the College × Bathurst traffic signal, OSM node 29690663 (43.6564664, −79.4077041), so the intersection is at (0, 0). Units are centimetres, +X east and +Y north. Gameplay bounds are 43.6530, −79.4135 to 43.6595, −79.4015, about 967 m × 724 m. The OBJ export negates Y and reverses winding, like the Montréal export, so the Unreal import matches the header coordinates.
- **Roads.** OSM highways in the Montréal road set (`residential`, `tertiary`, `secondary`, `primary`, `service`, `unclassified`, `living_street`). Ways that cross the bounds are clipped at the edge, so College and Bathurst reach it. Width comes from `road_width_cm()`. Ways tagged `oneway=-1` are reversed; `road_oneway` records the one-way flag of each way. `road_names` and `road_ways` give the street name and OSM way of each polyline.
- **Paths.** Footways, paths, cycleways, pedestrian ways and steps, clipped the same way; `path_kinds` records the `footway` value (`sidewalk`, `crossing`) or the highway type.
- **Streetcar tracks.** `railway=tram` ways, clipped, with their tram route numbers from the route relations (306, 506 on College; 511 on Bathurst; sidings have none). The blockout draws two 12 cm rails per track at the TTC gauge of 1,495 mm.
- **Buildings.** OSM building ways whose footprint centroid is inside the bounds, clipped to the bounds. A massing footprint matches when the overlap covers at least 50% of the smaller footprint; the match with the largest overlap gives the height. Height priority: massing `MAX_HEIGHT`, then OSM `height`, then `building:levels` × 3.2 m, then three storeys (9.6 m), clamped to 2.5–100 m. Each building records `height_source` (`massing`, `osm_height`, `osm_levels`, `fallback`), `levels` and, for massing heights, `massing_source` (the layer's `HEIGHT_SRC`). A massing footprint whose centroid is inside the bounds, with `MAX_HEIGHT` above 0, that the kept OSM footprints cover by less than half, adds its uncovered part (at least 4 m²) as a `massing-<index>` building, so no measured building is lost. Massing footprints with `MAX_HEIGHT` 0 (some site-plan and 3D-model entries) have no measured height and are not added. Walls use the Montréal Brick, Cream and Sage groups chosen by id; Sneaky Dee's has its own Landmark group. Window cards follow the Montréal spacing on walls of 2.5 m or more.
- **Landmarks.** Sneaky Dee's is OSM way 678313322 (amenity=pub, 431 College Street, `building:levels=2`). The layout records its footprint, centroid, area, height, College face and the midpoint of that face. The header's `SneakyDees` is the footprint centroid at ground level. Named amenities and shops in the bounds are listed in `landmarks.places` with name, kind and position.
- **Lamps and trees.** Every `highway=street_lamp` node in the bounds, at z = 470 cm, and every `natural=tree` node.
- **Spawn.** The nearest point on a mapped College sidewalk (`footway=sidewalk` whose nearest road is College Street) in front of the north face of Sneaky Dee's, at z = 120 cm. The car is at the nearest point of the College centreline, at z = 115 cm, facing along that segment (`car_yaw` in degrees, counter-clockwise from +X).

## Greybox map

`Scripts/create_college_bathurst.py` builds the separate map `/Game/Maps/CollegeBathurst` in the Unreal editor. It refuses to run if that map exists or if La Fontaine has unsaved edits, imports each OBJ group as `/Game/CollegeBathurst/SM_<group>` with existing `/Game/Plateau/Materials` materials, and adds a hidden collision floor and edge walls, four player starts at the spawn, the first car, the sun, sky, fog, clouds and the Montréal exposure. Buildings block; roads, paths, markings, tracks, grass and window cards do not. Start the editor on an engine map so La Fontaine is not loaded:

```bash
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Engine/Maps/Entry -ExecutePythonScript="$(pwd)/Scripts/create_college_bathurst.py" -unattended -nop4
```

Building the map, its collision and play need the Unreal host; none of it ran in the environment that prepared this data.

## Counts

| Item | Count |
|---|---|
| Road polylines / segments | 167 / 680 |
| Road segments kept after the game's dead-end pruning | 454, one connected network |
| Paths | 315 |
| Tram track polylines | 10 |
| Buildings | 1,002 |
| Heights from the massing layer | 959 (928 matched OSM footprints and 31 massing-only footprints, all `Lidar-Derived`) |
| Heights from OSM `building:levels` | 12 |
| Three-storey fallback | 31 |
| Street lamps | 32 |
| Trees | 124 |
| Named amenities and shops | 289 |

Sneaky Dee's: 277 m² footprint, 13.13 m from the lidar-derived massing `MAX_HEIGHT`. The spawn is about 1.6 m in front of its College face; the car is on College about 15 m east of the intersection centre.

## Limits

- Flat ground at z = 0. The district slopes gently in reality; `SURF_ELEV` is kept in the massing file but not used.
- `MAX_HEIGHT` is the highest lidar return on a footprint, so parapets, signs and rooftop equipment can raise a building above its main roof. Roofs are flat; there is no roof shape.
- Building courtyards (inner rings) are filled. The one building multipolygon relation and the 89 `building:part` ways in the snapshot are not used; the massing layer covers them where it has a footprint.
- Buildings cut by the bounds get a straight wall at the edge, and only the largest piece of a cut footprint is kept; the massing remainder fills the rest where it has a height.
- Road and path widths are estimates from lane counts. Roads have no curbs, medians or turn lanes, and the traffic graph does not use the one-way flags yet.
- Window spacing, wall colours and materials are procedural; there is no façade likeness.
- This is a greybox start. Traffic, parked cars, crowds, missions, the campaign, cooking and the browser host still assume La Fontaine.

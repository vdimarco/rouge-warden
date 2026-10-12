# Mapped neighbourhood furniture

This layer adds original comic bicycle, bus-stop, junction and chalet-terrace details to the existing La Fontaine map. `layout.json` retains OSM place/node IDs and SHA-256 guards for `Data/LaFontaine/osm.xml`, `Data/ParkComic/layout.json` and `Data/CityBuildings/manifest.json`. It uses the same geographic projection as the game. The current apply verifies these prepared counts; the preceding fresh-load report verifies settings. Final saved/native repeats pass after the frontage/net/resident corrections; both-size bounded visual review, current package play and all eleven packaged lifecycle checks pass; all six current packaged p95 budgets fail.

| Prepared instance category | Count |
| --- | ---: |
| Bicycle racks | 110 |
| Parked bicycles | 121 |
| Bus-stop poles | 45 |
| Bus shelters | 14 |
| Rental-dock elements | 72 |
| Street-name structures | 77 |
| Chalet terrace tables with chairs | 6 |
| **Total mesh instances** | **445** |

There are also **199 text signs**. Six original shared OBJ models supply these instances: BikeRack, CityBicycle, BusStop, BusShelter, StreetNames and TerraceTable. Rental-dock elements reuse the rack model; they are not a measured BIXI docking system.

Bus-stop poles follow retained OSM bus-stop points. Shelter presence uses the retained `shelter=yes` tag, with an estimated lateral offset. Bicycle/rental points and road orientation inform illustrated racks/docks and deterministic bicycle occupancy. Named road intersections supply local street names; sign corners and offsets are estimated. The six terrace tables follow the chalet's pond-facing wall with clearance checks. Furniture dimensions, finishes, orientation, occupied racks, café arrangement and signs are authored illustrations, not current service data or an exact STM/BIXI/Street View reconstruction. [City park context](https://montreal.ca/en/places/parc-la-fontaine) and [ékm's chalet renovation](https://www.ekmarchitecture.com/data-projects/1021-lafontaine-eng) support the setting; no reference photographs are copied into textures. OSM contributors supply the retained geographic data under ODbL 1.0.

## Prepare and apply

From `games/nord-unreal/`, use the existing geographic Python environment with Shapely:

```bash
/home/von/.cache/nord-geo-venv/bin/python Scripts/prepare_neighbourhood_details.py
/home/von/.cache/nord-geo-venv/bin/python Scripts/test_neighbourhood_details.py
```

Preparation writes the six models and `layout.json`. Source checks validate retained hashes/IDs, finite nondegenerate triangles, count bounds and text width. They test all 445 transformed mesh convex hulls against retained building footprints, mapped water and road asphalt at its actual half-width, allowing at most 10 cm² intersection area. The hull calculation restores OBJ’s negated Y and applies each saved yaw/position. Origin checks additionally retain a 60 cm road margin. Preparation excludes buffered paths and nearby inventory trees for terrace placement; corridor/social-pair clearance has not been added as a source-test assertion. The frozen CPU test passes, but these checks do not establish rendered text/sight-line quality, clearance against every prop or native traversal.

Import through [the environment refresh](../EnvironmentRefresh/README.md), after both environment and neighbourhood source preparation and with the current editor module built. `Scripts/apply_environment_refresh.py` requires this layout and matching source hashes; it imports `/Game/NeighbourhoodDetails`, recreates six HISM groups and text-sign actors, and saves the map after backup/preservation checks. It does not require rebuilding the original park or regenerating crew sources. A subsequent full park rebuild requires this refresh again; distribute a newly cooked package afterward.

## Collision, culling and verification

All added mesh groups and text use explicit `NoCollision`, with shadows disabled. Mesh instance culling starts at **65 m** and ends at **85 m**; text culls at **50 m**. These ranges bound distant clutter/render cost, not performance acceptance. Near-camera geometry can still overlap routes visually even with collision disabled, so inspect full mesh extents, text placement and walking/driving sight lines.

After a fresh level load, `Scripts/verify_park_comic.py` checks instance counts/positions against this layout, `NoCollision`, mesh cull distances/shadow flags, sign counts, environment accent/court mesh selection and preserved tree XY/diameters. Current `EnvironmentRefresh.json` passes these counts/preserved files. Final `Park.json` and seven-case `NeighbourhoodQA.json` pass saved settings and native population/interaction/collision/network checks after the final frontage/net/resident changes. Those results are separate from rendered quality. Both corrected twenty-one-view matrices and [bounded visual review](../../Verification/NeighbourhoodVisualReview.md) pass. Current package play and all eleven packaged lifecycle checks pass; all six current Epic performance scenes were measured and fail their p95 budgets; [current verification](../../Verification/README.md) records the full table and shared-GPU limits. See [the reference and gap review](../../Verification/NeighbourhoodReferences.md).

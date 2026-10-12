# College and Bathurst district start

The user asked to start a second GTA: NORTH location in Toronto, at College Street and Bathurst Street around Sneaky Dee's (431 College Street). The browser title already names "Le Plateau · Toronto". This change starts the district from surveyed open data and keeps Montréal untouched.

## Scope

- Snapshot OpenStreetMap around the intersection (ODbL) and clip the City of Toronto 3D Massing 2025 layer to the same area (Open Government Licence – Toronto), with attribution files.
- Add `Scripts/prepare_college_bathurst.py`. It uses the Montréal projection formula with a Toronto origin and writes `Data/CollegeBathurst/layout.json`, blockout OBJ geometry and the generated header `Source/Quebec/CollegeBathurstMap.h` in the same shape as `LaFontaineMap.h`, plus street lamps.
- Heights come from the massing layer where a footprint matches; OSM levels or a three-storey fallback fill the gaps, and the layout records which source each building used.
- Mark Sneaky Dee's (OSM way 678313322), the College × Bathurst intersection (node 29690663), the 506 College and 511 Bathurst streetcar tracks and named shops and bars.
- Render a top-down plan and a massing preview here, to check placement, heights and the spawn.
- Add `Scripts/create_college_bathurst.py`, an editor script that builds a separate greybox map `/Game/Maps/CollegeBathurst` from the OBJ files. It refuses to overwrite an existing map and does not touch `/Game/Maps/LaFontaine`.
- Record the gameplay places that still assume La Fontaine, for the next step.

## Out of scope

No traffic, parked cars, crowd, missions, campaign, cooking or browser host for Toronto yet. No façade art, interiors or Street View likeness. No change to the Montréal map, its data or its generated header.

## Acceptance

CPU checks here: the projection matches Montréal's formula, the spawn is on the College sidewalk in front of Sneaky Dee's, Sneaky Dee's has a footprint and a massing height, every road segment is finite and inside the bounds, the traffic graph has one connected component after the same pruning the game uses, and the header matches the layout. The previews are inspected by eye. Building the greybox map and walking it need the user's Unreal host.

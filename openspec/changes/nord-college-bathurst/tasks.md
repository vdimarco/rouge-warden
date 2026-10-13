# Tasks

## Data start (this container)

- [x] Store the OpenStreetMap and Toronto 3D Massing snapshots with attribution in `Data/CollegeBathurst/`.
- [x] Write `Scripts/prepare_college_bathurst.py` and generate the layout, blockout geometry and `Source/Quebec/CollegeBathurstMap.h`.
- [x] Render `Preview/CollegeBathurst/plan.png` and `massing.png` and inspect them.
- [x] Write `Scripts/test_college_bathurst.py` and pass it.
- [x] Write the editor greybox script `Scripts/create_college_bathurst.py` (checked only against a fake `unreal` module).
- [x] Ignore the generated blockout geometry in Git.
- [x] Review the data and scripts independently; fix the confirmed findings (average roof heights, split height parts, zero-height massing parts, parked car off the tracks, ASCII header, test without the ignored geometry, shared-height records).
- [x] Extend the district west to Euclid Avenue and three blocks past it (to Grace Street): wider OSM and massing snapshots with the first box's footprints first, regenerated layout, header and previews, new street checks.
- [x] Review the extension independently and fix the confirmed findings (massing-only ids and wall colours stay the same).
- [x] Validate this change with the OpenSpec CLI.

## Native checks (user's Unreal host)

- [ ] Run `Scripts/create_college_bathurst.py` in the editor; confirm it creates `/Game/Maps/CollegeBathurst` and leaves `/Game/Maps/LaFontaine` unchanged.
- [ ] Walk from the spawn to the College and Bathurst corner and around Sneaky Dee's; check scale, collision and the car.

## Next steps (not in this change)

- [ ] Select per-district data by map name in the game mode, radar, HUD title, fall recovery and parking, and key the campaign save slot by district.
- [ ] Add Toronto traffic, parked cars and crowds on the generated road graph.
- [ ] Add College Street façades, Sneaky Dee's signage and streetcars.
- [ ] Add the map to cooking, `launch.sh` and the browser host, and a way to travel between Montréal and Toronto.

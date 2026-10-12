# Tasks

## Data start (this container)

- [ ] Store the OpenStreetMap and Toronto 3D Massing snapshots with attribution in `Data/CollegeBathurst/`.
- [ ] Write `Scripts/prepare_college_bathurst.py` and generate the layout, blockout geometry and `Source/Quebec/CollegeBathurstMap.h`.
- [ ] Render `Preview/CollegeBathurst/plan.png` and `massing.png` and inspect them.
- [ ] Write `Scripts/test_college_bathurst.py` and pass it.
- [ ] Write the editor greybox script `Scripts/create_college_bathurst.py`.
- [ ] Ignore the generated blockout geometry in Git.
- [ ] Validate this change with the OpenSpec CLI.

## Native checks (user's Unreal host)

- [ ] Run `Scripts/create_college_bathurst.py` in the editor; confirm it creates `/Game/Maps/CollegeBathurst` and leaves `/Game/Maps/LaFontaine` unchanged.
- [ ] Walk from the spawn to the College and Bathurst corner and around Sneaky Dee's; check scale, collision and the car.

## Next steps (not in this change)

- [ ] Select per-district data by map name in the game mode, radar, HUD title, fall recovery and parking, and key the campaign save slot by district.
- [ ] Add Toronto traffic, parked cars and crowds on the generated road graph.
- [ ] Add College Street façades, Sneaky Dee's signage and streetcars.
- [ ] Add the map to cooking, `launch.sh` and the browser host, and a way to travel between Montréal and Toronto.

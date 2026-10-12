## ADDED Requirements

### Requirement: Surveyed College and Bathurst district start
The project SHALL contain a second district around College Street and Bathurst Street in Toronto, built from attributed open data, as a separate greybox map that does not change the Montréal map. It SHALL record honestly which heights are surveyed and which are estimated.

#### Scenario: Prepare the district data
- **WHEN** `Scripts/prepare_college_bathurst.py` runs on the stored OpenStreetMap and Toronto 3D Massing snapshots
- **THEN** it writes the layout, blockout geometry and `CollegeBathurstMap.h`, with College Street and Bathurst Street reaching the district edges and the 506 and 511 streetcar tracks marked
- **AND** each building records whether its height came from the massing layer, OSM or a fallback.

#### Scenario: Start at Sneaky Dee's
- **WHEN** a player starts on the greybox map
- **THEN** they stand on the College Street sidewalk in front of Sneaky Dee's at 431 College Street, near the College and Bathurst corner, with a car parked on College.

#### Scenario: Inspect the plan
- **WHEN** a reviewer opens `Preview/CollegeBathurst/plan.png` and `massing.png`
- **THEN** north is up, the College and Bathurst intersection is at the centre, Sneaky Dee's is marked on the south-east corner, and taller buildings read taller.

#### Scenario: Keep Montréal unchanged
- **WHEN** the Toronto scripts run
- **THEN** `/Game/Maps/LaFontaine`, its data, its generated header and its checks are unchanged
- **AND** the README and the generated header carry the OpenStreetMap and Open Government Licence – Toronto attribution.

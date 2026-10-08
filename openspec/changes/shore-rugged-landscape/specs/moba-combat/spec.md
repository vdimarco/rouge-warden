## ADDED Requirements

### Requirement: Winding lane roads
Each lane road SHALL follow fixed, seeded, smooth bends with varying spacing and strength. Team 1's half SHALL mirror team 0's half exactly. Side lanes SHALL deviate at least 275 world units from their original spline somewhere outside the calm approaches, and each half SHALL change between left and right bends at least twice. Routes SHALL retain their base exits, one river crossing at the existing bridge, ward walk stations, at least 210 units of cover clearance and 600 units of camp/gate clearance. Consecutive wards SHALL remain at least 2.5 tower ranges apart. Added route length SHALL stay below 6%, and bends SHALL retain the established minimum radius where the original spline was gentler. Routes SHALL avoid the map edges and self-intersections. An exhausted placement solver SHALL validate its fallback or reject an impossible layout.

#### Scenario: Follow an irregular lane
- **WHEN** a hero walks either side lane from base to river
- **THEN** the road makes clearly visible, uneven bends instead of following one predictable arc, while minions can complete the route without being displaced by cover.

#### Scenario: Same safe routes in both views
- **WHEN** the player switches renderer or opens the tactical map at 1440 by 900, 844 by 390 or 390 by 844
- **THEN** the displayed lanes match the simulation paths and both teams receive equal travel distances.

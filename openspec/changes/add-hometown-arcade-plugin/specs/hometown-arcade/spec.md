## ADDED Requirements

### Requirement: Build a playable map of a real place
#### Scenario: Building from an address
- WHEN the agent calls `hometown_build` with an address, a landmark or `lat,lon`
- THEN the result has a map id, a local URL, a page file, the main street names and named places with ids
- AND the page shows the place's buildings, streets, paths, parks, water and trees at their mapped positions.

#### Scenario: No network
- WHEN Overpass is unreachable
- THEN a map of 600 m or less comes from the OpenStreetMap API, and a local `osm_file` builds with no network at all
- AND a place with no data returns an error the agent can act on.

### Requirement: Missions from real places
#### Scenario: Writing a mission
- WHEN the agent calls `hometown_mission` with place ids or names and a line for each stop
- THEN the result has a par time from the route length and a time limit
- AND after a reload the game menu lists the mission, the HUD shows each stop's line, a beacon marks the stop, and the minimap and arrow point to it.

#### Scenario: Unknown place
- WHEN a stop names a place the map does not have
- THEN the tool returns an error that lists the closest places and does not save the mission.

### Requirement: Drive on desktop and phone
#### Scenario: Keyboard
- WHEN the player holds W or the up arrow
- THEN the car drives forward, the speedometer rises, and the HUD names the street under the car
- AND A/D steer, Space drifts, Shift boosts, C changes the camera, T changes the time of day, R returns to the last road and Esc opens the menu.

#### Scenario: Touch
- WHEN the page opens on a touch screen at 390x844
- THEN steer, brake and gas buttons of at least 44 px show, and the menu, objective, timer, minimap and speedometer fit without overlap.

#### Scenario: Collisions
- WHEN the car hits a building, a tree or water
- THEN it stops at the edge, bounces back, and a hard hit counts as a crash.

### Requirement: Results reach Hermes
#### Scenario: Finishing a mission
- WHEN the player reaches the last stop on a page opened from the local server
- THEN the results card shows time, par, stars, crashes and top speed, and says Hermes has the result
- AND `hometown_scores` returns the run.

#### Scenario: Untrusted requests
- WHEN a request to the local server has another Host header, a body over 8 KB, a wrong content type, an unknown map or mission, or a field of the wrong type
- THEN the server refuses it and stores nothing.

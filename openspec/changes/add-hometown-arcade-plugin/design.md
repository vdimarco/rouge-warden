# Design

## Data

`osm.py` asks Nominatim for the place (one request, skipped for `lat,lon`), then Overpass for a square around it. When every Overpass server fails, a map of 600 m or less comes from the OpenStreetMap editing API (`/api/0.6/map`). A local `.osm` or Overpass `.json` file works offline. All parsing uses the standard library.

`world.py` projects to local metres with the same equirectangular method as NORD's `Scripts/prepare_lafontaine.py`. Buildings get heights from `height`, then `building:levels`, then a type default. Roads keep their OSM names and get widths from `width`, then `lanes`, then their class. Rings are simplified (Douglas-Peucker), clipped to the map (Sutherland-Hodgman for areas, Liang-Barsky for lines, adapted from NORD's `clip_segment`), and triangulated in Python by ear clipping (Eberly, "Triangulation by Ear Clipping", Geometric Tools). Multipolygon rings are joined from their member ways. Random trees fill woods and parks but stay off roads. Named places carry the nearest street name so missions can say where things are.

Mission stops snap to the nearest road or path within reach of the chosen vehicle. Par is the straight-line route times 1.35 over a cruising speed, plus 2.5 s a stop. The default limit is 1.7 times par.

## Game page

One HTML file per map, with the world, the missions and the game script inlined. It works from `file://` and from the local server. Data inside `<script>` escapes `</` and `<!--`. Text from OSM and from the agent goes into the page with `textContent`.

Rendering is raw WebGL2 in one shader:

- Ground, areas and roads are one buffer drawn in painter's order without depth, so layers never z-fight.
- Building and tree shadows are planar projections onto the ground along the sun direction, drawn once per pixel with a stencil test. Source: Blinn, "Me and My (Fake) Shadow", IEEE CG&A 1988, with the stencil fix from the OpenGL "projected shadows" technique.
- Windows are procedural: wall UVs carry distance along the wall and height; a grid of 3.1 m by 3.2 m cells draws glass with a sky reflection, and a per-window hash lights some at dusk and night.
- The hash is Dave Hoskins' "Hash without Sine" (Shadertoy 4djSRW). A `sin` hash amplified small colour interpolation errors into speckle under SwiftShader.
- Water uses moving normals and a specular highlight; grass uses smoothed value noise.

Tree crowns and walls fade with a screen-door dither when the camera is close (the "camera fade" common in third-person games; the dither pattern is the same hash). A crown fades as a whole from its tree's centre, which each crown vertex carries, so a camera inside a street tree sees through it cleanly. The chase camera also stops short of any building or pond between it and the car.

Physics runs at 120 Hz fixed steps with a frame cap of 0.1 s. The car keeps forward and side speed apart; grip removes side speed, and the handbrake lowers grip to drift. Buildings, water and trees push the car out along the nearest edge, found through a 24 m grid.

## Results

The page posts a finished run to `/api/results` only when served over HTTP. The server binds 127.0.0.1, refuses other `Host` headers (DNS rebinding), takes `application/json` up to 8 KB, checks each field's type and range, and keeps the last 500 runs per map. Pages carry a strict Content-Security-Policy with `connect-src 'self'`.

## Checks

- `python -m unittest discover -s tests` covers geometry, the world build on a cropped NORD La Fontaine fixture, tool registration against `plugin.yaml`, handlers with bad input, mission and score round trips, script escaping and server refusals.
- `node tests/smoke.e2e.mjs` opens the page at 1280x720 and 390x844, drives, finishes a mission, sees the result reach Hermes, switches to the bike mission and fails on any page error. `EXTRA="--osm <file> --radius 380"` runs it on a bigger map.
- `hermes plugins validate` could not run here: installing Hermes Agent in this container was not allowed. The tests mirror its probe (package import, `register(ctx)`, declared versus registered tools).

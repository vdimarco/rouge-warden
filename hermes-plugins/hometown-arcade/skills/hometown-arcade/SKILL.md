---
name: hometown-arcade
description: Build a drivable game of a real place with the hometown_* tools, write missions from its real places, and adapt them to how the player does.
---

# Hometown Arcade

Use this when someone wants to play, explore, practise or show off a real place: "make my street a game", "a delivery game around my office", "show my friend the neighbourhood before they visit", "a scavenger hunt for the kids around the park".

## Steps

1. Call `hometown_build` with the address or landmark. Use `radius_m` 250 for a few blocks, 350 for a neighbourhood, 500 or more only when asked (bigger maps take longer).
2. Read `top_places` and `streets` in the result. Call `hometown_places` to find more, for example `query: "bakery"` or `kind: "park"`.
3. Write one to three missions with `hometown_mission`. Go from easy to hard:
   - Easy: two or three stops close together, car, no tight limit.
   - Medium: four or five stops that cross the map, a time limit near the default.
   - Hard: a bike or a night run, more stops, `time_limit_s` near 1.2 times par.
4. Give the user the `url` from the last call. Tell them the controls: WASD or arrows to drive, Space to drift, Shift to boost, C to change the camera, T for the time of day.
5. When they come back, call `hometown_scores`. Praise a beaten par. If they failed on time, offer an easier version. If they beat par, write a harder one with `replace: false` so both stay.

## Writing good missions

- Use the real names. "Grab a dozen sesame at St-Viateur" beats "Go to stop 2".
- Each `line` says what to do and why, in under 12 words. Each `done` is a short reaction ("Still warm!").
- Use the street names from the result in the `brief` so it feels local.
- Keep a theme: a delivery run, a tour for a visitor, errands before the store closes, a getaway at night.
- Do not make up places. Use place ids or names that the tools returned.

## Notes

- New missions show after the player reloads the page.
- Runs only reach `hometown_scores` when the game was opened from the `url` (the local server), not from the file.
- The map data is © OpenStreetMap contributors. The game shows the credit; keep it when sharing screenshots.

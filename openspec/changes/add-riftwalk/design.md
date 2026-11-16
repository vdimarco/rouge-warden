# Design

## Art direction, in the user's words
- "a gaussian splot within worldlabs that mimics a cyberpunk arcade to showcase our games and open portals to launch them"
- "make it darker and denser, more cyberpunk and each machine the screen should have the portal on the main screen with the live edge"
- "make it a bigger hall where you can move between zones", "of game categories and make it higher fidelity"
- "it looks awkward clean it up make it more natural and differentiated", "magically"
- "The spacing between the machines doesn't make any sense. And why is this rift like wedged there? Like it should be its own little section where there's machines next to each other and they do their thing. And then there's a rift above it or beside it or behind it. ... there should be clusters"
- "can we try atlas?", then "go ahead with the one hall plan"

## The hall
The hall is one Gaussian splat world: a dark steel room 8 m wide and 16 m long, with a wet black floor. Arcade cabinets stand shoulder to shoulder in clusters against all four walls, and each cluster has its own neon colour. Neon rings hang on the walls above the clusters. The world has 2,000,000 splats in one 30 MB file.

There are 41 machines for 44 games. Each collection of the homepage is a zone, and a zone is the cluster or clusters that hold its games:

| Zone | Clusters | Machines | Games |
| --- | --- | --- | --- |
| Cottage | amber and teal, left wall | 10 | 8 |
| Action | magenta on the left and red on the right, far end | 11 | 11 |
| ASCII Scenes | green, back wall | 3 | 2 |
| Strategy | cyan, back wall | 3 | 3 |
| GTA | violet, right wall | 3 | 1 |
| Lab | blue on the right and green at the entrance | 11 | 19 |

Every machine shows a game at once, so the whole hall is lit. The Lab has more games than machines, so it has two pages.

## How the hall was made (World Labs Atlas)
Earlier versions used Marble, which makes a world from one text prompt. The place of each cabinet was then part of the world, the cabinets came out spread in a ring, and the page could not move them. Atlas builds a scene from posed images, which gives control of the layout before the 3D step.

1. `atlasTextToImage`: one wide image of the hall, from a prompt that asks for six clusters of cabinets in tight rows, two on each of three walls, each in its own colour, with a neon ring above each.
2. `images2PosedRGBD`: the camera and a depth map for that image. The result is in metres with the floor at y = 0.
3. `atlasGenerate`: 14 more views with depth, from cameras along the middle of the hall: at each wall, back down the hall, and up at the rings. Atlas added clusters at the entrance end, which the first image did not show.
4. `posedImages2Splats`: the 15 posed views become one refined splat world (5,000 credits, 26 minutes).

Sources: the Atlas developer docs (docs.atlas.worldlabs.ai), mainly "Build a scene from images", "Make splats", "Splat best practices" and "Cameras and posed images". The steps follow those guides. The prompt, operation ids and target cameras are in `public/lab/riftwalk/worlds/sources.json`.

## Finding the screens
Every view has a camera and a depth map, so a white screen in a view is a patch of known 3D points. A scratch script kept bright grey patches that are taller than wide, unprojected them, named the nearest wall, and merged the patches of one screen across views. Each screen is an upright rectangle on its wall. The result is `public/lab/riftwalk/worlds/hall/screens.json`, with each screen's zone, each zone's station and each zone's ring.

## Zones, stations and rift rings
- A zone has a station: a point on the open floor in front of its cluster, with a facing. The zone the visitor is in is the zone with the nearest station.
- A rift ring hangs on the wall above each zone, where the world has its neon rings. A tap on a ring glides the visitor across the hall to that zone's station. This answers "a rift above it". The ring over the visitor's own zone shows that zone's next page of games.
- The zone buttons at the top, the up and down arrow keys and the keys 1 to 6 do the same glide.
- The visitor walks the open floor of the hall, a box 5.3 m by 12.2 m, with W A S D.
- Machines take games in reading order, from left to right for a visitor who stands at the station.

## Look
- A game shows as a picture on the machine's tube: scan lines, darker corners, a faint shine, and a thin live edge. Its name shows only over the machine in the middle of the view.
- A machine with no game idles dimly in its zone's colour.
- A ring is a disc of slow swirling light in its zone's colour, with stars that come and go.
- Each zone has its own screen corner, edge motion, scan lines and letters (`LOOKS` in `main.js`).
- Motes of light in each zone's colour drift near its station, and sparks circle each ring. A glint crosses the screen in view. The light on the way into a game blooms from the middle of the view.
- The zone's name shows large for a moment when the visitor enters the zone.

## Controls
- Look: drag the view. ◀ and ▶ turn to the next lit place within 9 m.
- Zones: a rift ring, a zone button, the up and down arrow keys, or the keys 1 to 6.
- More games: the More button, Page Down, M, or the zone's own ring.
- Play: tap or click a lit screen, press Enter or Space for the machine in view, or use the Play button.
- Walk: W A S D.
A visitor can do everything with taps alone, with the buttons alone, or with the keyboard alone. Every game is also a plain link on the page, and that list shows to everyone when WebGL2 is missing or the world does not load.

## Reduced motion
The visitor moves to a zone at once. There are no motes or sparks, the edge holds still, and a launch has no glide.

## Not done, and known limits
- No sound.
- The world loads as one 30 MB file. There is no small first file.
- The rings' places are estimates from a few depth samples. Two zones (Cottage, Lab) have a ring where the world has none.
- Atlas put a wall with clusters near the first camera's place. The first view saw through that place, so the entrance end can show ghosted surfaces.
- The Atlas docs list no price for the image and view steps, and the API reports no cost.

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
| Cottage | amber on the left, violet on the right | 8 | 8 |
| Action | magenta on the left and red on the right, far end | 11 | 11 |
| ASCII Scenes | green, back wall | 2 | 2 |
| Strategy | cyan, back wall | 3 | 3 |
| GTA | green, back wall | 1 | 1 |
| Lab | teal, blue and green, entrance end | 16 | 19 |

Every machine shows a game at once, so the whole hall is lit. The Lab has more games than machines, so it has two pages.

## How the hall was made (World Labs Atlas)
Earlier versions used Marble, which makes a world from one text prompt. The place of each cabinet was then part of the world, the cabinets came out spread in a ring, and the page could not move them. Atlas builds a scene from posed images, which gives control of the layout before the 3D step.

1. `atlasTextToImage`: one wide image of the hall, from a prompt that asks for six clusters of cabinets in tight rows, two on each of three walls, each in its own colour, with a neon ring above each.
2. `images2PosedRGBD`: the camera and a depth map for that image. The result is in metres with the floor at y = 0.
3. `atlasGenerate`: 14 more views with depth, from cameras along the middle of the hall: at each wall, back down the hall, and up at the rings. Atlas added clusters at the entrance end, which the first image did not show.
4. `posedImages2Splats`: the 15 posed views become one refined splat world (5,000 credits, 26 minutes).

Sources: the Atlas developer docs (docs.atlas.worldlabs.ai), mainly "Build a scene from images", "Make splats", "Splat best practices" and "Cameras and posed images". The steps follow those guides. The prompt, operation ids and target cameras are in `public/lab/riftwalk/worlds/sources.json`.

## Finding the screens
Every view has a camera and a depth map, so a white screen in a view is a patch of known 3D points. A scratch script kept bright grey patches that are taller than wide, unprojected them, named the nearest wall, and merged the patches of one screen across views. Each screen is an upright rectangle on its wall.

The first measure took the middle value over all views, and far and slanted views made the screens too small: the user saw that "the game pictures are not on the machine screens". The second measure takes each screen from its most direct view, with its edges at the 1st and 99th percentile of the patch. Machines in one cluster are the same model, so a cluster has one screen size, one height over the floor and one straight line along its wall. A drawn frame of the real magenta cluster (`shots/hall-cluster-real.jpg`, a full-detail cut of the world file) shows the pictures on the screens. The result is `public/lab/riftwalk/worlds/hall/screens.json`, with each screen's zone, each zone's station and each zone's ring.

## Zones, stations and rift rings
- A zone has a station: a point on the open floor in front of its cluster, with a facing. The zone the visitor is in is the zone with the nearest station.
- A rift ring hangs on the wall above each zone, inside one of the world's neon rings. This answers "a rift above it". A tap on a ring opens that zone's room (see below).
- The zone buttons at the top, the up and down arrow keys and the keys 1 to 6 glide the visitor across the hall to a zone's station.
- The visitor walks the open floor of the hall, a box 5.3 m by 12.2 m, with W A S D.
- Machines take games in reading order, from left to right for a visitor who stands at the station.

## Rings on the neon rings, and rooms behind them
The user's words: "the rift rings are not on the neon rings and can we borrow some existing marbles and each portal opens into a new preconstructed marble with machines in them".

- Rings: the first ring places came from a few depth samples. Now the neon rings are found in the views as bright, saturated pixels high on the walls, unprojected with the depth maps and grouped along each wall. The hall has nine neon rings, and each zone's rift is a disc inside the ring over its cluster.
- Rooms: a rift ring opens into its zone's own room. The rooms are Marble worlds of the earlier versions, with their measured screens, in `worlds/rooms/<zone>/` with 150,000 and 500,000 splats each. No new world was made. Which zones have a room is in "Order and machine counts" below.
- A ring in the hall shows a view into its room (`door.webp`). Going in: the view fills with the zone's light, the room loads small and then sharpens, and the visitor stands in its middle with the zone's first game in front. The room's machines take the zone's games from the front machine outward.
- A room has one ring, at eye level in the widest gap between its machines. That ring, the Hall button, Esc and Backspace go back to the hall, at the cluster the visitor came from. A zone button in a room goes to that zone's room.
- In the hall the arrows stop at machines only, because a ring hangs right over its machines. The Room button and the R key open the room of the zone the visitor stands in.
- A frame with real splats shows the rings inside the neon rings and the Action room with its games (`shots/rings-and-room.jpg`).

## Order and machine counts
The user's words: "we need a better way to play things properly. The portals in each hall is randomly choosen. And if there is only 1 game we dont need some many machines".

- Order: games go on machines in the homepage order, in one run along each cluster. `seats()` goes clockwise round the visitor from one end of the cluster (the place after the widest gap), which is from left to right along a row. In a room, `roomSeats()` puts the first game on the front machine and goes on clockwise. The earlier room order went right and left in turn from the front, and it read as random.
- Counts in the hall: each zone has as many machines as games. The zones of the 41 machines were set again: Cottage has 8 (amber, and violet across the hall), Action 11 (magenta and red), ASCII Scenes 2 and GTA 1 (the green cluster), Strategy 3 (cyan), and the Lab the 16 at the entrance end. No machine of the hall is idle. Only the Lab, with 19 games, has a second page.
- Rooms: a zone has a room only when it has more than three games: Cottage, Action and the Lab. Each room is the earlier Marble world whose machine count is nearest to the zone's games: the green ring room (9 machines) for Cottage's 8, the row room (11) for Action's 11, the amber room (12) for the Lab's 19. The other three earlier worlds are removed, and `worlds/rooms/` is 29 MB.
- ASCII Scenes, Strategy and GTA have no ring and no room. A zone button for one of them, pressed in a room, brings the visitor back to the hall at that zone.

## Portals in fixed places, and sharper rooms
The user's words: "games and portals, as well as higher quality backgrounds marbles".

- The way back from a room was in the widest gap between its machines, which is a different place in each room. Now `exitRing()` puts it behind the visitor: they arrive with the first game in front, and the ring takes the gap nearest to straight behind them.
- Each room ships its full-resolution Marble file again (about 29 MB each). A room shows its 150,000-splat file first, and then a desktop takes the full file and a phone the 500,000 file. `worlds/` is 144 MB.
- A sharper room than Marble's full file needs a new world. One room from Atlas, like the hall, costs 5,000 credits.

## Look
- A game shows as a picture on the machine's tube: scan lines, darker corners, a faint shine, and a thin live edge. Its name shows only over the machine in the middle of the view.
- The user's words: "they should flow when mouse hover". The picture under the mouse pointer flows: it swells a little, drifts, and its surface moves like slow water (two octaves of value noise move the picture's coordinates). On a touch screen the picture of the machine in view flows. Reduced motion turns the flow off.
- A machine with no game idles dimly in its zone's colour.
- A ring is a disc of slow swirling light in its zone's colour, with stars that come and go.
- Each zone has its own screen corner, edge motion, scan lines and letters (`LOOKS` in `main.js`).
- Motes of light in each zone's colour drift near its station, and sparks circle each ring. A glint crosses the screen in view. The light on the way into a game blooms from the middle of the view.
- The zone's name shows large for a moment when the visitor enters the zone.

## Controls
- Look: drag the view. ◀ and ▶ turn to the next lit place within 9 m.
- Zones: a zone button, the up and down arrow keys, or the keys 1 to 6.
- Rooms: a rift ring, the Room button or R to go in; the room's ring, the Hall button, Esc or Backspace to come back.
- More games: the More button, Page Down or M.
- Play: tap or click a lit screen, press Enter or Space for the machine in view, or use the Play button.
- Walk: W A S D.
A visitor can do everything with taps alone, with the buttons alone, or with the keyboard alone. Every game is also a plain link on the page, and that list shows to everyone when WebGL2 is missing or the world does not load.

## Reduced motion
The visitor moves to a zone at once. There are no motes or sparks, the edge holds still, and a launch has no glide.

## Not done, and known limits
- No sound.
- The world loads as one 30 MB file. There is no small first file.
- Atlas put a wall with clusters near the first camera's place. The first view saw through that place, so the entrance end can show ghosted surfaces.
- The Atlas docs list no price for the image and view steps, and the API reports no cost.

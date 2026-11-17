# Design

## Art direction, in the user's words
- "a gaussian splot within worldlabs that mimics a cyberpunk arcade to showcase our games and open portals to launch them"
- "make it darker and denser, more cyberpunk and each machine the screen should have the portal on the main screen with the live edge"
- "make it a bigger hall where you can move between zones", "of game categories and make it higher fidelity"
- "it looks awkward clean it up make it more natural and differentiated", "magically"
- "The spacing between the machines doesn't make any sense. And why is this rift like wedged there? Like it should be its own little section where there's machines next to each other and they do their thing. And then there's a rift above it or beside it or behind it. ... there should be clusters"
- "can we try atlas?", then "go ahead with the one hall plan"
- "floating portal frames, you choose the categories"
- With the Neon Alley world: "I really like this one, can we start with it as the main world and each storefront is a portal"

## The present design: an alley of storefront portals
The user gave six Marble worlds as splat files. The Neon Alley is the main world. The other five, and one world from an earlier version, are the worlds behind its storefronts. The Atlas hall and the rooms with machines are out of the page; the sections under "Earlier designs" tell how they were made.

| Zone | Storefront in the alley | World behind the door | Games |
| --- | --- | --- | --- |
| Cottage | north-west corner, lit shutter under the long cyan sign | Fantasy Meadow | 8 |
| Action | west side of the alley, warm lit door | Ancient Temple of Sacred Statues | 11 |
| ASCII Scenes | east side of the alley, red shutter | brick neon hall (earlier Marble API world) | 2 |
| Strategy | north-east corner, purple sign | Great Wall at sunset | 3 |
| GTA | south-east corner, cyan sign and lit window | Retro Diner | 1 |
| Lab | south-west, brick door under the cyan sign | Futuristic Space Station | 19 |

Why these pairs: the meadow is the cottage look, Olympus leads the Action row and the temple is a hall of statues, the Great Wall is a fortification, the diner is a city interior for GTA Montréal, the station is a laboratory, and the brick hall with cabinets at its walls suits the two text scenes.

### The alley
- The file is a Marble app export: 2,000,000 splats, y up. It is not metric. The floor is 0.5415 units under the origin, so a scale of 2.678 puts the eye at 1.45 m. Then the alley is 4.3 m wide and a shop door is 2.1 m high, which reads right.
- The world is a crossroads: a narrow alley along z and a street along x. The walking floor is two boxes that cross (`bounds.boxes`), and `walk()` ends a step in the nearer box, so the visitor cannot go through a corner building.
- Finding the storefronts: `games/riftwalk/tools/scenery-room.py` has the splat reader. A scratch script drew eight views from the origin as points with a depth map and a top-down map. I chose six shop fronts in the views. The points of each front give its wall (the walls follow the two axes), its place along the wall and its top. Each door is a box 2.05 m high and at most 1.9 m wide, on the ground, 6 cm in front of the wall. The result is `worlds/hall/screens.json`.
- A door is the same portal quad as before with a box shape (`ringPlace()` gives a box when the ring has a width and a height). It shows `door.webp`, a picture of the world behind it, under the slow swirl and stars of a rift.
- The user's words: "portals don't quite fit the store fronts maybe make them ovals with riptides on the edges". A door now draws as an upright oval, 1.5 m by 1.95 m at most, so it sits inside a shop front that is not square to it. Its rim is a riptide: two trains of sine waves run round the rim in opposite ways over slow noise, rings of water run from the rim toward the middle and bend the picture, and a fainter foam line moves in and out just outside the rim. The oval's distance is the scaled-circle estimate from Inigo Quilez's notes on 2D distance functions (iquilezles.org/articles/distfunctions2d), which is close enough near the rim; the waves are my own.
- The user's words: "make the edges of the portals fuzzier so it looks like they blend into the environment". A door and the round way back have no hard rim now. The picture fades out over about 30 cm, noise at two sizes makes the fade ragged like mist, and the bright line on the rim is a wide, faint glow. The frames of the games keep a crisp rim, because a frame is a picture to read. No source was adapted; the fade is a `smoothstep` on the rim distance plus value noise.
- The user's words: "put the name above the portal like it's the name of the store". Each door has a shop sign over it: a dark board 4 to 1, a little wider than the door, with a neon tube round it and the zone's name in lit capital letters of the zone's colour and lettering. Both are in `shots/soft-doors.jpg` (a 250,000-splat copy of the alley).
- The user's words: "when the mouse touches the edge of the rift it should move to show more of the portal scene beyond". The look ray of the pointer meets the door's plane, and the page finds how far that point is from the rim. Within 12 cm the touch is full, and it is gone at 40 cm. In the shader the opening reaches out 30 cm round the pointer, and the picture slides a little against the pointer, like a look round the rim. A door shows the middle four fifths of its picture, so the rest is there to see when the rift gives way. No source was adapted.
- A touch screen has no pointer to rest on a rim. There the door in the middle of the view opens by itself, and the place where it gives way goes slowly round the rim.
- The user's words: "the scenes in the portals should be higher quality". The door pictures came from the 500,000-splat copies at 1024 px square, and the door cut the sides off. Now `door-shots.mjs` draws each world from its largest file at 1280 by 1664, the shape of a door.
- The user's words: "make sure it's mobile friendly". A touch device loads a 1,000,000-splat copy of the alley (14 MB, half the download). The button that opens a storefront's world reads "Go in" on every screen: "Enter Strategy" pushed the ▶ button off a 390 px screen.
- The user's words: "center GTA on the store door". A capture of the GTA storefront showed the portal 0.85 m to the right of the shop's shutter. The door and its station moved 0.85 m.
- The user's words: "make it possible to point and click to navigate". A tap or a click on the ground walks the visitor to that spot: the look ray meets the floor, the spot moves onto the open floor when it is under a building, a ring of light marks it, and the view turns toward it. The walk goes straight at 3.2 m/s and stays on the streets. It ends at the spot, at a wall, or when a key takes over. A click on a door still opens the door. With reduced motion the visitor is at the spot at once.
- A station is the place on the street 3 to 4 m in front of a door. The arrows turn from door to door. A door seen from behind is not a stop.
- No source was adapted for the storefront layout or the point drawings. The frame and door quads draw after the splats, like every portal of this page.

### The worlds
- Five files are Marble app exports: metric, y up, with the floor at y = 0 (the Great Wall stands on a ridge, so ground goes far down around it). The page sets the eye 1.45 m over the origin. `turn` is the heading the visitor faces on arrival: 180 degrees for the Great Wall, so the gate tower is ahead.
- `scenery-room.py` writes each world's `full.spz`, a 500,000 and a 150,000-splat copy (a random pick with larger splats to close the holes), `door.webp` (a point drawing from eye height with a median filter) and `screens.json`. The diner has 500,000 splats, so it has no larger file.
- The brick hall is an API world: y down, with Marble's own scale and ground numbers. `flip` in a world's data tells the two kinds apart.
- Games are floating frames (`frameRing()`): the first straight ahead, the next 0.36 rad to the right each. More than 8 frames reach behind the visitor and crowd the way back, so a page holds 8 and More shows the next page. Action has 2 pages and the Lab 3.

### Resolution
The user's words: "merge it and then focus on increasing the resolution".

- Pixels: the view drew at the display's own pixel ratio, at most 2. A splat world has more detail than a 1x display shows, so on a desktop the view now draws at 2 device pixels for each CSS pixel, a 2 by 2 supersample on a 1x display. A touch device keeps its own ratio, at most 2. When frames are slow (30 of 45 frames over 34 ms) the ratio goes down a quarter step, to no less than the display's own pixels.
- Sharpness: Spark's `focalAdjustment` is 2 (its guide: "higher values will tend to sharpen the splats", and 2 matches PlayCanvas). A full-density piece of the alley drawn at 1 and at 2 showed sharper sign letters at 2 and no holes.
- Multisampling is off. Spark's guide says it "doesn't improve Gaussian Splatting rendering and significantly reduces performance". The portals smooth their own edges in the shader.
- Door pictures: each door showed a 512 px point drawing with speckles. Now `games/riftwalk/tools/door-shots.mjs` has the page draw each world with Spark at 1024 by 1024, with no frames, and that picture is the door's view.
- Range: the camera stopped at 300 m. The meadow's sky is 300 to 430 m away and the Great Wall's hills are kilometres away, so a part of the sky was a dark hole. The camera now reaches 30 km.
- Four of the new door pictures are in `shots/doors.jpg`. They also show that the page draws the temple, the Great Wall, the space station and the brick hall as it should.
- Source: the Spark documentation (sparkjs.dev/docs/spark-renderer and /docs/performance).
- Not changed: the world files. The alley and four worlds already load at Marble's full export size on a desktop.

### Size
`worlds/` is about 215 MB: the alley 29 MB, and six worlds of 10 to 39 MB each.

## Earlier designs

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
- ASCII Scenes and Strategy have no ring and no room. GTA has a scenery room (see "Floating portal frames"). A zone button for one of them, pressed in a room, brings the visitor back to the hall at that zone.

## Portals in fixed places, and sharper rooms
The user's words: "games and portals, as well as higher quality backgrounds marbles".

- The way back from a room was in the widest gap between its machines, which is a different place in each room. Now `exitRing()` puts it behind the visitor: they arrive with the first game in front, and the ring takes the gap nearest to straight behind them.
- Each room ships its full-resolution Marble file again (about 29 MB each). A room shows its 150,000-splat file first, and then a desktop takes the full file and a phone the 500,000 file. `worlds/` is 144 MB.
- A sharper room than Marble's full file needs a new world. One room from Atlas, like the hall, costs 5,000 credits.

## Floating portal frames in scenery worlds
The user's words: "floating portal frames, you choose the categories".

- A borrowed or older world can have no arcade machines, so it has no screens to carry games. Such a room is marked `"frames": true` in its `screens.json`, with an empty screen list. `frameRing(count, eye)` then makes one upright frame for each game, 2.5 m from the visitor, at eye height, with the first game straight ahead and the others 0.36 rad apart to the right. A room with few games has larger frames. A page holds 12 frames.
- A frame is the same portal quad as a machine screen: key art, live edge, hover flow, launch. Its name stays over it, because a frame has no cabinet to say what it is. It bobs a few centimetres. Reduced motion stops the bob.
- No source was adapted for the frame layout. It is a plain arc of quads, drawn after the splats like the machine portals.
- GTA is the first scenery room. Its world is the first brick hall from Marble, which the project already had. Its machines are at the walls and their screens were never measured, so the frame carries the game. A frame with the real 500,000-splat world is in `shots/frame-room.jpg`.
- The user linked five Marble worlds for more scenery rooms. Their splat files could not be read from the Marble web app in this session. When the files are in the repository, each world needs a scale, a floor height and `"frames": true`. Planned categories: the assistant gives one world each to ASCII Scenes and Strategy first, because those zones have no room, and the other three replace the Cottage, Action and Lab rooms if they look better than the present rooms.

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
- The alley loads as one 29 MB file. There is no small first file.
- The storefront doors were placed from point drawings and checked in one drawn frame of a 600,000-splat copy (`shots/alley.jpg`). A door can be a little off its shop front.
- The 500,000 and 150,000-splat copies of the worlds are random picks, so they are softer than Marble's own small files.
- The Atlas hall (5,000 credits) is no longer in the page. Its file is in the git history of this branch.

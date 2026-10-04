# Moonwell: faster, and the pearl can go back

After the endless islands shipped, the user asked: "make it faster and possible to go back". In the first version, a moon gate closed on each ridge, so the pearl could only go forward.

## Scope

- Remove the one-way gates. The pearl can cross any ridge in either direction, and the camera follows it left as well as right.
- Keep going back a choice. The islands step down as they go right, so the ridge behind a bowl is taller than the ridge ahead was. The right flipper swings at 78% of the left one's speed, so a normal pass stays in the bowl, and a hit near its tip goes back. Most bumpers stand on the forward half of the bowl.
- Pay for progress once. A ridge scores, and raises the streak, only the first time. A rail or a portal pays its bonus once. A shrine's seal opens after its charm, and its moonwell does not open twice. The best and the summary use the furthest island.
- Keep 40 islands behind the pearl, with a wall beyond them.
- Make play faster: the pace starts at 1.22 times real time (it was 1) and reaches 1.55 at island 60 (it was 1.28). The next pearl drops after 1.6 s (it was 3 s). Rails, portals, the camera and the stuck-pearl nudge are quicker.
- Draw faster: cache the far painting at screen size, and draw at most about 2.4 million pixels.

## Out of scope

- New art, new features in the bowls, and changes to other games.

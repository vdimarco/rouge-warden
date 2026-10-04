# Design

## The hero model: crew5.glb, with a figure built in code

**The model.** The hero is the crew's Red Jersey, `/wild/models/crew5.glb` (755 KB, 24 bones, one skinned mesh, one colour texture, about 12,500 triangles). The game already fetches `king.glb` from the same folder, so the hero reuses a model of the arcade. The file has a rest pose and no animation clips. `hero.js` loads it with `GLTFLoader`, checks that it has a skinned mesh with a colour map and that it is between 1.5 m and 2.2 m tall, and turns it to face the hero's forward direction. The service worker precaches it.

**The texture.** The colour map is a display colour, so it gets `NoColorSpace` (the repo rule: a hex in code is the colour on screen). It gets mipmaps and anisotropy 4, and `renderer.initTexture` uploads it at load, so the first frame does not stall. The model's other maps are never drawn, so the loader frees them. The file uses one texture for both the colour and the emissive map. The loader therefore skips the colour map by object and not by slot. If it freed that texture, it would free the copy that `initTexture` has just uploaded.

**The fallback.** If the file fails to load, has no rig, or has an odd height, `buildFigure()` builds a figure in code. It is one skinned mesh in which every part is rigid on one bone. The bones have the model's names and the model's T-pose proportions, so the same pose code drives both. The colours follow the key art: red jersey, white cuffs, dark gloves, jeans, red shoes. If even the figure fails, the hero stays hidden and the game plays on in first person with the camera at the eyes.

**Why not animation clips.** The model has none, and the poses depend on the game: the arm must reach the real anchor, and the body must hang below the real rope. Code can do this and a clip cannot.

## The pose code

The hero reads the physics state each frame: speed, vertical speed, ground contact, each rope's state and anchor, the yank cool-down. It blends these weights: run, air, swing, crouch, per-arm reach and per-arm yank. It then writes 22 of the 24 bones.

- **Arms.** Each arm has a target direction for the upper arm and one for the forearm. A rope arm points both along the line from its shoulder to the anchor. A yank blends the arm toward a snapped-back pose.
- **Legs.** A two-bone solver puts each ankle on a target point. The knee bends toward a pole in front. The foot keeps its own pitch in the world.
- **Body.** The up axis of the body leans toward the rope anchor and into the velocity. The yaw follows the velocity in the air and the move direction on the ground. When the hero hangs still on a rope, the yaw follows the anchor.
- **Head.** The head looks where the camera looks, within limits.
- **Hands.** `hero.hand(side)` returns the world position of each hand: the wrist bone plus 7.5 cm along the forearm. The ropes start there in third person.

The pose code works on scratch vectors made once. It makes no objects per frame.

## The skinned ink hull

`comic.outlineOf` cannot draw this outline. It makes a back-face copy of an unskinned mesh, and the copy would stay in the rest pose. The hero uses a second `SkinnedMesh` that shares the geometry, the skeleton and the bind matrix with the body.

- The hull draws back faces in ink and pushes each vertex out along its welded normal (`aOutline`, made once by `smoothNormals`). The push runs after skinning. The line then stays even when a limb bends.
- Welded normals matter because the model splits its normals at texture seams. Pushing along the raw normals would open cracks in the line.
- The push is `max(0.011 m, 2.2 px x inkK x distance)`, divided by the model scale. So the line is about 2 px wide on screen at any distance and never thinner than 1.1 cm.
- The body shader is `toonify` with a patch. It shades with the skinned normal (`objectNormal`) and not the rest-pose normal. The key light comes from behind the camera, above and a little left, and leans toward the sun. The hero's back is then never a dark shape against the sunset.

**The close fade.** When the camera comes closer than 1.5 m, the hero dissolves into Ben-Day dots by discarding fragments. It never goes transparent. It stays opaque with alpha 1, so there is no sorting and no blend. These dots are in screen space. This breaks the rule that dots stay in the world, and it is safe here: the hero is drawn only in flat play, which has one view. The hero is hidden in every XR session, so the dots cannot differ between the eyes.

## The camera: spring arm and pull-in

`flatcam.js` writes `camera.position` and `camera.quaternion` in world space.

- **The pivot** is the hero's chest plus 0.25 m. The arm is 4.5 m long at rest and lets out to 5.6 m as the speed goes from 15 m/s to 35 m/s.
- **The default pitch** is `-asin(1.2 / 4.5)`, which is -15.5 degrees. The camera is then 1.2 m above the pivot and looks at the pivot, 0.25 m above the chest.
- **Look.** Yaw is free. Pitch runs from -60 to +70 degrees in third person. In first person it runs to 85 degrees either way.
- **Pull-in.** A `city.raycast` goes from the pivot back along the arm. The arm shortens to the hit distance minus 0.3 m, and never below 0.35 m. A second limit keeps the camera at least 0.35 m above the street when the view looks up. A last test treats the camera as a ball of radius 0.28 m. If the ball still touches a collider, it shortens the arm by 20 percent, up to three times. This catches a corner that the ray slips past.
- **Smoothing.** The arm comes in at once and lets out slowly (a rate of 4 per second). A wall never gets a frame inside the view. The pull-in is fast on purpose, and the let-out is slow so that the view does not pump along a row of towers.
- **The fade.** The hero's opacity is a smoothstep of the camera distance from 0.8 m to 1.5 m.
- **Follow.** While a rope holds, the speed is above 6 m/s, the horizontal speed is above 3 m/s and the player has not touched the look input for 1.5 s, the yaw turns toward the velocity with a time constant of 1.2 s. The turn is weighted by the horizontal speed between 3 and 7 m/s.
- **Field of view.** In third person it goes from 70 to 88 degrees. In first person it goes from 75 to 87 degrees. Both follow the speed between 15 and 35 m/s, eased at a rate of 4 per second.
- **First person.** V (or `input.viewDown`) moves the camera from the chase position to the eyes in about half a second. The camera blends along a straight line between the two. The listener on the keydown ignores key repeat, modifier keys and text fields. `takeKey()` and `input.viewDown` give one toggle for one press.

The camera can come as close as 0.35 m to the pivot, and the hero fades out from 1.5 m. A 1.2 m floor would put the camera inside the wall in a narrow gap. The hero is gone before the camera is close enough to see the inside of the body.

## How the camera joins the rig

In flat play the camera is a child of the scene, not of the rig. The rig still carries the body and the yaw, so the physics, the input and the `G.test` hooks work as before. Three places in `main.js` do the work:

1. `flatView(on)` moves the camera between the rig and the scene and shows or hides the hero. Exit puts the camera back on the rig.
2. `flatInput(inp)` runs right after the input is read. It puts the camera back to the view's pose, because the input wrote the camera as the head. It gives the pitch of the view to the input (`D.setPitch`), so the head, the launchers and the aim rays follow the view. It turns the launchers about the head to the view's pitch, so that they stay low in the first-person view. It then builds the aim rays.
3. `flatFrame(dt, inp, yawDelta)` runs once the body has moved. It poses the hero and then updates the camera. In play the camera owns the yaw, because it may turn toward the travel.

The intro stays in first person. The cottage room is small, and the opening was made for the eyes. At the hand-off `flatcam.settle()` eases the pitch to the default over about a second, until the player moves the view. The head, the ears, the comic words and the far city follow the camera in flat play (`viewHead`).

## Why the phone tap ray comes from the view the player sees

The phone scheme from main built the tap ray from the input's own head. That was right when the camera was the head. It is wrong now, for three reasons.

1. **The camera is not at the head.** In third person the camera sits up to 5.6 m behind the head. A ray from the head that runs parallel to the tapped pixel's ray misses the point the player tapped. The miss is the arm length times the sine of the angle between the pixel and the view axis. At the edge of an 844x390 screen with the arm at rest, that is about 3.7 m (4.5 m x sin 56 degrees).
2. **The input's pitch is not the view's pitch.** The input clamps pitch at 85 degrees. The camera uses -60 and +70 degrees in third person, and it eases its pitch at the hand-off. A ray built from the input's quaternion is off by the difference.
3. **The overwrite.** `flatInput` once set both hands to the screen-centre ray after the input had built the tap ray. A tap then always aimed at the middle of the screen.

So `viewAim` in `main.js` builds the ray from the camera: its position, its quaternion, its field of view and its aspect. `city.raycast` finds the first point up to 400 m along it. The rope aims from the head to that point, which is where the rope really starts. With no hit, the rope aims along the ray. The desktop sends the tap's pixel as `inp.phoneAim` (NDC x and y) for the one frame in which it fires. The same code serves the middle of the screen for the SWING button and for every other shot. At any aspect the formula holds: the pixel's x is scaled by `camera.aspect`, so landscape and portrait use one path.

**Ground in view.** The chase camera looks down at the hero. The middle of the view shows the roof under the hero's feet, and a ray that hits that roof is a valid rope target at 6 m. The rope would attach to the floor. So in third person, a ray that hits an up-facing surface more than 0.3 m below the head and within 12 m of the hero (sideways), or hits nothing and points down, becomes the same bearing aimed 32 degrees above the horizon. 32 degrees is as high as the gold ring from the start roof: the phone's first SWING then catches the ring, as on main before the chase camera, and its speed kick works (a rope at 20 degrees put the kick into the roof, and the first swing reached 7 m/s instead of 11.7 m/s). The 12 m limit keeps a lower roof further away a target: without it, a clog on that roof could not be aimed at by pointing at it (a review found this, and `hero.mjs` now checks it). A tap on the hero then gives a swing up and ahead. This rule is a stopgap. The auto target in the controls change replaces it.

**The phone start.** At the hand-off a phone turns the yaw toward the gold ring and leaves the pitch to the camera. An earlier version levelled the input toward the ring, and the camera pitched up and put the arm through the roof.

## How outline twins follow their objects

An ink twin is the same shape drawn again as back faces, pushed out along welded normals. The push is `max(fixed width, px x inkK x distance)`, so the line keeps about 2 px at range. It must follow its object in every way the object moves, shows or hides. Each kind of object has its own way.

| Object | Twin | How it follows |
|---|---|---|
| A mesh or an instanced mesh | `outlineOf` (comic.js) or `inkTwin` (rope.js) | A child of the mesh, so it moves with it. It shares the geometry and the instance matrix. `onBeforeRender` copies the mesh's `count`. |
| Animated instances: toilets, Loonies | `twinOf` (game.js) | A cut-down hull geometry that reads the same instance attributes as the fill. The vertex shader is the fill's, compiled with `HULL`. The flush, the spin and the fly-home move the twin as well. |
| Pipes | `inkTwin` | The twin shares the instance matrix of the pipe mesh. |
| The ball | `inkTwin` | The twin is a child of the ball mesh, so it flies with the ball and hides with it. |
| The King | `kingHull` | A second mesh on the same geometry, child of each model mesh. It is also in the portal's stencil group, so it shows only through the hole until the hand-off. |
| Ropes, cups, launchers, gloves | `inkTwin` | The rope's twin draws as many segments as the rope. |
| The hero | the skinned hull | It shares the skeleton and the bind matrix. The push runs after skinning. |
| Wall shards of the opening | `outlineOf` on the instanced chunks | The twin hides when the fade of the shards falls below 0.3. The line stays 1.2 cm thick while a shard shrinks, and it would become a black dot. |

The fragment of a game twin is flat ink mixed with the city's four-step haze, so a far line fades like the city's own lines. Each twin draws once. The tests count them: at most six in the game objects, one for each thing.

## Budgets

| Item | Budget | Checked by |
|---|---|---|
| Whole frame, per view | 120 draws, 800,000 triangles | `perf.mjs` at every named shot, title and flat play; `hero.mjs` with the hero |
| Hero and its outline | 4 draws, 26,000 triangles | `hero.mjs` (draws with and without the hero) |
| Game outline twins | at most 6, one for each thing | `play.mjs` |
| Rope, cup, launcher and glove twins | one each | `swing.mjs` |
| Art textures | 16 in all | `perf.mjs` |
| Hero texture | one map, mipmapped, uploaded at load | `ui.mjs` |
| Per-frame allocations | none in `hero.update`, `flatcam.update`, `viewAim` | read in review; the code uses scratch objects |

These checks use software WebGL. They count draws and triangles. They do not measure frame time. Frame time on a Quest 3 is not known (see the checks that need hardware, in `tasks.md`).

## How to check the look and the layout

A reader of the specs needs a concrete way to see a picture is right. Use these.

1. **Pixels.** `hero.mjs` reads pixels with `readPixels` after one hand-drawn frame. At least 6 sample points at the hero's chest must be red. The hero's head must project near the middle of the view. `render.mjs` finds thin runs of ink pixels at the canyon shot, and the share of ink must stay under 35 percent of the picture. It checks that every pixel has alpha 255 and that the colours are saturated.
2. **Screenshots at the three sizes.** Take a screenshot in flat play at 960x540, at 844x390 and at 390x844. Read each against the specs: the hero near the middle, the ink line round the hero and the clogs, the HUD, the subtitle and the toast fully inside the window, the SWING button inside the window and not under any text. `mobile.e2e.mjs` writes the 390x844 and 844x390 pictures. No suite runs at 960x540.
3. **Geometry.** `ui.mjs` measures that a toast's box fits its canvas and that the compass arrow and its ink fit in the ring. `mr.mjs` samples the shards' ink flag and scale on every frame of the reveal.
4. **Counts.** Draw calls and triangles come from `renderer.info` in `hero.mjs`, `perf.mjs` and `play.mjs`.

## Risks

- The hero's close-fade dots are in screen space. If a future change draws the hero in a stereo session, the dots will differ between the eyes.
- The model comes from `/wild/`, a folder that another game owns. If that file changes size or rig, the hero falls back to the figure built in code. `hero.mjs` tests both paths.
- A phone in portrait has a narrow horizontal field of view (the vertical field is 70 degrees at rest). The tap ray accounts for the aspect, but how the view feels in portrait needs a real phone.
- The ground rule for the aim and the auto target of the controls change both decide the same thing. When the controls change lands, remove the ground rule.

## Joining the phone scheme of `full-swing-phone-and-climbing`

- **Aim.** `flatInput` builds the hand's aim ray from the view (`viewAim`). `phoneAim` then tries that ray first and, when it gives nothing swingable, its own assist. The two do not fight: the view ray is the exact ray of the assist.
- **Field of view.** On a phone, `main.js` computes the phone curve (wider with speed, plus the fling kick) and passes it to the chase camera as `flatcam.fovWant`. The chase camera eases to it. On a desktop the chase camera keeps its own curve.
- **The camera follow.** `phoneFollow` turns the rig yaw and nudges the input's pitch, as on main. The chase camera takes the rig's turn, so on a phone the chase view turns toward the flight with no rope as well (`mobile.e2e.mjs` checks it: the gap to the flight direction falls from about 2.7 rad to about 0.55 rad in 0.67 s).
- **Version.** Both changes raised the version to 1.4.0. The merge raises it to 1.5.0 (Quest APK version code 4), so an installed copy fetches the new files.

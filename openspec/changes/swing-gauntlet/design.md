# Design: the Gauntlet

## Sources

- **Enemy telegraphs.** The red rim on a goon who winds up follows the Arkham games' rule that an enemy shows clearly when he will
  strike, so the player can answer before the blow lands (the Game Design Skills analysis of Arkham combat,
  https://gamedesignskills.com/game-design/batman-arkham-combat/, and the GDC 2025 talk "Punching Across the Room in Batman: Arkham
  Shadow", https://gdcvault.com/play/1035681/Punching-Across-the-Room-in). Arkham draws its counter cue over the head; the game
  already had that (`#actWarn`). The rim on the body is added because, in a crowd, a mark over a head does not say which body
  moves.
- **Heavy enemy.** A big enemy that a normal blow does not stop and that must be dodged is the Arkham "titan"/brute pattern. The
  timing rule (the dodge must be live when he arrives) is ours: the bot showed that any dodge in his wind-up was enough.
- **Hit flash.** A white flash on a hit body is a common "game feel" device. The game already had hit-stop, shake and impact frames
  (`swing-verse-style`); the flash puts the blow on the body as well.
- **The brute's charge motion.** Generated with MotionBricks (T. Wang et al., "MotionBricks: Scalable Real-Time Motions with
  Modular Latent Generative Model and Smart Primitives", ACM TOG 45(4), SIGGRAPH 2026; https://github.com/NVlabs/motionbricks).
  It fills in motion between context and target poses. We gave it our own stand, wind-up and charge-end poses and baked the
  result offline (`qa/vr/motionbricks/README.md`); the game ships the clip, not the model.
- **The fight ring.** A decal: one textured quad with polygon offset over the roof, its texture painted on a canvas at load (no
  file). No outside source fit better for one flat roof; the three.js DecalGeometry is for curved surfaces.

## Decisions

- **The arena is part of the city.** `city.js` picks it after the roof antennas, with no random draws, so the rest of the city is
  the same as before. `cityview.js` adds it to the prop keep-out, so the plant rooms and air conditioners (drawn props with no
  collision) stay off it. The pick asks for a roof 16 m or more across, 14 to 60 m up, no antenna, nothing else on it, and a 6 × 6
  grid of open points (all of the middle, 90 % in all).
- **No goal beam during a round.** The beam over the job goal hid the goon it pointed at. In a round the gang is in plain view, so
  the card has no goal. The roof is the goal only for a hero who has left it.
- **The fight marks ride on an unused attribute.** `aB.w` of the figure instances was unused. It now holds the flash (0..1) plus 2
  for the telegraph. The cost is one varying and a few shader instructions on the figures; no new draw.
- **The rim, not only the hull.** The red ink hull alone was covered by the post pass's ink lines. The rim colours the body's
  edge pixels (a hard step on the view angle, in the comic cel style) and a pulse colours the rest of him a little.
- **The bot plays fair, not well.** It reacts after a set delay with some spread, dodges a brute when his lunge starts, and walks at
  5.5 m/s. It teleports for a zip (the zip's flight is main.js). Its numbers are for comparing passes, not a target to hit.

- **The charge as a clip on the street figure.** The goons are the instanced street figures, posed in the vertex shader; they
  have no skeleton. The baked motion is reduced to the figure's own joints (a pitch per leg, a pitch and a raise per arm, the
  lean, the head and the bob) at 15 Hz, 20 frames, and sent as uniforms (three vec4 a frame, 60 in all). Pose 16 samples it.
  `combat.js` stays free of the clip: it gives the charge's phase as the pose clock (0 to 1 over the wind-up, 1 to 2 over the
  lunge), and the shader maps that onto the clip's own wind-up and run. Without the file, pose 16 shows a hand-made stand-in.
- **MotionBricks on a CPU.** Its runtime needs TensorRT. Only the inference call does, so `cpu_engine.py` stubs the TensorRT
  import and runs that call on ONNX Runtime; the release's own Warp kernels prepare the inputs and decode the outputs on the
  CPU. One generation takes about a second on four cores.
- **No sample clips.** The release's sample motions are for internal evaluation only, so none of them conditions the model.

## The loop and what each pass found

1. First bot runs: the brute never hurt the bot. A kick stopped his wind-up. → nothing stops his wind-up or charge.
2. Still never: any dodge during the wind-up made him miss. → his charge is dodged only by a dodge that is live when he arrives.
   After this the reaction time matters: a 0.25 s bot clears about 8 to 10 rounds, a 0.5 s bot about 5 (`gauntlet-bot.mjs`).
3. First browser shots: the training card and its lines over the fight → `game.hush`. The banner over the speech line → lower.
4. The goon could not be seen: the goal beam hid him → no goal in a round.
5. The camera in a box: the first arena roof had props → the arena moved into the city and the props keep off it.
6. The roof was plain → the painted fight ring.
7. The banner covered the goons → smaller, shorter (1.6 s).
8. The red outline did not show in pixels → the rim on the body. The browser check now counts pixels that turn red.

## How to check

- `node qa/vr/gauntlet.test.mjs`: the round plan, the arena, the brute, the loop, the end, and a bot run.
- `node qa/vr/gauntlet-bot.mjs 300 0.25 6`: balance numbers for six seeds (rounds cleared, hurt by goon and brute, dodges,
  zips, finishers, round times).
- `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/gauntlet.e2e.mjs` (with `SHOTS=<dir>`): at 960 × 540 and 390 × 844, the
  start, the roof, the banners, the red rim (pixels that turn red round a goon who winds up, against the noise of two calm frames),
  the white flash, three rounds played with the real inputs, the brute, the end and the best. It writes six screenshots per layout
  and `gauntlet-report.json`.

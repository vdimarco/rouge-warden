# Breath of the Lake: making it faster

The game ran slowly, most of all on iPhone. This note says what was slow, what changed, and how to measure it.

## How it was measured

`qa/wild/perf.mjs` loads the game in a test browser, starts a new game, and measures five places on the map for each graphics setting:

- draw calls,
- triangles,
- the main-thread time of the game step, the world update, and the draw.

`PERF_PHONE=1` copies an iPhone screen: 390 x 844, touch, pixel ratio 3. The test browser draws in software, so its frame times are much slower than a real phone's. Compare runs with each other, not with a phone. The draw-call and triangle counts are the same as on a real device.

Two audits read the code before anything changed:

- a general one, with 88 agents;
- one for iPhone Safari, with 33 agents. It used web research on how WebGL behaves on Apple GPUs.

A second agent checked each finding and tried to prove it wrong. Only the findings that survived were fixed. After that, each group of fixes was built in its own copy of the repo, reviewed by a skeptical agent, and fixed where the review found a real problem.

## What was slow

In iPhone mode on the Low setting (the one phones use), each frame drew about 5.3 million triangles in 530 to 600 draw calls. The main thread sat idle 98.7% of the time, so the graphics chip was the limit. The causes:

| Problem | Cost |
| --- | --- |
| All 2,047 trees were two instanced meshes that spanned the whole map, so the camera and the sun's shadow never skipped any of them. Each round tree had 2,160 triangles and 6,480 vertices, and 5 of every 6 vertices were copies. | About 3.3 M of the 5.3 M triangles, drawn twice (colour and shadow) |
| Props were built from many small meshes, each with its own outline: 45 per campfire, about 98 per tower | Hundreds of draw calls |
| Characters, their outlines, campfire flames and embers were never culled | Skinned three times a frame, even off screen |
| Grass blades behind the camera, or where no grass grows, ran the full shader | 700 k vertices a frame on Low |
| One tap on the Graphics button went from Low to High, and the game saved it | A phone could be stuck on the heaviest setting |
| Dynamic resolution could only go down on an iPhone, and it counted title and menu frames | A blurry picture that was still slow |
| The full 3D world was drawn behind the opaque title and full-screen menus | Wasted frames and heat |
| Hazards and outlines compiled shaders again in the middle of fights | Stalls |
| The title waited for all 18 models (8.7 MB) | Slow start on a phone network |

## What changed

**Trees.**
- Trees are split into 200 m tiles, and each tile has a near version and a far version.
- The far version has fewer faces and casts no shadow.
- Tiles past the fog are hidden.
- Tree shapes are welded, which gives 6 times fewer vertices and the same image.

**Grass.**
- A blade that cannot be seen skips the shader work.
- The grass is split into buckets that the camera skips when they are off screen.
- Grass is drawn before the ground, so the ground under it is not shaded twice.
- Low and the far layer use fewer joints per blade.
- Cloud shadow and fog are worked out per vertex.

**Props.**
- `models.bake()` merges the fixed parts of a prop into one mesh per material. It is used for campfires, towers, the stone circle, the dojo, the castle, docks, court pipes, shrine glow bars, chests and food.
- Small far things leave the scene: secret rocks, food, chests, ground weapons, coolers and far critters. Hidden objects no longer cost a matrix update each frame.

**Culling.**
- Characters get fixed bounding spheres, so the camera and the shadow can skip them.
- Flames and embers get proper bounds.

**Settings.**
- The Graphics button goes Low, Medium, High.
- On a touch device, a saved High counts only if the player chose it on that device.
- Computers with built-in graphics start on Medium.
- If a computer is still slow at the lowest resolution step, the game drops one setting for that visit.

**Resolution control.**
- It runs only during play.
- It learns the screen's frame interval, so iPhone Low Power Mode at 30 fps does not count as slow.
- It uses fixed steps, undoes a step that does not help, and steps back up.

**Less drawing.**
- Nothing is drawn behind the title or full-screen menus.
- The sky draws after the solid things, so covered sky pixels are skipped.
- On Low, the shadow map redraws every second frame, with a 4-read filter in place of 16.
- Ground textures are read only where they show.

**The painted look on Medium and High.**
- The brush filter reads each pixel once, with no loops.
- It skips flat sky.
- The glow runs at half size.
- The picture is the same.

**Stalls.**
- Hazard materials are reused, and all outlines share one shader.
- Model sizes are measured once.
- Shaders for things that first appear mid-game are compiled behind the title.

**Loading.**
- The title waits only for the 8 models the world needs. The crew and the bosses load behind it.
- World generation takes less than half the time it did.
- Decoded model images are freed after upload.

**Page.**
- The minimap redraws only when it changes.
- The HUD writes text only when it changes.
- The stamina wheel moves by transform, so moving it needs no layout.

## Results

**iPhone mode on Low.** This is an A/B test of main against this branch, at the same draw size (pixel ratio 0.85), at five places on the map. Frame times come from software rendering, so only the ratio counts.

| | main | now | Change |
| --- | --- | --- | --- |
| Triangles per frame | 5.13 to 5.33 M | 0.40 to 0.63 M | −88% to −92% |
| Draw calls per frame | 529 to 596 | 177 to 198 | about −67% |
| Main-thread time to send a frame to the GPU | 9.6 to 13.1 ms | 3.7 to 5.7 ms | about −57% |
| Frame time (software rendering) | 1,050 to 2,970 ms | 120 to 830 ms | −72% to −93% |
| Meshes in the scene | 3,423 | 1,084 | −68% |
| JS memory | 60 MB | 42 MB | −30% |

**Every setting.** Taken at the cottage, the meadow and a lake vista.

| Setting | Triangles, main | Triangles, now | Draw calls, main | Draw calls, now |
| --- | --- | --- | --- | --- |
| Low | 5.29 to 5.36 M | 0.86 to 1.02 M | 442 to 1,010 | 148 to 374 |
| Medium | 8.56 to 8.64 M | 2.07 to 2.36 M | 443 to 1,011 | 266 to 457 |
| High | 11.0 to 11.1 M | 2.72 to 2.95 M | 443 to 1,010 | 262 to 450 |

**Loading.** Measured on the test machine; a phone on a slow network gains more.

| | main | now |
| --- | --- | --- |
| Time to the title | 11.7 s | 2.9 s |
| Time to play | 65 s | 11.6 s |
| Downloaded before the title (10 Mbps test) | 12.1 MB | 5.4 MB |

**The look.** Screenshots at every setting match main, except for one change. Grass blades whose height is zero no longer draw as grey specks on the sand and the lake.

**Tests.** All of `qa/wild` passes: level, king, adventure, stress, flows, fun, touch, render and fuzz. The stress test is flaky on main too. It failed there once with "fishing-stuck", and on this branch once with a single camera frame. It passes on a rerun.

## What could still help

- Compress the model files (Meshopt or Draco, and KTX2 textures). This needs a loader change together with the file change.
- Measure on a real iPhone with Safari's Web Inspector timeline. Software rendering cannot show the phone's real graphics time.
- The ground shader now reads rock textures with explicit gradients. On a phone this may be slower on rocky slopes, though flat ground now skips four texture reads. Check this on a device.

# Local graphic-novel character pilot

This is an isolated partial improvement of the retained CurlyMetalhead body. It supplies fitted teal trousers/canvas high-tops, twenty weighted finger joints, two restrained squint shapes, and a native blended animation route. It is not the proposed mature replacement anatomy, full blinking/speech, finished graphics, or a production rollout.

`reference.png` is the clean imagegen A-pose input for a replacement model; exact prompts and provenance are retained beside it. The connected fal account returned `balance_exhausted` during upload preparation. No upload or model generation was submitted; see `provider-status.json`.

`rigged/` retains the editable body, neutral FBX/GLB, partial-control review and rejected full-blink evidence. `wardrobe/` retains the clothed FBX/blend, four CPU views, source guards, rejected revisions and fresh round-trip report. The repaired cloth passes fresh FBX reimport with zero unintended boundaries, non-manifold edges or degenerate faces; all 36 outer-ankle sightlines hit trousers. The prior failed revision is retained. This accepts the bounded topology repair, not final graphics. `body-bind-pose.fbx` consolidates the original export's partial bind poses without changing geometry, weights, morphs or transforms; its proof is separate. Unreal still reports relative bind warnings and successfully recreates the bind pose, requiring actual native visual review.

Before regenerating, move the previous `body-bind-pose.fbx/json` into an owned timestamped `wardrobe/revisions/` subfolder; consolidation deliberately refuses to overwrite an existing copy. Regenerate in order with the installed Blender, from the repository root:

```sh
blender --background --factory-startup --python-exit-code 1 --python games/nord-unreal/Scripts/prepare_graphic_novel_rig.py
blender --background --factory-startup --python-exit-code 1 --python games/nord-unreal/Scripts/prepare_graphic_novel_wardrobe.py -- --source Data/GraphicNovel/Pilot/CurlyMetalhead/rigged/body.fbx
blender --background --factory-startup --python-exit-code 1 --python games/nord-unreal/Scripts/consolidate_graphic_novel_bind_pose.py
```

Author only `/Game/ParkComic/CrewGraphicNovel/Resident9` in a fresh NullRHI Python commandlet with `-NordGraphicNovelCandidate`: run `Scripts/import_meshy_crew.py` and `Scripts/apply_comic_style.py`, then exit normally. Imports back up any prior candidate packages. The original sources and production crew/map are preserved.

Use `-NordGraphicNovelCandidate` for opt-in native review after a current editor build. Only style 9 selects the candidate body/blended graph; other styles retain their existing assets. F2 remains private. The normal launch is unchanged. The native pose/still fixture is `Scripts/capture_player_quality.py` with that flag; it pauses only while saving each still. Add `-NordGraphicNovelStandard` for a separate standard-view comparison; add `-NordGraphicNovelHeadless -NullRHI` for explicit native-only state/bone checks, or `-NordQuality1920` for the second capture size. Use `-NordGraphicNovelMotion` for a separate eight-phase unpaused 1× motion-only route with the native controller camera and read-only material checks; it emits timestamped diagnostics without stills. Its headless pass does not establish rendered fluidity or FPS. The fixture hides cars/residents and disables their collision. Do not add `-immersive`: it auto-starts PIE before this fixture boot. Render only in an available serialized GPU window. Raw evidence is under `Saved/Tests/GraphicNovel/`; current reviewed scope is in `Verification/GraphicNovelPilot.md`.

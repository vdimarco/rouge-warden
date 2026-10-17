Private jump-only reduced-arm diagnostic — preparation, not a graphics fix

The existing high-detail Airborne still observes A_Jump at 0.42189 s with Jump weight 1.0. Its helper's smoothstep authoring drives both upper arms to -108.433394331 degrees there, with both shoulder/clavicle tracks neutral. The native view shows pinched sleeve/upper-arm lobes. Matching source binds/weights rule out a gross rig mismatch; they do not establish anatomical weight quality. This trial asks whether the unusually raised arm pose contributes. Collar chips already exist at rest and will remain outside this trial.

Exact retained inputs, relative to `/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal`:

- `Scripts/prepare_meshy_jump.py` — authoring implementation; SHA256 `ed50ad1d4a09a9d6b71ee45c108a4f0e404b222ebfe311df3302929a6602aebd`.
- `Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/body.fbx` — SHA256 `b7e7ca0d9c486412108cba85e1cd4a5512fecd4ad36b8cfdb4677259ff6f9244`.
- Same folder `jump.fbx` — SHA256 `36d74356ca903188a9b3956db69e51367260866972cda9215fab6a66d5362aa3`.
- Same folder `jump.json`, `files.json`, `source-review.json` remain immutable. No FBM sidecar restoration is required for this isolated body-copy authoring.

The only proposed helper differences are the arm field in two POSES rows:

```diff
-    (0.23, 0, -8, 16, -8, -95, 35, -5),
+    (0.23, 0, -8, 16, -8, -60, 35, -5),
-    (0.47, 0, -58, 100, -30, -110, 65, 10),
+    (0.47, 0, -58, 100, -30, -70, 65, 10),
```

These are test values, not approved acting. Both LeftArm and RightArm use them. At 0.42189 s the trial is -68.955596221 degrees; elbow stays 61.866788662 degrees. The keys at 0/.10/.73/.93/1.20 s stay unchanged, including neutral endpoints. Smoothstep interpolation and 37 samples at 30 fps/1.2 s remain. This lowers the central raising interval; it does not add a clavicle rig, fingers or facial performance. World-space hands/forearms naturally change with their parent arms.

CPU preparation and subsequent optional authoring:

```bash
PYTHONDONTWRITEBYTECODE=1 python /tmp/nord-private-jump-arm-trial-20261017/prepare.py --check
PYTHONDONTWRITEBYTECODE=1 python /tmp/nord-private-jump-arm-trial-20261017/prepare.py /tmp/nord-jump-arm-ab-20261017
```

Preparation uses no bpy/process/network calls. It makes a fresh `/tmp` control/trial pair from the exact body, snapshots the original helper, checks its AST differs only at those two scalar fields, and records explicit Blender argv in `preparation.json` without executing them. Each argv fixes all write destinations with absolute `--source-root`, `--names CurlyMetalhead`, and absolute `--report`. The existing helper otherwise overwrites its selected folder's jump.fbx/jump.json and has a default Verification destination: never run it on the retained source or with omitted arguments. Future Blender runs use `-t 4 --background --factory-startup`; they render nothing, and any FBX extraction stays inside the fresh temporary tree.

Required CPU gates before native authoring:

1. Run those recorded control/trial commands only if root approves the diagnostic. Keep original delivered jump.fbx as the immutable baseline; do not replace its manifest or receipt.
2. Both exported clips must pass the helper's existing 24-bone hierarchy/rest-head, moving-knee, neutral-end and FBX round-trip checks. Verify 37 frames/1.2 s, finite transforms and no root motion.
3. Compare fresh reimported control/trial semantic local transforms at all 37 sample frames: same names/hierarchy/rest matrices; every bone's translation/scale unchanged; only LeftArm/RightArm local rotation curves may differ. Shoulders, forearms, spine, legs, Hips, head/neck local rotation curves remain equal. Also compare retained vs reauthored control before using it as a baseline. FBX byte equality is inappropriate for rebaked metadata. Body geometry/weights/UVs/normals are never exported by this armature-only helper and their retained source hashes must stay fixed.

Smallest future native integration, explicitly a separate root-owned step:

- Use the animation-only import block from `Scripts/import_meshy_crew.py` (FbxImportUI / FBXIT_ANIMATION / import_mesh=False / import_animations=True; no materials/textures) in a short isolated NullRHI helper. Do not invoke the full importer: it also reauthors body, maps, materials and graphs.
- Read the actual skeleton from `/Game/ParkComic/CrewGraphicNovelHighDetail/Resident9/SK_Body.SK_Body`. Import only the trial jump to existing PRIVATE `/Game/ParkComic/CrewGraphicNovelHighDetail/Resident9/A_Jump.A_Jump`; keep enable_root_motion=False and force_root_lock=False as the original jump. No new runtime selection path is necessary for this temporary A/B.
- Before import, seal/backup all current Content bytes and all A_Jump package sidecars; expected original A_Jump.uasset SHA256 is `1e62a9debd7aec41beac0466ac6a5114741ce79de6bce102f6cdbe5d3cd52f26` at proposal time. Stop if it changed. After save, allow only that private package set to change; all skeleton/body/maps/materials/other clips/graphs/map/production packages must be byte-identical. Read back the actual AnimSequence source filename/hash, skeleton, length, rate and root-motion flags in a NEW trial receipt; exit the authoring process before Vulkan. Restore the sealed original private jump package bytes after the trial process exits and verify the complete Content baseline again.
- Reuse `Scripts/capture_player_quality.py` through a frozen ignored capture wrapper and the proven serialized render-window manager. Retain `-NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetail`, the raw 1-UV source guard, full normals and exact existing quality/isolation settings. The current capture verifies the ORIGINAL raw source manifest; it does not prove a deliberately replaced native A_Jump matches that source. Add an explicit trial-native receipt/readback to the wrapper/report, preserving the original raw manifest and its truthful baseline status. Do not forge HighDetailImport/source-review or relax the body guard.
- Capture matched before/after Airborne/Landing stills (same camera, actual clip time recorded) plus unpaused 1x jump/landing/recover and walk/run/turn context in Standard and Comic. Review sleeve volume, upper-arm/clavicle silhouette, hand/head intersections, transition speed and ink stability; keep 720p/1080p readability and both modes for any adoption. A still improvement alone is insufficient for adoption. Continuous playback remains a distinct required review, not inferred from graph clocks or selected frames.
- Keep native knee-pose, clip advance, jump-height/root-drift, capsule and movement/controller tests. No C++ movement, capsule, collision, replication, input, camera, C/E/F2 or player-control code is changed by this proposal. That source scope does not itself prove native behavior; repeat the relevant existing checks after import. No held-pose/cadence change, default promotion, crew expansion or packaged-60 claim.

Reuse the active OpenSpec change `openspec/changes/nord-city-quality`: `specs/nord-unreal/spec.md` Requirement “Isolated native pilot review” / Scenario “Compare a higher-detail body independently”, together with “Mature graphic-novel character direction” / “Review an implemented character pilot”. Its existing three-flag isolation, immutable provenance, native deformation comparison and motion/image gates fit this diagnostic. This does not belong in the current EastDetails merge. If the trial fails, keep its evidence and leave the original private clip in place; no broad weighting or geometry repair is justified by this test alone.

Prepared artifact scope: CPU/static proposal only. No Blender, Unreal, GPU, service, paid job, source restoration or existing-file edit was performed.

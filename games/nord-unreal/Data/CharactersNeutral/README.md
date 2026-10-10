# Relaxed cottage crew

The replacement crew uses relaxed reference artwork and complete Meshy bodies with their own Idle/Walk/Run clips. Jump is authored locally on each replacement rig. Identity, outfits and style numbers 3–10 follow the retained originals. Expressions remain static: body animation does not supply blinking, jaw/eye controls or lip sync. Generated proportions, hair, fingers, lettering and skinning remain approximate.

Style 9 first passed the separate pilot; all eight current resting faces now pass native review, including corrected style 8 revision 2. Both normal production matrices pass 56 views each and final smoke passes 66 checks; see [NaturalFaces.md](../../Verification/NaturalFaces.md). All replacements use existing `/Game/ParkComic/Crew/Resident3` through `Resident10` paths. [NeutralCrewImport.json](../../Verification/NeutralCrewImport.json) records the first production backup under `Saved/Backups/CrewImport-20261010-010939-540179`; the focused style 8 backup is recorded below. Final Linux build/cook/stage succeeds, and separate-process package play passes; all eleven final packaged gameplay checks pass in 89.1 seconds. Source/import checks are separate from visual/gameplay acceptance.

Style 8 needed a second correction: its first neutral generation retained a strong furrowed brow and was rejected against the relaxed-brow requirement. The complete first generation, its own clips and four native front/three-quarter views are retained read-only in [Revisions/LimeJacket-v1](Revisions/LimeJacket-v1/revision.json). Current `LimeJacket/` contains the second reference and complete Meshy generation (request `01a12447-8c57-7212-a7de-93c4be38d37b`), with its own Idle/Walk/Run and locally rebuilt Jump. [NeutralLimeImport.json](../../Verification/NeutralLimeImport.json) records the style-8-only replacement and recoverable package backup. The other seven designs retain 140 unchanged source files and 77 unchanged Unreal assets. Current source/Jump/saved checks and both whole native matrices pass all eight; the new style 8 calm brow/eyes and closed subtle smile pass four native face views. Final smoke passes 66 checks. Package play passes; all eleven final packaged gameplay checks pass in 89.1 seconds. The relaxed-brow criterion is unchanged.

Each folder retains `reference.png`, exact submitted `request.json`, returned `result.json`, downloaded body/textures/animations and locally authored `jump.fbx`/`jump.json`. `files.json` hashes the completed downloaded outputs. `CharactersNeutralSources.json` and `CharactersNeutralJumpSources.json` in Verification pass all eight sources. Saved `MeshyAssets.json` checks source MD5 for each body and all 32 clips, exact source hierarchy, local mesh/skeleton reference transforms and source bind distances. Each source has 24 weighted body joints; Unreal retains an additional `Armature` wrapper root, giving 25 saved nodes. This is not a facial rig.

`Data/CharactersMeshy/` is the immutable original source tree. [NeutralOriginalSources.json](../../Verification/NeutralOriginalSources.json) protects 166 files, including its README. That README describes the previous pipeline; use the commands here for replacements. Original-source download/jump/test helpers deliberately retain their old default source root. Always pass `--source-root Data/CharactersNeutral` when working with the replacements.

Run the following from this Unreal project directory. These steps use retained completed results and local tools; they do not submit generation jobs. Downloads still depend on returned URLs being live. Jump regeneration writes the replacement jump files and provenance; import backs up and replaces saved production packages. Close this project's other editor/game processes before imports or captures, and run each process serially.

```bash
python3 Scripts/download_meshy_crew.py --source-root Data/CharactersNeutral
blender --background --factory-startup --python Scripts/prepare_meshy_jump.py -- --source-root Data/CharactersNeutral
python3 Scripts/test_meshy_crew.py --source-root Data/CharactersNeutral
```

The importer and saved-asset verifier now default to `CharactersNeutral` without an extra flag. Import refreshes each mesh/skeleton reference pose and all four own clips at the existing production paths. Original handheld props remain separate and must already be imported.

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$PWD/Quebec.uproject" -ExecutePythonScript="$PWD/Scripts/import_meshy_crew.py" -unattended -nop4 -nosound -NullRHI
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$PWD/Quebec.uproject" -ExecutePythonScript="$PWD/Scripts/verify_meshy_crew.py" -unattended -nop4 -nosound -NullRHI
```

Normal native capture also defaults to the production replacement crew. It requires rendering and ImageMagick; do not use NullRHI. It captures eight bodies × seven states (Idle, Face, FaceThreeQuarter, Walk, Run, Airborne, Landing), or 56 PNGs per size. Results use `Preview/PlayerQuality1280/`, `Preview/PlayerQuality1920/` and `Verification/PlayerQuality/PlayerQuality{1280,1920}.json`. Those paths replace the previous six-state mip-fix matrices; check fresh report completion and source provenance before treating them as current evidence.

Final editor capture used temporary streaming-pool/virtual-shadow-page limits of 1024 MiB/2048 pages at 720p and 512 MiB/1024 pages at 1080p to fit the shared GPU. These process-only inspection budgets are separate from unchanged packaged Epic defaults; successful captures do not establish packaged performance.

```bash
"$ue_root/Engine/Binaries/Linux/UnrealEditor" "$PWD/Quebec.uproject" /Game/Maps/LaFontaine -ExecutePythonScript="$PWD/Scripts/capture_player_quality.py" -unattended -nop4 -nosound -RenderOffscreen
"$ue_root/Engine/Binaries/Linux/UnrealEditor" "$PWD/Quebec.uproject" /Game/Maps/LaFontaine -ExecutePythonScript="$PWD/Scripts/capture_player_quality.py" -NordQuality1920 -unattended -nop4 -nosound -RenderOffscreen
```

`-NordNeutralCandidate` on import/verify/capture selects only style 9 under `/Game/ParkComic/CrewNeutral/Resident9`, with separate candidate reports/captures and PIE-only mesh/clip overrides during capture. Reviewed candidate assets were archived to ignored `Saved/Backups/CrewNeutral-reviewed-20261010` before the final cook, avoiding a duplicate packaged body; references/reports/PNGs remain. Re-run the candidate import first to reproduce that review path. Normal whole-crew import and gameplay use the existing `Crew` paths.

Replacement materials retain default lit shading, the existing emission fill, source corner normals/full UV precision and reduced normal detail. Base-color atlases use BC7, NoMipmaps, NeverStream and zero LOD bias. Eight 2048² BC7 atlases occupy about 32 MiB and may alias at distance; padding/repacking tiny UV islands is the longer-term route to safe mips. Source RGB matching does not establish exact rendered pixels after compression, lighting and postprocessing.

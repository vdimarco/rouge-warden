# Resting crew faces — production review, 2026-10-10 UTC

**All eight resting faces pass native review; packaged integration passes.** Both final production matrices pass eight bodies × seven states, 56 views at each supported size. Style 8 revision 2 now has calm brows/eyes and a gently closed, subtly smiling mouth; its rejected predecessor is retained separately. Seven other designs retain unchanged source/assets. Fresh native smoke passes 66 checks. The original expression criterion is met in the inspected face views without accepting the old furrow as an exception. Exact likeness and facial animation are not claimed.

## Style 8 revision

The rejected first `LimeJacket` generation, own four clips and four native front/three-quarter views at both sizes are retained read-only under [Revisions/LimeJacket-v1](../Data/CharactersNeutral/Revisions/LimeJacket-v1/revision.json). Its stern face is historical evidence, not an accepted exception. Current [LimeJacket/request.json](../Data/CharactersNeutral/LimeJacket/request.json) records replacement job `01a12447-8c57-7212-a7de-93c4be38d37b`; the new reference, result, complete body/textures, own Idle/Walk/Run and locally rebuilt Jump reside in the normal `LimeJacket` folder. [NeutralLimeImport.json](NeutralLimeImport.json) passes the one-style production import after backup. All-eight source/Jump/saved checks pass, including the new body import MD5. The other seven retain 140 unchanged source files and 77 unchanged saved assets.

Independent inspection of all four final style 8 front/three-quarter views against its [new reference](../Data/CharactersNeutral/LimeJacket/reference.png) confirms the strong pinched V-shaped brow and tense frown are gone. Eyelids/eyes read calmly, lips remain closed with a subtle smile, and grey hair/stubble, beanie, patterned scarf and lime jacket stay recognizable. Age lines and painted skin shading remain; these do not reproduce the rejected angry brow. [720p front](../Preview/PlayerQuality1280/Resident8_Face.png), [720p quarter](../Preview/PlayerQuality1280/Resident8_FaceThreeQuarter.png), [1080p front](../Preview/PlayerQuality1920/Resident8_Face.png), [1080p quarter](../Preview/PlayerQuality1920/Resident8_FaceThreeQuarter.png).

## Production evidence

The final [1280 report](PlayerQuality/PlayerQuality1280.json) and [1920 report](PlayerQuality/PlayerQuality1920.json) each pass **eight bodies × seven states, 56 views**, including style 8 revision 2. They use the normal possessed production pawn at `/Game/ParkComic/Crew/Resident3` through `Resident10`, with `Data/CharactersNeutral` source checks and **no PIE mesh/clip overrides**. Idle, Face, FaceThreeQuarter, Walk, Run, Airborne and Landing use native movement/sprint/jump callbacks. All 112 PNGs pass dimensions/completion checks; all eight imported base-color RGB comparisons match the current neutral sources. Movement/root/cadence checks pass separately from visual judgment. These paths supersede both the six-state mip-fix matrices and the first neutral-set runs.

Temporary editor inspection budgets differ by size: 720p uses a **1024 MiB streaming pool / 2048 virtual shadow pages**; 1080p uses **512 MiB / 1024 pages** to fit the shared GPU. These are capture-process limits, not saved production-quality changes. Actual packaged Epic defaults remain unchanged. Capture success is not a performance benchmark or a 60 FPS claim.

The scoped [styles 3–6 review](NeutralFacesReview3-6.md) and [styles 7–10 review](NeutralFacesReview7-10.md) record independent dedicated-face and selected movement inspection. The final four style 8 faces are additionally reviewed above. Visual conclusions cover the documented samples rather than every animation frame; all 112 files receive separate integrity checks. Earlier stern-brow observations apply only to retained style 8 revision 1.

| Style | Resting face / identity cues | Visible limits |
| --- | --- | --- |
| 3 | Closed lips, readable eyes, green backward cap, facial hair and navy 51 jersey. | Painted beard/skin and coarse collar trim. |
| 4 | Closed mouth and relaxed cheeks, navy cap, tinted round glasses and red Memphis 33 jersey. | Tint reduces eye readability; coarse neck/jersey edge. |
| 5 | Closed, slightly pursed lips, dark cap, rectangular glasses, beard and black outfit. | Thick generated glasses and painterly skin/beard. |
| 6 | Closed-mouth mild smile, backward white cap, glasses, full beard and black outfit. | Protruding far-side frame, pale painted streaks and irregular collar edge. |
| 7 | Small closed-mouth smile, navy cap, blue sunglasses and red baseball jersey. | Sunglasses hide eyes by design; plunger crosses glasses/upper face in 1080p Run. |
| 8, revision 2 | Calm brow/eyes, closed subtle smile, grey stubble, beanie/scarf and lime jacket. | Age lines, painted skin shading and generated facial proportions remain approximate; first strong furrow is superseded. |
| 9 | Closed-mouth mild smile, readable eyes/beard, skull shirt, palm shorts and bare feet. | Fuller wavy hair/approximate proportions; plunger overlaps the upper face in 720p Run. |
| 10 | Restrained closed-mouth smile, topknot, dark sunglasses, white shirt and cross-body bag. | Sunglasses hide eyes; bag, muscle and hair details are stylized. |

All dedicated face views are unobstructed. The final soccer-pitch framing removes the pilot's foreground fence rail; inspected movement frames keep complete bodies/feet in view. Walk/run/bent-leg airborne/landing poses remain distinct without gross mesh separation or exploded limbs. Stiff open hands, pronounced shoulders/upper arms, angular neck planes and approximate lettering remain. Carried props may still cross a face in a movement sample, so the dedicated face views establish expression readability. Still images do not establish flawless skinning in every animation frame or temporal smoothness.

Final [Smoke.json](Smoke.json) passes 66 native two-player checks in 43.98 seconds with style 8 revision 2, including character selection/replication, private F2, movement, car interactions, objectives and reconnect. Final Linux build/cook/stage/pak/archive succeeds in 69.76 seconds. Current [Package.json](Package.json) passes separate-process host/client joining, eight native character cycles, eight bodies/32 clips, 1,161 city models and seven rendered captures in 33.78 seconds. [PackagedGameplay.json](PackagedGameplay.json) passes all eleven checks in 89.1 seconds using separate Linux processes and native inputs, with collision and ambient traffic enabled. Handbrake/release, abrupt driver loss, timeout release, rejoin and clean departure pass. The [integration task](../../../openspec/changes/nord-city-quality/tasks.md) is complete; overall performance/art acceptance remains open. Earlier revision-1 build/package reports are superseded.

## Provenance and retained originals

All eight replacements use relaxed imagegen references, complete Meshy bodies and their own Idle/Walk/Run clips; Jump is locally authored on each 24-body-bone rig. References, exact submitted inputs, returned results, downloaded outputs and jump provenance are retained under `Data/CharactersNeutral/`. [NeutralCrewImport.json](NeutralCrewImport.json) records the recoverable original packages and import at existing production paths. [CharactersNeutralSources.json](CharactersNeutralSources.json), [CharactersNeutralJumpSources.json](CharactersNeutralJumpSources.json) and [MeshyAssets.json](MeshyAssets.json) pass eight sources and saved assets. Saved checks verify exact 25-node hierarchies (24 body bones plus Armature wrapper), local mesh/skeleton reference transforms, source bind distances and body/32-clip import MD5. The importer retains default lit shading, BC7/NoMipmaps/NeverStream/zero bias and matching source RGB. [Pipeline commands](../Data/CharactersNeutral/README.md) reproduce the retained outputs without submitting new jobs.

The original `Data/CharactersMeshy/` tree is separate and immutable; all 166 files and the complete file set match [NeutralOriginalSources.json](NeutralOriginalSources.json), including its historical README. The earlier [mip-fix review](FaceVisualReview.md) establishes detail recovery on the original bodies and is superseded for expression evidence by this review. It does not describe the new 112-frame matrices.

## Style 9 pilot

The initial separate pilot was reviewed against the [relaxed reference](../Data/CharactersNeutral/CurlyMetalhead/reference.png) and retained [original face illustration](../Data/CharactersMeshy/CurlyMetalhead/face-reference.png). Its four native faces showed closed lips with a mild smile, relaxed cheeks and readable eyes while retaining recognizable curly hair, brows, beard and skull-shirt design. The exposed-tooth grin was absent.

| Native view | 1280×720 | 1920×1080 |
| --- | --- | --- |
| Front | [Face](../Preview/NeutralCandidate1280/Resident9_Face.png) | [Face](../Preview/NeutralCandidate1920/Resident9_Face.png) |
| Three-quarter | [FaceThreeQuarter](../Preview/NeutralCandidate1280/Resident9_FaceThreeQuarter.png) | [FaceThreeQuarter](../Preview/NeutralCandidate1920/Resident9_FaceThreeQuarter.png) |

The [1280 report](NeutralCandidate/PlayerQuality1280.json) and [1920 report](NeutralCandidate/PlayerQuality1920.json) each pass seven states: Idle, Face, FaceThreeQuarter, Walk, Run, Airborne and Landing. These are the actual possessed pawn with PIE-only mesh/clip overrides to `/Game/ParkComic/CrewNeutral/Resident9`, using native movement/sprint/jump callbacks and the lit comic materials. They do not prove production promotion or native C selection of the replacement. All fourteen PNGs independently pass signature, dimensions and complete-IEND checks. Independent visual review also inspected the ten full-body poses: black/red graphic shirt, teal palm shorts and bare feet remain present, with distinct walk/run and bent-leg airborne poses. The reports record zero horizontal actor drift during the vertical jump and recovery to Idle.

Pilot [submitted inputs](../Data/CharactersNeutral/CurlyMetalhead/request.json), [returned provenance](../Data/CharactersNeutral/CurlyMetalhead/result.json) and [local Jump provenance](../Data/CharactersNeutral/CurlyMetalhead/jump.json) remain retained. The [candidate asset check](NeutralCandidate/MeshyAssets.json) passed the saved body/material/texture settings. The pilot's Run/Landing views had a court rail across the neck/lower face and showed shoulder/shirt stretching in Airborne. These are pilot observations; the final full-matrix framing is fence-free, with the skinning limits above retained.

Reviewed `CrewNeutral` assets were archived under ignored `Saved/Backups/CrewNeutral-reviewed-20261010` before the final cook, avoiding duplicated packaged models; pilot sources/reports/PNGs remain. Candidate import with `-NordNeutralCandidate` recreates the separate style 9 review assets.

## Scope

Expressions are still baked into geometry/textures. Body rigs provide no implemented jaw/eye controls, facial morphs, blinking or lip sync; head movement in Idle is body animation. Physical keyboard delivery, external internet/NAT, exact likeness, exhaustive animation quality and final packaged performance are outside these visual/native matrices. Relaxed resting-face review does not establish changing emotions or dynamic facial animation.

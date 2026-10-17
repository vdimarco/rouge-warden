# Rejected character silhouette repair — 17 October 2026

Follow-up: the user rejected this four-track pose as awkward and identified backward arms. Its artifacts below remain historical evidence. The [forward-elbow fix and compact twelve-track CPU candidate](../GraphicNovelNaturalMotion/README.md) supersede it for the next visual comparison; neither candidate is adopted or accepted as final art.

The rejected frame has visibly raised shoulder lobes, a rigid symmetric jump and an oversized upright plunger. This checkpoint prepares a compound correction to the private high-detail Resident9 pilot. It is **not installed or accepted as final art**. The original clip, all 6,850 Content files, source art, native module, live packages, saves and services are preserved.

## Concrete correction

The [four-track animation derivative](CPU/trial/CurlyMetalhead/jump.fbx) lowers the tool arm and gives the other arm a different balancing pose. It retains the existing jump timing, legs, spine, head, reference pose, geometry, weights and textures. Retained/control comparisons match exactly; the trial changes only LeftArm, RightArm, LeftForeArm and RightForeArm rotations across 37 samples at 30 Hz. The original generation's 23 files remain byte-identical.

The tool study uses the existing plunger at 0.6 scale (about 56 cm long), cup below/outside the hand, with shaft-local z = −20 cm anchored at the wrist. Its attachment follows the hand instead of keeping absolute world rotation. No original prop mesh, collision or ordinary crew changes are adopted.

Inspect the matched CPU [baseline front](CPU/baseline-front.png), [corrected front](CPU/trial-native-grip-front.png), [side](CPU/trial-native-grip-side.png) and [three-quarter](CPU/trial-native-grip-threequarter.png). They are labelled CPU studio previews with a white geometry proxy, not gameplay captures. The sleeves improve visibly; open fingers, restrained posing, shirt faceting and the overall illustrated character quality remain unfinished. See [CPU review and limits](CPU/CPUReview.md).

## Native evidence and limits

- Fresh NullRHI [animation authoring](Native/Author.json) and [independent reload](Native/FreshVerify.json) pass: only the private A_Jump package changes, with the same own skeleton, 25 native tracks including its static import root, neutral endpoints and all other local channels preserved.
- The [rendered attempt](Native/FailedVulkanWindow.json) fails before PIE with Vulkan GPU allocation exhaustion. It produces no successful comparison. The [parent](Native/CompoundWindow.json) and [restoration receipt](Native/RestoredOriginal.json) record complete original Content/settings restoration; the normal demo and tunnel/TURN identities are restored/preserved. The crash log could not allocate 128 MiB; Vulkan reported its device budget as 11,453.56 MB and usage as 11,403.94 MB. Separate GPU inventory showed Dota 2 and desktop processes also using VRAM; those processes were left alone. No core dump was available.
- A separate [headless gameplay check](Headless/Gameplay.json) passes all seven existing states, real native jump/recoil/recovery and hand-relative shaft anchoring. Its [parent](Headless/Restoration.json) passes Content, source/module, save, settings, service and TURN preservation. It provides no rendered, frame-rate or browser evidence.
- That first headless check exposes a calibration limit: the initial live hand orientation is 17.355° from neutral. Its measured transform preserves wrist alignment, but must not be persisted as a neutral bake. The [independent quaternion audit](NeutralReferenceAudit/README.md) reconstructs 42 observed native jump hand orientations within 0.0025° and quantifies the mismatch.
- The corrected [reference-derived headless check](ReferenceHeadless/Gameplay.json) passes all seven states. The actual native reference-pose API yields the independently predicted relative quaternion/offset exactly within float precision. The [executed PIE prototype](ReferenceHeadless/crew_prop_trial.py) composes the own skeleton's component reference hand with the actual mesh world rotation; calibration is independent of live idle phase. Its [parent](ReferenceHeadless/Restoration.json) again passes all preservation checks. This remains a PIE diagnostic; no persistent runtime C++ change or package is adopted.

The earlier two-upper-arm-only trial remains rejected and restored; this four-track plus smaller hand-relative tool study does not relabel its results. Final art, continuous 1× rendered motion, packaged performance, browser decode, physical-device and off-LAN acceptance remain separate and open. No additional generation request or spending occurred: US$4 remains reserved of US$25 authorized, leaving US$21 uncommitted.

## Next checkpoint

Obtain a fresh owned GPU window with sufficient headroom. Keep the existing process/12,000 MiB guard and exact demo restoration. Compare the original camera/phase plus side motion, Standard/Comic at 720p/1080p, including landing and recovery. Do not lower quality or replace this check with CPU images. Only after the compound result survives that review should a private persistent import/runtime correction be built and rechecked. A C++ rebuild requires fresh pre-PIE build-flag proof; the prepared later wrapper must inspect native prop state rather than applying a PIE override.

The active OpenSpec change is `nord-city-quality`; its rendered/adoption tasks remain incomplete. No source/art checkout, public package, normal crew or accepted district is promoted by this checkpoint.

Run `python3 -B games/nord-unreal/Verification/GraphicNovelSilhouetteRepair/verify.py` and `python3 -B games/nord-unreal/Verification/GraphicNovelSilhouetteRepair/NeutralReferenceAudit/check.py` from the repository root to verify the curated checkpoint. The first checks hashes, retained sources and receipts; the second independently recomputes the reference math. Neither runs an engine, submits generation, restarts services or claims visual acceptance. See [handoff](Handoff.md) for the next bounded engine run.

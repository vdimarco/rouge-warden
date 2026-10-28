# BlackCap: Tripo body and its own Tripo rig

CPU surface and motion preparation pass for the actual H3.1 static body and returned 61-bone rig. These receipts establish preserved source PBR, provider skin/binds and animation export behavior. Visible deformation, continuous-motion art acceptance, native import height/shading and package acceptance remain open.

Inputs are immutable `Crew/BlackCap/tripo-h31-body-20261017/body.glb` (SHA `ff4d393b98d5fba212295305b714ab7fce04229e34b14196c7e2f4c210467d70`) and its own `tripo-h31-rig-20261017/rig.fbx` (SHA `54db95e20649c34c1d6dd2f28e1a1ec44a91250b0f73f6041774ac722764848b`). The 24-bone BlackCap Meshy body and its own local Walk/Run are motion references only. Their geometry is unrelated and is never used as proof of the new Tripo surface. A corrected source Jump was authored on a fresh copied reference body by the unchanged historical helper.

## Surface

[Surface.json](Surface.json) pins the actual inputs, exact executed recipe, output FBX and three unchanged original embedded maps. The original is static, centered vertically; the provider rig places its feet at zero. The rejected origin-only attempt and its exact recipe remain in `Saved/Tests/TripoH31Surface/BlackCap-v1`. That rejected 0.27087668 scale is invalid.

The new static-source correspondence fits positive uniform scale and translation from 96,140 unambiguous UV triangles, with no rotation fit. It measures provider-to-original scale 0.9999999606255 and translation `(+0.000660406,-0.000894533,-0.489688970)m`. These values match UV corners only; no mesh, bind or object transform is corrected. Legacy skinned-source correspondence and strict provider-before/after export still use zero translation. The 10µm source-pair and2µm provider-roundtrip policies and normal gates are unchanged.

| Check | Actual |
| --- | --- |
| Original/provider maximum geometry residual | 0.0673µm |
| Provider export/reimport maximum geometry residual | 0.1309µm |
| Bind maximum matrix error | 0.000005141 |
| Corner weight error | 0 |
| Fresh normal mean / p99 / maximum | 0.001757° / 0.007515° / 0.331966° |
| Fresh normals above 0.1° | 8 retained outliers |
| Hierarchy / weighted finger controls | 61 bones / all 30 |

The original normalTexture index 2 selects the exact PNG payload. No external normal PNG was returned; no conversion or rebake occurred. The GLB's ORM JPEG remains packed G=roughness/B=metallic. Native channel wiring and tangent convention still need explicit validation. `native_import_scale_required` is null because restoring this static original's size does not establish gameplay height. A later native scale must independently use the desired player height divided by the measured provider height, applying the same scale to body and clips.

[CorrespondenceTest.json](CorrespondenceTest.json) records a passed synthetic regression: unique UV/geometry correspondence, ambiguity rejection, 9.999µm acceptance, 10.001/20µm rejection, translated static positive without mutation, and origin-only/nonuniform/rotation/deformation negatives. A read-only second-agent review verified receipt/output/texture/recipe hashes and found no correctness blocker.

Actual generated files are in ignored `Saved/Tests/TripoH31Surface/BlackCap-v2/body`; log, executed recipe and original receipt are retained beside them. Root owns any fresh Data promotion.

## Motion

[Motion.json](Motion.json) and [MotionTest.json](MotionTest.json) pin the four actual animation-only FBXs, source references, copied corrected Jump and passed own-body surface receipt. The static original is 0.979425192m high; the motion reference is 1.819999786m. Hip deltas use `source_object_scale * (own_original_height / reference_height) / (provider_to_original_scale * target_object_scale)`, measured 0.005381457824. The surface recentering translation is not applied to motion deltas.

Both rigs are A pose. Gravity stays world+Z; the semantic source-to-provider frame is approximately `Rz(+90°)`, transporting all 22 component deltas and hip XYZ. Body lean is recorded separately. Only gait arm virtual references receive measured segment-direction corrections: upper 8.998°/8.149°, lower 11.375°/5.660° left/right. Hands follow the corrected lower arms through their own local binds. Provider data binds, torso and leg reference rotations remain unchanged. Idle/Jump use the existing anatomical v4 acting recipe on the actual new rig.

| Clip | Duration / fresh half-frame samples | Result |
| --- | --- | --- |
| Idle | 4s / 241 | Moving relaxed arms/fingers; minimum forward elbow delta 14.000013° |
| Jump | 1.2s / 73 | Matched Idle endpoints; minimum forward delta 14.000006°; inherited lower-body matrix difference 0 |
| Walk | 31/30s / 63 | Transported source gait; minimum signed elbow 4.159° |
| Run | 19/30s / 39 | Transported source gait; source step cadence retained |

All four actual binary FBXs declare 30Hz, exact durations and curve ticks within the existing one-tick bound. Fresh reimports retain61 bones, normalized finite poses, static root/object, original binds/local translations/scales, all 30 loose finger locals and loop/endpoint gates. The 416 half-frame pose comparisons use evaluated keyed target poses captured before export, not a noncommuting interpolation of raw source deltas. Maximum fresh pose matrix error is 0.000009001; Idle/Jump endpoint error 0.000004769.

The newly authored upper-body step gate passes: Idle 0.0955° and Jump 15.156° per30Hz frame. Inherited source Run reaches 35.541° upper-body and 63.339° overall per30Hz frame; these are reported and are not claimed under the 20° authored Jump gate. CPU matrices alone cannot establish natural-looking visible stride or deformation.

Preflight negatives reject tampered SHA, existing output/report paths, mismatched own-rig proof, failed surface proof, rotation fitting and applied provider transforms before creating output. The actual rig's forward/backward elbow sign controls also pass. Frozen pilot, current native pilot Content, original new Tripo inputs and reference body/gaits remain byte-for-byte unchanged.

Actual animation FBXs, executed recipes and logs are retained in ignored `Saved/Tests/TripoH31Motion/BlackCap-v1`. Surface recipe SHA is `1a8c1ade86f6773eb726f4aa7f9d27f3dfa129618e25dc7b9521e63a2934ad10`; motion recipe SHA is `cca7cdc012bde7585a57f9f8744d2bc5b8a95521a495bd2d264c2e599448733d`. Earlier comparison recipes were archived before adaptation. No provider, render, Unreal, GPU, native asset, package or service operations were performed by this preparation.

[FrameTest.json](FrameTest.json) separately checks proper heading, preserved gravity and component-delta conjugation; wrong untransported deltas, mirrored labels, opposed facing and upside-down references fail. An independent read-only code review found no blocker in the new motion route. Its stale historical comparison test was removed after preserving the exact original recipe; the passing current-body entry point is `Scripts/test_tripo_h31_motion.py`.

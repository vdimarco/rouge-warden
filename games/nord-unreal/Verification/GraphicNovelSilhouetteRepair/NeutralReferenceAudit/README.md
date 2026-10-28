# Neutral reference audit

The first headless prop calibration used a **non-neutral starting hand**. Its quaternion is17.3553246° from the native reference and both jump endpoints. The attachment formula is correct for that measured socket; it is unsuitable as a neutral, phase-independent persistent bake.

Run the read-only stdlib check from the game directory:

```sh
python3 -B Verification/GraphicNovelSilhouetteRepair/NeutralReferenceAudit/check.py
```

The script verifies SHA256 of the three existing curated inputs; no duplicated native dump, installed engine or Unreal process is needed. `Results.json` is the actual successful output. `Provenance.json` records the original/native/code source hashes and the evidence boundaries.

Use `Native/TrialReceipt.json`'s actual25-bone reference and37RAW local samples. Its passed native comparison proves reference preservation; both corrected jump endpoints equal that reference. Compose the validated24-bone CPU hierarchy with the extra static native Armature root above Hips:

`Armature → Hips → Spine02 → Spine01 → Spine → RightShoulder → RightArm → RightForeArm → RightHand`.

All quaternions use`xyzw`. Compose`componentQ = parentQ * localQ`, including the static Armature rotation. Installed UE5.8.3 `AnimPose.h:32–38` explicitly defines WORLD as component space. `AnimPose.cpp:564–584` initializes the USkeleton reference,`:240–245` populates reference component transforms, and`:288–295` returns them. Actual game-world reference requires the mesh component transform: `neutralHandWorldQ = meshWorldQ * referenceHandComponentQ`.

For this recorded fixture, native `ApplyCrewAppearance` sets mesh-relative rotation identity and `start_style` resets actor rotation to zero. The inferred component-to-world rotation identity is independently supported by42 actual pure-Jump hand observations: composing/interpolating the native local poses reproduces live hand-world rotation within0.000393–0.002497°. This crosscheck includes compressed runtime evaluation and five-decimal reported clip times; it is not an exact continuous pose proof. Initial mesh/actor full transforms were not independently recorded at the calibration instant, so identity at that instant also relies on those inspected setters. The later reference-derived helper must record the actual mesh world transform explicitly.

Reference hand component quaternion:
`[-.9378648152710662,-.3124863755584396,-.10953791638768545,.10374631675564644]`.

Recorded initial hand quaternion:
`[-.8848354782301255,-.4264924262529126,-.17894276525953356,.05612373451081554]`.

`inverse(initialHandQ)*targetWorldQ` reproduces the recorded relative quaternion within1.43e−14°. Using that relative quaternion at neutral shifts the cup axis7.053653° from the intended down/outside axis. In contrast, deriving from the reference yields:

- Relative quaternion`[.0746121380784118,.224637684893198,-.9553328060518326,.17694679725364926]`.
- Relative offsetcm`[-.7567321044396016,-5.467347089357475,10.655302545052614]`.

These values use uniform scale.6 and grip source-localZ=−20cm, so `offset = −relativeQ.rotate(0,0,−12cm)`. They are a mathematical basis for the separate reference-derived diagnostic, not native/pixel or persistent-art acceptance.

The precise starting cached/idle phase was not recorded. This audit establishes a non-neutral initial socket, without assigning a specific stale-pose cause. It does not prove camera clearance, closed grasp, swept collision, rendering, continuous fluidity or final character quality. Seven-state headless wrist alignment remains valid evidence for attachment algebra, independently of this neutral-reference failure.

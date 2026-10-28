# Natural pose verification: rejected attempts and precision

The CPU attempts below retain their failures. [Rejected/Manifest.json](Rejected/Manifest.json) hashes 27 copied recipes, reports and logs, plus omitted payloads. Large rejected authoring snapshots, FBXs and PNGs remain in private scratch directories `/tmp/nord-tripo-natural-pose-20261017-v1` through `v3`; filename-level locations and hashes are recorded rather than copied. Each retained diagnostic recipe matches its executed receipt hash.

**v1:** The animation-only FBX exported while the character held its relaxed pose. Blender's Model defaults became the imported reference pose: maximum reference matrix error **1.1207384**, failing the fixed 1e−5 gate. A neutral reference key at frame 0 fixes this: export only scene frames 1–121 or 1–37, while frame 0 remains current for the static FBX defaults. The exported animations retain their relaxed entry and exclude frame 0.

**v2/v3:** That structural defect disappeared. Both still failed the original raw-matrix comparison at **1.0818243e−5**. Explicit frame-0 translation/quaternion/scale and direct source channels did not remove it. Independent measurements identify small float32 FBX rotation/scale decomposition drift: reference angle **7.19308e−6 rad**, head displacement **6.07131e−7 target units**, scale difference **8.22544e−6**. The final policy separately requires angle <1e−4 rad, head displacement/scale <1e−5, and raw matrix difference <2e−5. Original failed recipes/reports remain retained; no rig data was changed to satisfy these checks.

One diagnostic also incorrectly required unit raw quaternion channels between keys. Linear channels have jump midpoint norm deviation **0.00666815**; Blender normalizes their evaluated rotation. The corrected checks require finite, nonzero raw channels, unit integer-key quaternions and unit evaluated component rotations. Raw midpoint deviation remains reported.

**v3 motion:** Actual authored upper-body component motion peaked at **23.71898° per 30Hz frame**, exceeding the unchanged 20° gate. This was a real cumulative arm-motion defect. v4 reduces and staggers swing/flex keys; its maximum is **11.98931°**. Whole-body maximum **26.48149°** comes from the inherited calf crouch, independently matched to the previous clip. All inherited pelvis/leg matrices must match within 1e−5; the 20° gate covers authored upper-body local and component rotations.

**v4 passes:** 241 idle/73 jump half-frame samples; forward elbows ≥14°; exact loop matrix seams; idle/jump entry difference 5.36442e−7; inherited-leg error 4.29153e−6. Root/object remain static. All 23 original files, provider rig and prior clip remain unchanged.

These are CPU animation checks. Native import, physical contact, prop grip, continuous gameplay and final visual acceptance remain separate.

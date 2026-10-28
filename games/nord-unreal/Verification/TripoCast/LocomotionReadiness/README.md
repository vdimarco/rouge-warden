# Remaining crew: source motion readiness

[LocomotionReadiness.json](../LocomotionReadiness.json) inventories the seven current accepted neutral sources for styles3–8 and10. A bounded four-thread Blender process checked copied inputs under ignored `Saved/Tests/TripoCast/LocomotionReadiness-20261017-v2`, exited0 and left all98 pinned source files unchanged. Exact recipe, full receipt, log paths and hashes are retained in the JSON. No provider request, rendering or native operation occurred. `passed` means the inventory completed, not that these old motions or a future model are accepted.

| Style | Source | Measured rest width × depth × height, m | Intended prop | Worst old jump elbow flex, ° |
|---|---|---|---|---:|
| 3 | GreenCap51 | 1.069 × .334 × 1.820 | Plunger | −59.73 |
| 4 | Memphis33 | .861 × .400 × 1.820 | Plunger | −61.80 |
| 5 | BlackCap | 1.197 × .406 × 1.820 | Plunger | −56.43 |
| 6 | WhiteCap | .909 × .360 × 1.820 | Plunger | −61.23 |
| 7 | RedJersey | .962 × .360 × 1.820 | Plunger | −63.33 |
| 8 | LimeJacket, current revision | .918 × .402 × 1.820 | PVC tube | −59.83 |
| 10 | Topknot | .982 × .388 × 1.820 | Plunger | −59.32 |

Each body has24 own joints and one material; all source triangle UV keys are unique at1e−6. Actual binary FBX metadata and Blender ranges agree at30Hz: Idle121samples/4s, Walk32samples/31⁄30s, Run20samples/19⁄30s, Jump37samples/1.2s. The inventory evaluates2,912 half-frame poses across all28 clips. Walk/Run references match their own body exactly. Their small loop seams are recorded rather than assumed zero.

**Both elbows bend backward in every retained Jump**, measured relative to each own bind using its forearm/face-derived hinge. Preserve these source files and author fresh corrected derivatives. Existing Idle loops have a roughly2.01e−4rad seam. WhiteCap Jump reference-scale drift reaches2.46e−5 and RedJersey1.001e−5; neither satisfies a new1e−5 scale gate. The first inventory's strict raw source-unit matrix assertion failed on WhiteCap and is retained; the completed inventory reports these differences without treating them as new-target passes.

For the rollout, pin each source body and its matching clips, measure scale/topology/UVs again for the actual new body and returned rig, and derive pose/finger axes on that rig. Reuse the existing component-delta and relaxed-pose methods; retain canonical `Armature`, a neutral reference outside the export range, explicit30Hz **after imports**, and actual binary timing checks. New high-detail bodies require their own source pairs and new receipts; these neutral measurements cannot substitute for those checks. Keep the merged pilot's sources, recipes and Resident9 assets frozen.

Import only fresh per-resident private folders, use one measured body/clip scale, and preserve default/live routes. Generalize the four-flag route and mandatory own-rig tests together; legacy24-bone fixtures must strip those flags. The source PVC tube is6.6×6.6×90cm, versus the plunger28.7866×28.7866×93.5cm. These are OBJ dimensions, not a fresh native readback: style8 needs its own prop calibration, not the pilot plunger's16×55cm target or grip offset.

Native movement, visible naturalness, hand/prop clearance and grasp, package/performance, browser/device and off-LAN acceptance remain open. No source model/script, existing native asset or live package was changed.

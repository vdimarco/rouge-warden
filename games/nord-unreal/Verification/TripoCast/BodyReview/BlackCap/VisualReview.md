# BlackCap original-body review — 17 October 2026

Compared the [current clean reference](../../../../Data/GraphicNovel/Crew/BlackCap/reference.png) with all eight actual CPU views: [front](front.png), [three-quarter](threequarter.png), [side](side.png), [back](back.png), [face front](face-front.png), [face three-quarter](face-threequarter.png), and [left](hand-left.png)/[right](hand-right.png) hands. These retain the original source GLB geometry and embedded PBR material in neutral bind.

The stocky adult, complexion, full dark beard, black cap/T-shirt, charcoal cargo shorts and dark shoes remain recognizable. Cargo pockets have projecting form and the body reads as adult rather than a caricature. Facial detail is softer than the reference; the eyes remain visible through the glasses, but that does not establish independently controllable eyes or lenses.

**Visible source defect:** the face close-ups show thin extra/dangling temple-like geometry curling below the glasses beside the cheek. The rectangular frames also become rounder, and the cap crown/brim are simplified. This is a generated surface defect, not a material-preview or rigging result; a Tripo rerig must not be assumed to remove it. Root should inspect these close views before deciding to pay for a rig of this exact body.

The hand crops show four rounded long-finger ends with shallow gaps and large palm/thumb masses; thumbs lie close to the palm and webbing remains broad. Five fully separated, independently deforming digits and a prop grasp are not proven. Cloth folds, cargo seams, shoes and rear design are generated approximations, with movement/intersections untested.

**Readiness:** usable for the free biped compatibility check. Hold paid-rig acceptance pending root's explicit review of the glasses defect; if retained as a bounded rigging trial, the defect and coarse hand geometry remain open. This does not establish final body/hand art, native or motion acceptance.

[Review.json](Review.json) records actual geometry/material/image hashes and eight PNGs. Source GLB SHA-256: `310b173814108907c7041dbfc51bb0f5228a9b94a7a3323ac7b87243f6fe5a6c`. Cycles CPU, four threads, 16 samples, no denoising, 512×640; [render log](render.log) confirms completion. Full copied input/run remain ignored `Saved/Tests/TripoCastReview-BlackCap-20261017-v1`; horizontal orthographic cameras keep the lower body unoccluded. Original source, material pixels and evaluated geometry remain unchanged. No provider/GPU/Unreal/service action occurred.

# WhiteCap original-body review — 17 October 2026

Compared the [current clean reference](../../../../Data/GraphicNovel/Crew/WhiteCap/reference.png) with all eight actual CPU views: [front](front.png), [three-quarter](threequarter.png), [side](side.png), [back](back.png), [face front](face-front.png), [face three-quarter](face-threequarter.png), and [left](hand-left.png)/[right](hand-right.png) hands. These use the original source GLB geometry and embedded PBR material in neutral bind.

The stocky adult, beard, rectangular dark glasses, white backward cap, black shirt, gray shorts and gray/white shoes remain recognizable. The body has credible adult proportions; the face is smoother and less detailed than the reference, with a restrained closed mouth. Brow creases remain. The glasses have visible frame/temple volume and eyes remain visible, without the conspicuous dangling cheek loops seen in BlackCap's source. Independent eye/lens geometry and facial controls are not established.

The white cap retains its front strap opening and rear-facing brim, but the crown/panels are faceted and mesh/stitch detail is simplified. Shirt/short colors and shoe shapes remain consistent; cloth boundaries, cap/face fit and feet have only been viewed in bind, without collision, motion or deformation checks. The single front reference does not establish exact rear surfaces.

Hands are a significant limitation. Each crop has a separate thumb, but the long fingers form a close, paddle-like mass with shallow valleys and broad webbing; fingertip steps do not establish fully separated digits. A Tripo rig can only be accepted after actual weighted-finger deformation checks and cannot be assumed to remodel the surface. A prop grasp is untested.

**Readiness:** suitable for the free Tripo biped check and a bounded rerig trial after root's independent review, retaining the coarse-hand and cap-detail limits. This is not final body/hand art, native or motion acceptance.

[Review.json](Review.json) records actual geometry/material/image hashes and eight PNGs. Source GLB SHA-256: `3d492478c8c46998049520448d290880b839178237f8e4745da91a915f15e35c`. Cycles CPU, four threads, 16 samples, no denoising, 512×640; [render log](render.log) confirms completion. Full copied input/run remain ignored `Saved/Tests/TripoCastReview-WhiteCap-20261017-v1`. Horizontal orthographic directions keep the lower body unoccluded. Original source, material pixels and evaluated geometry remain unchanged. No provider/GPU/Unreal/service action occurred.

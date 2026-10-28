# RedJersey original-body review — 17 October 2026

Compared the [current clean reference](../../../../Data/GraphicNovel/Crew/RedJersey/reference.png) with all eight actual CPU views: [front](front.png), [three-quarter](threequarter.png), [side](side.png), [back](back.png), [face front](face-front.png), [face three-quarter](face-threequarter.png), and [left](hand-left.png)/[right](hand-right.png) hands. These retain the downloaded GLB's own neutral-bind geometry and original embedded PBR material.

The lean adult, moustache/small goatee, backward navy cap, blue sunglasses, red baseball jersey, black shorts and white shoes remain recognizable. The face is smoother and less lined/stubbled than the reference. Closed lips remain restrained, but there is no face animation. Glasses have visible frame/temple volume and blue lenses; the bright sky-like reflections are generated surface appearance, not proof of runtime glass or eye geometry.

The white W chest emblem, navy/white collar/cuff piping, front seam and button indications remain readable. Fine stitch/button detail is approximate, and material/lighting changes the perceived red saturation. The rear shirt is plain, an inferred design from the single front reference. The side/three-quarter views expose an overly long, downward-sloping rear cap brim; head/neck clearance during movement remains unchecked.

Both hand crops reveal a distinct thumb and rounded finger ends, but long fingers lie together with shallow valleys and broad webbing. Five fully separated, independently skinnable digits and a prop grasp are not established. The full-body front hands are nearly edge-on, so those views alone would overstate readiness.

**Readiness:** suitable for the free Tripo biped check and a bounded rerig trial after root's independent review, retaining the coarse-hand and cap-profile limitations. A rigging pass cannot be assumed to repair their geometry. No native, motion or final-art acceptance is implied.

[Review.json](Review.json) records all actual geometry/material/image hashes and cameras; source GLB SHA-256 is `36cb56d15c07cac1d4533c1964eb42028a3c0d11da52a797859ab2f93c37175c`. Cycles CPU, four threads, 16 samples, no denoising and 512×640, with [normal completion](render.log). The full camera-corrected run is ignored `Saved/Tests/TripoCastReview-RedJersey-20261017-v2`; prior v1 is retained. Current horizontal orthographic directions keep lower legs/feet unoccluded. Original source, material pixels and evaluated geometry remain unchanged. No provider/GPU/Unreal/service action occurred.

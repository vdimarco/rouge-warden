# Natural pose visual review

Reviewed the six actual v4 CPU images from `/tmp/nord-tripo-natural-pose-20261017-v4/Views/`: idle three-quarter/front/side, jump three-quarter/side, and left-hand close-up. `Views/Readback.json` identifies the reviewed clips as idle `f5cf127b897cd54b52676932ff89461033becf1a19e8cf109a33d30c8958dfbc` and jump `11b1f85e5d84f38ab6aa4e17ff951116a43cd16b08bfa02938ad0e781010ace1`. Idle is sampled at 0 seconds; jump at 0.4667 seconds. Also compared the retained earlier apex and the actual v3 images.

The standing silhouette is visibly less rigid than the original neutral: shoulders sit lower, upper arms follow the torso, elbows remain softly bent, and hands hang beside the thighs rather than forming flat straight paddles. Front and side views support this assessment. Small shoulder and hand differences avoid exact bilateral symmetry. Compared with v3, bringing the thumbs closer to the index fingers reduces the large C-shaped hand opening without turning the hands into fists.

The v4 jump apex improves on both earlier versions. The original apex presented an outward open palm; v3 held both hands forward at similar height, reading like handlebars. V4 separates the arms in depth and height: one hand stays near the thigh while the other is farther forward. Both elbows bend forward, and neither arm forms a rigid horizontal bar. The side view confirms this separation. The legs and overall flight silhouette remain similar to the previous compact jump.

Remaining limits: the hand close-up still shows broad, partly merged finger contours, coarse knuckles/webbing and a visibly curved hand shape. Pose changes cannot establish finer source geometry. The torso, head and facial acting remain restrained, and the airborne stance still looks upright. These stills establish a more relaxed pose, not convincing full-body jump timing, weight transfer, foot contact or continuous natural motion. No prop fit or functional grasp was reviewed.

These are CPU previews using restored original GLB materials and preview-only height normalization. Provider corner-normal/material export issues are unchanged. This review does not accept native import, gameplay blending, performance, or final art; continuous-motion review is separate.

## Rendered frame sequence

Also reviewed all 127 rendered frames through the three contact sheets `frames-000-048.png`, `frames-049-097.png`, and `frames-098-126.png` in the v4 `Review` directory. They cover the four-second idle and 1.2-second authored jump sequence; the encoded preview presents 127 frames at 24 fps (5.291667 seconds). The raw frames are retained under `Saved/Tests/TripoNaturalPose-20261017-v4/Motion`.

The idle changes remain subtle across its frames: the relaxed arm position is sustained without a large repeating arm gesture. Through the jump samples, the hands remain staggered, the elbows stay forward, and the arms return to the relaxed standing silhouette at the end. No repeated handlebar pose or return to the original flat-palm apex is apparent in these contact sheets. The inherited compact crouch/foot changes remain brisk, and the torso still contributes relatively little acting.

This is a bounded visual review of a CPU-rendered frame sequence. Contact sheets do not establish playback timing, temporal smoothness, convincing momentum or fluid native continuous motion. The preview lacks actor ballistic flight, physical foot contact and native state/blend transitions; those require separate gameplay validation.

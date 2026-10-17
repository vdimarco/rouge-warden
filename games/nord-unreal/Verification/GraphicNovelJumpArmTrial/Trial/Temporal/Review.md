# Jump-arm trial: sampled temporal review

The sampled trial retains the reduced arm raise, but introduces a visible prop-readability concern in the side view: the red plunger head passes across or very close to the mouth/face during the selected jump frames. This supplements the front-still shoulder gain; it does not support adoption. Three-dimensional penetration is unproven.

All four actual contact sheets were inspected: [baseline Standard](BaselineStandard.png), [trial Standard](TrialStandard.png), [baseline Comic](BaselineComic.png) and [trial Comic](TrialComic.png). Each contains thirteen selected frames at nominal video times4.4–6.8s, every0.2s: source presentation-frame indices264,276,288,300,312,324,336,348,360,372,384,396,408. The exact frame indices, integer PTS, time base, PTS seconds and decoded-frame hashes are in [Selection.json](Selection.json). The same fixed source-pixel crop `(740,280,1240,1060)` makes the body and prop legible; full1920×1080 selected frames remain under ignored Saved.

The trial's upper arms remain lower through the sampled central jump interval, with a less extreme shoulder/sleeve silhouette. Angular sleeve/upper-arm junctions and rigid open hands remain. In Standard, the trial prop head visibly covers part of the face at frame312/PTS5.2s; nearby selected5.0–5.6s frames keep it across or close to the face. The baseline5.2s prop is separated in front of the face. The trial's lower handle also approaches the bent knee in projection. These images establish occlusion/proximity, not collision or3D intersection.

Both sets show raised/crouched airborne poses, lower arms again around nominal6.0s, and subsequent reorientation/recovery samples at6.2–6.8s. No gross detached limb or exploding-body defect is visible in the selected frames. The crops and sample spacing cannot clear contact, foot planting, hidden armpit geometry or intermediate poses. Different recovery timing and motion blur, particularly baseline Standard near6.2s, prevent treating equal video timestamps as identical poses.

Comic retains the arm/prop placement change. Its large native “HOP!” graphic obscures part of the arm/prop region in selected4.8–5.4s frames. Strong body/prop outlines, dense background ink and occasional thin shadow marks remain in the samples; temporal shimmer, line stability and shadow continuity cannot be judged from these static selections. Collar microgeometry is too small in these side/body crops for a new collar verdict. The fixed crop also limits full viewport/HUD/camera assessment; two original full-resolution Standard5.2s frames were additionally inspected.

All four jobs were individually passed, their native processes and recorders exited0, and each native report's transition checks passed before decoding. Only software CPU decoding was used, with decoder2/filter1/PNG-encoder1 threads, serialized per video. Native events place jump roughly4.74–4.79s after the idle event and landing roughly6.02–6.08s after idle. There is no verified mapping from that native clock to source video PTS. The sheets use approximate nominal-time comparison, not synchronized native phase comparison.

| Source | Encoded frames | Duration | Encoded rate |
| --- | ---: | ---: | ---: |
| Baseline Standard,144012Z |601|10.016667s|60/1|
| Baseline Comic,144012Z |571|9.516667s|60/1|
| Trial Standard,145346Z |571|9.516667s|60/1|
| Trial Comic,145346Z |571|9.516667s|60/1|

Every source is H.264,1920×1080. Encoded60fps is not measured native/game FPS. All four source-video SHA256 values match the passed-job receipts and remain identical before decode, after sheets and after review:

- Baseline Standard: `4dca101f2952b61b3fe74fcd17e5b1801cc4bd774c67995f140d07c055050995`
- Baseline Comic: `4c0c5e56363563927eda9d6fac90493956c3f1e47c1b1b78f8042ae4b005f70b`
- Trial Standard: `bf95b2020381df0fdfa1bfe3e39cc9dd87b5a4abd4f9cd30231991f1a330d138`
- Trial Comic: `3cc28e44c9984821520fa3c58c92b676705a47d2a8b3e6eb3c15c7662fce2c74`

This is52 selected frames, four contact sheets and two additional full-resolution frame inspections. Continuous playback, fluidity, audible playback, exact prop contact, native FPS, packaged behavior and final graphics acceptance remain unreviewed. No engine, GPU, service, paid-generation or adoption action was performed by this reviewer.

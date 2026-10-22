# Design and sources

The existing shaft algorithm adapts [GPU Gems3 chapter13](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process). Its local output is multiplied by(1-here), where smoothstep bounds here to[0,1]. Guard the gather with here<1.0: partial edges still run all16samples; only an exactly zero contribution is skipped. No sample count, weight, buffer, scene or artwork changes. XR already bypasses this post-process and remains unchanged.

Two preliminary activated-sun30s comparisons showed16–19% lower GPU time, but are not release acceptance. Require recorded hardware renderer, three matched60s repetitions per workload, activation assertions, FPS/tails/longframes/input-to-submit measurements and same-frame pixel equivalence. Keep actual affected Chrome acceptance open. Compare normal current-runtime play and controlled fixed-resolution pressure separately; never infer benefit from an inactive sun path.

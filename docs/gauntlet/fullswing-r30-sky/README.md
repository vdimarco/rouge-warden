# Round30: zero-contribution sun-shaft gather

**Full release measurements are in progress; no acceptance claim yet.**

The existing shader computes16radial samples on fully sky pixels, then multiplies that contribution by(1-here), which is exactly zero there. Guarding the gather with here<1.0 retains the original samples/weights on city pixels and partial sky edges. No resolution, effect intensity, geometry, artwork, input or XR-path change.

Two preliminary activated-sun30s/15input comparisons under artificial6draw pressure gave GPU medians24.79/24.02→20.02/20.07ms and FPS33.88/34.03→38.18/38.50. These are diagnostics, not full60s/35input/three-pair acceptance. An earlier camera facing away from the sun did not exercise the path and cannot establish benefit. A separate stencil-copy trial had no consistent gain and was rejected.

Functional same-frame reference/candidate comparisons pass at640×360 and390×844 for active/inactive sun and comic effects full/off, with zero differing RGBA bytes in all eight cases. The reference forces the guard true, preserving the previous unguarded formula. This is functional coverage, not hardware performance or physical-device evidence. Recorded NVIDIA hardware equivalence and three matched normal-play/controlled-pressure pairs are running serially. Normal tests retain the current adaptive controller; controlled6draw tests disable it equally for both variants to isolate shader cost at fixed resolution. Sun activation is asserted; inactive-path measurements are rejected.

Actual user-profile Chrome/high-refresh/input-to-photon behavior remains unverified. Prior performance target misses remain disclosed; no inherited passing hardware scores or current rubric total. Full raw data, visual evidence and all review/CI/current-preview/rebase gates remain required before merge. OpenSpec CLI unavailable; proportional scenario artifacts reviewed manually.

# Tasks

- [x] Address PR #611 review: suppress spill from blank bays and incomplete top-floor rows, then repeat the render check.

- [x] Print a warm pool around a lit window after the grade, and warm the hem of a lit shop's cloth
- [x] Photograph the street before and after, and confirm a shop or pier crop actually changes
- [x] Run `qa/vr/render.mjs` and record the street luminance (street mean 75.8, saturation 0.59, canyon ink 26.7%)

Review correction verified locally on 2026-10-21: before and after `qa/vr/render.mjs` each passed all 50 checks. Corrected street mean 70.6, saturation 0.59; canyon ink 26.9%. City, physics, target and mobile Node checks passed. OpenSpec CLI unavailable; structure reviewed manually.

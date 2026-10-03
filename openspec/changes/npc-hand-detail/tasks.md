# Tasks
- [x] Replace mitten geometry with palms and fingers.
- [x] Validate model budgets, skeletons and rendered hand appearance.
- [ ] Validate/archive with OpenSpec CLI when available.

`qa/crimson/cast.mjs` passes in local Chromium: all procedural variants remain within 2k–5k triangles (3196–4024), 24-bone compatibility, retargeting, props, poses, LOD and lifecycle checks pass. Close-up `/tmp/crimson-npc-hand-detail.png` inspected: four separate fingertips and a thumb are visible. No additional hand joints or draw calls; fingers remain rigidly weighted to the existing hand bone. Imported crew models are unchanged. Browser plugin not available; used Playwright. Physical phone/performance not tested; OpenSpec CLI unavailable.

# Design

Shared lanes.js defines indices 0–4, center 2 and unchanged 3.8 m spacing, plus laneToX/xToLane, count, extrema and playable width. Simulation starts at center 2; actual and visual positions keep the existing analytic spring and all inputs clamp at the new edges. Broaden CPU and GPU river halfwidth by 3.8 m and frame all five lanes on supported screens. Both renderers use the shared physical mapping; pickups retain the exact existing contact radius and height rules.

Hazard routes and moving enemies use all five lanes without changing accepted action windows or pace. Native branches keep their one/two/three-lane anatomical variants. Full canopy rows consist of opposite-bank 3+2 trees (seeded which bank gets three), covering the river without oversized native scaling; a row still awards one duck and one collision outcome. Warning text distinguishes partial three-lane limbs from full five-lane canopies. Finish piers sit beyond the five-lane envelope.

Coin patterns use deterministic bounded layout generation. Straight ribbons, adjacent recovery sweeps, staggered zigzags and split/fork/offbeat choices must be geometrically distinct. A reachable primary route moves only when there is enough time, while simultaneous alternatives are clearly optional. Jump rewards remain tied to their real jump arc and no ground coin is bait inside a rock or conflicting jump. Cap per-row rewards and renderer pools; vary layout rather than flood the scene.

Restore Menu.jsx/styles.css to their pre-restyle c167d97 versions and remove the rejected hero from runtime assets. Other help/accessibility copy adapts to five lanes; the campaign stays exactly three maps.

Preserve the analytics loader already added to public/river-rush/index.html by upstream main 8e2eff4. Carry its identical tag into the source HTML so rebuilding does not remove the existing arcade integration.

Check seeded whole-map fairness, lane bounds, enemy/contact alignment, coin geometries/reachable routes and row-level paired-canopy rewards. Build and check actual keyboard/drag/reversal/jump/duck on phone 390×844, desktop 1365×900 and landscape 844×390 with one browser owner. Separate controlled renderer fixtures from natural App runs. Inspect all five lanes, outer rider bodies, branches, gold and finish; verify title controls. Publish exact bytes, review canonical delta and archive. OpenSpec CLI is unavailable; use manual structure checks.

# Visible tradeoffs verification

The bank now pays eight actual ordinary coins instead of a small fixed score stash. The landing detour's +200 points compete with eight seconds of Gold Boost; the sheltered snatch's +120 points compete with one nonstacking shield. Opposite-lane stashes and powers share their exact distance and require grounded contact within 0.95 m. Larger comparisons show the foregone benefit, return and held-power state. World labels distinguish coins from fixed points.

## Gameplay and rendering

**282 unit tests passed**, with zero failures or skips. Coverage includes 72 spring-controlled stash/power pairs across all maps, 30/60/120 Hz and maximum future Rush; 120 bank economy comparisons with eight ordinary tokens; 27 bank/guard qualification pairs; 108 detours and 108 snatches with 180/234/288 ms delayed returns. Strict airborne/adjacent misses, ordinary power behavior, coin goals, nonstacking shields, full maps and naturally earned Rush passed. Prepared geometry tests remain within existing bounds. The final arcade build passed; existing shared plain-script/chunk-size warnings remain.

The Browser plugin is absent, so regular Playwright Chromium/SwiftShader was used. Source fixtures explicitly own their isolated state and clock and render the actual Hud over generated spring trajectories. **21 policies and 20 captures passed**: 15 matrix WebGL views, two held-shield/boost-refresh views and three fallback views. All three maps, portrait 390×844, landscape 844×390 and desktop 1365×900 were checked. Benefits, missing alternatives, readable bounds, pointer transparency, reduced motion and exact stopped drawing passed. Counters stayed at 56 texture uploads and 84 shader programs; maximum reduced-path submission was 117,313 triangles and 54 calls, within the existing 125,000/65 budgets. The landscape card partly covers the upper-left channel horizon; the raft and lower channels remain open.

A native App phone run retained original seed 555849855, clock and protection. All ten models were ready. Keyboard and an actual 4→3 drag through the comparison hit the game canvas. Gold Boost paid eight seconds, the eight-coin bank paid 220 points from individual values [20,20,20,20,20,40,40,40], and the base cache paid 200 after two required clears. Exact pause status/pixels matched. Counters stayed 56/84; 34 samples peaked at 111,752 triangles/47 calls. No impacts, page/GPU errors or public score posts occurred. This exact local play used `index-cK9xwG5D.js`, before two copy-only refinements clarifying retained shields and missed boost refreshes. The final two copy-state screenshots passed separately. Engine, geometry and controls were unchanged.

Independent review found no blocking gameplay or resource issue. “Keep clean +400” now describes the deferred bonus without claiming one guard alone earns it. Canonical delta validation passed directly: 58 requirements, 137 scenarios, one modified requirement and four WHEN–THEN scenarios. OpenSpec CLI is absent; no CLI check is claimed. Hardware phone FPS, physical touch sensors and human enjoyment were not measured.

## Publication and final live check

Code commit `9c296e275929857a0c539b4ce7501326bd07ac4d` was pushed to GitHub main. Deployment `dpl_AP6pat1NnMHYTChPfVcJqdQuzXpZ` is READY and owns the production alias. HTML, JS, CSS and approved title image were all HTTP 200 with correct MIME and exact local bytes.

The final production smoke used `index-u8BvqzOE.js`, byte SHA256 `873995348d1202f7100257a17ba0e4978742ac3d19002f8d1ba3eed37446dae0`, with both final copy tokens present. Ten models loaded, keyboard 2→3 and canvas pointer 3→2 worked, and native seed 556363496/clock stayed untouched. Exact pause status/pixels matched; pause modal was settled and hidden solely for canvas comparison. Pixel SHA256 was `990357de54316d6d59708c5ff0ae45d01d8dfd16b66c7776129a373c6e32b680`. Counters stayed 56/84; submission was 90,676 triangles/31 calls. No impacts, page/GPU errors or score posts occurred. Browser closed.

An initial auxiliary Node HTTP byte request was refused before any controls. Its original failed report is preserved; a fresh same-origin browser request and independent Python HTTP checks succeeded. That failure is not reported as a passing native run. The final passing raw report SHA256 is `29fd63e7205e091d304e166cb924d9da5449439a1a5cec32e4f9d86c4347b1b5`.

Completed work is archived with canonical requirements merged. The archive commit changes only evidence/documentation; the product manifest freezes the published source and assets.

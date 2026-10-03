# Verification

## Implemented and checked

All 18 `qa/tidebreak/*.test.mjs` suites pass. The simulation suite completes 36 matches across all twelve heroes and three seeds. Every match finishes with finite, bounded entities, both realm phases, hero fights and damaged wards; seeded replay remains deterministic.

Focused scenarios cover independent root/stun/silence/disarm behavior; cursor coordinate conversion at 1440x900, 390x844 and 844x390; thumb placement distance; accurate ground and movement endpoints; deliberate touch cancellation with movement retained; all 48 skill previews; commitment, resource-free interruption and forced displacement; retained Omen/Soul thread targets; mark expiry and useful follow-up cues; shield/combo/opening results; neutral locked attack shapes, dodge, line of sight, recovery and boss escalation; delayed bot reactions to both cast and pending ground warnings; active-field urgency; supported objectives and ally protection.

`node --check` passes for main, simulation and renderer. `git diff --check` passes. No dependencies or art were added by this combat change. The branch includes the concurrent `main` update that renamed the game to Shore of the Ancients and polished its selection art.

## Combat-fun follow-up QA

GitHub Actions run 37129321686 passed on commit `40634656b4ac8ba99584cc81f15900be1f7c5d6a`. The focused check ran JavaScript syntax validation, `git diff --check`, `qa/tidebreak/combat-decisions.test.mjs`, `qa/tidebreak/tactical-combat.test.mjs`, and the Crimson opening-reward unit suite. The Shore tests now explicitly verify the 0.26 s committed-cast recovery, the 0.34 s ultimate recovery, zero added recovery for defensive casts, and bot/player recast blocking until the recovery expires.

The Vercel preview for the validated gameplay head returned HTTP 200 for `/tidebreak/`. This verifies deployment and route availability only; it is not a rendered interaction check. The viewport, multi-touch, visual clarity and subjective timing playtests listed below remain open.

## Rendered checks blocked

The intended flow is `/tidebreak/` → learn Baba Yaga's ground skill → aim/cast or cancel while moving → observe correct mana, cooldown and aim cues on desktop and touch layouts.

Browser plugin not available. Local Playwright 1.62.1 used the already installed Chromium executable and attempted two launches. Chromium aborted before page load with `process_singleton_posix.cc(292): socket() failed: Operation not permitted`. The second attempt with `--no-process-singleton` produced the same failure. No page identity, console, screenshot, viewport-fit or real multi-touch result is claimed from these attempts.

Vercel reported a successful branch deployment. A managed cloud-browser navigation to its `/tidebreak/` route redirected to Vercel sign-in. No authentication or deployment-protection settings were changed. The page and live controls could not be tested through that route.

Remaining: rendered 1440x900, 390x844 and 844x390 checks; real concurrent touch input and cancel gestures; console/asset health; visual mark/warning/result clarity; listening to sound cues; physical-phone performance. These require an accessible browser session. Keep the PR in draft and the OpenSpec change active.

## Spec structure

Manually checked the proposal, design, task checklist and two capability deltas for requirement/scenario structure. The OpenSpec CLI is unavailable, so CLI validation has not run. Canonical specs should be updated and the change archived after the remaining rendered scenarios pass.

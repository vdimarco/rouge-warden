# Six-hour district and graphics continuation

Authorized window: 2026-10-14 14:09:15–20:09:15 UTC (10:09–16:09 Montréal).
Checkout: `/home/von/Work/rouge-warden-nord-graphic-novel`, branch `codex/nord-district-polish-six-hours`.
Recurring follow-up: `nord-polish-and-college-street-expansion-six-hours`, every twenty minutes until the deadline.

PR [349](https://github.com/vdimarco/rouge-warden/pull/349) merged at 14:11:43 UTC as `e5cbe480897af4a75ab41c409751b661794da396`. Its native graphics QA passes; finished art quality and continuous fluidity remain unaccepted. See [higher-detail pilot](GraphicNovelHighDetailPilot.md).

## Current work, 15:24 UTC

- Root owns Git, engine/build/render windows and service restoration; all UE jobs are serialized. CPU agents independently review fixture and art limits.
- Toronto has a fresh saved map: 12 exact mesh groups, 185 retained Nanite trees, original eight-mesh Sneaky Dee’s façade, four starts and a native starter car. Additive fresh verification passes; all pre-existing assets were preserved at that checkpoint.
- Toronto runtime selects its own spawn, recovery, radar and HUD, suppresses Montréal campaign/water/population, and preserves explicit launch routes. Actual owned two-peer headless PIE passed 32 checks, including walking, car entry/throttle/brake/handbrake/exit, replicated character selection, falls and a negative Montréal-objective interaction. Disk save hashes stayed unchanged. Fixture placements are logged; physical input and rendered acceptance remain pending.
- Five bounded Toronto render windows failed on viewport geometry/readiness and restored the live demo. No native Toronto PNG has yet been accepted. The latest frozen fixture measures the physical X11 display, compensates client window chrome once, and waits for both connected native pawns before enforcing the exact map identity. Real X11 exposed a full-quality two-peer allocation OOM before readiness. A separate single-player immersive capture is being added; two-peer headless behavior remains the networking evidence.
- Montréal now opens the existing surveyed 200 m eastern strip. Native authoring and independent fresh readback pass: 40 new mesh assets, 54 actors after the checked boundary repair, ten old closure decorations hidden and the retained east wall moved exactly 20,000 cm. Original actors, other existing Content, sources, saves and seven settings files are preserved. The new radar contains all 663 original road rows followed by 143 extension rows. Native former-edge walking, starter-car crossing/braking/exit and walking containment pass. The stricter running jump escaped the retained 200 cm east wall by over 4 m. The preserved original-wall upper cap and taller new north/south strips are saved and fresh-verified. The same running-jump test now passes with actual airborne wall contact; all 19 native extension checks pass with 110 residents and 16 traffic cars active. The repair changes only the two new strips and adds one cap; all other actor states and assets are preserved.
- The current native module is SHA256 `163f26ff17c83e3fce410c25c2b8a2042b2746cb692d0f671179973cbd6eb8b8`. All 29 tests passed before the radar addition; the new district fixture passed warning-free after world-context repair. The expanded rerun passed 27 plain successes plus two existing fixture warnings, zero failures.
- Montréal authoring backup: `Saved/Recovery/montreal-east-20261014T150229Z`. Author/fresh receipts: `Saved/Tests/DistrictRuntime/AuthorEast/` and `VerifyEast/`.
- The higher-detail collar derivative remains CPU-only; its limited improvement does not justify promotion. The body violet-wash reduction is source-only pending matched native A/B; no native material has changed.
- PR 353 browser recovery is integrated through `64c8c31f`; the separate mobile task is idle. Public browser still runs the preserved Montréal package. A fresh isolated Development two-map cook is active. Package execution, rendered views and publishing remain pending.

## Failures retained and corrected

The first fresh Toronto verification rejected a real source/export defect: OBJ-precision clipping slivers collapsed into zero-area faces and Unreal removed them. The exporter now removes collapsed/collinear vertices at its actual output precision, with a focused regression test. The original import is retained under `Saved/Recovery/toronto-degenerate-import-20261014T142831Z`; first authoring and rejected verification logs remain under `Saved/Tests/DistrictRuntime/`. Clean reimport and unchanged strict triangle checks pass.

Native automation completed successfully, but the first report parser rejected Unreal's UTF-8 BOM. The original report and failed parser result are retained; corrected UTF-8-sig readback confirms 26 plain successes plus three successes with fixture warnings, zero failures. A separately rebuilt/rerun district-only check confirms three plain successes after registering the test worlds with the engine.

The separate mobile-browser task owns its live checkout and frontend deployment. Preserve its files, both streaming slots, package/saves, public/Funnel/TURN services and container. Inspect its status and actual resources before a bounded GPU maintenance window. Run fresh NullRHI authoring before fresh Vulkan review, serialize engine jobs, snapshot/restore editor settings before commandlets, and require the existing 12,000 MiB free-VRAM gate.

No new paid generation. Existing authorization is US$25, with US$4 reserved for two completed jobs and US$21 uncommitted; actual billing balance is unverified.

## Next checks

1. Finish expanded automation, then run the headless native Montréal crossing/car/boundary suite with real population and collision active.
2. Retry Toronto at exact 720p/1080p and inspect all native HUD and façade images. Keep the live demo restored after each bounded window.
3. Capture baseline character colour, author only the private candidate material in NullRHI, and evaluate matched still/motion A/B before accepting the one-line wash change.
4. Cook/launch/join both implemented district routes, preserve existing packages and saves, save verified Git increments/PRs, and update this log after each checkpoint.

At the deadline, stop new development, safely finish/stop only owned jobs, restore the demo and report measured results and remaining limits. Do not infer completion of unchecked tasks from this log.

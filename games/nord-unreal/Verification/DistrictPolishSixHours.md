# Six-hour district and graphics continuation

Authorized window: 2026-10-14 14:09:15–20:09:15 UTC (10:09–16:09 Montréal).
Checkout: `/home/von/Work/rouge-warden-nord-graphic-novel`, branch `codex/nord-district-polish-six-hours`.
Recurring follow-up: `nord-polish-and-college-street-expansion-six-hours`, every twenty minutes until the deadline.

PR [349](https://github.com/vdimarco/rouge-warden/pull/349) merged at 14:11:43 UTC as `e5cbe480897af4a75ab41c409751b661794da396`. Its native graphics QA passes; finished art quality and continuous fluidity remain unaccepted. See [higher-detail pilot](GraphicNovelHighDetailPilot.md).

## Current work, 16:11 UTC

- Root owns Git, serialized engine jobs, GPU windows and service restoration. Core district implementation is checkpointed at `33cb86c7`; the verified polish increment and fresh package checks are in progress.
- Toronto is a separate playable free-roam map with12 base mesh groups,185 retained Nanite trees, four starts and a starter car. The original eight-group Sneaky Dee’s façade has corrected readable signs. Independent native720p/1080p review accepts the scoped lettering checkpoint and the map-only Path `cast_shadow=False` fix; generic corridors, road-edge bands and thin seams remain unfinished. See [district visual review](DistrictExpansion/review.md) and [shadow review](DistrictExpansion/PathShadowReview.md).
- Toronto’s fresh map verifier now reads all four exact300cm boundary cubes and four native outward hits. All35 owned two-peer headless checks pass: original32 plus source-derived running approach, actual airborne contact and strict capsule containment at one outer boundary. Native map reports20 checks. No physical-input or complete perimeter-jump claim.
- Montréal opens the retained surveyed200m eastern strip:40 new meshes,54 actors,143 new radar road rows after the663 unchanged originals. All19 native crossing/car/boundary checks pass with110 residents/16traffic and active campaign state. The original200cm east-wall running-jump escape was repaired with an upper cap and taller new north/south strips; old actor states are preserved. Latest current canonical map readback passes after accepted graph/lettering/shadow changes. Disk load/write is suppressed for these fixtures, so this is no production persistence claim.
- All eight original playable crew now have saved native locomotion graphs. Fresh authoring/readback and all30 native tests pass (28plain, two older warning fixtures), with the old bodies/rigs/clips preserved. See [motion evidence](CrewLocomotion/README.md). Park resident single-clip animation remains unchanged.
- The private high-detail character’s matched7 Comic720p stills and1080p1x motion/CSV trial pass native checks and exact restoration. Root and independent still review accept only reduced violet body wash; shoulder/sleeve deformation and chipped collar still block default promotion. Short editor CSVs do not meet a60FPS target. Final trial evidence curation is in progress.
- A fresh isolated two-map Development archive built at `Builds/District-20261014T160237Z/Archive/Linux` in42s. Its initial parent settings guard failed; all seven files were restored exactly in a separate retained recovery, and source Content/saves were preserved. Current package QA passes Montréal standalone/listen/join, selected native graphs and vehicle controls. Toronto exposed a fixture error that counted all bodies on live components after cycling; per-selection readback correction/native retry is pending. No current package or public-release acceptance yet.
- Public browser still runs the preserved Montréal package. PR353 plus its verification archive are integrated through `64e0e72e`. No new paid generation; existingUS$25 authorization, US$4 reserved and US$21 uncommitted, actual balance unverified.

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

## Historical motion and visual checkpoint, 15:43 UTC

Default production crew were missing eight `BS_Locomotion` assets, so existing runtime code fell back to single-clip playback. Eight new saved graphs now author/fresh-verify with all6,834 earlier Content files preserved. All30 native tests pass (28 plain, two older warning fixtures), including all eight actual saved selections, blend transitions, own-clip cadence, evaluated bone output and reapply behavior. Graph authoring changed no old body/rig/clip/material. The initial parent author parser failure and obsolete ReapplyCrew test failures are retained; native authoring was not repeated. Latest successful build/check: `BuildCrewReapply` and `AutomationWithCrewReapply`.

24 native Toronto stills and preservation pass at `SingleRenderWindow-20261014T153050Z`; the independent rejected-art review is `Verification/DistrictExpansion/review.md`. All venue signs were mirrored despite correct outward normals. CPU correction changes only135 letter quads/270triangles within Cladding and preserves the other7 OBJ groups. The single native Cladding reimport is saved; its first supplemental source check attempted unavailable Shapely inside Unreal. The corrected read-only verifier uses the existing OBJ reader instead; fresh source-vertex/normal/material/actor readback is underway. Original8nativepackages/map are backed up under `Saved/Recovery/sneaky-dees-mirrored-20261014T153954Z`.

A one-flag Path shadow trial is proposed after sign verification, with unchanged geometry/material/collision and a map-only rollback. It may improve raised-overlay shadows but cannot union sidewalks or repair coplanar overlap. Candidate-only violet-wash A/B helpers are prepared under Saved; no material has been authored yet. No new paid generation.

## Curated production motion evidence, 2026-10-14

[Saved production crew checkpoint](CrewLocomotion/README.md) retains the exact eight-graph Author/Verify receipts, the failed author-parent parser result and its read-only recovery, the successful build, all 30 corrected automation results and the earlier rejected automation/build attempts. Native authoring preserved the 6,834 Content files present at that operation; later separately authorized district and shader edits have their own preservation scope. [SourceChecks.json](CrewLocomotion/SourceChecks.json) identifies the current source/tests, unchanged eight graph bytes and successful module `a86f7bf1e4945c9f0d475f5362e54c5eed0a0620a7de96df4c6242792ec0e4a7`.

The verified change concerns default playable crew 3–10: saved own-rig locomotion graphs, native blends, retained clip cadence and actual evaluated poses. Park residents retain their separate manual SingleNode path. Bodies, rigs, clips, materials and static face/finger limits did not change in this authoring step. Editor NullRHI graph/pose tests do not establish packaged graph binding, continuous rendered fluidity or a 60 FPS target; those remain separate checks. No private original-content/settings/service baseline or save was copied into the curated checkpoint.

## Packaged checkpoint, 17:33 UTC

PR359 is open; all30 native automation, Toronto20map/35headless and Montréal19runtime/currentcanonical checks pass. Fresh two-map package QA now also passes all six standalone/listen/client processes, eight exact per-selection body/clip/graph proofs, joined controls and14actual720p startup captures with all11Epic groups/r.ScreenPercentage100 read before/after. Both rendered quality timing failures remain retained: frame-zero constructor0, then startup setter+query duplicate. A barrier after the final ordered startup command excludes setter echoes while retaining strict query parsing. Final window `SingleRenderWindow-20261014T172829Z` passes/restores all protected state. Independent package image curation is underway; root viewed all14 and accepts bounded startup/readability only. No continuous-fluidity/performance or physical-device/persistence claim.

Human authorization in task01a13b20-f6be-7dd1-80e2-19d549c7b30e permits coordination with both active NORD tasks. Its baseline window finished/restored, followed by this district window. It now owns the next serialized music import/build/native/cook window; root is CPU/Git/review-only until release. Its High2/75% browser-profile5ms diagnostic is separate from Epic/100 imagery. Public package remains preserved until combined integration is coordinated.

Next bounded polish: three existing source-pinned Visitation shells,42candidate decorative panes after culling8fullyhidden source emissions, three NoCollision mesh groups/2604triangles. Source/fake-preflight tests and independent author/canonical review pass; native import remains pending. OpenSpec `nord-east-facade-detail` stays active. Panet skyline/source coverage is still absent. No new generation spend.

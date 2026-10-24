# Full Swing performance improvement plan

User direction: ship small, reviewable improvements continuously. FPS-benefit checks and long benchmark queues are no longer merge gates. Keep focused correctness tests, review, CI, deployed preview, rebase and production verification. Measure when it answers a specific question; do not delay every increment for another full comparison.

## Constraints
- Real building anchors only; reachable attachments above rooftops remain allowed. No artificial height ceiling.
- Keep the existing image, effects, native UI resolution and XR behavior. No blind quality cuts.
- Keep the affected Chrome slowdown open until that browser is actually verified. FPS/latency targets remain diagnostic; no inherited passing hardware scores.

## Incremental delivery
1. **Remove redundant fullscreen clears (#634).** Reuse the tested opaque fullscreen pass helper; restore caller renderer state in finally. Pixel equivalence, failure-state tests, CI/review/preview are already established on the runtime change. Ship after fresh current-head release checks; do not require a proven FPS gain.
2. **Bound dynamic GPU uploads.** Inspect the street/character instance buffers and upload only populated/changed ranges using the existing addUpdateRange pattern. Verify actual GPU-upload ranges and shrinking/growing instance counts; preserve visible actors and motion.
3. **Reduce repeated scene work.** Use the existing scene-cost data to target recurring material/instance work, reuse cached static data and preserve culling bounds. Pick one concrete hot path, make one change, and add a focused equivalence or behavior check.
4. **Keep responsiveness observable.** Retain FPS, p95/p99, long-frame and precisely scoped input-latency diagnostics. Record before/after observations when available; use an actual affected-Chrome capture when accessible. Do not repeat identical passing benchmark suites.

Each increment gets a small commit/PR, honest limitations, automated review and release checks, a rebase before merge, and production byte verification. Revert verified shipped regressions. Continue to the next implementation after release instead of repeating audits.

## Current evidence
The shipped render budget, bounded adaptive feedback and zero-contribution shaft guard are live. Fullscreen-clear measurements were mixed: this increment removes redundant render commands, with FPS benefit unverified. The new user-directed workflow supersedes the earlier rejection based solely on an unproven throughput gain.

## Released increments

PR#634 released as `8608ff629f30ec911edab0ad6c12f77606b6fc9c` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

PR#635 released as `3797b07fdd943b430102de6b573ef8f20f6f2e38` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

PR#636 released as `9d82f8233450bc1a3c5f1e8ef841c78de731c768` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

Continue with small concrete scene-work changes; do not reinstate FPS-benefit checks or benchmark queues as merge prerequisites.


Increment37 released in #638 as2c9d2d8f after all6CI/review/current4checkpreview/freshrebase. Production streetview HTTP200 exactSHA6a1c7c3089d596471c0cca7fae51a27b30b6bd39bdffa021a49f879fe5c64282. Canonical invisible-street scenarios published and OpenSpec archived. No FPS gain or affectedChrome acceptance claimed; currenttotal withheld.


Increment38 shipped #640 as69c6ecff after all6CI/review/current9checkpreview/freshrebase. Productionactionview HTTP200 exactSHA8390a157dc9c3ccd40b16968f869791f8ea7713cd2d81fd114b12d885c276a38. Canonical populated-car/marker scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment39 shipped #642 asf84e61f3 after all6CI/review/current20deployedchecks/freshrebase; productionactionview HTTP200 exactbytes verified (fullhash in fullswing-r39-marker-dirty/production-verification.json). Canonical markerdirty scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment40 shipped #644 as8b5a4565 after freshall6CI/review/current25deployedchecks/rebase; productionactionview HTTP200 exactbytes verified (hash in fullswing-r40-selection-slots/production-verification.json). Canonical selection/no-camera scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment41 shipped #646 as2d254f7d after freshall6CI/review/current10deployedchecks/rebase; productioncars HTTP200 exactbytes verified (hash in fullswing-r41-traffic-paint/production-verification.json). Canonical traffic-paint scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment42 shipped #648 as853fed7a after all6CI/review/current9deployedchecks/rebase; productioncars+main HTTP200 exactbytes verified (hashes in fullswing-r42-hazard-scratch/production-verification.json). Canonical hazard-output scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment43 shipped #650 as5f5c85f5 after all6CI/review/current10deployedchecks/freshrebase/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r43-clog-guards/production-verification.json). Canonical guard-selection scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment44 shipped #652 as16909bd0 after all6CI/review/current14deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r44-rope-want/production-verification.json). Canonical desired-map scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment45 shipped #654 as8005f88d after all6CI/review/current18deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain+combat HTTP200 exactbytes verified (hashes in fullswing-r45-combat-targets/production-verification.json). Canonical combat-target-storage scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment46 shipped #656 as5536c923 after all6CI/review/current22deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain+jobs HTTP200 exactbytes verified (hashes in fullswing-r46-job-targets/production-verification.json). Canonical job-target-storage scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment47 shipped #658 as6aa20d58 after all6CI/review/current26deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r47-goon-rope-records/production-verification.json). Canonical registered-goon-record scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment48 shipped #660 as09966956 after all6CI/review/current18deployedchecks/rebase before AND afterpreview/exactmerge. Productionstreetview HTTP200 exactbytes verified (hash in fullswing-r48-figure-counts/production-verification.json). Canonical figure-count scenarios published and OpenSpec archived. ActualChrome/FPSbenefit and deletioncost unverified; totalwithheld.


Increment49 shipped #662 asa51930fe after all6CI/review/currentlayout+goalmarkdeployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r49-goal-layout/production-verification.json). Canonical goal-layout scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment50 shipped #664 asfba485ea after freshall6CI/review/current12deployedchecks/rebase before AND afterpreview/exactmerge. Productioncombat+jobs HTTP200 exactbytes verified (hashes in fullswing-r50-job-crew/production-verification.json). Canonical crew-storage scenarios published and OpenSpec archived. Initial incomplete review retried successfully, never accepted as passing. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment51 shipped #666 as2035c0b8 after all6CI/review/current13deployedchecks/rebase before AND afterpreview/exactmerge. Productionjobs HTTP200 exactSHA c714f2e6fbb50390ceab1bb75dece1c794fa2946c98deb8c992a8b37167d69ac verified. Canonical crew-count scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment52 shipped #668 as2264dc92 after all6CI/review/current12deployedchecks/rebase before AND afterpreview/exactmerge. Productionjobs HTTP200 exactSHA9ed9b41552376e9930dd0b4a2dc25da4da69b828f9b1cad866d729f9f09abb04 verified. Canonical idle-offer scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld; expiryextrascanunmeasured.


Increment53 shipped #670 asff8861c5 after all6CI/review/current4HUDdeployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA d58ec0ebbad7a244cc85beabfcee1bef89b41c3bb44741021227c8f41e85f9c9 verified. Canonical HUD throw-query scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment54 shipped #672 as05750289 after freshall6CI/review/current8HUDdeployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA11e1f28fb3cb50f199caf8d630a9825ae6af40ab5eed34bb54f914fd94c7df67 verified. Canonical HUD threat-query scenarios published and OpenSpec archived. Concurrent unrelated main changes preserved by rebase; all checks rerun on rebased head. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment55 shipped #676 asd1867b18 after freshall6CI/review/current63deployedchecks/exactmain+ropebytes/rebase before AND afterpreview/exactmerge. Productionmain+rope HTTP200 exactbytes verified (hashes in r55-phone-finish/production-verification.json). Canonical phone-finish and ink-rope endpoint scenarios published and both changes archived. Shipped stale endpoint regression restored without changing physics/renderedink; layout fixture waits CSS fade completion, assertions unchanged. Concurrent NORD/buildingrope work preserved. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment56 shipped #679 as c4c37bd9 after all6CI/review/current46deployedchecks/exactfxbytes/rebase before AND afterpreview/exactmerge. Productionfx HTTP200 exactSHA3a67361da1a3e08fb75b31b3fcd65f890708e49f79dfb364a3347058a38e19f8 verified. Canonical comic-word upload scenarios published and OpenSpec archived. Initial full GPU allocation unchanged; actualChrome/FPSbenefit unverified; totalwithheld.


Increment57 — atlas uploads omitted on animation-only word updates; pending spawn/removal ranges preserved. Actual one-word animated uploads96→80bytes, baseline assertion fails;16browserchecks/exactnonblankpixels/fullreplacement/swap/hiddenaging PASS;32FXchecksPASS. Evidence r57-word-atlas/all20limits/noFPSclaim/totalwithheld. Releasepending.


Increment57 shipped #681 as f548a6b7 after all6CI/review/current48deployedchecks/exactfxbytes/rebase before AND afterpreview/exactmerge. Productionfx HTTP200 exactSHA03095f3bb17ef5d1078d601045c5cad9e29a34c81c230785df95f2a5c014e9c7 verified. Canonical atlas-update scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment58 pending: populated web matrix/fade uploads1088→408bytesone6segments/816two12 with exactnonblankpixels; existing building checks caught shippedsky-anchor regression/currentmainbaseline3fail. Restored prior shared realbuilding selector preserving newer gold-ring/melee/wall/heldrope behavior;4building+51swing checksPASS. Evidence r58-web-ranges/all20limits/noFPSclaim.


Increment58 shipped #683 as b05703d1 after all6CI/review/current63deployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA220d0f069b4d893723e7bda74bec3a0131d7d940b2d21bf9341a02f3716b026c verified. Canonical web-upload and real-anchor-restoration scenarios published; both OpenSpecs archived. Realbuilding-only/above-roof restoration preserves newer goldring/melee/wall/heldrope behavior; legacyfixtures corrected to realanchor contract. NoFPSclaim/actualChromeunverified/totalwithheld.


Increment59 pending — sharedcamera.updateMatrixWorld onceper3Dwebdraw vsperrope;actualtwo/fading2→1call.8upload/pixel+11web-line+4buildingchecksPASS. Evidence r59-web-camera/all20limits/noFPSclaim/totalwithheld.


Increment59 shipped #685 as d7b7c8bf after all6CI/review/current23deployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA2602aa95c69c6a447f93048b39fac22d9740bb5bd6700be776953ef3e2c96a27 verified. Canonical shared-web-camera scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment60 pending — goonpose tick shared perstreetframe/currentdiagnosticdefault. Actualfunctions60frames10goons/6mode-layout runs equivalent allfields+pose/state/position/modechanges;400→40ticksfull/calm,200→20offtransition,nonflat0. ExistingVersebrowserchecksPASS. Emptyframeoneextratick/aggregateeffectunmeasured. Evidence r60-goon-tick/all20limits/noFPSclaim/totalwithheld.


Increment60 shipped #687 as8b4f724a after all6CI/review/currentVersepreview/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA9be698cabaa8fc4334b71712cefe5cccd427d6188d43db044925ff04d7034d24 verified. Canonical goon-pose tick scenarios published and OpenSpec archived. ActualChrome/FPSbenefit and aggregate effect unverified; totalwithheld.


Increment61 pending — sharedfigure root followsworldvisibility;hiddenvisualprep180→0calls/60frames/bufferversionsunchanged. Simulation+crowd60/60 retained;firstresumeactualmovedgoon/currenttime/jobpopulationPASS.5browser+4hiddenstreet+6goonposeequivalencecasesPASS. Evidence r61-hidden-figures/all20limits/noFPSclaim/totalwithheld.


Increment61 shipped #689 asb123bc2f after all6CI/review/current9deployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA5850d940312c64eef14db15acf1f1a6a6ed3a64e25ac3950b8fd45d1e6a29e11 verified. Canonical hidden-figure scenarios published and OpenSpec archived. PhysicalAR/actualChrome/FPSbenefit unverified; totalwithheld.


Increment62 pending — privateaction-viewoptions64fresh→1record inactualbrowseractive/hidden/resume/cutscene/play;4checksPASS/currentmarkerflags/samecamera. Marker-dirty+6goonposeequivalencecasesPASS. Evidence r62-action-options/all20limits/noFPSclaim/totalwithheld.


Increment62 shipped #691 as b6763a7a after all6CI/review/current authenticated options+marker checks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA074d5e80ccfcc386336c3cc1b4a545fc0e85b8f6bf8bb32bd99c4ef7f8a45898 verified. Canonical action-view options scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment63 pending — crowd height rejection before horizontal distance:240actualupdates equivalent state/crowd across boundary/movement,19200hypotcalls skipped/6400roof. Existing street and5hidden-figure browser checksPASS. Evidence r63-crowd-height/all20limits/noFPSclaim/totalwithheld.


Increment63 shipped #693 as a3710180 after all6CI/review/current5authenticatedbrowserchecks/exactstreetbytes/rebase before AND afterpreview/exactmerge. Productionstreet HTTP200 exactSHA20e474654fbd99fc37eafc02afc3abc77de05ce7d79641498983a715a1d51c89 verified. Canonical crowd-height scenarios published and OpenSpec archived. ActualChrome/FPSbenefit/listening unverified; totalwithheld.


Increment64 pending — traffic wrapper optionaloutput/private runtime scratch60fresh→1 direct+street frames;4browser+actualaccessor null/replacementchecks+existingactionbrowserPASS. Evidence r64-traffic-record/all20limits/noFPSclaim/totalwithheld.


Increment64 shipped #695 as013e0bbc after all6CI/review/current authenticated traffic+action checks/exactmain+cityviewbytes/rebase before AND afterpreview/exactmerge. Productionboth HTTP200 exactSHA main00ebd4da21a1c12c01d7c04038c4a52ce94f9be631533bfab2d02c69f1a138b3/cityview634fdd52adfe4935feb960e34f29d4c6bbe0ccf38969f952d6d641e3e0438601 verified. Canonical traffic-record scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment65 pending — goal placement+HUD output share private record/twoactivegoalrecords→0;1920exactplacementcomparisons/defaultfresh+goalmark+7browserchecksPASS includinglayout/state/mission/trendreset. Evidence r65-goal-record/all20limits/noFPSclaim/totalwithheld.


Increment65 shipped #697 as765d5da0 after all6CI/review/current7authenticatedbrowserchecks/exactmain+actionhudbytes/rebase before AND afterpreview/exactmerge. Productionboth HTTP200 exactSHA main8224627aa0816c71eba6778e777b5bc39e318e85da3faa9137a921a7e4b8afa7/actionhud0f995bd08ad348c929818e50b1fd7c19948a9e489160cdf2ddebc9a9c7441693 verified. Canonical goal-record scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.

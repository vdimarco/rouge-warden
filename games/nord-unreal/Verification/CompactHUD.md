# Compact NORD HUD verification

## Status and scope

Native automated and independent visual evidence pass with the exact presentation scopes below. The current-source Linux Development editor build and full 1080p story suite pass. The full burst-spacing 720p suite passes 121 checks/21 captures before the final R-only header refinement, followed by a current-source focused 720p pass of two checks/one capture. The 13 native automation tests pass before the final R-only header expression. Both 66-check/15-capture smoke runs pass before that expression and the three burst-spacing constants changed; an exact in-memory source comparison confirms no functional differences. The current package build, independent-peer startup/render verification, local/browser package parity and all six Epic reference profiles pass. The normal public two-player service is restored. The browser side-rail correction is accepted: local, preview and final public desktop checks pass 7/7 and phone-emulated checks pass 6/6. Decoded fullscreen review confirms clear HUD and touch controls at 800×360 and 667×375. This is the integrated Warden HUD, not the older separate GTA source project. [CompactHUD.json](CompactHUD.json) records the machine-readable source, run, archive and delivery evidence.

The user requested a more GTA-inspired HUD. The current implementation uses outlined text, a compact player-centered clipped road radar, small NORD/Montréal crew/online identity, lower-right objective/status, one contextual action region, a corner speed readout and a centered gold shared-completion banner. Credits use font scale .85, objective body 1.15 and title/status .9, multiplied by the supported-size scale. The radar remains 240×150 reference pixels with a 58-pixel credit footer. The initial on-foot jump/sprint hint clears after ten seconds. Story briefing receives nine visible seconds; private interaction/dialogue captions pause that budget without changing their existing lifetime. Save warnings remain in the objective status. The top-right C/F2 hint also includes R Recover during an unfinished campaign, preserving discovery while alignment or save status occupies the objective status row. Comic sound words use the existing local style getter and track movement edges while hidden; their final spacing uses a maximum 90-pixel ray, font scale 2.4 and center Y at .47 of screen height. Campaign and legacy objective counts and car interaction priority remain intact in source.

Map credits retain OpenStreetMap contributors/ODbL and its copyright URL, plus Ville de Montréal/CC BY 4.0. No health, armour, currency or wanted-level state is invented. No map, gameplay progression, input binding, asset or `Quebec.uproject` changes are part of this HUD implementation.

## Build and source identity

Warden baseline: `db92dffb113cc81e2c871bd4884e669c923388e4`.

| Input | SHA-256 |
| --- | --- |
| `Source/Quebec/QuebecGameplay.cpp` | `4d831c4373bf7de2807fa2d0a73e5a8b029605448aefde07e60aadea7910df2a` |
| `Source/Quebec/QuebecGameplay.h` | `764e32fe8848ecd53f7a3fb44d18a4687c684a3f9062a7a8fcbbd490059d4b46` |
| `Scripts/test_compact_hud.py` | `207068abce3b72f45a00babf7c42053b86e55f9eb11966a29ae842938815ac7b` |
| `Scripts/smoke_test.py` | `24375e249800635826cb56f0cfe739aaac1c44f7edaa8c8730e3b4c9efef621c` |

`Saved/Tests/CompactHUD/editor-build.log` reports `Result: Succeeded`, with `QuebecGameplay.cpp` compilation and editor module linking completed in 8.65 seconds for the current recovery-header source. The full current-source 1080p and focused 720p reports identify `4d831c4373bf7de2807fa2d0a73e5a8b029605448aefde07e60aadea7910df2a`. The passing full burst-spacing 720p report identifies source `56bac00481573a0fa56c9dabcaa106f2f071afd41a3f49a64e238c0cc17d2929`, before the presentation-only R hint. The editor build and deliverable game package are verified separately below.

An in-memory source comparison passes: reverting only the final R-header expression hashes the current C++ file exactly to the full-720p source above. Reverting the three burst presentation expressions from that source hashes exactly to `0165f38fa0685affe0c3c74c0f01a5817ea72b5d90bd20509ad2c325c6a6fc9f`, the earlier typography module covered by the legacy tests. Those expressions change only burst center Y, font scale and ray length. This establishes the precise reuse of existing functional test evidence; it does not pretend the earlier captures show the final header or burst spacing.

## Checks

| Check | Current result | Evidence / acceptance |
| --- | --- | --- |
| Linux Development editor build | PASS, current source | `Saved/Tests/CompactHUD/editor-build.log`; 8.65 seconds |
| Native Quebec automation, including radar clipping | PASS after burst spacing, before R-only header expression | `Saved/Tests/CompactHUD/Automation/index.json`; 13/13 success, zero warnings/errors, 0.1512 seconds; clean process exit reported by runner. Exact source comparison confirms no functional change afterward |
| Full story suite at 1280×720 | PASS with final burst spacing, before R-only header refinement | `Saved/Tests/CompactHUD/CompactHUD1280.json`; 121 checks / 21 completed PNGs, 104.3 seconds |
| Focused header capture at 1280×720 | PASS automated, current source; affected proof reviewed | `Saved/Tests/CompactHUD/recovery-header-1280.json`; two checks / one HUDQuiet capture, 16.38 seconds |
| Full story suite at 1920×1080 | PASS automated, current source; staged matrix and affected proofs reviewed | `Saved/Tests/CompactHUD/CompactHUD1920.json`; 121 checks / 21 completed PNGs, 105.14 seconds; clean exit 0 |
| Legacy/interaction smoke at 1280×720 | PASS automated before R-header expression and three burst expressions; reviewed | `Saved/Tests/CompactHUD/SmokeRender1280.json`; 66 checks / 15 captures, 69.87 seconds |
| Legacy/interaction smoke at 1920×1080 | PASS automated before R-header expression and three burst expressions; reviewed | `Saved/Tests/CompactHUD/SmokeRender1920.json`; 66 checks / 15 captures, 69.92 seconds |
| Independent native visual review | PASS, no native HUD blocker | `Saved/Tests/CompactHUD/visual-review.json`; 42 readability-stage story images, 30 legacy images and six final affected proofs; all 78 paths/hashes verified by root |
| Current Linux package build/cook/archive | PASS, owner delivery | [CompactHUDPackageIdentity.json](CompactHUDPackageIdentity.json); 77.42 seconds |
| Current package startup/render and parity | PASS, owner delivery | [CompactHUDPackage.json](CompactHUDPackage.json); 30.36 seconds, independent peer join, seven 1600×900 PNGs, eight crew/32 clips and 2,190 Plateau meshes. [CompactHUDPackageIdentity.json](CompactHUDPackageIdentity.json) confirms 48 non-save files match |
| Six Epic reference-scene profiles | PASS, 6/6 | [CompactHUDPerformance.json](CompactHUDPerformance.json); all p95 values below 16.67 ms; static scenes on the tested RTX 4090 |
| Normal public two-player service restoration | PASS before mobile CSS correction | Restored at 05:50:59 UTC; `Browser/.qa/live-2026-10-11T05-51-04-717Z/summary.json` passes all seven checks on the public player |
| Save, settings and historical evidence preservation | PASS | [CompactHUDPreservation.json](CompactHUDPreservation.json); actual project/package save inventory unchanged, package settings restored and historical reports/PNGs restored |
| Final public desktop media/input/reconnect | PASS, 7/7 | `Browser/.qa/live-2026-10-11T06-00-49-062Z/summary.json`; final public deployment |
| Browser phone-emulated layout and final CSS acceptance | PASS, 6/6; owner visual acceptance | `Browser/.qa/mobile-2026-10-11T06-01-09-657Z/summary.json`; portrait/non-fullscreen retained, both landscape fullscreen sizes clear all ten touch targets from the video with minimum dimension 44 px |
| Local and preview desktop/mobile regression | PASS, 7/7 desktop and 6/6 mobile at each stage | Local `live-2026-10-11T05-55-46-284Z` / `mobile-2026-10-11T05-56-24-252Z`; preview `live-2026-10-11T05-59-03-886Z` / `mobile-2026-10-11T05-59-24-743Z`, under `Browser/.qa/` |
| OpenSpec merge and archive structure | PASS, manual | Four-file archive at `openspec/changes/archive/2026-10-11-nord-compact-hud/`; two MODIFIED requirements merged once into canonical spec, ten scenarios, all tasks complete and relative links resolved. CLI unavailable |

`Scripts/test_compact_hud.py` reuses `Scripts/test_story_slice.py` and adds `HUDQuiet` after eleven seconds without progress changes, `HUDDelayedBriefing` ten seconds after the first-clamp action to check readable briefing after its private message clears, and `HUDCompletion` .6 seconds after the final required gate to inspect completion after its fade-in. Automated state and PNG-completion assertions still require independent inspection of the rendered text. The full burst-spacing 720p, focused current-header 720p and full current-source 1080p runs all report the isolated QA slot, production saves and editor settings restored, with the viewport realtime override released.

The 72 fresh story/legacy PNGs are preserved under `Saved/Tests/CompactHUD/Captures/{1280|1920}/{story|legacy}/`: 21 story and 15 legacy images per resolution. [CompactHUD.json](CompactHUD.json) records each archived path and SHA-256. These archives are durable capture evidence; the original `Preview/` paths in raw reports record capture provenance only. The historical `StorySliceRender*`/`SmokeRender*` reports and tracked Preview images were restored after preserving the new reports and images. Review this change's reports under `Saved/Tests/CompactHUD/`, not restored historical reports at the root of `Saved/Tests/` or mutable Preview output paths.

Independent native review passes in staged scope: all 42 readability-stage story images and all 30 legacy images were individually inspected, followed by six final affected proofs for the smaller burst, recovery header, quiet state, delayed briefing, completion and save warning. `Saved/Tests/CompactHUD/visual-review.json` records the 78 exact paths/hashes; root verified every recorded path/hash. No remaining native text clipping, overlapping HUD text, missing private feedback or unreadable attribution was found. Immediate completion fade-in is intentionally faint; the delayed `HUDCompletion` proof establishes readable full-opacity text. The final delayed briefing proof confirms the reading budget survives private feedback. Unchanged layouts were not individually repeated after the presentation-only spacing/header refinements; the affected proofs cover those changes. This review does not establish streamed phone layout.

One full burst-spacing 720p attempt timed out at gate6 after 88 checks/12 captures in 88.39 seconds; the runner observed only about 52 cm of vehicle movement in that gate fixture. Its failure and all captures remain under `Saved/Tests/CompactHUD/final-720-gate6-timeout/`. Its QA slot, production-save hashes, editor settings and realtime override all restored. An unchanged-source retry then passed all 121 checks/21 captures in 104.3 seconds; no gameplay code or fixture was altered to obtain that retry. This retained intermittent fixture failure is not erased by the passing rerun.

After the R-only header change, `Saved/Tests/CompactHUD/check_recovery_hint.py` reuses only the native startup and HUDQuiet steps, producing `recovery-header-1280.json` and its screenshot. This ignored one-off fixture verifies current-source startup/capture, not the full story. The subsequent full current-source 1080p suite passes all 121 checks/21 captures. The exclusive HUD test window is now closed and the GPU has been released to the normal host owner for package, performance and browser delivery; no further HUD capture jobs are planned.

The smoke fixture's QA-only change suppresses the duplicate host world render, enables the inspection client, releases the editor viewport realtime override during cleanup and asserts rendering only for an actual capture. An initial 720p run reached 61 checks/15 captures but failed when the new rendering assertion ran on a destroyed client world during teardown. The failure and its images remain under `Saved/Tests/CompactHUD/smoke-1280-initial/`; moving the assertion below the actual-capture guard fixed that fixture error. The subsequent 720p and 1080p runs both pass 66/15 and report the realtime override released. This was a test fixture issue, not a reported gameplay progression failure.

The owner's current package verifier uses fresh campaigns on both peers with campaign saving disabled for startup verification. Its passing separate-process join, crew/animation inventory and seven rendered views do not establish a naturally driven complete story or browser mobile clearance. The historical `Verification/Package.json` was restored; current package evidence is explicitly named `CompactHUDPackage*.json`.

All six current package profiles pass at Epic quality, 100% screen percentage, comic on, VSync off and uncapped. Each retains 2,398 frames after discarding the first 600 and final two from a 3,000-frame static-camera sample. [CompactHUDPerformance.json](CompactHUDPerformance.json) records the tested Linux RTX 4090 hardware and raw evidence.

| Reference scene | 1280×720 p95 | 1920×1080 p95 |
| --- | --- | --- |
| Sherbrooke | 11.80 ms | 13.62 ms |
| Pond | 12.10 ms | 14.19 ms |
| North Park | 11.52 ms | 13.54 ms |

The owner restored the normal host at 05:50:59 UTC and the public player passed all seven baseline live media/input/reconnect checks in `Browser/.qa/live-2026-10-11T05-51-04-717Z/`. [CompactHUDPreservation.json](CompactHUDPreservation.json) confirms actual project/package save inventory preservation, restored package settings and historical evidence.

Fresh mobile review identified touch controls covering the radar, credits and speed in landscape fullscreen. The accepted browser correction reserves side rails around the contained game video and places the existing touch controls in those rails; it preserves portrait and non-fullscreen layouts and existing input behavior. Final public phone emulation verifies all ten targets lie outside the video container at 800×360 and 667×375, with minimum target dimension 44 px. Owner decoded-frame review accepts HUD/credit/speed clearance. Local and preview desktop/mobile regressions pass before the final public runs. Earlier collision/failure evidence remains in `Browser/.qa/`.

Final delivery is [NORD Montréal](https://nord-montreal.vercel.app/), deployment `dpl_EPZzH974H9YeWt1X6nbUAqKGfJPg`, status READY. The owner verifies four deployed browser files match the accepted local files. Final public desktop evidence is `Browser/.qa/live-2026-10-11T06-00-49-062Z/summary.json` (7/7); mobile evidence is `Browser/.qa/mobile-2026-10-11T06-01-09-657Z/summary.json` (6/6). OpenSpec's two modified requirements are merged into `openspec/specs/nord-unreal/spec.md`, and the completed four-file change is archived at `openspec/changes/archive/2026-10-11-nord-compact-hud/` after owner acceptance. Manual validation checks requirement uniqueness, ten delta scenarios, twelve completed tasks, archive contents and relative links. The OpenSpec CLI is unavailable; CLI validation was not run.

## Reproduction

From `games/nord-unreal/`, use the installed Unreal Engine 5.8.3. Relevant commands/flags are below; rendered jobs require a coordinated exclusive GPU window with the normal browser host owner. Full invocations and inspection-only renderer budgets belong in each raw log.

```bash
/home/von/.local/share/Epic/UE_5.8.3/Engine/Build/BatchFiles/Linux/Build.sh \
  QuebecEditor Linux Development "$PWD/Quebec.uproject" \
  -WaitMutex -NoUBA -NoHotReloadFromIDE

/home/von/.local/share/Epic/UE_5.8.3/Engine/Binaries/Linux/UnrealEditor-Cmd \
  "$PWD/Quebec.uproject" /Game/Maps/LaFontaine \
  -NullRHI -unattended -nop4 -nosound -NordCampaignQA \
  '-ExecCmds=Automation RunTests Quebec;SoftQuit' \
  -ReportExportPath="$PWD/Saved/Tests/CompactHUD/Automation"
```

For native story captures, run `Scripts/test_compact_hud.py` with LaFontaine loaded and `-NordCampaignQA -NordStoryRenderChecks -NordCaptureWidth=1280`, then separately at `1920`; omit `-NullRHI`. The fixture initially writes to `Preview/CompactHUD1280/` and `Preview/CompactHUD1920/`; this run's durable archived evidence is under `Saved/Tests/CompactHUD/Captures/`. For relevant legacy/interaction regression use `Scripts/smoke_test.py` with `-NordRenderChecks -NordCaptureWidth=1280|1920` in the existing smoke configuration.

From `Browser/`, `npm test`, `npm run test:live` and `npm run test:mobile` provide the existing CPU/input, real two-player media and touch-emulated checks. The live tests attach to available running slots; they must not evict another subscriber or independently replace/restart the normal host. Existing touch-target assertions do not prove the native HUD avoids the touch overlay; actual decoded-frame review is required.

## Remaining limits

Physical-phone and off-LAN play, acoustic listening, handling enjoyment and full manual solo/co-op story acceptance are not established by these checks. Static scene frame times on one GPU do not establish moving/co-op or internet performance. A portrait browser viewport still receives the fixed 1280×720 game stream; it is not a native portrait HUD. Final browser acceptance covers Chromium touch emulation and owner decoded-frame review, with fullscreen side-rail clearance established at the two reported landscape sizes. The OpenSpec CLI is unavailable; the completed merge/archive received manual structure validation only.

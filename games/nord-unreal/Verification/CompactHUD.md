# Compact NORD HUD verification

## Status and scope

Native automated evidence is complete with the exact presentation scopes below. The current-source Linux Development editor build and full 1080p story suite pass. The full burst-spacing 720p suite passes 121 checks/21 captures before the final R-only header refinement, followed by a current-source focused 720p pass of two checks/one capture. The 13 native automation tests and both 66-check/15-capture smoke runs pass before that header expression and the three burst-spacing constants changed; an exact in-memory source comparison confirms no other differences. The owner also reports a passing current package build, independent-peer startup/render verification and local/browser package parity. Independent final visual review, the complete six-scene performance gate and browser-owner acceptance remain pending. This is the integrated Warden HUD, not the older separate GTA source project. No visual acceptance is inferred from compilation or preceding release reports. [CompactHUD.json](CompactHUD.json) records the machine-readable source, run, archive and delivery evidence.

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

`Saved/Tests/CompactHUD/editor-build.log` reports `Result: Succeeded`, with `QuebecGameplay.cpp` compilation and editor module linking completed in 8.65 seconds for the current recovery-header source. The full current-source 1080p and focused 720p reports identify `4d831c4373bf7de2807fa2d0a73e5a8b029605448aefde07e60aadea7910df2a`. The passing full burst-spacing 720p report identifies source `56bac00481573a0fa56c9dabcaa106f2f071afd41a3f49a64e238c0cc17d2929`, before the presentation-only R hint. The build verifies the editor target only; the deliverable game package remains a separate gate.

An in-memory source comparison passes: reverting only the final R-header expression hashes the current C++ file exactly to the full-720p source above. Reverting the three burst presentation expressions from that source hashes exactly to `0165f38fa0685affe0c3c74c0f01a5817ea72b5d90bd20509ad2c325c6a6fc9f`, the earlier typography module covered by the native/legacy tests. Those expressions change only burst center Y, font scale and ray length. This establishes the precise reuse of existing functional test evidence; it does not pretend the earlier captures show the final header or burst spacing.

## Checks

| Check | Current result | Evidence / acceptance |
| --- | --- | --- |
| Linux Development editor build | PASS, current source | `Saved/Tests/CompactHUD/editor-build.log`; 8.65 seconds |
| Native Quebec automation, including radar clipping | PASS before R-header expression and three burst presentation expressions | `Saved/Tests/CompactHUD/Automation/index.json`; 13/13 success, zero warnings/errors, 0.1512 seconds; clean process exit reported by runner. Exact source comparison confirms no functional change afterward |
| Full story suite at 1280×720 | PASS with final burst spacing, before R-only header refinement | `Saved/Tests/CompactHUD/CompactHUD1280.json`; 121 checks / 21 completed PNGs, 104.3 seconds |
| Focused header capture at 1280×720 | PASS automated, current source; visual review pending | `Saved/Tests/CompactHUD/recovery-header-1280.json`; two checks / one HUDQuiet capture, 16.38 seconds |
| Full story suite at 1920×1080 | PASS automated, current source; visual review pending | `Saved/Tests/CompactHUD/CompactHUD1920.json`; 121 checks / 21 completed PNGs, 105.14 seconds; clean exit 0 |
| Legacy/interaction smoke at 1280×720 | PASS automated before R-header expression and three burst expressions; visual review pending | `Saved/Tests/CompactHUD/SmokeRender1280.json`; 66 checks / 15 captures, 69.87 seconds |
| Legacy/interaction smoke at 1920×1080 | PASS automated before R-header expression and three burst expressions; visual review pending | `Saved/Tests/CompactHUD/SmokeRender1920.json`; 66 checks / 15 captures, 69.92 seconds |
| Independent native visual review | Pending | Inspect all current-build story/smoke states, attribution and text clearance |
| Current Linux package build/cook/archive | PASS, owner delivery | [CompactHUDPackageIdentity.json](CompactHUDPackageIdentity.json); 77.42 seconds |
| Current package startup/render and parity | PASS, owner delivery | [CompactHUDPackage.json](CompactHUDPackage.json); 30.36 seconds, independent peer join, seven 1600×900 PNGs, eight crew/32 clips and 2,190 Plateau meshes. [CompactHUDPackageIdentity.json](CompactHUDPackageIdentity.json) confirms 48 non-save files match |
| Six Epic reference-scene profiles and restored browser service | Pending owner completion | First reported Sherbrooke 720p p95 11.80 ms passes; remaining profiles and normal browser acceptance pending |
| Browser phone-emulated layout | Pending | Decode actual video at 360×800, 800×360 and landscape fullscreen; inspect HUD/touch clearance |
| OpenSpec delta structure | PASS, manual | Four-file change; two MODIFIED requirement names match the canonical spec; ten scenarios. CLI unavailable |

`Scripts/test_compact_hud.py` reuses `Scripts/test_story_slice.py` and adds `HUDQuiet` after eleven seconds without progress changes, `HUDDelayedBriefing` ten seconds after the first-clamp action to check readable briefing after its private message clears, and `HUDCompletion` .6 seconds after the final required gate to inspect completion after its fade-in. Automated state and PNG-completion assertions still require independent inspection of the rendered text. The full burst-spacing 720p, focused current-header 720p and full current-source 1080p runs all report the isolated QA slot, production saves and editor settings restored, with the viewport realtime override released.

The 72 fresh story/legacy PNGs are preserved under `Saved/Tests/CompactHUD/Captures/{1280|1920}/{story|legacy}/`: 21 story and 15 legacy images per resolution. [CompactHUD.json](CompactHUD.json) records each archived path and SHA-256. These archives are the durable review evidence; the original `Preview/` paths in raw reports record capture provenance only. The four historical `StorySliceRender*`/`SmokeRender*` reports were restored after preserving the new reports and images. Review this change's reports under `Saved/Tests/CompactHUD/`, not restored historical reports at the root of `Saved/Tests/` or mutable Preview output paths. Independent manual review of the archived matrix remains pending.

One full burst-spacing 720p attempt timed out at gate6 after 88 checks/12 captures in 88.39 seconds; the runner observed only about 52 cm of vehicle movement in that gate fixture. Its failure and all captures remain under `Saved/Tests/CompactHUD/final-720-gate6-timeout/`. Its QA slot, production-save hashes, editor settings and realtime override all restored. An unchanged-source retry then passed all 121 checks/21 captures in 104.3 seconds; no gameplay code or fixture was altered to obtain that retry. This retained intermittent fixture failure is not erased by the passing rerun.

After the R-only header change, `Saved/Tests/CompactHUD/check_recovery_hint.py` reuses only the native startup and HUDQuiet steps, producing `recovery-header-1280.json` and its screenshot. This ignored one-off fixture verifies current-source startup/capture, not the full story. The subsequent full current-source 1080p suite passes all 121 checks/21 captures. The exclusive HUD test window is now closed and the GPU has been released to the normal host owner for package, performance and browser delivery; no further HUD capture jobs are planned.

The smoke fixture's QA-only change suppresses the duplicate host world render, enables the inspection client, releases the editor viewport realtime override during cleanup and asserts rendering only for an actual capture. An initial 720p run reached 61 checks/15 captures but failed when the new rendering assertion ran on a destroyed client world during teardown. The failure and its images remain under `Saved/Tests/CompactHUD/smoke-1280-initial/`; moving the assertion below the actual-capture guard fixed that fixture error. The subsequent 720p and 1080p runs both pass 66/15 and report the realtime override released. This was a test fixture issue, not a reported gameplay progression failure.

The owner's current package verifier uses fresh campaigns on both peers with campaign saving disabled for startup verification. Its passing separate-process join, crew/animation inventory and seven rendered views do not establish a naturally driven complete story or browser mobile clearance. The historical `Verification/Package.json` was restored; current package evidence is explicitly named `CompactHUDPackage*.json`. Final six-profile results and browser acceptance must be recorded before closing delivery tasks.

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

Physical-phone and off-LAN play, acoustic listening, handling enjoyment and full manual solo/co-op story acceptance are not established by these checks. A portrait browser viewport still receives the fixed 1280×720 game stream; it is not a native portrait HUD. Earlier mobile geometry predicts lower-corner intersections with the existing touch controls, so browser spacing and current decoded-frame review remain required before delivery. The OpenSpec CLI is unavailable; no CLI validation, canonical merge or archival is claimed at this stage.

# Claude handoff — NORD Montréal

Prepared 2026-10-11 after the accepted environment graphics pass. Continue the existing project; do not rebuild it from an older generator or treat this as a new game.

## Start here

```text
Read AGENTS.md and games/nord-unreal/CLAUDE_HANDOFF.md in
/home/von/Work/rouge-warden-codex-nord-unreal.
Use Verification/EnvironmentPolish.md/json as the accepted graphics checkpoint.
Inspect current git changes and process/GPU ownership before doing work.
Preserve concurrent edits, saves, the integrated Plateau map and the live browser demo.
Continue within the user's next requested scope, using the existing pipelines and strict QA.
```

| Item | Location / accepted state |
| --- | --- |
| Repository | `https://github.com/vdimarco/rouge-warden.git` |
| Working checkout | `/home/von/Work/rouge-warden-codex-nord-unreal` |
| Branch | `codex/nord-unreal` |
| Game root | `/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal` |
| Accepted graphics commit | `7d632b1f53bc1c79ff4f86902fff07f9957b6065` |
| Accepted evidence clarification | `e665df273592854642dd7407fadfb9973c504c53` |
| Unreal | `/home/von/.local/share/Epic/UE_5.8.3` — Linux, Vulkan SM6 |
| Project / map | `Quebec.uproject`; `/Game/Maps/LaFontaine` |
| Public player | <https://nord-montreal.vercel.app/> |
| Arcade title page | <https://arcade.uptick.systems/gta/> — prior-release trailer; not recaptured in this graphics pass |
| Separate source project | `/home/von/Documents/ChatGPT/GTA_ Quebec` — **read-only for this gameplay/streaming work** |

Read the repository's `AGENTS.md` before editing. Substantial new changes use the existing OpenSpec workflow. The accepted graphics change is archived at `openspec/changes/archive/2026-10-11-nord-environment-polish`; its requirement is merged into `openspec/specs/nord-unreal/spec.md`. All 14 tasks and ten scenarios are recorded complete. OpenSpec CLI validation was unavailable; structure was validated manually.

### Concurrent changes are separate from the accepted checkpoint

At 17:45 UTC, HEAD was `e665df27` and another workstream had uncommitted changes in:

- `README.md`
- `Scripts/plateau_perimeter.py`, `Scripts/plateau_tower.py`, `Scripts/upgrade_plateau.py`
- `Scripts/test_launcher.py`
- `Source/Quebec/Quebec.cpp`
- New `Scripts/test_editor_shutdown.py` and `Scripts/test_offline_authoring.py`

These paths are relative to the game root. Their state is changing concurrently. Re-run `git status`/`git diff`, establish ownership, and preserve them. The graphics acceptance below applies to the committed checkpoint, not automatically to these later edits. This handoff does not accept, revert, or bundle them.

## What is implemented

The game is a native Unreal neighborhood around Parc La Fontaine and 1334 Sherbrooke Est, with a comic-book look, eight selectable supplied crew designs, walking/sprinting/jumping, cars, runtime traffic/parked vehicles/pedestrians, a compact radar/objective HUD, and two-player native multiplayer.

The campaign is **NORD: One More Tomorrow**, about saving the park from a Boogeyman who traps days inside comic panels. Only two missions are implemented: the chalet worklight/plunger rescue and an ordered seven-gate street race. The remaining six missions are design material in `Design/SaveThePark.md`, not playable content. Mission-boundary saves/reload, encounter recovery and race replay exist; unfinished missions restart at their boundary on reload. Host progression is shared; character choice is connection-local. Faces are static: no facial rig, blinking or lip sync.

Controls: WASD movement/driving; mouse look; Shift sprint; Space jump/handbrake; E contextual interaction/car entry; C crew cycle; F2 per-player comic toggle; R recover; T replay completed race; Esc release browser mouse. The browser has a movement stick, drag-anywhere/gyro look and larger action buttons in two bottom-right rows. Each browser slot controls a separate native game instance.

### Accepted graphics changes

- Tree alpha sampling, mip coverage, Nanite preserve-area, foliage shading and comic masking were corrected. Sky and smooth upward pond reflections retain gradients. All **4,571 tree instances**, raw tree geometry and collision states were preserved.
- **154 park-facing fronts** across Avenue du Parc-La Fontaine, Rachel, Papineau and Sherbrooke received masonry, tall windows, trim, balconies and exterior stairs. There are 305 spatial detail batches, with source footprints and existing height derivation retained.
- **Le Neuville**, 1101 Rachel Est, now uses retained municipal exterior geometry: 57.44 m instead of its 9.6 m visual fallback. **École Le Plateau**, 3700 Calixa-Lavallée, uses its retained U-shaped survey exterior, approximately 20.88 m main walls and 24.02 m roof maximum. Decoration is estimated. Original gameplay colliders remain; these are exterior visual corrections, without upper-floor access/interiors.
- Duplicate old landmark shells/cards were filtered precisely: seven original NoCollision visual components are hidden and four owned filtered copies retain every unaffected face/UV token. Both owned roof-material parents are explicitly saved and fresh-load verified.
- **65 cornices** were closed; exactly four confirmed side edges on three parcels received opaque backed window skins. Final finishing is 36 batches / 13,352 triangles.

The accepted map has **3,048 actors = 2,701 originals + 347 approved additions**. Only the seven exact original render visibility transitions are permitted; original placement, gameplay collision and routes were preserved. The accepted map SHA-256 is:

```text
ed0056d27b3a9496871c538bcbe7e6214b5dbe7d4ae87b88c03015900c3662ce
```

Current source/provenance details: `Verification/GraphicsBuildingSources.md/json`, `Data/Plateau/README.md`, and the generated geometry manifests. No GTA source or Google imagery was copied. This is not an exact Street View reconstruction.

## Accepted QA and where to find it

**Authoritative final report:** `Verification/EnvironmentPolish.md` and `Verification/EnvironmentPolish.json`. All seven bounded final gates passed. The final JSON SHA-256 at handoff preparation is `69b1b2a71d76efb484676fcc174a9bb517ea03fa7b364eef6867081e02012c93`.

Some project README/Verification passages describe earlier maps, HUDs, package timings and performance. Treat them as historical when they conflict with this final report. Do not replace historical evidence with a new run.

| Check | Accepted result |
| --- | --- |
| Final frozen CPU checks | 11 suites; prior corruption rejections preserved |
| Fresh saved map | All 17 existing Plateau checks; exact original actor preservation/visibility allowlist, 347 additions, tree/material/roof readbacks |
| Render completion | 42 Comic/F2 PNGs at 720p and 42 at 1080p, normal exit 0 and clean closed dependency/shader/fatal logs |
| Independent visual review | 36 audit-agent, 32 building-agent, 19 tree-agent editor images, with overlapping coverage and additional cooked spot checks; not every reviewer inspected every image |
| HUD/story/save | 121 checks and 21 PNGs at each size; isolated saves/settings restored |
| Collision / population | 13 checks each |
| Continuous native race | Seven gates, 63.153 seconds, about 271 m actual travel, traffic/collision enabled, zero checkpoint retries, saves restored |
| Linux cook / package | Exit 0, zero cook errors/warnings; separate native host/client; 2,537 loaded meshes across eight families; eight crew, 32 clips, seven rendered screenshots |
| Local / browser package identity | All 48 non-Saved files match SHA-256 |
| Current performance | Six Epic 3 / 100% warmed packaged static scenes; every p95 below 16.67 ms; worst 15.14 ms |
| Public browser | Seven real two-player media/input/reconnect checks and six mobile-emulated checks, normal exit 0 |
| Preservation | All 651 protected identities exact before host startup; afterward 650 exact and only native guest `CachedClientID` 25→26. Existing saves unchanged; no new live save slots |

Measured hardware: RTX 4090 / i9-14900K / Linux / UE 5.8.3. Native static averages were 82.0–102.9 fps. Public browser decoded about 23–25 fps; **no 60 fps browser claim**. Static/native performance is not remote responsiveness acceptance.

Local evidence (ignored by Git, available on this PC):

- `Saved/Tests/EnvironmentPolish/Final720/` and `Final1080/`: accepted editor captures and manifests.
- `Saved/Tests/EnvironmentPolish/PackageScreenshots/`: accepted new cooked screenshots. The ordinary `Builds/Linux/.../Saved/Screenshots/Linux/` files were restored to their protected historical versions; do not mistake them for this pass.
- `Saved/Tests/EnvironmentPolish/FinalPerformance.json`, `FinalPerformance/`, `PerformanceProcess.json`: accepted current profiles; managed harness exited 0.
- `Saved/Tests/EnvironmentPolish/BuildingsIndependentReview.json`, `TreeAndGradientVisualReviewFinal.json`, `FinalVisualAudit.json`, `PreviewPromotion.json`, `RootDeliveryAudit.json`.
- `Browser/.qa/live-2026-10-11T17-11-31-006Z/summary.json` and `Browser/.qa/mobile-2026-10-11T17-13-02-348Z/summary.json`.
- `Saved/Recovery/environment-polish-20261011T145444Z/`: recovery snapshot, 6,364 Content files and 651 protected files. Preserve it and `actors-before.json`.

Eight unchanged accepted 1080p screenshots are committed under `Preview/EnvironmentPolish/`; start with `PlateauCorner_Comic.png`, `Perimeter2_Comic.png`, `LeNeuvilleSkyline_Comic.png` and `SchoolParkFront_Comic.png`. A fresh clone does not contain local packages, logs, recovery or other ignored evidence. Request/access those from this machine rather than inventing a new acceptance history.

### Important failures already handled

- Relative uproject startup failed/crashed. Always pass the absolute project path; `Scripts/launch.sh` already resolves it.
- Bulk material authoring in a live Vulkan renderer hit an RHI uniform-buffer reference assertion. Use a **fresh NullRHI authoring process**, let it exit, then a separate normal Vulkan verification/capture process. This changes authoring workflow, not production graphics quality.
- Missing owned roof-parent packages passed an early property-only check but failed fresh rendering. The shared helper now saves parent before instance and validates disk/parent identity. Keep those checks.
- A clean 42-image candidate still had giant blue side planes. It was visually rejected and fixed. Exit 0/property assignments alone do not accept graphics.
- The QA race driver hit stationary traffic on its old outside hairpin arc. Only its final-gate lookahead changed to 950 cm; all 32 original assertions, route/gates/time/travel thresholds and native input remained. Unused reverse helpers were removed. Production driving was unchanged by this pass.
- The first final profile parent ended 143 with unknown cause and no aggregate result. Those outputs remain rejected under `InterruptedPerformance/`. The unchanged full suite then passed under a managed one-shot unit. Do not reuse the interrupted output as accepted evidence.

All rejected captures/logs remain hashed in the report. Do not delete failures or weaken a gate to obtain a pass.

## Runtime ownership and GPU rules

At handoff inspection, `nord-browser-demo.service` was active/running with two `Quebec` processes. RTX 4090 usage was 15,265 MiB, free 8,801 MiB. **This is a point-in-time snapshot, not a new preflight pass.** The live demo consumes the VRAM required by other rendering jobs.

Before any editor, capture, profiling, package-render or streaming launch, inspect current GPU/processes and establish ownership. A separate task, **Create NORD promotion trailers** (thread `01a127df-bee5-7303-87cd-523985629232`), may own capture jobs in the separate source project. Coordinate; do not kill its editor/capture or unrelated apps. Run heavy jobs serially.

```bash
cd /home/von/Work/rouge-warden-codex-nord-unreal
git status --short
systemctl --user show nord-browser-demo.service -p ActiveState -p SubState -p Result
nvidia-smi --query-gpu=name,memory.used,memory.free --format=csv,noheader,nounits
ps -eo pid,ppid,comm | rg 'Unreal|Quebec|ffmpeg'
```

The demo uses the existing `Scripts/browser_streaming.py` lifecycle under its user service. Helper commands are `self-check`, `check`, and `run`; there is no helper `stop` command. `check` requires no rendered Unreal jobs, free owned ports and **12,000 MiB free on adapter 0**. It is expected to reject while the normal demo is already active. Never bypass the guard, lower graphics defaults to pass it, or start a second lifecycle.

Only for an intentional, coordinated maintenance window, stop **just** `nord-browser-demo.service` through `systemctl --user stop nord-browser-demo.service`; let the helper clean up its owned children and confirm they exited. Preserve public/Funnel/TURN services. After jobs finish and the unchanged preflight passes, restore the normal demo using the existing `Browser/HOSTING.md` service recipe, then verify actual media/input/reconnect. Transient units use no reboot persistence; inspect whether the unit still exists before choosing start versus the documented `systemd-run` recipe.

Keep `nord-browser-public.service`, `nord-browser-funnel.service`, `nord-browser-turn-funnel.service`, and the named `nord-browser-turn` container intact. Recreating the Cloudflare Quick Tunnel can change its hostname and require a browser rebuild/Vercel deployment. Native asset changes alone did not require a Vercel deployment. Never print, commit or upload `Saved/BrowserStreaming/relay/ice.json`, `turnserver.conf`, or relay credentials.

## Where to change things

| Concern | Existing implementation |
| --- | --- |
| Trees / comic | `Scripts/refine_plateau_trees.py`, `apply_comic_style.py`, `plateau_rendering.py`; saved tree/leaf/comic assets in `Content/Art/` |
| Added park-facing fronts | `Scripts/plateau_perimeter.py`, shared primitives in `plateau_facades.py`; `Data/Plateau/PerimeterGeometry/` |
| Survey landmarks / roof persistence | `Scripts/plateau_tower.py`, `plateau_school.py` |
| Exact duplicate-shell removal | `Scripts/plateau_landmark_visuals.py`; `Data/Plateau/LandmarkVisualGeometry/` |
| Cornices / four side skins | `Scripts/plateau_facade_finish.py`; `Data/Plateau/FacadeFinishGeometry/` |
| Saved-map verification / cooked inventory | `Scripts/verify_plateau.py`, `package_inventory.py`, `verify_package.py`, `render_log_guard.py` |
| Gameplay / HUD / vehicle | `Source/Quebec/QuebecGameplay.cpp` / `.h`; native handling tests in `QuebecCarHandlingTests.cpp` |
| Campaign / save authority | `Source/Quebec/QuebecCampaign.cpp` / `.h`; native save tests in `QuebecCampaignSaveTests.cpp`; module startup/shutdown in `Quebec.cpp` |
| Native authoring orchestration | `Scripts/upgrade_plateau.py` — full regeneration has **not** been accepted end-to-end; prefer bounded authoring with recovery |
| Browser UI / touch / runtime | `Browser/`; native lifecycle `Scripts/browser_streaming.py` |

Do not use `prepare_lafontaine.py` / `create_lafontaine.py` to regenerate the current map: those create the older environment. Existing raw OSM/municipal data, crew originals, material inputs and gameplay routes are protected. Reuse existing helpers rather than creating another parallel generation pipeline.

## Reusable commands and QA precautions

Commands below are references, **not a batch to execute immediately**. Read each script and its outputs first, account for concurrent edits, back up affected assets/settings/saves, and choose checks for the actual change.

Local play (GPU job; coordinate first):

```bash
cd /home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal
./Scripts/launch.sh play
```

The launcher prefers `Builds/Linux/Quebec.sh` if present. Editor asset changes therefore do not appear in local/package/browser play until rebuilt. `editor`, `host`, and `join HOST:7777` are the other launcher modes; do not launch these over owned GPU jobs.

CPU-only graphics checks (the existing geo Python has Shapely; system/bundled Python did not):

```bash
cd /home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal
for suite in test_plateau_landmark_visuals test_plateau_tower_materials \
  test_plateau_facade_finish test_plateau_perimeter test_plateau_facades \
  test_plateau_trees test_package_inventory test_verify_plateau_background \
  test_verify_plateau_landmarks test_render_log_guard test_upgrade_plateau_guard
do
  /home/von/.cache/nord-geo-venv/bin/python "Scripts/$suite.py" || exit 1
done
```

Native checks use an absolute `Quebec.uproject` with the real map, outside existing PIE. Relevant fixtures:

- `Scripts/test_compact_hud.py`: real Vulkan, `-NordCampaignQA -NordStoryRenderChecks -NordCaptureWidth=1280` or `1920`, serial runs. Preserves isolated saves/settings; inspect output destinations first.
- `Scripts/test_race_drive.py`: real rendered native input, `-NordCampaignQA`; do not add `-NordNoCampaign` or `-NordNoCampaignSave`.
- `Scripts/car_collision_test.py` / `population_test.py`: `-NullRHI -NordNoCampaign` isolated checks.
- `Scripts/verify_package.py`: current cooked startup, seven views, crew cycles and separate host/client joining.
- `Scripts/verify_packaged_gameplay.py --soak-seconds 1800`: longer lifecycle/soak fixture; not repeated in this graphics pass.
- `Scripts/profile_package.py`: six strict Epic/100% static profiles. Current final method: 3,000 CSV frames, discard first 600 and last two, retain 2,398; p95 below 16.67 ms.
- `Browser/live.test.mjs`, then `Browser/mobile.test.mjs`: real public streaming tests; run serially with both browser slots free and inspect screenshots.

Capture/profile and some gameplay scripts overwrite historical `Preview/` / `Verification/` destinations. Copy/retarget them to a **new timestamped evidence directory** before rerunning. The prior scoped wrappers are in `Saved/Tests/EnvironmentPolish/` (`capture_final720.py`, `capture_final1080.py`, `profile_final.py`, `verify_package.py`, `test_compact_hud.py`, `test_race_drive.py`). Preserve those too. `verify_graphics.py` in that directory is a read-only **checkpoint-specific** verifier requiring `actors-before.json`, `Applied.json`, and `apply_graphics.py`; it asserts the exact accepted map hash. Do not relax that assertion to accept a new map; derive a separately recorded new-scope verifier while retaining original-state checks.

Cook the local package only after coordinated authoring/QA preparation, from the game root:

```bash
/home/von/.local/share/Epic/UE_5.8.3/Engine/Build/BatchFiles/RunUAT.sh BuildCookRun \
  -project="$PWD/Quebec.uproject" -nop4 -platform=Linux -clientconfig=Development \
  -build -cook -stage -pak -archive -archivedirectory="$PWD/Builds" \
  -map=/Game/Maps/LaFontaine -unattended -utf8output -nocompileeditor \
  -NoUBA -MaxParallelActions=3 -AdditionalCookerOptions=-NullRHI
```

With the owned demo stopped for the package update, synchronize only the intended package and preserve all save directories:

```bash
rsync -a --delete --exclude='Saved*' Builds/Linux/ Builds/Browser/Linux/
```

Then verify every non-Saved file identity, fresh package dependencies/rendering, save preservation, unchanged preflight, normal host restore and real browser media/input. The guest's legitimate `CachedClientID` increment is runtime state; do not reset active state merely to force an old hash. Never overwrite production campaign saves.

Already installed browser QA runtime (no dependency installation needed on this PC):

```bash
cd /home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal/Browser
export NORD_PLAYER_URL=https://nord-montreal.vercel.app/
export NORD_PLAYWRIGHT_PATH=/home/von/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
/home/von/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node live.test.mjs
# Only after the first test has completed and released its slots:
/home/von/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node mobile.test.mjs
```

Do not use the absent `qa/browser/node_modules` path on this checkout or silently introduce a DNS override. Record the actual network scope, process exits, decoded frames and limitations. Package/native/browser jobs must remain serialized; PIE and packaged tests reuse ports.

## Remaining work to scope with the user

1. **Architectural likeness:** ordinary elevations/opening rhythms remain estimates; 85 of the new fronts use the untagged three-storey fallback and 69 use tagged storeys ×3.2 m. Farther/background/rear elevations still contain generic masses and repeated blue window cards. Notre-Dame remains a simplified 35.2 m shell. The 1334 Sherbrooke municipal association is uncertain (IoU 0.649); do not auto-replace it. Use measured frontage references and bounded replacements rather than broad overlays.
2. **Park likeness / foliage:** flat ground, pond shape/banks/cascades and simplified terrain remain. NorthPark water is flat/pale at a reviewed angle. All mapped trees share one crown/species model. Wind, species variety and moving-camera temporal shimmer are not accepted by static captures.
3. **Real play quality:** physical iPhone/Android, cellular/off-LAN NAT, audible sound, sustained latency, naturally driven packaged full Mission 1–2 progression/reload and subjective handling still need meaningful playtests. Native PIE story checks and browser decode/input checks cover narrower scopes.
4. **Story / promotion:** six later missions remain design only. Current trailer/title page belong to the prior release; coordinate the separate trailer task before replacing them with new footage.

Do not describe these as already finished. Prioritize the user's next request, keep the high graphics/QA bar, and report explicit evidence and remaining limits.


## 2026-10-13 — curb parking and fitted collision

See `Verification/CurbParking.md/json`. The installed `Builds/Browser/Linux` now uses actual concrete curb queries, bounded qualified parking (19–20 added), three fitted convex car proxies, four-wheel ground support, glancing collision response and fitted checkpoint clearance. Initial corridor validation avoids idle mission cars; stale cleared junction reservations no longer starve earlier-ticking traffic. Original Content files/map, art, stream settings, mobile production UI, camera limits, 15:00 clock and five runtime Saved directories are preserved. Tests: native 21, collision PIE 13, two-player city 14, browser unit 24/page, public mobile 16 and public desktop peers 7 passed. Current host `host-20261014-005051-1631030.log`; rollback `Builds/BrowserPrevious-curb-parking-20261013`. Physical-phone/carrier performance and full campaign replay remain unverified. Keep original decorative street-car art and mission car positions.

## 2026-10-13 — continuous race and stream follow-up

`Verification/DrivingStreamFollowup.md/json` closes the continuous Mission 2 race check for the installed collision revision: seven ordered gates, 271.62 m, 63.0 simulated seconds, no retry/stall, actual native E/throttle/steering, collision and sixteen traffic actors enabled, persisted mission 2 and isolated QA save restored. Editor exit 0 and clean dependency/fatal scan. Separate 60.409-second public-player camera sweep: 29.96 decoded FPS, zero drops/freezes/lost packets, 100.1 ms longest callback gap, adaptive phone fallback 640×360 VP8, direct host UDP on this PC. Source and all 48 installed package file identities match CurbParking; production save preserved. Live service/tunnels were not restarted. No new optimization or speedup is claimed. Physical phones/carrier, subjective handling/audio, rendered packaged Mission 1–2 progression and GPU frame-time distribution remain unverified; the native race was standalone NullRHI PIE. Raw run: `Saved/RaceCurb-20261014`; stream: `Saved/BrowserStreaming/samples/2026-10-14T02-05-43-754Z-NordHost`.


## 2026-10-14 — mobile UX, swimming and local traffic

PR 351 merged as `38ad7494`; production alias `nord-montreal.vercel.app` serves deployment `dpl_Gi5bvxeg4CDNYCMN3Mnsm2RyAfox`. See `Verification/MobileUX.md/json` for exact identities and scope. Installed native binary SHA-256 `879de4709ebb18e465b94d8823ee64b15b2bdc4b4bf5291166c7b2c68320cff8`, 48 package files; rollback `Builds/BrowserPrevious-mobile-ux-20261014`. Current host/friend logs `*-20261014-040507-2408502.log`. All five runtime Saved roots were preserved, including the existing story save. Separate source/art checkout and original map/art remain untouched by this task; merged crew animation fixes are retained.

Double-tap Move/hold or double-tap Sprint while moving; action-button dragging looks without dropping held actions, with background look priority. Small tap jitter is tolerated; deliberate drag-and-return cannot latch sprint. Menus, rotation, blur, cancel, disconnect and car transitions clean up keys/latches, and accessibility activation can cancel sprint. Actual ponds now use native replicated surface swimming, buoyancy and stroke; safe banks restore walking, islands/two bridges stay dry, hand props hide, idle treads and travel poses horizontally. Jump becomes Stroke. The compact circle radar covers 500 m. Eight of sixteen traffic cars stay on local circuits; 600 s replay median nearby traffic improved from one to six. Phones start 960/2 Mbps, recover to 1280/4 Mbps, and retain 800/1.5 and emergency 640/1 profiles for sustained pressure. Native graphics, 30 FPS cap, independent worklight aim and existing camera limits remain.

Accepted: 32 browser unit checks, 17 final real-media phone-layout checks, seven public independent-peer checks, 26 native checks before the final visual pose tweak, ten final two-peer swimming checks, fresh packaged wide/upright water renders and 600 s traffic replay. Twelve public static files match the tested local build. Final public 60.281 s camera sweep: 29.93 decoded FPS, 1280×720 VP8, 2.39 Mbps, zero drops/freezes/loss, longest callback gap 116.7 ms, direct host UDP on this PC. Exact measurements are in MobileUX.json. Rejected fixture/pose/relay-floor attempts are retained under `Saved/StreamClarity-20261014`; do not count them as passes. Physical phones/carrier/off-LAN, audible sound, subjective handling and a new full campaign/race replay remain unverified. Swimming reuses crew clips; constrained relay links still need a grainier emergency profile. OpenSpec CLI absent; manual scenario/structure checks apply. Archive: `openspec/changes/archive/2026-10-14-nord-mobile-ux` after final verification. Larger stream-speed work remains active.


## 2026-10-14 — browser media lifecycle

PR 352 (`e241cc56`) stops title-loop downloads/decoding during connection, intro, play and backgrounding; data saver/reduced motion retain the poster without a title source. Rotation updates only needed visible media, full trailer loads explicitly and releases on close, and late autoplay results cannot restart hidden title playback. Production alias serves READY deployment `dpl_7MRfH2Dzxugi1SWsa4PYec3zepzF`; previous alias deployment is `dpl_Gi5bvxeg4CDNYCMN3Mnsm2RyAfox`. Twelve static files match the tested candidate; four public media checks and seven public peer/input/reconnect checks passed. See `Verification/BrowserMedia.md/json` for exact identities and evidence. Tests: 36 unit checks, extended existing Chromium UI suite and four real-media phone-orientation checks. A Chromium comparison observed four MP4 request attempts before versus zero after for each still-only preference; transfers were aborted, so no megabyte/FPS speedup is claimed. Native package/source and existing saves preserved; no native build or host restart. Physical phones/carrier and audible trailer playback remain unverified. Archived lifecycle change: `openspec/changes/archive/2026-10-14-nord-browser-media-lifecycle`; larger native stream-speed change stays open.

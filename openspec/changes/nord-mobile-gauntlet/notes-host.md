# Host steps for this change

The cloud container has no Unreal Engine, no GPU and no dotnet. These steps run on the owner's PC with UE 5.8.3. Run them in order from `games/nord-unreal/`, with the project's editor closed.

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
uat="$ue_root/Engine/Build/BatchFiles/RunUAT.sh"
uproject="$(pwd)/Quebec.uproject"
```

The `gauntlet_loop.py` flags below follow `design.md`. If `python3 Scripts/gauntlet_loop.py <command> --help` differs, follow `--help` and fix this file. Items marked **(unverified)** were written from memory of the engine and must be confirmed here.

## 0. GPU window and safety
- Agree a GPU window with the user for every step that renders. Steps 3 to 9 render.
- Stop only the game lifecycle: `systemctl --user stop nord-browser-demo.service`. Never stop `nord-browser-public`, the two funnel units or the `nord-browser-turn` container. A new Quick Tunnel hostname breaks the live page.
- Record `nvidia-smi` before you start. Do not stop user applications to make a run pass. The runner labels a run "contended" when another GPU process is present, and a contended run is never ranked.
- End each window by starting the demo again with the native recipe in `Browser/HOSTING.md`. Check that the other units are still active and the tunnel hostname is unchanged.
- Never write ICE server lists, TURN usernames or passwords into `Verification/`, `Saved/Gauntlet/` reports or logs you commit.

## 1. Build and package
```bash
"$ue_root/Engine/Build/BatchFiles/Linux/Build.sh" QuebecEditor Linux Development "$uproject" -WaitMutex -NoUBA -NoHotReloadFromIDE
"$ue_root/Engine/Build/BatchFiles/Linux/Build.sh" Quebec Linux Development "$uproject" -WaitMutex -NoUBA
"$ue_root/Engine/Build/BatchFiles/Linux/Build.sh" Quebec Linux Shipping "$uproject" -WaitMutex -NoUBA
```
The cloud stub check compiled and linked the new C++ against stub headers. The Gauntlet and CSV profiler stubs were written from memory **(unverified)**. Fix what the real build finds. Check that the plugin name in `Quebec.uproject` and the module name in `Source/QuebecGauntletTest/QuebecGauntletTest.Build.cs` match the engine's Gauntlet plugin **(unverified)**: `find "$ue_root/Engine/Plugins" -name 'Gauntlet*.uplugin'`.

The Gauntlet controller is in its own module, `QuebecGauntletTest`. `Quebec.uproject` lists it and keeps it and the Gauntlet plugin out of Shipping with `TargetConfigurationDenyList` **(unverified field name)**. Check each build:
- The Development builds compile `QuebecGauntletController.cpp`. UBT builds the modules that `Quebec.uproject` lists **(unverified)**. If the module is missing, add `if (Configuration != UnrealTargetConfiguration.Shipping) ExtraModuleNames.Add("QuebecGauntletTest");` to both `Source/*.Target.cs` files.
- The Shipping build succeeds and does not compile `QuebecGauntletController.cpp`. This is the only Shipping check; nothing else here builds Shipping.
- The editor opens the project with the Gauntlet plugin enabled: `"$ue_root/Engine/Binaries/Linux/UnrealEditor" "$uproject"`.

Package the Browser build into a staging folder first. `Builds/Browser/Linux` is the live demo, so replace it only after the staged package passes. The new package is the same game plus the Gauntlet code, which runs only with `-NordGauntlet`:
```bash
stage="$(pwd)/Builds/BrowserGauntletStage"
"$uat" BuildCookRun -project="$uproject" -noP4 -platform=Linux \
  -clientconfig=Development -build -cook -map=/Game/Maps/LaFontaine -stage -pak -archive \
  -archivedirectory="$stage" -utf8output -unattended \
  -AdditionalCookerOptions=-NullRHI -NoUBA
```
In the GPU window, start the staged package without any gauntlet flag for 90 s, then read its log:
```bash
timeout 90 "$stage/Linux/Quebec.sh" /Game/Maps/LaFontaine -RenderOffscreen -windowed -ResX=1280 -ResY=720 -unattended -nosound \
  -abslog="$stage/no-gauntlet.log"
grep -n "NORD_GAUNTLET\|nord.Gauntlet" "$stage/no-gauntlet.log"
grep -in "gauntlet" "$stage/no-gauntlet.log"
```
- The first `grep` finds nothing.
- The second `grep` finds only plugin and module mount lines. No Gauntlet controller, ticker or heartbeat line appears **(unverified log categories)**.

Then, with the demo stopped (step 0), keep the old package and put the staged one in its place:
```bash
mv Builds/Browser/Linux "Builds/Browser/Linux-BeforeGauntlet-$(date -u +%Y%m%d)"
cp -a "$stage/Linux" Builds/Browser/Linux
```
Start the demo again (step 0) and check that the public page still streams. If it does not, move the old package back.

Then run the offline checks on the host:
```bash
python3 Scripts/gauntlet_loop.py self-check
python3 Scripts/browser_streaming.py self-check
python3 Scripts/test_gauntlet_route.py
```

## 2. C# test node
UAT compiles `Build/Scripts/NordGauntlet.Automation.csproj` when it runs with `-ScriptsForProject` **(unverified)**. If the build fails on engine references, copy the reference block from an engine `*.Automation.csproj` under `$ue_root/Engine/Source/Programs/AutomationTool/`. The UAT log must show that `NordMobileLoop` was found.

## 3. RunUnreal smoke on Linux (one lap)
```bash
run="$(pwd)/Saved/Gauntlet/$(date -u +%Y%m%dT%H%M%SZ)-smoke"
"$uat" RunUnreal -project="$uproject" -ScriptsForProject="$uproject" -platform=Linux -configuration=Development \
  -build="$(pwd)/Builds/Browser/Linux" \
  -test="NordMobileLoop(mode=perf,size=1412x652,sky=night-rain,laps=1,run='$run')"
```
The `-build=` path form and `-ScriptsForProject` are **(unverified)**. The wrapper runs the same test and writes the verdict:
```bash
python3 Scripts/gauntlet_loop.py native --mode perf --size 1412x652 --sky night-rain --laps 1 --label smoke
```
If RunUnreal or the Gauntlet plugin does not work on Linux, record the error in task 11.2 and use the direct launch. It starts the packaged binary with the same flags, as `profile_package.py` does, and the subsystem quits by itself:
```bash
python3 Scripts/gauntlet_loop.py native --direct --mode perf --size 1412x652 --sky night-rain --laps 1 --label smoke
```
Check the smoke run:
- The exit code is 0. Codes: 2 stuck over 10 s, 3 sky flags missing, 4 CVar mismatch, 5 timeout, 6 setup (a bad mode, the wrong map, no loop, a stop off the road or a lost world; the `error=` line says which).
- The CSV is `native/NordGauntlet-perf-night_rain.csv`. If the engine added its own extension, the name ends in `.csv.csv`, which the runner also reads **(unverified)**.
- Under RunUnreal, the log shows the controller ending the test with the run's exit code, and the game did not quit before that. The two meet through the console variables `nord.GauntletController` and `nord.GauntletExit`.
- The log has `NORD_GAUNTLET stop=` lines for S1 to S5 in order and a `NORD_GAUNTLET summary` line.
- `native/route.json` exists. The measured loop length is near 3.0 km (2.5 to 3.5 km). Note the heaviest leg in `native/legs.json`.
- The CSV has FrameTime, GameThreadTime, RenderThreadTime, RHIThreadTime and GPUTime **(unverified names)**. `verdict.json` lists any missing column.
- The summary p95 and the CSV p95 agree within 1 ms.
- The car drove with pawn input disabled. If real input wrote zero axes each frame, the car stalls at S1 and the run exits with code 2.

## 4. Phone profile readback
```bash
python3 Scripts/gauntlet_loop.py native --direct --quality phone --mode perf --size 1412x652 --sky day --laps 1 --label profile
```
`phone` passes `-DeviceProfile=NordPhoneStream` **(unverified that the override applies in a Development package)**. Every CVar in `[NordPhoneStream DeviceProfile]` must read back in the log. Also check that `Builds/Browser/Linux/Quebec/Saved/Config/Linux/GameUserSettings.ini` does not override a scalability group. If the override does not apply, the launcher expands the section into `-ExecCmds`. Record which path works in task 11.3.

## 5. References and repeatability
```bash
python3 Scripts/gauntlet_loop.py reference
```
This renders the ceiling look (all `sg.*` at 3, screen percentage 100, VSM on, Lumen at Epic, TSR) twice, at 1412x652 and 652x1412, in both skies, with `-NordNoAmbient`. Every image pair must have SSIM at least 0.98, or the round is invalid. Each sky switch at a stop must log `NORD_SKY_WEATHER command <weather> settled`: the new weather and the street wetness then start settled, so the day stills show dry streets and no still depends on the frame rate. Install `flip-evaluator` with pip if you want the report-only FLIP map.

## 6. Baseline twice
```bash
python3 Scripts/gauntlet_loop.py native --quality current --mode perf --size 1412x652 --sky night-rain --laps 1 --label baseline-a
python3 Scripts/gauntlet_loop.py native --quality current --mode perf --size 1412x652 --sky night-rain --laps 1 --label baseline-b
```
Use `--direct` on both if RunUnreal failed in step 3. The two p95 values set the noise tie. If the baseline is not feasible (FrameTime p95 over 30.0 ms or GPUTime p95 over 28.0 ms), the tuner searches downward first.

## 7. Overnight tune
```bash
python3 Scripts/gauntlet_loop.py tune --until 06:30
```
Set `--until` to the end of the agreed window. The tuner measures the baseline and the ceiling twice, measures each single step once, combines steps, climbs back, and stops after 24 candidates or at the window end. It then confirms the winner and the baseline with 3 measured laps each, both skies, landscape and portrait. Every candidate goes into `tune.json`.

## 8. Stream runs
Build a separate local player that accepts `?pin=`, and serve it on loopback port 8100. From `Browser/`:
```bash
NORD_SIGNALLING_URL=ws://127.0.0.1:9010 NORD_DEFAULT_STREAMER_ID=Choose NORD_QA_PIN=1 npm run build
python3 -m http.server 8100 --bind 127.0.0.1 --directory dist
```
Do not deploy this `dist`. Rebuild the normal player before any deploy.

Each sample needs a fresh lifecycle start. The car starts 95 s after the first BeginPlay, when NordFriend1 is asleep. It drives one warm-up lap, which is not gated, and the gated lap starts at the first `NORD_GAUNTLET leg=` line, about 5 minutes later. Sample the winner and the baseline at rung 0 and rung 1, in landscape and in portrait: eight rows. For one row, start the lifecycle with the gauntlet on NordHost. From `games/nord-unreal/`:
```bash
run="$(pwd)/Saved/Gauntlet/$(date -u +%Y%m%dT%H%M%SZ)-stream-winner-r0-land"
NORD_SKY_ARGS="-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather" \
NORD_STREAM_QUALITY="file:$(pwd)/Saved/Gauntlet/<tune run>/candidates/<id>.execcmds" \
NORD_STREAM_GAUNTLET="$run" \
python3 Scripts/browser_streaming.py run
```
Use `NORD_STREAM_QUALITY=current` for the baseline. The launcher refuses `NORD_STREAM_GAUNTLET` unless `NORD_SKY_ARGS` has both hour and weather. In a second terminal, sample the lap. Use `--pin 1` for rung 1 and add `--portrait` for portrait:
```bash
python3 Scripts/gauntlet_loop.py stream --run "$run" --slot NordHost --pin 0
```
The sampler drives `Browser/stream-sample.mjs` with `--frames --latency --trigger --out`, saves a decoded frame at each stop hold, and judges the stream gate. When it ends, stop the lifecycle with Ctrl-C and start the next row.

Report-only rows:
- Two viewers: start the lifecycle once for the baseline and once for the winner in the same window. Run one sampler per slot at the same time (`--slot NordHost` and `--slot NordFriend1`). The winner may lose at most 2 decoded FPS against the baseline.
- Relay: set `NORD_ICE_CONFIG` to the private `ice.json` before `run`, and add `--relay` to the sampler. Never print the file.

After the last row, restore the demo (step 0).

## 9. Review and write the profile
```bash
python3 Scripts/gauntlet_loop.py report Saved/Gauntlet/<tune run>
```
Open `review.html` with the user. It shows the ceiling, baseline, candidate and decoded frame for each view, with SSIM, a difference map and an A/B flip. Only after the user approves the winner's paired captures:
```bash
python3 Scripts/gauntlet_loop.py write-profile Saved/Gauntlet/<tune run> --candidate <id>
python3 Scripts/browser_streaming.py self-check
```
This rewrites only `[NordPhoneStream DeviceProfile]`. The stream default stays `current`. Flipping it to `phone` is a separate change.

## 10. Physical phone (person)
Start one stream lifecycle as in step 8 with the winner profile, and also set the demo's `NORD_ICE_CONFIG`, so a phone on carrier data can use the relay. Watch one full lap on NordHost on a real phone:
- Android Chrome and iOS Safari, each on Wi-Fi and on carrier data, through the public page.
- Note: video starts, no visible freeze over the lap, the car drives the whole loop, the picture matches the paired captures, and the HUD fits in landscape and portrait.
- Then stop the lifecycle, restore the demo (step 0), drive one lap by hand on it, and note the perceived input delay. The gauntlet drives the car itself, so a hand lap needs the normal demo.

Record the date, device, OS, browser, network and deployment ID in its own file, `Verification/Gauntlet/<YYYYMMDD>-phone.md`. Never put phone results in a `verdict.json`.

## 11. Commit the round
- Copy each run's verdict summary to `Verification/Gauntlet/<YYYYMMDD>-<label>.json`, failing runs included. Do not commit PNGs there.
- Copy the stills the user approved to a new folder, `Preview/Gauntlet/<YYYYMMDD>/`.
- Score the round in `docs/gauntlet/gta-mobile.md` with rubric v1. "Performance stability" cites the verdict file.

## Known limits to confirm on the host
- RunUnreal and the Gauntlet plugin on Linux. Every public example is Win64.
- `-DeviceProfile=` in a Development Browser package, and `GameUserSettings.ini` overrides.
- The CSV column names, and GPUTime with `-csvGpuStats`.
- C++ driving of a possessed, rendered car with pawn input disabled.
- The loop length, and which leg is heaviest.
- Whether UAT finds `Build/Scripts/NordGauntlet.Automation.csproj`.
- Whether UBT builds `QuebecGauntletTest` from `Quebec.uproject`, and whether Shipping builds without it and without the Gauntlet plugin.
- Whether `BeginCapture` keeps the given CSV file name as it is.

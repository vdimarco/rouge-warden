# Host steps for this change

The cloud container has no Unreal Engine, no GPU and no dotnet. These steps run on the owner's PC with UE 5.8.3. Run them in order from `games/nord-unreal/`, with the project's editor closed.

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
uat="$ue_root/Engine/Build/BatchFiles/RunUAT.sh"
uproject="$(pwd)/Quebec.uproject"
```

The `gauntlet_loop.py` flags below follow `design.md`. If `python3 Scripts/gauntlet_loop.py <command> --help` differs, follow `--help` and fix this file. Items marked **(unverified)** were written from memory of the engine and must be confirmed here.

## 0. GPU window and safety
- Agree a GPU window with the user for every step that renders. Steps 3 to 10 render.
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
- `native/route.json` exists. The measured loop length is near the offline model's 3,488 m driven line, and the route gate is 3.0 to 4.0 km. A perf lap is about 296 s of driving in the model, and the lap limit is 360 s. Note the heaviest leg in `native/legs.json`.
- The CSV has FrameTime, GameThreadTime, RenderThreadTime, RHIThreadTime and GPUTime **(unverified names)**. `verdict.json` lists any missing column.
- The summary p95 and the CSV p95 agree within 1 ms.
- The CVar readback includes the `loop.json` `fixed` CVars, `t.MaxFPS 60` and `r.AntiAliasingMethod 4`. The second comes from `Config/DefaultEngine.ini` **(unverified)**. If it reads back another value, the run exits with code 4: record which setting overrides it.
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
This renders the ceiling look (all `sg.*` at 3, screen percentage 100, VSM on, Lumen at Epic, TSR) twice, at 1412x652 and 652x1412, in both skies, with `-NordNoAmbient`. Every image pair must have SSIM at least 0.98, or the round is invalid. Both ceiling runs must also hold every still, or the `repeat_stills` gate fails. Each sky switch at a stop must log `NORD_SKY_WEATHER command <weather> settled`: the new weather and the street wetness then start settled, so the day stills show dry streets and no still depends on the frame rate. Install `flip-evaluator` with pip if you want the report-only FLIP map.

## 6. Baseline twice (inside the tune)
Do not run separate baseline runs. The tune in step 7 starts with two baseline perf runs of its own, `baseline-a` and `baseline-b`, and only those two set the noise tie in `tune.json`. The tune has no option to reuse other runs, so separate runs here would cost about 23 minutes of the window (two perf runs of about 690 s) and give a tie that the tune does not use. If the baseline is not feasible (FrameTime p95 over 30.0 ms or GPUTime p95 over 28.0 ms), the tuner searches downward first, one step below today's value per knob.

## 7. Overnight tune
```bash
python3 Scripts/gauntlet_loop.py tune --until 06:30
```
Set `--until` to the end of the agreed window. Add `--direct` if RunUnreal failed in step 3. To reuse the step 5 references instead of rendering the ceiling again, add `--reference Saved/Gauntlet/<reference run>`. The runner refuses that folder, before it starts any run, when its commit or package build differs from the current ones, or when a ceiling run at 1412x652 lacks a still, did not exit cleanly or was contended. The tuner measures the baseline and the ceiling twice, measures each single step once, combines steps, climbs back, and stops after 24 candidates or when the next candidate would not finish before `--until`. It then confirms the best ranked candidates, best first, with 3 measured laps each, both skies, landscape and portrait, until one passes every native gate. The baseline is confirmed only when it is ranked, in its place in the ranking. Every candidate goes into `tune.json`.

Plan the window from these estimates. A candidate is a perf run and a look run, about 20 minutes, so 24 candidates take about 8 hours. A confirmation run is about 22 minutes, and each confirmed candidate needs 4 of them, so a winner that passes takes about 1.5 hours more. A failed run ends a candidate's confirmation at once, because its result is then final and its other runs would change no verdict. So a winner that fails takes at most 1.5 hours, and the next candidate starts right after it and takes up to another 1.5 hours. The search keeps no time for the confirmation. A confirmation run starts only when its planned time ends before `--until`. Without `--reference`, the first candidate also renders the ceiling look, about 28 minutes, and the search plans it so. The confirmation's plan starts at the estimate, made longer by as much as the search found this host slower: the tune keeps its slowest run against that run's estimate in `tune.json` (`host_slowdown`). Only runs that ended with exit 0 and were not contended count, because a run that hung to the runner's limit, failed or shared the GPU says nothing about this host's speed. It rises to the longest confirmation run measured so far, so no run ends after the window by plan. A run can still take longer than every run before it. When the window cuts a candidate's confirmation, its result has the reason "the window ended before every confirmation run" and counts as not run. A contended confirmation run runs once more. After a second contended run, the result has the reason "a foreign GPU process shared a confirmation run twice" and also counts as not run. A confirmation run that is unverified (a gate has no value and none failed, for example a missed `nvidia-smi` listing) also runs once more, so one such run does not leave the rest of the window idle. After a second unverified run, the result gets a reason that starts with "a confirmation run was unverified". The other runs of that candidate go on, so a later failed run can still make the result final. Without one, the result also counts as not run. A contended or unverified run runs again before the candidate's other runs, so a retry inside the winner can push the next candidate past the window. Only a result with a run unverified twice, or a result in a `tune.json` from older code, can hold both such a missing-evidence reason and a failed run. Such a result is final and counts as failed. The confirmation stops at a cut, twice contended or twice unverified result without a failed run. `report` reads the baseline's native result only when it reaches the baseline in the ranking, so an unranked baseline gets no native confirmation and takes no window time, and a ranked baseline runs only in its place, after every candidate ranked above it failed. `native_confirmation.stop_reason` in `tune.json` says why a result did not finish: `window_end`, `contended` or `unverified`. It is empty when every result finished. `report` then shows the `confirmed` gate as unverified, not failed, while a ranked candidate has only such missing evidence. Agree a window that covers the search plus about 3 hours, room for the winner and one more candidate. Otherwise, run `tune --no-confirm`, or let the window cut the confirmation, and confirm in a second window with `confirm` (step 9). Steps 8 and 10 also need GPU time. Step 8 takes about 1.6 hours for one candidate: seven lifecycles (four solo rows, the input row and two two-viewer rows) of about 14 minutes each. Each row that you sample again adds about 14 minutes. Step 10 takes about 1 hour: four lifecycles of about 14 minutes. With one GPU window, set `--until` that much before the window ends: about 1.6 hours before it for step 8, and about 2.6 hours before it when step 10 also runs in that window.

The tune prints `winner`, the best candidate of the search, `confirmed_native`, the best ranked candidate that passed its native confirmation, and `waiting_on`, the candidate that step 8 samples. They can differ: when the winner fails its native confirmation and the next candidate passes, `winner` is the first and `confirmed_native` and `waiting_on` are the second.

## 8. Stream runs
Build a separate local player that accepts `?pin=`, and serve it on loopback port 8100. From `Browser/`:
```bash
NORD_SIGNALLING_URL=ws://127.0.0.1:9010 NORD_DEFAULT_STREAMER_ID=Choose NORD_QA_PIN=1 npm run build
python3 -m http.server 8100 --bind 127.0.0.1 --directory dist
```
Leave the server running in a terminal of its own until the last row. Do not deploy this `dist`. Rebuild the normal player before any deploy. `build.mjs` refuses `NORD_QA_PIN=1` when `VERCEL` is set, so a Vercel build cannot honour `?pin=`.

Each sample needs a fresh lifecycle start. The car starts 95 s after the first BeginPlay, when NordFriend1 is asleep. It drives one warm-up lap, which is not gated, and the gated lap starts at the first `NORD_GAUNTLET leg=` line, about 5 minutes later (the model drives a stream lap in about 307 s). Sample the candidate that `tune` printed as `waiting_on`, at rung 0 and rung 1, in landscape and in portrait: four rows. Then add one input row for that candidate (below). `report` reads the baseline's solo rows only when the baseline is itself `waiting_on`, so sample them only then. Otherwise the baseline needs only its two-viewer rows (below). `waiting_on` is the best ranked candidate that no failure dropped, where `report` stops. It is not always the search `winner`. When the winner failed its native confirmation, a failed native run drops it, so its rows would count for nothing, and `waiting_on` is the candidate that passed. When the window cut the winner's confirmation, or `tune --no-confirm` ran none, it is the winner. When it is empty, every ranked candidate failed and nothing is left to sample. `report` prints `waiting_on` too, from the newest evidence. For one row, start the lifecycle with the gauntlet on NordHost. From `games/nord-unreal/`:
```bash
run="$(pwd)/Saved/Gauntlet/$(date -u +%Y%m%dT%H%M%SZ)-stream-<id>-r0-land"
echo "$run"
NORD_SKY_ARGS="-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather" \
NORD_STREAM_QUALITY="file:$(pwd)/Saved/Gauntlet/<tune run>/candidates/<id>.execcmds" \
NORD_STREAM_GAUNTLET="$run" \
python3 Scripts/browser_streaming.py run
```
`<id>` is the `waiting_on` candidate. Use `NORD_STREAM_QUALITY=current` for the baseline. The launcher refuses `NORD_STREAM_GAUNTLET` unless `NORD_SKY_ARGS` has both hour and weather. `browser_streaming.py run` stays in the foreground of the first terminal, and a second terminal does not have its `run` variable. Wait until the first terminal prints `NORD host and friend are connected`. The launcher starts NordFriend1 only after the host listens, and a `stream` command started before that line would count NordFriend1 as a foreign GPU process, so `stream` refuses the lifecycle until then and starts nothing. The car starts 95 s after the first BeginPlay and drives the warm lap first, so a row started after that line still has the whole gated lap. Then, in a second terminal, from `games/nord-unreal/`, set `run` to the folder that the first terminal printed, and sample the lap. Use `--pin 1` for rung 1 and add `--portrait` for portrait. `stream` takes only a rung that has a size in `loop.json` (0 and 1), and refuses `--pin 2` or `3` before it starts anything:
```bash
run="<the folder that the first terminal printed>"
python3 Scripts/gauntlet_loop.py stream --run "$run" --slot NordHost --pin 0
```
Without `run`, `--run ""` names the current folder, and the runner refuses it as "not a gauntlet lifecycle for this run".
The sampler drives `Browser/stream-sample.mjs` with `--frames --latency --trigger --out`, saves a decoded frame at each stop hold, and judges the stream gate over the gated lap only. It also follows NordFriend1's log, so the verdict shows whether NordFriend1 slept through the lap, and it records the host command line, its world flags and the CVar readback in `run.json`. When the lap ends, the runner writes `END` to the trigger file, and the sampler takes one last sample and stops. The runner then follows the host log on to its `result` line, which comes after `native/route.json`, for at most 45 s, and then judges the run. If the host stops before its `done`, `fail` or `result` line, no `END` comes. The sampler then stops 10 s after its last sample with a connected peer, and otherwise at `--seconds`, 925 s by default. A real host exit is expected to leave no connected peer **(unverified)**. If a peer stays connected, the sampler runs on to `--seconds`. A stream that drops for 10 s before `END` also stops the sample. Such a sample does not pass and exits non-zero. The verdict reads only the samples inside the lap.

After its `result` line, NordHost quits by itself. The first terminal then prints `NORD streaming: host exited; inspect <path of the host stdout log>.`, stops NordFriend1 and the signalling server, and returns to the prompt. This is the normal end of a row, not a fault, and there is nothing to stop. Wait until `stream` in the second terminal prints its result line (`folder`, `status` and `counts`): until then it still watches the GPU, and a new lifecycle started before that would count as a foreign GPU process. Then start the next row with a new `run` folder. If `stream` refused to start because the lifecycle was still starting, run it again after `NORD host and friend are connected`. If the first terminal still runs after `stream` printed its result, for example because NordHost hung, stop the lifecycle with Ctrl-C before the next row.

Check each stream verdict:
- `received_size` is the pinned rung's size in that orientation, and `size_changes` is 0.
- `friend_awake_windows` is 0. If it is unverified, the runner found no NordFriend1 window inside the lap. If it is more than 0 in a solo, input or relay row, NordFriend1 was awake inside the lap. A render CVar cannot wake it. A viewer can, for example a visitor of the public page, which reaches this lifecycle, who picked Player 2. The row then reads contended, with NordFriend1 in `contended_by`, and does not drop the candidate. Sample the row again. NordFriend1 also stays awake when the lifecycle starts without the idle flag (`-NordIdleThrottle`), for example when `NORD_STREAM_FLAGS` is `''` or `windowed` in the shell. Then every such row would read contended, so the launcher refuses `NORD_STREAM_GAUNTLET` without `idle` in `NORD_STREAM_FLAGS`, and `stream` refuses such a lifecycle. Unset `NORD_STREAM_FLAGS` and start the lifecycle again.
- `stream_lost_in_lap` is 0. It is 1 when the stream went away inside the lap and did not come back while NordHost drove on: its exit 0 is in the log, or its process still ran when the runner stopped following the log. That is a longer freeze than any gate allows, so it fails a solo, input or two-viewer row. A relay row gates nothing, so it reads unverified then, as after a failed drive. When NordHost crashed (no exit in its log and its process gone), the gate is unverified, because a crash is not the profile's fault.
- `decoded_over_50ms_percent` and `longest_gap_ms` are unverified when `stream/sample.json` has no `timeOrigin`. The sampler writes it once the page starts recording frames. That the frame times and the host log share one clock is written from memory and unverified: check one run by eye, for example that the frames of the first stop hold fall inside that hold's log lines.
- `python3 Scripts/gauntlet_loop.py route "$run"` checks the stop order and the lateral error of the stream run.
- If the verdict is contended or unverified, sample that row again. A two-viewer or relay row reads `report-only` once its values are whole, and `stream` exits 0, so do not sample it again. `report` reads the newest solo row of each candidate at each rung and orientation, by `started_at` in `run.json`, and the newest input row. A failed row drops the candidate, also when a newer row at that rung and orientation passed, so sampling a failed row again does not clear it. The same holds for a failed input row and a failed two-viewer row. A newest row that is contended, unverified or has no verdict is missing evidence.

Input row: drag on the stream during the whole lap, with the `waiting_on` candidate at rung 0 in landscape. Start the lifecycle as above, wait for `NORD host and friend are connected` in the first terminal, then set `run` in the second terminal as above and sample:
```bash
python3 Scripts/gauntlet_loop.py stream --run "$run" --slot NordHost --pin 0 --look
```
Its stream figures are report-only. It gates the car's lateral error from `native/route.json` (at most 2.5 m) and the exit code. A stream lost inside the lap while NordHost drove on fails it too, because the drags stopped with the stream. The lateral error and the exit come from the car's own drive, so the row reads pass only when the drags covered the whole gated lap (`drags_cover_lap`): the runner followed the lap live from its first `leg=` line, and NordHost's `sample.json` was taken with `--look` and covers the lap. Otherwise it reads unverified, for example when the sampler could not reach the page on port 8100, crashed or was killed, or when `stream` started after the gated lap began; sample it again. `--look` cannot be combined with `--relay` or `--two-viewers`. `report` needs an input row from each ranked candidate, a ranked baseline too, at any rung and orientation. A failed input row drops the candidate, also when a newer one passed. A missing one gives `stream rows missing: input row`, and a newest one that is contended, unverified or has no verdict gives `stream row unverified`: both are missing evidence.

Report-only rows:
- Two viewers: in each GPU window, start the lifecycle first for the baseline, then for the `waiting_on` candidate. When `waiting_on` is the baseline, it needs no co-op guard, so sample no two-viewer row. Sample each from the second terminal, after `NORD host and friend are connected` in the first terminal and with `run` set as above, with one command: `python3 Scripts/gauntlet_loop.py stream --run "$run" --slot NordHost --pin 0 --two-viewers`. It starts one sampler per slot itself and records the two-viewer row. Sample the baseline and the candidate at rung 0 in landscape, because the guard pairs only rows at the same rung and orientation. Do not start a second `stream` command on the same run. The runner refuses it, and it refuses `--slot NordFriend1`, because a NordFriend1 row alone wakes NordFriend1 and could never pass. The frame figures are report-only, but the co-op guard compares them: it pairs each two-viewer row of the candidate with the baseline's two-viewer row at the same rung and orientation from the same window: the baseline's row started last before it, at most 12 hours before it, when that row reads `report-only`, else the first baseline row that reads `report-only` and started at most 4 hours after it. The guard never reaches back past the baseline's last row before the candidate to an older one, which can come from an earlier window, and it never pairs forward with a row from the next window. So sample the baseline until its latest row in this window reads `report-only`, before the candidate. Never sample the candidate right after a baseline row that does not read `report-only`. The candidate may lose at most 2 decoded FPS against that baseline row. A pair more than 2 FPS apart drops the candidate, also when another pair passed, so sampling the candidate again does not clear it. A row counts only when it reads `report-only`: no foreign GPU process shared it, every slot decoded frames inside the lap, and NordHost's drive ended with exit 0, kept its stream through the lap, held the pinned rung's size with no size change, read back every CVar and had `nvidia-smi` process listings. A row that a foreign GPU process shared reads contended, and a row where a slot decoded no frame or one of those NordHost figures has no value (for example no `nvidia-smi` listing) reads unverified. Its notes say what is missing; sample it again. A row where one of those NordHost gates failed reads `fail`, and `stream` exits 1, as a solo row does: a drive that failed inside the lap (an exit other than 0 in its log, such as stuck or timeout), a stream that went away inside the lap while NordHost drove on, another received size, a size change, or a CVar that did not apply. That failure drops the candidate, as a failed solo row does. When the baseline's two-viewer row fails, the baseline has no row to pair with, so every candidate's guard stays unverified: fix the cause and sample the baseline again.
- Relay: set `NORD_ICE_CONFIG` to the private `ice.json` before `run`, and add `--relay` to the sampler. Never print the file. The row reads `report-only` once each stream figure has a value, NordHost's drive ended with exit 0 and the stream stayed through the lap. Otherwise it reads unverified, because a failed drive or a lost stream covers only part of a lap; sample it again.

After the last row, restore the demo (step 0).

## 9. Review and write the profile
```bash
python3 Scripts/gauntlet_loop.py report Saved/Gauntlet/<tune run>
```
`report` judges the tune again from its files, with the native confirmation and the stream runs made after the tune started. Only a failure drops a candidate. While a better ranked candidate has only missing evidence (a cut, twice contended or twice unverified confirmation, a missing, contended or unverified stream row or input row, or an unverified co-op guard), `report` confirms no lower ranked candidate and shows the `confirmed` gate as unverified, so give that evidence first. `report` prints `waiting_on`, the ranked candidate whose evidence the round waits on, and leaves it empty once a candidate is confirmed or every ranked candidate failed. When its native confirmation was cut, contended twice, unverified twice or never ran, confirm it natively in the GPU window with `confirm`. When its stream rows or its input row are missing, contended or unverified, sample them (step 8). When `report` gives it `co-op guard unverified`, the candidate has no two-viewer row that reads `report-only` with a baseline two-viewer row that pairs with it (step 8): at the same rung and orientation, by `started_at` in `stream_evidence`, and either the baseline's last row before it, at most 12 hours before it and reading `report-only`, or the first such row at most 4 hours after it. In the next window, sample the baseline until its row reads `report-only`, then sample the candidate again after it (step 8). A reason `two-viewer FPS <x> is <y> below the baseline's <z>` is a failed pair, which drops the candidate for good. Then run `report` again. A drop by a stream row or the co-op guard moves `waiting_on` to the next ranked candidate, which then needs `confirm` and its own stream rows:
```bash
python3 Scripts/gauntlet_loop.py confirm Saved/Gauntlet/<tune run> --until 06:30
```
Add `--candidate <id>` to pick a ranked candidate, and `--direct` if RunUnreal failed in step 3. `confirm` runs the baseline first only when the baseline is ranked above the candidate (with `--candidate`), has no finished native result and the round has not dropped it, and then goes on to the candidate only when the baseline finished. It never runs an unranked baseline, or one ranked below the candidate, because `report` reads that result before no candidate's, so it would only take window time. An unfinished result of an unranked baseline that an older tune left stays as it is. A ranked baseline that a failure dropped keeps its result as it is. When the baseline is the candidate, it runs once. A result that the window cut, that a foreign GPU process shared twice or that was unverified twice (a reason that starts with "a confirmation run was unverified") counts as not run: `confirm` runs that candidate again and replaces its result, and `--candidate` accepts it. A run that was unverified once and passed when it ran again gives no such reason. Only a result with a run unverified twice, or a result in a `tune.json` from older code, can hold both such a reason and a failed run. Such a result is final: `confirm` keeps it, runs the next ranked candidate, and refuses `--candidate` for it. `confirm` judges the round as `report` does and skips a ranked candidate that a failed stream row or the co-op guard dropped, also when its native confirmation was cut or never ran, so it confirms the next ranked candidate and not the dropped winner. It refuses `--candidate` for a dropped candidate, because a new native result cannot change its verdict. `confirm` adds each result to `tune.json` and writes no profile. It also updates `native_confirmation` there: `confirmed_native` names the best ranked candidate that passed, a ranked baseline too. `stop_reason` counts only the results that `report` can still read: a ranked result that no failure dropped, and not ranked below one that passed and that no failure dropped. It is empty once each of them finished, else `window_end`, `contended` or `unverified`. A dropped candidate's unfinished result can never finish, because `confirm` refuses to run it, so it sets no stop reason.

Open `review.html` with the user. It shows the ceiling, baseline, candidate and decoded frame for each view, with SSIM, a difference map and an A/B flip. Only after the user approves the paired captures of the confirmed candidate (`confirmed` in `report.json`):
```bash
python3 Scripts/gauntlet_loop.py write-profile Saved/Gauntlet/<tune run> --candidate <id> --approved
python3 Scripts/gauntlet_tune.py check
python3 Scripts/browser_streaming.py self-check
```
Without `--approved`, `write-profile` refuses and writes nothing. It rewrites only `[NordPhoneStream DeviceProfile]` and writes the approval record `Config/NordPhoneStream.approval.json` beside the ini. Commit both files. `gauntlet_tune.py check` must then report `approved <id>`. The stream default stays `current`. Flipping it to `phone` is a separate change.

## 10. Physical phone (person)
Start a stream lifecycle as in step 8 with the approved candidate, `NORD_STREAM_QUALITY="file:$(pwd)/Saved/Gauntlet/<tune run>/candidates/<id>.execcmds"`, and also set the demo's `NORD_ICE_CONFIG`, so a phone on carrier data can use the relay. Do not use `NORD_STREAM_QUALITY=phone` here: the package from step 1 still holds the old `[NordPhoneStream DeviceProfile]`, because a packaged game reads the config staged into it **(unverified)**, so its CVars would not match the new section and the run would exit with code 4. `phone` needs a package built after `write-profile`. Watch one full lap on NordHost on a real phone. A lifecycle drives its warm lap and its gated lap and then stops by itself, as in step 8, so start a new one, with a new `run` folder, for each phone, browser and network:
- Android Chrome and iOS Safari, each on Wi-Fi and on carrier data, through the public page.
- Note: video starts, no visible freeze over the lap, the car drives the whole loop, the picture matches the paired captures, and the HUD fits in landscape and portrait.
- After the last watch, restore the demo (step 0), drive one lap by hand on it, and note the perceived input delay. The gauntlet drives the car itself, so a hand lap needs the normal demo.

Record the date, device, OS, browser, network and deployment ID in its own file, `Verification/Gauntlet/<YYYYMMDD>-phone.md`. Never put phone results in a `verdict.json`.

## 11. Commit the round
- Copy each run's verdict summary to `Verification/Gauntlet/<YYYYMMDD>-<label>.json`, failing runs included. Do not commit PNGs there.
- Copy the stills the user approved to a new folder, `Preview/Gauntlet/<YYYYMMDD>/`.
- Score the round in `docs/gauntlet/gta-mobile.md` with rubric v1. "Performance stability" cites the verdict file.

## Known limits to confirm on the host
- RunUnreal and the Gauntlet plugin on Linux. Every public example is Win64.
- `-DeviceProfile=` in a Development Browser package, and `GameUserSettings.ini` overrides. Whether the package reads the profile only from the config staged into it, so `phone` needs a new package after `write-profile` (step 10).
- The CSV column names, and GPUTime with `-csvGpuStats`.
- Whether `r.AntiAliasingMethod` reads back as 4 in every run kind.
- Whether a host exit leaves the sampler with no connected peer, so the sampler stops about 10 s later and its summary ends at the stream end.
- C++ driving of a possessed, rendered car with pawn input disabled.
- The loop length against the modelled 3,488 m, and which leg is heaviest.
- Whether UAT finds `Build/Scripts/NordGauntlet.Automation.csproj`.
- Whether UBT builds `QuebecGauntletTest` from `Quebec.uproject`, and whether Shipping builds without it and without the Gauntlet plugin.
- Whether `BeginCapture` keeps the given CSV file name as it is.
- Whether the sampler's frame wall times (`timeOrigin` plus `expectedDisplayTime`) line up with the host log times within a few ms.

# Tasks

Read `design.md` first. `notes-host.md` gives the exact host commands. The lead checks off cloud tasks after their checks pass. Host and person tasks stay open until they run.

## 1. Spec and plan
- [x] 1.1 Read the gauntlet docs, the stream and perf code, and the existing NORD specs; settle the design (`design.md`).
- [x] 1.2 Write `proposal.md`, `design.md`, both capability specs, `tasks.md` and `notes-host.md`.
- [x] 1.3 Validate the structure: `OPENSPEC_TELEMETRY=0 npx -y @fission-ai/openspec@1.14.3 validate nord-mobile-gauntlet --strict`.

## 2. Engine-free model
- [x] 2.1 `Source/Quebec/QuebecGauntletModel.h`: route assembly from stops over the through roads of `FRoadGraph` (`FForwardRoads`, junctions rounded by `FinishLoop`), driver step, run state machine, frame-stat accumulator (p50, p95, p99, hitches, per leg) and the expected-CVar parser.
- [x] 2.2 `Scripts/gauntlet_model_test.cpp` and `Scripts/test_gauntlet_model.py`: the route closes and is 3.0 to 4.0 km (the modelled driven line is 3,488 m); a kinematic car at 30 Hz and 120 Hz completes it with lateral error under 2.5 m and no stall; percentiles match `Data/Gauntlet/fixtures/frametimes.csv`. Passes with g++ and clang++ under `-Wshadow -Werror`.

## 3. Route
- [x] 3.1 `Scripts/make_gauntlet_route.py` generates `Source/Quebec/QuebecGauntletRoute.h` from the replica manifest cameras.
- [x] 3.2 `Scripts/test_gauntlet_route.py` fails when the header and the manifest disagree.

## 4. Game module
- [x] 4.1 `QuebecGauntlet.h/.cpp`: `UQuebecGauntletSubsystem` with the `-NordGauntlet*` flags, car seating and driving, CSV capture, holds and stills, `NORD_GAUNTLET` log lines, `route.json` and the exit codes.
- [x] 4.2 `Source/QuebecGauntletTest/QuebecGauntletController.h/.cpp`: `UQuebecGauntletController` in its own module, which depends on Gauntlet and is left out of Shipping. It meets the subsystem only through the console variables `nord.GauntletController` and `nord.GauntletExit`.
- [x] 4.3 `Quebec.uproject` (the `QuebecGauntletTest` module and the Gauntlet plugin, both denied in Shipping), `QuebecSky.cpp` (`NordGauntlet` QA flag, and a settled weather switch under that flag).
- [x] 4.4 Stub `CsvProfiler.h` and the Gauntlet stub headers, marked unverified, plus a selftest case.
- [x] 4.5 From `games/nord-unreal/`, `Tools/SyntaxCheck/check.sh --both` and `Tools/SyntaxCheck/link.sh --both -j 2` pass for `Source/Quebec`. The same two commands with `--src Source/QuebecGauntletTest` pass for the controller module. `--src` is relative to the current folder, so from `Tools/SyntaxCheck/` it is `--src ../../Source/QuebecGauntletTest`.

## 5. C# test node (host compile)
- [ ] 5.1 `Build/Scripts/NordGauntlet.Automation.csproj` and `Build/Scripts/NordMobileLoop.cs` with the `mode`, `size`, `sky`, `laps`, `run` and `execcmds` params.

## 6. Python runner
- [x] 6.1 `Scripts/gauntlet_loop.py` with `self-check`, `route` (also for a stream run), `native` (RunUnreal or `--direct`), `stream` (with the `--look` input row), `reference`, `tune` (with `--reference` for the same commit and build, and ceiling runs that were not contended), `confirm`, `report` and `write-profile --approved`.
- [x] 6.2 `Scripts/gauntlet_metrics.py`: CSV parse, legs, hitch rule, gate verdicts with pass, fail, unverified, contended and report-only, numpy SSIM, optional FLIP, `review.html`.
- [x] 6.3 `Scripts/gauntlet_tune.py`: knob ladders and dependencies, candidate ExecCmds and expected-CVar files, profile section read and write, greedy search, stop rule.
- [x] 6.4 `Data/Gauntlet/loop.json` with stops, speeds, holds, delays, laps, skies, sizes, budgets, knobs, ceiling and baseline.
- [x] 6.5 `test_gauntlet_metrics.py`, `test_gauntlet_tune.py` (fake measure: search order, stop rule, fallback, ties) and `test_gauntlet_loop.py` (fake RunUAT and sampler: command lines, folder layout, sky refusal, contention label) pass, and `gauntlet_loop.py self-check` passes.
- [x] 6.6 `confirm_candidate` starts a confirmation run only when its planned time ends before `--until`. The plan starts at `gauntlet_tune.run_estimate_s`, made longer by as much as the search found the host slower: its slowest native run against that run's estimate (`host_slowdown` in `tune.json`), or its longest candidate against its own plan. It rises to the longest confirmation run measured so far in the call. Without `--reference`, the search plans its first candidate with the ceiling look run that it renders first. A result that the window cut counts as not run: `confirm` runs it again, the baseline first, and replaces it. A cut result that also holds a failed run is final: `confirm` keeps it and runs the next ranked candidate. A baseline that is itself the candidate runs once. Until then, `report` leaves the `confirmed` gate unverified, also after a better ranked candidate failed. `test_gauntlet_loop.py` checks these with a fake clock.
- [x] 6.7 Every run's expected-CVar file also holds the `loop.json` `fixed` CVars that the candidate does not set, so the readback checks `r.AntiAliasingMethod 4`. `test_gauntlet_loop.py` compares the phone run's expect file with the profile section without the fixed names, and checks that the fixed names are there.
- [x] 6.8 After the sampler stops at `END`, `stream_run` follows the host log on to its `result` line, until the host quits or for at most the CSV wait and 15 s, so the exit code and `native/route.json` reach the verdict. The fake host in `test_gauntlet_loop.py` logs its result line 2 s after the sampler quit.
- [x] 6.9 A contended confirmation run runs once more. After a second one the result counts as not run, unless it also holds a failed run, so `confirm` runs it again and `report` leaves the `confirmed` gate unverified. The co-op guard skips a contended two-viewer row, and a two-viewer row whose NordHost drive did not end with exit 0 has no `two_viewer_fps`. `test_gauntlet_loop.py` checks these (`check_confirm_window`, `check_report_coop_contended`, `check_stream`).
- [x] 6.10 `report` reads only the newest solo stream row of each candidate at each rung and orientation, by `run.json` `started_at`. A failed row is a failure, also when a newer row at that rung and orientation passed, as a failed native confirmation is final. A newest row that is contended, unverified or has no verdict is missing evidence (`stream row unverified`), so the `confirmed` gate is unverified, not failed. `test_gauntlet_loop.py` checks seven pairs of an older and a newer row, where the newer row's folder name sorts first (`check_report_stream_latest`).
- [x] 6.11 `confirm` keeps `native_confirmation` current after each result: `stop_reason` is empty when every result finished, else `window_end` or `contended`, and `confirmed_native` names the best ranked candidate that passed, a ranked baseline too. `test_gauntlet_loop.py` checks both (`check_confirm_window`).
- [x] 6.12 `report` stops at the first ranked candidate that passed or that has only missing evidence (`gauntlet_tune.confirm` with `still_open`), so a contended row, a cut confirmation or an unverified co-op guard of the winner does not confirm the runner-up. `test_gauntlet_loop.py` checks these three and a failed row that does (`check_report_better_open`).
- [x] 6.13 `stream` offers only `--slot NordHost` on its command line and refuses `--slot NordFriend1`, and a second command on a run that already has a `stream/` folder. `--two-viewers` samples both slots in one command. `test_gauntlet_loop.py` checks these refusals (`check_stream_one_command`).
- [x] 6.14 `confirm` judges the round as `report` does, on through every ranked candidate, and skips a candidate that a failed stream row or the co-op guard dropped, also when its native confirmation was cut or never ran. `--candidate` refuses such a candidate. `test_gauntlet_loop.py` checks a cut confirmation and `tune --no-confirm`, each with a failed row and with the co-op guard (`check_confirm_dropped`).
- [x] 6.15 `stream` refuses a lifecycle that is still starting, before the launcher prints "NORD host and friend are connected", and starts nothing, so the run's own NordFriend1 never counts as a foreign GPU process. `test_gauntlet_loop.py` checks the refusal (`check_stream_one_command`).
- [x] 6.16 `confirm` resolves its tune folder, and `report` maps a candidate's stream rows by resolved paths, so `confirm Saved/Gauntlet/<tune run>` from `games/nord-unreal/` (notes-host step 9) skips a dropped winner as an absolute folder does, and its runs get absolute folders. `test_gauntlet_loop.py` runs every `check_confirm_dropped` case also with a relative folder.
- [x] 6.17 `tune` and `report` print `waiting_on`, the best ranked candidate that no failure dropped, and `report.json` and the round's `verdict.json` record it. notes-host step 8 samples that candidate, not the search winner, and step 9 says what it still needs. `test_gauntlet_loop.py` checks a winner that failed natively, one that passed, a cut and a missing confirmation, and every candidate failed (`check_waiting_on`).
- [x] 6.18 A two-viewer or relay row gates nothing, so its verdict is `report-only` once its values are whole, and `stream` exits 0. A two-viewer row is whole when the co-op guard counts it: every slot decoded and NordHost's drive ended with exit 0. A relay row is whole when each of its stream figures has a value. Otherwise the row is contended or unverified, and notes-host step 8 samples it again. `test_gauntlet_metrics.py` checks the status, and `test_gauntlet_loop.py` checks a clean, a contended, a failed and a one-slot two-viewer row and a clean and an unclocked relay row (`check_stream`).

## 7. Browser sampler
- [x] 7.1 `stream-sample.mjs`: `--frames`, `--pin`, `--trigger`, `--out`, `--latency`, and the new summary fields.
- [x] 7.2 `config.mjs` `pinnedLevel`, `player.js` skips adaptation when pinned, `build.mjs` defines `NORD_QA_PIN` (false by default) and refuses `NORD_QA_PIN=1` when `VERCEL` is set.
- [x] 7.3 `stream-sample.test.mjs` and `config.test.mjs` cover the new fields, the page clock origin (`timeOrigin`), the production pin define and the sizes 1412x652, 652x1412, 1058x488 and 488x1058; `npm test` passes in `Browser/`.
- [x] 7.4 `stream-sample.mjs` stops sampling at a trigger line equal to `END`, which the runner writes when the lap ends, instead of taking a shot named `END` and running on to `--seconds`. When the host quit first, the summary ends at the stream end (`streamEndedTimeMs`), and the sample does not pass and exits non-zero, also as a standalone sample without a trigger file. `stream-sample.test.mjs` covers these.
- [x] 7.5 Without `END`, `stream-sample.mjs` stops 10 s after its last sample with a connected peer (`STREAM_GONE_MS`), and the sample does not pass and exits non-zero. A peer that connects again within 10 s keeps the sample going until `END`. `stream-sample.test.mjs` covers both with the fake plan. That a real host exit leaves no connected peer is unverified (task 11.10).

## 8. Launcher
- [x] 8.1 `browser_streaming.py`: `NORD_STREAM_QUALITY=current|phone|file:<path>` and `NORD_STREAM_GAUNTLET=<run dir>`, recorded in `lifecycle.json`.
- [x] 8.2 `browser_streaming.py self-check` covers the unchanged default line, the phone and file values, the path refusal and the sky refusal.

## 9. Phone profile
- [x] 9.1 `Config/DefaultDeviceProfiles.ini` with `[NordPhoneStream DeviceProfile]` equal to today's `QUALITY`.
- [x] 9.2 A parse test checks that the section holds the same CVars as `QUALITY`, or as the candidate in the approval record that `write-profile --approved` writes.

## 10. Docs
- [x] 10.1 `Verification/QAPlan.md` names the 60 FPS cap and points to the gauntlet gates.
- [x] 10.2 `docs/gauntlet/gta-mobile.md` protocol header, with no scored rounds.

## 11. Host and person (owner's PC with UE 5.8.3)
- [ ] 11.1 Build both targets with the Gauntlet plugin and a Shipping build without it, compile the C# node, and package the Browser build into a staging folder. Replace the live package only after the staged one starts without Gauntlet log lines.
- [ ] 11.2 RunUnreal smoke on Linux (one lap). If it fails, record why and use `--direct`.
- [ ] 11.3 `-DeviceProfile=NordPhoneStream` reads back in the Browser package, or the launcher falls back to `-ExecCmds`.
- [ ] 11.4 Confirm the CSV column names, including GPUTime.
- [ ] 11.5 First measured lap: loop length, per-leg p95 ranking, and the summary line against the CSV.
- [ ] 11.6 Ceiling references twice; run-to-run SSIM at least 0.98.
- [ ] 11.7 Baseline twice at the start of the window: the tune's own `baseline-a` and `baseline-b` runs set the noise tie. Run no separate baseline runs (notes-host step 6).
- [ ] 11.8 Overnight tune in an agreed GPU window.
- [ ] 11.9 Confirmation: 3 laps each for the winner and the baseline, both skies, landscape and portrait. After a stream row or the co-op guard drops a candidate, `gauntlet_loop.py confirm <tune folder>` confirms the next one that no failure dropped.
- [ ] 11.10 Stream runs: solo at rung 0 and rung 1, landscape and portrait, the input row (`stream --look`, lateral error at most 2.5 m), plus the two-viewer and relay rows. Check by eye that the frame times line up with the host log (the shared clock is unverified). Sample a contended or unverified row again, because `report` reads only the newest one. A clean two-viewer or relay row reads `report-only`, not unverified. If a host exit happens, check that the sampler stopped about 10 s after the stream ended.
- [ ] 11.11 Manual phone run on a physical Android and iOS phone, recorded on its own.
- [ ] 11.12 User review of `review.html`; run `write-profile --approved` only after approval, and commit the ini and its approval record.
- [ ] 11.13 Commit the round evidence and score round 1 in `docs/gauntlet/gta-mobile.md`.
- [ ] 11.14 Archive this change and review the canonical specs.

## Follow-up
- [ ] Flip the stream default to `phone` in a separate change, after the user approves paired captures.
- [ ] Bring canonical `nord-camera-touch` (24 and 28 FPS) in line with the shipped 29 and 35 FPS ladder.

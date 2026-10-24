## ADDED Requirements

### Requirement: Best-looking feasible profile
The tuner SHALL choose, among the candidates it measured, the phone profile with the best look that meets the frame budget with a safety margin.

#### Scenario: Search
- **WHEN** the tuner stops because no feasible, visibly better step is left, because it measured 24 candidates, or because the agreed window ended
- **THEN** `tune.json` lists every measured candidate, failures included
- **AND** the winner is feasible: on the night-rain landscape lap its FrameTime p95 is at most 30.0 ms and its GPUTime p95 at most 28.0 ms, and its hitch, VRAM and CVar readback gates pass
- **AND** no measured feasible candidate has a Look score above the winner's by more than the tie threshold, which `test_gauntlet_tune.py` checks with a fake measure function
- **AND** a candidate whose look run did not exit cleanly, or scored fewer than all 20 stills, has no Look and is never ranked
- **AND** no search run ends after `--until` by plan: without `--reference` the plan of the first candidate also holds the ceiling look run that it renders first, which `test_gauntlet_loop.py` checks with a fake clock

#### Scenario: Baseline not feasible
- **WHEN** the baseline misses the feasible limits on the night-rain landscape lap
- **THEN** the tuner first measures one step below today's value for each knob that has one, and `loop.json` gives a floor reason for each enabled knob that has none

#### Scenario: Never worse than today
- **WHEN** the tuner picks a winner
- **THEN** the winner's mean SSIM against the ceiling is at least the mean of the current production profile, and every one of its images has an SSIM of at least 0.85

#### Scenario: Co-op guard
- **WHEN** the winner and the baseline run the two-viewer row in the same window
- **THEN** the winner's mean decoded FPS with two viewers is at most 2 FPS below the baseline's, otherwise the next feasible candidate is confirmed instead
- **AND** each two-viewer row of the winner is paired with the baseline's row at the same rung and orientation from the same window, the baseline's row started last before it when that row counts, else the first counted one started after it, at most 12 hours apart, and a pair more than 2 FPS apart drops the winner for good, also when another pair passed, which `test_gauntlet_loop.py` checks
- **AND** when the baseline's last row before the winner's does not count, for example an unverified row first in a morning window 10 hours after the evening's, the guard does not reach back to the evening's counted row but pairs with the morning's next counted baseline row, which `test_gauntlet_loop.py` checks
- **AND** without such a pair, for example when the two rows are more than 12 hours apart, or at another rung or orientation, the guard is unverified, so it is missing evidence, which `test_gauntlet_loop.py` checks
- **AND** only a row that reads "report-only" counts: a two-viewer row that a foreign GPU process contended does not count, nor one where a slot decoded no frame inside the lap, nor one where one of NordHost's `game_exit`, `stream_lost_in_lap`, `received_size`, `size_changes`, `cvar_mismatches` and `gpu_process_samples` gates did not pass, so without a counted row the guard is unverified, which `test_gauntlet_loop.py` checks
- **AND** a two-viewer row where one of NordHost's `game_exit`, `stream_lost_in_lap`, `received_size`, `size_changes` and `cvar_mismatches` gates failed, for example a drive that failed inside the lap or a size change under the load of two viewers, fails, and that drops the winner as a failed solo row does, while a baseline whose two-viewer row fails has no row to pair with, so the guard of every candidate stays unverified, which `test_gauntlet_loop.py` checks with a drive that fails inside the lap, another received size and a size change inside the lap

#### Scenario: Confirmation fails
- **WHEN** the winner fails any gate in the 3-lap confirmation or in the stream runs
- **THEN** the tuner confirms the next feasible candidate, and `tune.json` records why the first one was dropped
- **AND** a failed native confirmation run ends that candidate's confirmation at once, in `tune` and in `confirm`, because its result is then final, so the next ranked candidate starts right after it: with room for 5.5 runs, a winner that fails its first run and the next candidate, which passes, both finish their confirmation in one window, which `test_gauntlet_loop.py` checks
- **AND** after a stream row or the co-op guard drops a candidate, `gauntlet_loop.py confirm <tune folder>` confirms the next ranked candidate natively, adds the result to `tune.json` and writes no profile
- **AND** `confirm` skips a ranked candidate that a failed stream row or the co-op guard dropped, as the round report judges it, also when that candidate's native confirmation was cut or never ran, and refuses `--candidate` for it, because a new native result cannot change its verdict, which `test_gauntlet_loop.py` checks also with the tune folder given relative to `games/nord-unreal/`
- **AND** when the round dropped a ranked baseline whose native confirmation is not finished, `confirm` does not run that baseline first and confirms the next ranked candidate, because the baseline's result cannot change the verdict and a cut there would stop the candidate, which `test_gauntlet_loop.py` checks
- **AND** `tune` and the round report print `waiting_on`, the best ranked candidate that no failure dropped, whose stream rows are sampled next: when the winner failed its native confirmation and the next candidate passed, it names that candidate, not the winner, and it is empty once a candidate is confirmed or every ranked candidate failed, which `test_gauntlet_loop.py` checks
- **AND** after each result, `confirm` sets `native_confirmation.confirmed_native` in `tune.json` to the best ranked candidate whose native confirmation passed, a ranked baseline too, which `test_gauntlet_loop.py` checks
- **AND** only a failure drops a candidate: while a better ranked candidate has only missing evidence, the round report confirms no lower ranked candidate and the `confirmed` gate is unverified, which `test_gauntlet_loop.py` checks

#### Scenario: Stream row sampled again
- **WHEN** a candidate's solo stream row at one rung and orientation is sampled more than once
- **THEN** the round report reads the newest of those rows, by `started_at` in its `run.json`, so a row sampled again replaces an older row that is contended, unverified or has no verdict
- **AND** a failed row drops the candidate, also when a newer row at that rung and orientation passed, as a failed native confirmation is final
- **AND** a newest row that is contended, unverified or has no verdict is missing evidence, so the `confirmed` gate is unverified, not fail, which `test_gauntlet_loop.py` checks
- **AND** only the rungs and orientations of `size_use.stream` in `loop.json` count, so a solo row at another rung neither holds nor drops a candidate, which `test_gauntlet_loop.py` checks

#### Scenario: Window ends during the confirmation
- **WHEN** the agreed window (`--until`) ends before every confirmation run of a candidate
- **THEN** no confirmation run starts unless its planned time ends before `--until`, and the confirmation stops at that candidate
- **AND** the planned time starts at the model estimate, made longer by as much as the search found the host slower (its slowest native run that ended with exit 0 and was not contended, against that run's estimate, or only without such a run its longest candidate against its own plan), and rises to the longest confirmation run measured so far, so a host slower than the estimate does not overrun the window by plan, which `test_gauntlet_loop.py` checks also when a contended run splits the search's first candidate, and when a run that hung to the runner's limit would make the plan too long
- **AND** the round report marks the `confirmed` gate unverified, not fail, while a ranked candidate has only missing evidence (a cut, twice contended, unverified or missing confirmation, missing stream rows or input row, a newest stream row that is contended, unverified or has no verdict, an unverified co-op guard), also after a better ranked candidate failed; a cut result that also holds a failed run counts as failed
- **AND** `gauntlet_loop.py confirm <tune folder>` in a later window runs that candidate again and replaces its result in `tune.json`, with the baseline first only when the baseline is ranked above the candidate, has no finished result and the round has not dropped it, and on to the candidate after the baseline only when the baseline finished, which `test_gauntlet_loop.py` checks with a fake clock
- **AND** a cut result that also holds a failed run is final: `confirm` keeps it, runs the next ranked candidate and refuses `--candidate` for it, which `test_gauntlet_loop.py` checks
- **AND** `native_confirmation.stop_reason` in `tune.json` reads `window_end` while a result that the window cut is still not finished, else `contended` or `unverified` for a result that a foreign GPU process shared twice or that holds an unverified run, and is empty once `confirm` has finished every result, which `test_gauntlet_loop.py` checks
- **AND** the baseline runs once when it is itself the ranked candidate

#### Scenario: Contended confirmation run
- **WHEN** a foreign GPU process shares a native confirmation run
- **THEN** that run runs once more, as in the search
- **AND** after a second contended run the confirmation stops at that candidate, its result counts as not run, the round report marks the `confirmed` gate unverified, not fail, and `gauntlet_loop.py confirm <tune folder>` runs that candidate again, which `test_gauntlet_loop.py` checks
- **AND** when that result also holds a failed run, it counts as failed: the round report drops the candidate, and `confirm` keeps the result and runs the next ranked candidate, which `test_gauntlet_loop.py` checks

#### Scenario: Unverified confirmation run
- **WHEN** a native confirmation run is unverified: a gate has no value and none failed
- **THEN** that run runs once more, as a contended run does, so when the second run gives a verdict the candidate can be confirmed in the same window, which `test_gauntlet_loop.py` checks
- **AND** after a second unverified run, the candidate's other confirmation runs go on, so a later failed run can still make the result final, and its result gets a reason that starts with "a confirmation run was unverified" and, without a failed run, counts as not run
- **AND** the confirmation then stops at that candidate with `native_confirmation.stop_reason` `unverified`, the round report marks the `confirmed` gate unverified, not fail, and waits on that candidate, and `gauntlet_loop.py confirm <tune folder>` runs it again and replaces its result, which `test_gauntlet_loop.py` checks
- **AND** when that result also holds a failed run, it counts as failed, and the next ranked candidate is confirmed, which `test_gauntlet_loop.py` checks

#### Scenario: Baseline confirmation
- **WHEN** `tune` or `confirm` runs the native confirmation
- **THEN** it runs the baseline's native confirmation only when the round report reads it before the candidate's: `tune` confirms a ranked baseline in its place in the ranking, and `confirm` runs a ranked baseline first only when it is ranked above the candidate, so an unranked baseline, or one ranked below the candidate, takes no window time, which `test_gauntlet_loop.py` checks
- **AND** when an earlier tune left an unranked baseline's result unfinished and a failed stream row dropped the winner, `confirm` in a window with room for 5 runs, with or without `--candidate`, runs only the next candidate's 4 runs, and the round report confirms that candidate, which `test_gauntlet_loop.py` checks
- **AND** a baseline ranked above the candidate whose result does not finish, after an unverified run twice or a run contended twice, stops `tune` and `confirm` before the candidate, and the round report waits on the baseline, which `test_gauntlet_loop.py` checks

#### Scenario: Fixed settings
- **WHEN** the tuner builds a candidate
- **THEN** it keeps `t.MaxFPS 60`, TSR (`r.AntiAliasingMethod 4`) and VP8 unchanged, and never breaks a knob dependency declared in `Data/Gauntlet/loop.json`
- **AND** `gauntlet_tune.py check_loop` refuses a knob step that sets a CVar named in `loop.json` `fixed`
- **AND** every run's expected-CVar file holds the `fixed` CVars that the candidate does not set, so the CVar readback checks `t.MaxFPS 60` and `r.AntiAliasingMethod 4`, which `test_gauntlet_tune.py` and `test_gauntlet_loop.py` check

### Requirement: Opt-in, approved phone profile
The phone-stream profile SHALL be opt-in. The production stream SHALL keep its current settings until the user approves paired captures and a separate change flips the default.

#### Scenario: Default unchanged
- **WHEN** the host starts the stream without `NORD_STREAM_QUALITY`
- **THEN** the game command line is the same as before this change, which `browser_streaming.py self-check` checks

#### Scenario: First profile equals today
- **WHEN** this change lands
- **THEN** the `[NordPhoneStream DeviceProfile]` section in `Config/DefaultDeviceProfiles.ini` holds the same CVars as the current `QUALITY` string, which a parse test checks, so choosing `phone` changes nothing on screen

#### Scenario: Phone profile loads
- **WHEN** the host starts a run with `NORD_STREAM_QUALITY=phone`
- **THEN** every CVar in the `[NordPhoneStream DeviceProfile]` section reads back in the game log with the requested value
- **AND** a mismatch, for example from a saved `GameUserSettings.ini`, ends the run with exit code 4 and marks it failed

#### Scenario: Candidate file
- **WHEN** the host starts a run with `NORD_STREAM_QUALITY=file:<path>`
- **THEN** the launcher accepts only a candidate file under `Saved/Gauntlet/`, and refuses any other path or value

#### Scenario: Approval
- **WHEN** the user has not approved the winner's paired captures
- **THEN** `gauntlet_loop.py write-profile` is not run and the profile section stays unchanged, and without `--approved` it refuses and writes nothing
- **AND** after approval, `write-profile --approved` writes the section and an approval record beside the ini, and the parse test accepts a section that equals `QUALITY` or that record, so a later hand edit fails
- **AND** the default changes to `phone` only in a separate change after the user approves

### Requirement: Desktop gate unchanged
The desktop release gate SHALL stay separate from the phone profile and unchanged.

#### Scenario: Desktop profile run
- **WHEN** the host runs `profile_package.py` after this change
- **THEN** it still gates FrameTime p95 below 16.67 ms at Epic quality and 100% screen percentage on its three scenes at both sizes, and the gauntlet never edits its settings or limits

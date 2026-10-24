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
- **AND** a two-viewer row that a foreign GPU process contended does not count, so without a clean row the guard is unverified, which `test_gauntlet_loop.py` checks

#### Scenario: Confirmation fails
- **WHEN** the winner fails any gate in the 3-lap confirmation or in the stream runs
- **THEN** the tuner confirms the next feasible candidate, and `tune.json` records why the first one was dropped
- **AND** after a stream row or the co-op guard drops a candidate, `gauntlet_loop.py confirm <tune folder>` confirms the next ranked candidate natively, adds the result to `tune.json` and writes no profile
- **AND** after each result, `confirm` sets `native_confirmation.confirmed_native` in `tune.json` to the best ranked candidate whose native confirmation passed, a ranked baseline too, which `test_gauntlet_loop.py` checks

#### Scenario: Stream row sampled again
- **WHEN** a candidate's solo stream row at one rung and orientation is sampled more than once
- **THEN** the round report reads only the newest of those rows, by `started_at` in its `run.json`, so a row sampled again replaces the older one
- **AND** a newest row that failed drops the candidate, and a newest row that is contended, unverified or has no verdict is missing evidence, so the `confirmed` gate is unverified, not fail, which `test_gauntlet_loop.py` checks

#### Scenario: Window ends during the confirmation
- **WHEN** the agreed window (`--until`) ends before every confirmation run of a candidate
- **THEN** no confirmation run starts unless its planned time ends before `--until`, and the confirmation stops at that candidate
- **AND** the planned time starts at the model estimate, made longer by as much as the search found the host slower than its own plan, and rises to the longest confirmation run measured so far, so a host slower than the estimate does not overrun the window
- **AND** the round report marks the `confirmed` gate unverified, not fail, while a ranked candidate has only missing evidence (a cut or missing confirmation, missing stream rows, a newest stream row that is contended, unverified or has no verdict, an unverified co-op guard), also after a better ranked candidate failed; a cut result that also holds a failed run counts as failed
- **AND** `gauntlet_loop.py confirm <tune folder>` in a later window runs that candidate again, the baseline first when its result was cut too, and replaces its result in `tune.json`, which `test_gauntlet_loop.py` checks with a fake clock
- **AND** `native_confirmation.stop_reason` in `tune.json` reads `window_end` while a cut result is not run again, and is empty once `confirm` has finished every result, which `test_gauntlet_loop.py` checks
- **AND** the baseline runs once when it is itself the ranked candidate

#### Scenario: Contended confirmation run
- **WHEN** a foreign GPU process shares a native confirmation run
- **THEN** that run runs once more, as in the search
- **AND** after a second contended run the confirmation stops at that candidate, its result counts as not run, the round report marks the `confirmed` gate unverified, not fail, and `gauntlet_loop.py confirm <tune folder>` runs that candidate again, which `test_gauntlet_loop.py` checks

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

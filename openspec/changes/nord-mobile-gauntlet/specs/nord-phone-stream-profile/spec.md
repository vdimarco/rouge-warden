## ADDED Requirements

### Requirement: Best-looking feasible profile
The tuner SHALL choose, among the candidates it measured, the phone profile with the best look that meets the frame budget with a safety margin.

#### Scenario: Search
- **WHEN** the tuner stops because no feasible, visibly better step is left, because it measured 24 candidates, or because the agreed window ended
- **THEN** `tune.json` lists every measured candidate, failures included
- **AND** the winner is feasible: on the night-rain landscape lap its FrameTime p95 is at most 30.0 ms and its GPUTime p95 at most 28.0 ms, and its hitch, VRAM and CVar readback gates pass
- **AND** no measured feasible candidate has a Look score above the winner's by more than the tie threshold, which `test_gauntlet_tune.py` checks with a fake measure function

#### Scenario: Never worse than today
- **WHEN** the tuner picks a winner
- **THEN** the winner's mean SSIM against the ceiling is at least the mean of the current production profile, and every one of its images has an SSIM of at least 0.85

#### Scenario: Co-op guard
- **WHEN** the winner and the baseline run the two-viewer row in the same window
- **THEN** the winner's mean decoded FPS with two viewers is at most 2 FPS below the baseline's, otherwise the next feasible candidate is confirmed instead

#### Scenario: Confirmation fails
- **WHEN** the winner fails any gate in the 3-lap confirmation or in the stream runs
- **THEN** the tuner confirms the next feasible candidate, and `tune.json` records why the first one was dropped

#### Scenario: Fixed settings
- **WHEN** the tuner builds a candidate
- **THEN** it keeps `t.MaxFPS 60`, TSR and VP8 unchanged, and never breaks a knob dependency declared in `Data/Gauntlet/loop.json`

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
- **THEN** `gauntlet_loop.py write-profile` is not run and the profile section stays unchanged
- **AND** the default changes to `phone` only in a separate change after the user approves

### Requirement: Desktop gate unchanged
The desktop release gate SHALL stay separate from the phone profile and unchanged.

#### Scenario: Desktop profile run
- **WHEN** the host runs `profile_package.py` after this change
- **THEN** it still gates FrameTime p95 below 16.67 ms at Epic quality and 100% screen percentage on its three scenes at both sizes, and the gauntlet never edits its settings or limits

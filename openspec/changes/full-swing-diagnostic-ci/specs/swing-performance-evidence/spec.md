## MODIFIED Requirements

### Requirement: Performance measurements remain diagnostic
FPS, frame-time and input-to-submit benchmark thresholds SHALL NOT be required merge gates. Hardware results SHALL stay explicitly unverified until measured on the actual device; missing measurements SHALL NOT block release or inherit a hardware score. Verified shipped correctness regressions SHALL still be repaired or reverted.

#### Scenario: A software benchmark times out
- WHEN an optional software-rendered benchmark times out or reports a slow sample
- THEN the result remains diagnostic and does not fail a required CI job
- AND functional frame/input instrumentation checks remain required.

#### Scenario: Gameplay correctness checks run
- WHEN Swing browser QA runs for a change
- THEN all six existing jobs retain their non-benchmark checks, including real frame intervals, keyboard samples, overlay labels and invisible/held simulation exclusions
- AND runtime rendering quality and gameplay behavior are unchanged.

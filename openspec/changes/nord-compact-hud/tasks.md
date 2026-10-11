# Tasks

## Implementation

- [x] Replace the permanent native HUD panels with the compact layout, measured/wrapped text and supported-size spacing.
- [x] Implement player-centered radar projection and road-segment clipping; retain both geographic credits, objective, player and nearby car symbols.
- [x] Time initial/phase-change briefings while preserving private dialogue/errors, save warnings, campaign/legacy counts and existing interaction priority.
- [x] Restyle centered completion and speed/handbrake feedback; limit sound words to comic view without stale motion events.
- [x] Add focused radar clipping automation and quiet/delayed-briefing/completion capture checks; build the Linux Development editor module including the recovery-header refinement successfully.

## Verification and delivery

- [x] Run the native story matrix at 1280×720 and 1920×1080: full burst-spacing 720p before the R-only header plus focused current-header 720p, and full current-source 1080p; preserve save/settings cleanup and exact source scopes.
- [x] Run 13 native automation tests and relevant smoke states at both sizes: 66 checks/15 captures each; confirm only the final R-header expression and three burst presentation expressions differ from that tested source.
- [ ] Complete independent visual review of story/smoke states at both sizes, including briefing timeout/change, save warning, tool prompt, rescue/race completion, dialogue, blocked exit, car/objective priority, credits and both peers' private/shared feedback.
- [ ] Review decoded browser video and touch-control clearance at 360×800, 800×360 and landscape fullscreen; record physical-device and off-LAN limits separately.
- [x] Rebuild/cook/archive the current Linux package and verify independent-peer startup, seven rendered views and 48 non-save files matching the browser package; retain separate CompactHUDPackage evidence.
- [ ] Complete the six Epic reference-scene profiles and verify the normal two-player browser service after owner delivery.
- [ ] Record current-build results and visual evidence, manually review delta structure with CLI validation explicitly unavailable, then archive only after accepted implementation and checks.

Implementation and native automated evidence are complete with the exact source scopes above. The current-source editor build and full 1080p 121-check/21-capture suite pass; the full burst-spacing 720p pass is supplemented by a current-source focused header capture. The 13 native tests and both 66-check/15-capture smoke runs are retained with an exact source comparison distinguishing the final four presentation expressions. All story cleanup guards pass. Fresh 72 PNGs and current reports are archived under `Saved/Tests/CompactHUD/`; four historical raw reports were restored and original Preview paths are provenance only. The exclusive HUD render window is closed and the GPU released to the host owner, whose current package build/startup/parity checks pass. Checked tasks do not establish final visual, complete performance or browser acceptance; current results are tracked in [CompactHUD.md](../../../games/nord-unreal/Verification/CompactHUD.md) and [CompactHUD.json](../../../games/nord-unreal/Verification/CompactHUD.json). Canonical merge and archival remain pending owner acceptance.

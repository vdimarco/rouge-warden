# Tasks

- [x] Inspect current arcade registration, sound and deployment conventions; record scope and scenarios.
- [x] Integrate the standalone game, cabinet, Strategy group and shared switcher/audio.
- [x] Implement GPU wave animation with stable horizon, pause/reduced-motion behavior and fallback.
- [x] Run engine, ocean, route, layout, switcher and sound checks; capture required cabinet widths.
- [x] Publish the reviewed PR through the normal deployment path and verify the public URL.
- [x] Archive completed OpenSpec change and review its canonical capability spec (CLI unavailable; use Markdown structure checks).


## Checks completed

- Engine: 15/15 tests, including all five patrol starts, individual tube choice and lowered-scope behavior.
- Browser: control room → periscope → tube 3 → second target → dive / hydrophone → victory → fresh control room, with true-touch input at 390×844.
- Sea: time-separated GPU samples change water (mean RGB delta 13.85) and leave sky unchanged (delta 0); same-time renders are identical; context-loss fallback and restoration pass.
- Arcade: cabinet and actual coin/START launch at 320, 390 and 1280px; shared switcher pauses time; groups regression passes desktop, portrait and landscape; static machine registry checks pass.
- Quiet: 25/25 selected-game hidden-page audio checks pass (emulated hidden, pagehide and normal-policy real tap).
- Visual: source cabin and desktop/mobile command/weapon screenshots inspected with view_image. Matched scene framing, palette, serif/monospace type, hotspot/control geometry and mobile stacking. Removed weapon-footer text overlap and desktop tab scrollbars. Portrait station tabs intentionally scroll horizontally; walking an avatar is deferred.
- OpenSpec CLI is absent. Markdown structure is checked directly; CLI validation is not claimed. Physical iPhone/Android and audio listening on a phone remain unverified.


## Release

PR #706 merged as `95bd7507b07cf9377603f7f447b66d9449ee390b`. Vercel production deployment `dpl_G8dNRq9ftmy92TTfKQ2pYwNkCqZy` reached READY on 2026-10-24 and assigned `arcade.uptick.systems`. The public route https://arcade.uptick.systems/silent-depth/ returns HTTP 200 without authentication; twelve shipped files were downloaded anonymously and matched the reviewed bytes.

The complete browser suite was rerun against the public HTTPS origin and passed, including the full touch patrol, individual tube selection, replay, all required cabinet widths, GPU ocean checks and graphics fallback. No browser errors; the production deployment's error/fatal runtime-log scan returned no groups. Physical-phone confirmation is still not claimed.

Archived to `openspec/changes/archive/2026-10-24-add-silent-depth/` and reviewed `openspec/specs/silent-depth/spec.md`: all five requirements and nine scenarios match the implemented, tested game. OpenSpec CLI remains unavailable; Markdown structure validation is the recorded alternative.

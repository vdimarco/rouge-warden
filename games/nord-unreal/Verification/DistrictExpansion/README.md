# District expansion checkpoint

The separate College/Bathurst map and the retained 200 m Montréal east strip are implemented. This checkpoint proves source preservation, native authoring/readback, compilation, 29 automation tests, 32 two-peer Toronto headless checks and 19 Montréal crossing/driving/boundary checks. Native rendered appearance and a fresh two-map package are still pending.

The strict running-jump test first reproduced a real escape over the retained 200 cm east wall. `EastJumpEscape.json` retains that failure. `EastBoundaryRepair.json`, `EastCapFresh.json` and `EastRuntime.json` prove the checked upper-cap repair without changing original wall scale or loosening the test. Original native authoring/canonical receipts remain historical; they describe the first 53-actor revision. The repaired map contains 54 additions and four hidden collision cubes.

`RenderFailures.json` retains five failed two-peer capture windows and successful demo/settings/Content restoration. These are failure evidence, not art acceptance. The final separate single-player views will supply visual/HUD review; two-player behavior remains the headless evidence.

Tests use explicitly logged fixture placements and native callbacks. They do not prove physical keyboard/touch delivery, a naturally navigated full trip, packaged performance, final character art or production save/reload. The Montréal encounter test keeps campaign state active but suppresses both disk loading and writing. Toronto headless checks use no campaign-suppression flags and observe absent campaign/population plus unchanged saves.

See [six-hour work log](../DistrictPolishSixHours.md), [Toronto native checkpoint](../CollegeBathurstRuntime/HeadlessRuntime.json), [current expanded runtime](EastRuntime.json), [native automation](AutomationExpanded.json) and [repair receipt](EastBoundaryRepair.json).

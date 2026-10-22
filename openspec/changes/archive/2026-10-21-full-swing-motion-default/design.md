# Design

Change only defaultSettings in main.js, using its existing REDUCED media-query result. loadSave already overlays valid saved choices, including legacy saves with no verse field. No new setting, rendering technique or input behavior is needed; Calm already disables impact flashes, camera shake, bank and snap zoom. The preference is read on page load as elsewhere in this game. This does not promise live media-query changes or disable all movement.

Scope: main.js defaults; browser regression and Swing CI; canonical specification; before/after Comfort screenshots and graphics round log. The test must finish model loading before reloading to avoid aborting in-flight texture loads. No storage schema changes or deletion of progress.

# First two missions — bounded visual review, 2026-10-10 UTC

**Presentation inspection passes at both supported sizes.** All 36 final raw PNGs were independently viewed: 18 at 1280×720 and 18 at 1920×1080, including the repeated rescue with an unsupported future-version save. This accepts the visible prototype HUD, action cues and completion/retry framing in these scenes. Physical solo/co-op comprehension, handling enjoyment, pacing, audio and performance remain outside this review. Missions 3–8 remain planned.

[StorySliceRender1280.json](StorySliceRender1280.json) passes 118 native checks and 18 captures in 84.31 seconds; [StorySliceRender1920.json](StorySliceRender1920.json) passes 118 and 18 in 82.02 seconds. Both record the current campaign/controller source hashes, correct PNG signature/IHDR dimensions/IEND completion, save guards and restored editor settings. File integrity is separate from the visual assessment below. [StorySlice.md](StorySlice.md) explains real native actions and authority-only setup relocations.

## Findings

- The opening view includes the gold clamp while alignment/hold remain 0%. The worklight aim/release prompt and objective are readable. After alignment unlocks the cable phase, the seam is berry coloured; that frame is a post-unlock view rather than proof of the original gold target. Current-phase captions replace the earlier premature bay/sprint captions.
- Red/green clamp states have matching wait/pull text. The extended red plunger cup and handle are visible immediately after the first pull. The earlier stale sprint-error caption is absent after the actual crossing; the reports also require empty client and host captions at that transition.
- The nearby-car entry prompt sits above the briefing without overlapping it. The parked car, beam and final-clamp direction are visible. Driving controls occupy the left of the footer and speed the right, with handbrake status separate at both sizes.
- After the rescue, the press frame disappears and three upright paper-guest proxies on the magenta table/base and a souvenir card are visible. The next objective and 1/2 completion display agree. These are abstract temporary proxies, not a finished transformation into animated human guests.
- Blue gate arches/route marks contrast with purple ink and the route warning. The rival is a temporary blocky projection. Retry frames settle into ordinary chase framing with the road and next gates visible, rather than filling the view with the windshield. Recorded settled camera distances are 697.07 cm at 720p and 697.61 cm at 1080p; neither applies a SpringArm collision fix. No production camera change was needed.
- The final view displays 2/2 completion and T replay, with saved status for the supported save. All seven future-save frames retain the session-only save warning, including successful M1 completion; completion is not mislabelled as persistence.

The press, clamps, paper guests, souvenir and projected car remain simple prototype forms. Large press beams occupy much of the upper clamp view, distant world captions can fall under fixed HUD panels, and the brief M1 completion toast is still present at the immediately following race-start capture. Dense dark outlines/shadows and thin beam/text edges remain stylized and sometimes aliased. These limits do not hide the inspected current action or overlap the HUD text, but this is not final art, a complete campaign or a moving-scene readability guarantee.

## Capture conditions and limits

Native client captures use HighResShot at the requested output sizes from a 640×480 PIE window. To fit the shared GPU, this inspection alone uses a 256 MiB texture pool, 512 virtual-shadow pages, 1024 Lumen atlas and 128 Nanite pool. The editor realtime override and duplicate listen-host viewport rendering are disabled during inspection; the client view renders and both peers retain native gameplay/replication. Cleanup restores settings, saves and the world-local emulation. Packaged Epic defaults are unchanged. These images and suite timings are not default-Epic performance measurements or proof of physical fullscreen input delivery.

The camera turns toward the gold target and restored table are recorded presentation fixtures; actors and progress are not changed for those views. Race gate approaches use traced setup relocations followed by actual native driving; the separate continuous [RaceDrive.json](RaceDrive.json) covers a complete naturally driven circuit. Neither harness establishes enjoyable physical handling, human co-op communication or audio quality.

## Inspected final images

Every entry below was viewed at both sizes after its corresponding complete passing report. Earlier failed, partial and pre-caption/fixture-correction frames are superseded.

| State | 1280×720 | 1920×1080 |
| --- | --- | --- |
| WorklightAim | [PNG](../Preview/StorySlice1280/WorklightAim.png) | [PNG](../Preview/StorySlice1920/WorklightAim.png) |
| AlignedWorklight | [PNG](../Preview/StorySlice1280/AlignedWorklight.png) | [PNG](../Preview/StorySlice1920/AlignedWorklight.png) |
| FirstClamp | [PNG](../Preview/StorySlice1280/FirstClamp.png) | [PNG](../Preview/StorySlice1920/FirstClamp.png) |
| FirstClampPull | [PNG](../Preview/StorySlice1280/FirstClampPull.png) | [PNG](../Preview/StorySlice1920/FirstClampPull.png) |
| CarEntryPrompt | [PNG](../Preview/StorySlice1280/CarEntryPrompt.png) | [PNG](../Preview/StorySlice1920/CarEntryPrompt.png) |
| CarLightBay | [PNG](../Preview/StorySlice1280/CarLightBay.png) | [PNG](../Preview/StorySlice1920/CarLightBay.png) |
| TerraceRestored | [PNG](../Preview/StorySlice1280/TerraceRestored.png) | [PNG](../Preview/StorySlice1920/TerraceRestored.png) |
| RaceStarted | [PNG](../Preview/StorySlice1280/RaceStarted.png) | [PNG](../Preview/StorySlice1920/RaceStarted.png) |
| RaceRetry | [PNG](../Preview/StorySlice1280/RaceRetry.png) | [PNG](../Preview/StorySlice1920/RaceRetry.png) |
| BlueAlternativeGate | [PNG](../Preview/StorySlice1280/BlueAlternativeGate.png) | [PNG](../Preview/StorySlice1920/BlueAlternativeGate.png) |
| SliceComplete | [PNG](../Preview/StorySlice1280/SliceComplete.png) | [PNG](../Preview/StorySlice1920/SliceComplete.png) |
| FutureSaveWarning | [PNG](../Preview/StorySlice1280/FutureSaveWarning.png) | [PNG](../Preview/StorySlice1920/FutureSaveWarning.png) |
| FutureSaveWorklightAim | [PNG](../Preview/StorySlice1280/FutureSaveWorklightAim.png) | [PNG](../Preview/StorySlice1920/FutureSaveWorklightAim.png) |
| FutureSaveAlignedWorklight | [PNG](../Preview/StorySlice1280/FutureSaveAlignedWorklight.png) | [PNG](../Preview/StorySlice1920/FutureSaveAlignedWorklight.png) |
| FutureSaveFirstClamp | [PNG](../Preview/StorySlice1280/FutureSaveFirstClamp.png) | [PNG](../Preview/StorySlice1920/FutureSaveFirstClamp.png) |
| FutureSaveFirstClampPull | [PNG](../Preview/StorySlice1280/FutureSaveFirstClampPull.png) | [PNG](../Preview/StorySlice1920/FutureSaveFirstClampPull.png) |
| FutureSaveCarLightBay | [PNG](../Preview/StorySlice1280/FutureSaveCarLightBay.png) | [PNG](../Preview/StorySlice1920/FutureSaveCarLightBay.png) |
| FutureSaveTerraceRestored | [PNG](../Preview/StorySlice1280/FutureSaveTerraceRestored.png) | [PNG](../Preview/StorySlice1920/FutureSaveTerraceRestored.png) |

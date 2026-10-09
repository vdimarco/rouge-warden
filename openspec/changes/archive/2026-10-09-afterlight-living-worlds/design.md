# Design

Use a pinned, locally vendored Phaser 3 runtime for scene lifecycle, camera, texture composition and input. Keep deterministic campaign simulation separate. Original MIT ASCII source grids remain the art master; evolving cell art is an intentional code-native ASCII choice, preserving the user reference rather than adding raster art. Dark ink background, muted blue atmosphere and warm light cues; scene-first layout with operation controls integrated beside the scene.

Each map has weather and spatial terrain effects. Operations are distinct: focus forest light, route city power, tether and escort coastal boats, read fjord echoes, align desert bearings, cultivate lunar gardens. Choices require explicit readable decisions with forgiving retries and no resource charge until completion. Pause freezes simulation and operations. Legacy saves rebuild transient simulation safely. Reduced motion freezes decoration and keeps essential action cues.

## Runtime boundaries and performance

Phaser owns the active scene, canvas texture composition, camera pan/zoom transitions, pointer coordinates and keyboard states. A 60 Hz fixed simulation step keeps currents and towing consistent when frame rates vary, with bounded catch-up after a hidden tab. Environmental ASCII frames update independently of actor/operation composition. The compositor repaints changed cells and their glyph-overlap neighbors; region changes and resizing invalidate caches. A full-redraw comparison must show no stale pixels.

The Phaser texture has a fixed 1200×600 master; mobile screens scale it rather than multiplying the offscreen surface by phone device pixel ratio. Original scenes, attribution and licenses remain local, alongside the pinned Phaser runtime. No runtime CDN or backend is required.

During an operation, its instrument replaces generic controls. Non-spatial work holds the avatar safely while weather continues; coastal towing keeps movement available and attachment requires proximity. Save restoration discards unfinished operations without charging supplies and preserves clamped completion timestamps.

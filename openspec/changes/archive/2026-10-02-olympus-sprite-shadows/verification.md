# Verification

- All 12 tests pass: alpha footprints, separated feet, transparent/stray pixels, loaded frame cache reuse, unloaded images, mirrored pose, readable shadow projection in both cameras, input and run preservation.
- Production build and diff checks pass.
- Both views rendered and inspected across three realms at 390×844, 844×390 and 540×900. All 12 hero frames, enemy shapes and scenery were checked. The 110-enemy native-canvas check measured about 10 ms per isometric frame and 6 ms top-down on the desktop runtime; this is not a physical-phone performance claim.
- Live preview inspected: title, start, silhouette floor shadows, pause, top-down switch and resume. No application errors; browser extension metadata errors excluded. The shared light direction was then adjusted to preserve readable shadow area in top-down, covered by a regression assertion and fresh renders of both views.
- OpenSpec CLI unavailable. Markdown requirement/scenario structure reviewed manually. Physical phone testing remains manual.

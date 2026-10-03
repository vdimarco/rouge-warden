# Verification

- `npm test`: 7 passing checks for inverse projection, cardinal/diagonal screen control, world speed, sprite facing, saved preference, unavailable storage, paused state preservation and input clearing.
- `npm run build` and `git diff --check`: pass.
- Canvas renders inspected in isometric/top-down across Asphodel, Styx and Tartarus at 390×844, 844×390 and 540×900. Terrain fills each viewport; sprites remain upright; warning circles become ground ellipses; raised ruin bases and shadows align with feet. Desktop native-canvas render sampling is about 1–2 ms per frame; this is not a physical-device performance claim.
- Live Vercel preview: isometric default, title toggle to top-down, reload persistence, start, pause, toggle back to isometric and resume confirmed. No application console errors observed (browser extension metadata errors excluded).
- OpenSpec CLI unavailable. Requirement/scenario headings and delta structure reviewed manually.
- Physical phone interaction/performance remains manual.

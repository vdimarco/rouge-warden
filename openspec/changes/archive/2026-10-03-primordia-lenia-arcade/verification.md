# Verification

- `node qa/primordia/lenia.test.mjs`: 9 checks pass (pattern decode, Orbium glide, all four hunters survive alone, a dragged hunter survives and closes in, prey bloom starves, red tide burns out, devouring prey, Frenzy kills a hunter, epoch and mutation flow).
- `node qa/primordia/bot.mjs 240 <seed>`: a simple bot plays four-minute runs on several seeds. It reaches epoch VI with light dipping to 30-60 when hunters close in; one earlier tuning let it die at 83 s.
- `NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs`: passes at 1280×720 (mouse and keyboard) and 390×844 (touch). Title, start, eating, a tracked hunter, Frenzy devour, mutation pick, pause and game over all work, with no console errors and no horizontal overflow.
- Arcade check: selecting PRIMORDIA, dropping a token and pressing Enter loads /primordia/.
- Not checked here: real GPUs and phones (the container renders with SwiftShader at a few frames per second), audio output, and physical gamepads.

# Tasks

- [x] Find the cause: the flash and the card follow the wall clock, and the push-in and the camera follow the lake's clock.
- [x] `world.js`: run the photo beat on the wall clock (`beatT`), and move the camera on the push-in's curve (`photoStep`).
- [x] `main.js`: take `PHOTO` from `WORLD.PHOTO`.
- [x] Add Part D to `qa/fish/moments.e2e.mjs`. It fails on the old code and passes on the new code.
- [x] `qa/fish/world.render.mjs`: let the wall-clock beat pass before the push-in is measured.
- [x] `qa/fish/store-shots.mjs`: remove the zoom wait. Render `05-trophy.png` again.
- [x] Run the fish checks.
- [x] Validate the change with the OpenSpec CLI.
- [x] Archive the change.

## Checks

Run under Chromium with SwiftShader (software WebGL). No real phone was used.

- `PARTS=D node qa/fish/moments.e2e.mjs`, where the fish's middle sits at the flash, against the middle of the free part:

  | Size | Old code | New code |
  | --- | --- | --- |
  | 390x844 | 388 px against 249 (fails) | 250 against 249 |
  | 360x640 | 260 px against 147 (fails) | 145 against 147 |
  | 844x390 | 494 px against 195, below the view (fails) | 195 against 195 |

  The card check passes on both, because by the time the card has come up the old camera has caught up enough.
- After the photo settles, the old and the new code reach the same pose: at 360x640 the fish's middle is at 136 and 134 px, and the free part's middle is at 134.
- `node qa/fish/moments.e2e.mjs` (Parts A to D): 81 checks pass. `node qa/fish/cutscenes.e2e.mjs`: 75 pass. `node qa/fish/boot.e2e.mjs`: 91 pass.
- `node qa/fish/world.render.mjs`: OK, 106 shots. The push-in check now grows the fish at every place (Loon Lake 0.07 to 1.39 of the view's width, Stump Bay 0.17 to 1.45, the river 0.27 to 1.41, Gull Rock 0.30 to 1.46). Without the wait it failed on the new code (0.07 to 0.08).
- The 10 unit tests in `qa/fish/*.test.mjs` pass.
- `node qa/fish/store-shots.mjs` without the zoom wait: every check passes. The new `05-trophy.png` (1080 x 1920, RGB) shows the fish in the middle of the free part, with the gold sparks.
- `openspec validate fish-trophy-photo-framing --type change --strict` (CLI 1.14.0): valid.

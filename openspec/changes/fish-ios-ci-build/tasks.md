# Tasks

- [x] Add `.github/workflows/fish-ios.yml` with the simulator job and the TestFlight job.
- [x] Document the Apple setup and the secrets in `apps/fish/README.md`.
- [x] Target iPhone and iPad, and allow "Designed for iPad" on Mac, in the Xcode project. Update the native check.
- [x] Set the Mac flag in `MainViewController`, and use it in `Native.touchScreen` for the game's input mode.
- [x] Version 1.1.0 (Android code 5, iOS build 5).
- [x] Add the iPad and Mac runs to `qa/fish/app-bundle.e2e.mjs`.
- [x] Open the app on an iPad simulator and build the device app in CI.
- [x] Add the iPad 13" slot to the store kit and `qa/fish/store-shots.mjs`. Update the listing, the accessibility answers and the device checklist.
- [x] Make the iPad 13" store screenshots and commit them (`apps/fish/store/screenshots/ipad-13/`).
- [ ] Run the iOS workflow in GitHub Actions and look at the iPhone and iPad screenshots.
- [ ] Archive the change.

## Checks

- On Linux: `npm run build:www -- --release`, `npx cap sync` (with the native check), `npm run test:check` (61 passed) and `npm run test:native` (12 passed) in `apps/fish`. All ten `qa/fish/*.test.mjs` pass.
- `qa/fish/app-bundle.e2e.mjs`: 26 ok. With the game code from before this change, the three Mac checks fail (the help says Touch, Motion can be picked, Settings says the device buzzes).
- `SLOTS=ipad-13 qa/fish/store-shots.mjs`: all checks pass, after two fixes to the script. At 2064 x 2752 the software renderer draws a frame in seconds, so the strike prompt and the jump zoom (both on the game clock) need longer than the old fixed waits: the script now waits up to 5 min for each, and goes on as soon as it holds. Before the fix the fight check failed twice (zoom 0.45 and 0.59) and the strike check once.
- The shots are saved with lossless PNG compression (31 MB down to 20 MB; the pixels are the same). The strike shot shows the bass shadow as faintly as the Android set does.
- The Xcode build, the simulators and the TestFlight upload need the macOS runner. The Mac launch and the iPad and Mac play need real devices (see the device checklist).

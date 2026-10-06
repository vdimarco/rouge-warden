# Tasks

- [x] Add `.github/workflows/fish-ios.yml` with the simulator job and the TestFlight job.
- [x] Document the Apple setup and the secrets in `apps/fish/README.md`.
- [x] Target iPhone and iPad, and allow "Designed for iPad" on Mac, in the Xcode project. Update the native check.
- [x] Set the Mac flag in `MainViewController`, and use it in `Native.touchScreen` for the game's input mode.
- [x] Version 1.1.0 (Android code 5, iOS build 5).
- [x] Add the iPad and Mac runs to `qa/fish/app-bundle.e2e.mjs`.
- [x] Open the app on an iPad simulator and build the device app in CI.
- [x] Add the iPad 13" slot to the store kit and `qa/fish/store-shots.mjs`. Update the listing, the accessibility answers and the device checklist.
- [ ] Run the iOS workflow in GitHub Actions and look at the iPhone and iPad screenshots.
- [ ] Archive the change.

## Checks

- On Linux: `npm run build:www -- --release`, `npx cap sync` (with the native check), `npm run test:check` (61 passed) and `npm run test:native` (12 passed) in `apps/fish`. All ten `qa/fish/*.test.mjs` pass.
- `qa/fish/app-bundle.e2e.mjs`: 26 ok. With the game code from before this change, the three Mac checks fail (the help says Touch, Motion can be picked, Settings says the device buzzes).
- `SLOTS=ipad-13 qa/fish/store-shots.mjs` made all eight iPad shots at 2064 x 2752. Its fight check failed on the zoom (0.45, not over 0.9, after 20 s): at that size the software renderer is slow, and the picture shows the jump as the list asks. The shots are not in git (30 MB).
- The Xcode build, the simulators and the TestFlight upload need the macOS runner. The Mac launch and the iPad and Mac play need real devices (see the device checklist).

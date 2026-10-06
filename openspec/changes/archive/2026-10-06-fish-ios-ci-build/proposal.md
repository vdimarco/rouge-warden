# Build the Reel It In iPhone app without a Mac

The owner asked for an iPhone app of Reel It In. The Capacitor iOS project in `apps/fish/ios` exists, but nobody has built it: the build needs a Mac with Xcode 26, and the team works on Linux. Android has a GitHub Actions workflow. iOS has none.

## Scope

- Add `.github/workflows/fish-ios.yml` on a GitHub macOS runner with Xcode 26.
- On each pull request and push to `main` that changes the game or the app: build `www/`, sync the iOS project, build for the iOS Simulator, open the app on a simulated iPhone, check that it still runs after 20 s, and keep a screenshot and the simulator app as artifacts.
- On a run by hand with **TestFlight** on: build the store bundle (`--release`), archive, sign with an App Store Connect API key (automatic signing), and upload to App Store Connect. A build number input overrides `CURRENT_PROJECT_VERSION`.
- Document the one-time Apple setup and the four secrets in `apps/fish/README.md`.

## Out of scope

- Changes to the game or to the native project.
- App Store review submission. The owner submits from App Store Connect with the text in `apps/fish/store/`.

## iPad and Mac

The owner then asked that the app also work on iPad and macOS.

- The iOS app targets iPhone and iPad (`TARGETED_DEVICE_FAMILY = "1,2"`), portrait only, with `UIRequiresFullScreen` (an iPad app with fewer than four orientations needs it).
- Macs with Apple silicon run the same app as "Designed for iPad" (`SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = YES`). Mac Catalyst is out of scope: the Capacitor plugins do not support it, and it would be a second app build.
- On a Mac, `MainViewController` sets `window.__reelItInMac` before the page loads. `Native.touchScreen` is then false, so the game uses its computer controls (mouse and keys), turns off motion play, and Settings says "This Mac cannot buzz." The Mac web view can report touch points, so the flag is the only reliable signal.
- The version goes to 1.1.0 (Android code 5, iOS build 5).
- The bundle browser check opens the bundle as the iOS app on an iPad and on a Mac. CI opens the app on an iPad simulator and builds the device app that Macs run.
- The store kit names the iPad 13" screenshot slot, and `qa/fish/store-shots.mjs` can make it (`SLOTS=ipad-13`).

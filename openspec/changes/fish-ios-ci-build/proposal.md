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

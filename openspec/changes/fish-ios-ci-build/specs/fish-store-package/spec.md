## ADDED Requirements

### Requirement: iOS build in CI
A GitHub Actions workflow SHALL build the iOS app on a macOS runner with Xcode 26, so a developer with no Mac can build the app and put it on an iPhone. It SHALL build for the iOS Simulator on each pull request and push to `main` that changes `public/fish/` or `apps/fish/`. A run by hand SHALL be able to sign the app and upload it to App Store Connect with an App Store Connect API key kept in repository secrets.

#### Scenario: Pull request build
- **WHEN** a pull request changes `public/fish/` or `apps/fish/`
- **THEN** the workflow builds the app for the iOS Simulator, opens it on a simulated iPhone, fails if the app is not running 20 s after launch, and keeps a screenshot and the simulator app as run artifacts.

#### Scenario: TestFlight upload
- **WHEN** the owner runs the workflow by hand with TestFlight on and the four secrets set
- **THEN** it builds the store bundle with `--release`, archives and signs the app, uploads it to App Store Connect, and the run summary shows the version and the build number.

#### Scenario: Missing secrets
- **WHEN** the owner runs the TestFlight upload without the secrets
- **THEN** the run stops at once and names the four secrets.

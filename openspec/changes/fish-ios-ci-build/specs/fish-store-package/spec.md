## MODIFIED Requirements

### Requirement: Capacitor project
`apps/fish/` SHALL hold a Capacitor 8 project for iOS and Android with the app ID, the display name "Reel It In", portrait lock, a hidden status bar, a full-screen layout that keeps the safe areas, and only the plugins the game uses. iOS SHALL target iPhone and iPad, from iOS 16.4 (the first version with import maps), portrait only with `UIRequiresFullScreen`, and SHALL let Macs with Apple silicon run it as "Designed for iPad". Apple Vision Pro SHALL stay off. Android SHALL use minSdk 24, targetSdk 36, the game app category, and the VIBRATE permission.

#### Scenario: Android debug build
- **WHEN** a developer runs the documented build steps on a machine with the Android SDK
- **THEN** `assembleDebug` makes an APK that holds the game files and opens to the title with no network.

#### Scenario: iOS project
- **WHEN** a developer opens the iOS project on a Mac with Xcode
- **THEN** the project targets iPhone and iPad from iOS 16.4, allows "Designed for iPad" on Mac, has portrait lock, a privacy manifest that declares no tracking and no collected data, the app icon, and the splash screen set. It has no motion usage text, because the web view grants motion itself.

#### Scenario: iPad
- **WHEN** a player opens the app on an iPad
- **THEN** the game fills the screen in portrait, the title buttons are inside the screen, and the controls are the touch and motion controls of a phone.

## ADDED Requirements

### Requirement: Mac controls
On a Mac, the app SHALL tell the game that it runs on a Mac before any page script runs, and the game SHALL then use its computer controls: the mouse and the keys, with no motion play and no buzz.

#### Scenario: Mac title and settings
- **WHEN** a player opens the app on a Mac with Apple silicon
- **THEN** the How to play tab says "Touch and mouse" and names the mouse, the Controls list in Settings cannot pick Motion, and Settings says "This Mac cannot buzz."

#### Scenario: Touch points on a Mac
- **WHEN** the Mac web view reports touch points
- **THEN** the game still uses the computer controls, because the Mac flag decides.

### Requirement: iOS build in CI
A GitHub Actions workflow SHALL build the iOS app on a macOS runner with Xcode 26, so a developer with no Mac can build the app and put it on an iPhone, an iPad or a Mac. It SHALL build for the iOS Simulator and the device on each pull request and push to `main` that changes `public/fish/` or `apps/fish/`. A run by hand SHALL be able to sign the app and upload it to App Store Connect with an App Store Connect API key kept in repository secrets.

#### Scenario: Pull request build
- **WHEN** a pull request changes `public/fish/` or `apps/fish/`
- **THEN** the workflow builds the app for the iOS Simulator, opens it on a simulated iPhone and a simulated iPad, fails if the app is not running 20 s after launch on either, keeps screenshots and the simulator app as run artifacts, and builds the unsigned device app with both iPhone and iPad in its device family.

#### Scenario: TestFlight upload
- **WHEN** the owner runs the workflow by hand with TestFlight on and the four secrets set
- **THEN** it builds the store bundle with `--release`, archives and signs the app, uploads it to App Store Connect, and the run summary shows the version and the build number.

#### Scenario: Missing secrets
- **WHEN** the owner runs the TestFlight upload without the secrets
- **THEN** the run stops at once and names the four secrets.

# fish-store-package Specification

## Purpose
The Reel It In app package for the App Store and Google Play: the Capacitor project, a self-contained web bundle, icons and the splash, the crank kept clear of system gestures, the privacy policy and the listing, the store videos, and the release steps.

## Requirements

### Requirement: Capacitor project
`apps/fish/` SHALL hold a Capacitor 8 project for iOS and Android with the app ID, the display name "Reel It In", portrait lock, a hidden status bar, a full-screen layout that keeps the safe areas, and only the plugins the game uses. iOS SHALL start at iOS 16.4 (the first version with import maps), on the devices in "Apple devices". Android SHALL use minSdk 24, targetSdk 36, the game app category, and the VIBRATE permission.

#### Scenario: Android debug build
- **WHEN** a developer runs the documented build steps on a machine with the Android SDK
- **THEN** `assembleDebug` makes an APK that holds the game files and opens to the title with no network.

#### Scenario: iOS project
- **WHEN** a developer opens the iOS project on a Mac with Xcode
- **THEN** the project targets iPhone and iPad from iOS 16.4, allows "Designed for iPad" on Mac, has portrait lock, a privacy manifest that declares no tracking and no collected data, the app icon, and the splash screen set. It has no motion usage text, because the web view grants motion itself.

### Requirement: Apple devices
The iOS app SHALL run on iPhone and iPad, portrait only with `UIRequiresFullScreen`, and SHALL let Macs with Apple silicon run it as "Designed for iPad". Apple Vision Pro SHALL stay off.

#### Scenario: iPad
- **WHEN** a player opens the app on an iPad
- **THEN** the game fills the screen in portrait, the title buttons are inside the screen, and the controls are the touch and motion controls of a phone.

### Requirement: Self-contained web bundle
A build script SHALL copy `public/fish/` into `apps/fish/www/`, set the store build flag, and drop the files the app does not use (the arcade script and unused art). The bundle SHALL reference no other host and no root path outside itself.

#### Scenario: Check the bundle
- **WHEN** the build script runs
- **THEN** a check of `www/` finds no `http` import, no root path such as `/icons` or `/arcade`, and no visible arcade text, and the game opens from `www/` in a browser with the network blocked.

### Requirement: Icons and splash
The app SHALL have its own icon and splash screen made from the game's art, at every size the stores need, with an Android adaptive icon.

#### Scenario: Icon set
- **WHEN** the asset step runs
- **THEN** the iOS 1024 px icon and the Android adaptive icon layers exist with no transparency in the iOS icon.

### Requirement: Crank clear of system gestures
The crank SHALL NOT trigger the system back or home gestures.

#### Scenario: Fast crank near the edge
- **WHEN** the player turns the crank 50 times fast in the app
- **THEN** neither Android back nor iOS home fires. (This needs a real phone.)

### Requirement: Privacy policy and listing
The repo SHALL hold a privacy policy page that the game shows offline and the web serves, and the store listing text: the store name "Reel It In: Lake Fishing" (the plain name is taken), subtitle, short and full descriptions, keywords, category, age rating answers, the data safety answers, and the screenshot list. The privacy policy SHALL give the support email, `support@uptick.systems`, as text and as a `mailto:` link.

#### Scenario: Data safety
- **WHEN** a reviewer reads the privacy policy
- **THEN** it says the game collects no personal data, sends nothing off the phone, and keeps progress on the phone only.

#### Scenario: Contact
- **WHEN** a player reads the privacy policy
- **THEN** it shows `support@uptick.systems` as a `mailto:` link to that address

#### Scenario: Placeholder before a release
- **WHEN** a developer builds the bundle for a store upload (`--release`) while a page still holds an owner placeholder (an element with `data-placeholder`)
- **THEN** the build fails and names the placeholder. A debug build and the browser checks still pass, and the bundle check prints a warning.

### Requirement: Release steps
A README in `apps/fish/` SHALL list the steps to build, sign, and upload both apps, the owner's accounts and decisions they need, and the checks that need a real phone.

#### Scenario: New developer
- **WHEN** a developer follows the README on a Mac
- **THEN** they can make a signed iOS archive and a signed Android App Bundle without other notes.

### Requirement: Store videos
`qa/fish/store-video.mjs` SHALL make two store videos from the store build of the game: a Google Play promo video and an App Store app preview. Every picture of the game SHALL be the game itself, filmed frame by frame, and every sound SHALL be a sound the game played, at the time it played it. The videos SHALL show no device and no brand. `apps/fish/store/video.md` SHALL say what each video shows, how to upload it, and how to make it again.

#### Scenario: Google Play promo video
- **WHEN** a developer runs the script with `public/` served
- **THEN** it writes an MP4 of 30 s to 2 min at 1920 x 1080 and 30 fps, H.264 with AAC. The game is on screen from the first second, and the titles say what the game is with the sound off.

#### Scenario: App Store app preview
- **WHEN** a developer runs the script with `FORMAT=appstore`
- **THEN** it writes an MP4 of 15 to 30 s at 886 x 1920 and 30 fps, H.264 High Profile at Level 4.0 or lower at no more than 12 Mbps, with stereo AAC at 256 kbps. Each picture is a full-screen capture of the game. Only text, and a ring where a finger touches, go over it.

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

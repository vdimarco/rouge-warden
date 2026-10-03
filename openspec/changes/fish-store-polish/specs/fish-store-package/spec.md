## ADDED Requirements

### Requirement: Capacitor project
`apps/fish/` SHALL hold a Capacitor 8 project for iOS and Android with the app ID, the display name "Reel It In", portrait lock, a hidden status bar, a full-screen layout that keeps the safe areas, and only the plugins the game uses.

#### Scenario: Android debug build
- **WHEN** a developer runs the documented build steps on a machine with the Android SDK
- **THEN** `assembleDebug` makes an APK that holds the game files and opens to the title with no network.

#### Scenario: iOS project
- **WHEN** a developer opens the iOS project on a Mac with Xcode
- **THEN** the project has portrait lock, a motion usage text, the app icon, and the splash screen set.

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

### Requirement: Privacy policy and listing
The repo SHALL hold a privacy policy page that the game shows offline and the web serves, and the store listing text: name, subtitle, short and full descriptions, keywords, category, age rating answers, the data safety answers, and the screenshot list.

#### Scenario: Data safety
- **WHEN** a reviewer reads the privacy policy
- **THEN** it says the game collects no personal data, sends nothing off the phone, and keeps progress on the phone only.

### Requirement: Release steps
A README in `apps/fish/` SHALL list the steps to build, sign, and upload both apps, the owner's accounts and decisions they need, and the checks that need a real phone.

#### Scenario: New developer
- **WHEN** a developer follows the README on a Mac
- **THEN** they can make a signed iOS archive and a signed Android App Bundle without other notes.

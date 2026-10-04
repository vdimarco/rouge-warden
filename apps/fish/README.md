# Reel It In app (iOS and Android)

This folder wraps the web game in `public/fish` as a phone app with [Capacitor 8](https://capacitorjs.com/). The web game stays the single source. A build script copies it into `www/`, and Capacitor puts `www/` inside the Android and iOS projects.

Never edit `www/` or the copies in the native projects by hand. Change `public/fish`, then build again.

## What is here

| Path | What it is |
| --- | --- |
| `package.json` | Capacitor 8.5 and the plugins: App, Haptics, Preferences, Splash Screen and Keep Awake. The scripts below. |
| `capacitor.config.json` | The app ID, the name, the splash and system bar settings, and the web view settings. |
| `scripts/build-www.mjs` | Makes `www/` from `public/fish` and runs the bundle check. |
| `scripts/check-www.mjs` | The bundle check. `scripts/check-www.test.mjs` tests it. |
| `scripts/native-check.mjs` | Runs after each `cap sync`. It keeps the iOS package at 16.4 and fails when a store setting is missing. |
| `scripts/render-art.mjs` | Paints the icon, the adaptive icon layers, the splash and the Play graphics. |
| `scripts/adaptive-icons.mjs` | Writes the Android adaptive icon layers at full size after `@capacitor/assets`. |
| `resources/` | The icon and splash sources (`icon-only.png` is the 1024 px icon). |
| `web/webview-update.html` | The page the app shows when the Android web view is too old (before version 105). |
| `android/`, `ios/` | The native projects, made by `npx cap add` and then set up for the stores. |
| `store/` | The store listing, the privacy and age answers, the screenshot list, the review notes and the accessibility labels. |
| `www/` | Made by the build. Not in git. |

The privacy policy is `public/fish/privacy.html`. The web serves it at `/fish/privacy.html`, and the app shows the same file offline.

## What you need

| For | You need |
| --- | --- |
| Everything | Node 22 or later and npm. Run `npm ci` in this folder. |
| Android | JDK 21, and the Android SDK with platform 36 (`platforms;android-36`), `platform-tools` and build tools 35.0.0. Gradle installs build tools 35.0.0 on the first build if the licences are accepted. Set `ANDROID_HOME`, or write `sdk.dir=/path/to/android-sdk` in `android/local.properties` (not in git). Gradle 8.14.3 comes with the wrapper. |
| iOS | A Mac with Xcode 26 and the iOS 26 SDK (App Store uploads need them since April 2026). Swift Package Manager fetches Capacitor, so CocoaPods is not needed. |
| Art and browser checks | Playwright with Chromium: `npm ci --prefix ../../qa/browser`, then `npx playwright install chromium` in `qa/browser`. Run the scripts with `NODE_PATH=../../qa/browser/node_modules`. |
| Uploads | An Apple Developer Program membership and a Google Play developer account. |

## Build the web bundle

```sh
npm ci
npm run build:www          # makes www/ and runs the bundle check
npm run check:www          # the check alone
npm run check:www -- --strict   # also fails on "ghibli" and on arcade text in a script (or set WWW_STRICT=1)
npm run test:check         # tests for the check itself
```

The build copies `index.html`, `privacy.html`, `js/`, `lib/` and `fonts/`, and every other file that a page, a style sheet or a script loads. It leaves out files that nothing loads, such as `art/README.md`. In `www/index.html` it sets `<html data-build="store">`, removes the arcade switcher script, the `og:` and `twitter:` tags, the `/icons` links and any web font link, hides the "Switch game" and "Back to the arcade" parts, and points the import map at `./lib/three.module.min.js`.

The check reads every HTML, CSS, JavaScript, SVG and JSON file in `www/`, also the files that nothing loads. It fails when:

- a file loads another host (an import, a link, a `src`, a `fetch`, a page navigation);
- the code holds a web address (`http://`, `https://`, `ws://`, `wss://` or `//host`) anywhere outside a comment: in a string, in an attribute, in a style sheet, or in a JSON or SVG file. XML namespace names such as `http://www.w3.org/1999/xhtml` are allowed, and so is plain text in `privacy.html`;
- a load, a link, markup in a string, or a page navigation (`location = ...`, `location.assign()`, `location.replace()`, `history.pushState()`, `window.open()`) uses a root path such as `/`, `/icons` or `/arcade`;
- a file names a missing file;
- the HTML shows arcade text ("Switch game", "Back to the arcade", "GET PLUNGER'D") outside the parts that the store build hides.

It warns about "ghibli", and about arcade text in a script: the check cannot tell if the code shows that string. With `--strict` (or `WWW_STRICT=1`) both are errors. When the code shows the string on the web only (it checks the store flag first), put `// web only` on the same line. It prints the size of the bundle.

The check reads the files. It cannot see a web address that the code builds at run time from parts, or a root path that the code keeps in a variable. The browser check below blocks and counts every request that leaves the app's origin, and it fails on arcade text that the page shows.

While the boot work is not in `public/fish`, the build prints warnings: it borrows three.js from `public/crimson/lib`, and the app has no game fonts and no native bridge. The warnings go away when those files land.

Browser check of the bundle, with the network blocked and a fake Capacitor bridge (from the repository root):

```sh
NODE_PATH=qa/browser/node_modules node qa/fish/app-bundle.e2e.mjs
```

## Android

### Debug APK

```sh
npm run android:debug
# the same steps: npm run build:www && npx cap sync android && (cd android && ./gradlew assembleDebug)
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a phone with USB debugging on: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. In a debug build, `chrome://inspect` on a computer shows the web view (Capacitor turns web view inspection on for debuggable builds only). A release build turns this off.

To use the game's debug overlay in the app, open the web view in the inspector and type `location.replace("./?debug")` in its console. The page loads again with the overlay. On iOS, a debug build from Xcode works the same way in Safari > Develop > the iPhone.

Check the manifest of the APK:

```sh
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump badging android/app/build/outputs/apk/debug/app-debug.apk | grep -E "package:|targetSdk|uses-permission"
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump xmltree --file AndroidManifest.xml android/app/build/outputs/apk/debug/app-debug.apk | grep -E "minSdk|screenOrientation|appCategory"
```

You must see the package name, `targetSdkVersion:'36'`, `minSdkVersion=24`, `VIBRATE`, `screenOrientation=1` (portrait) and `appCategory=0` (game).

### Signed release bundle (AAB) for Google Play

Google Play signs the app for the store (Play App Signing). You sign each upload with your own upload key.

1. Make an upload key once. Keep it out of the repository, for example in `~/keys/`:

   ```sh
   keytool -genkeypair -v -keystore ~/keys/reelitin-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```

   Keep the file and both passwords in a password manager. If you lose the upload key, Play support can reset it, but it takes days.
2. Set the version in `android/app/build.gradle`: `versionCode` goes up by 1 for every upload, and `versionName` is the version people see (for example `1.0.0`).
3. Build and sign. The passwords come from the environment, never from a file in git:

   ```sh
   npm run build:www
   npx cap sync android
   npx cap build android \
     --keystorepath ~/keys/reelitin-upload.jks --keystorealias upload \
     --keystorepass "$REELITIN_STORE_PASS" --keystorealiaspass "$REELITIN_KEY_PASS" \
     --androidreleasetype AAB --signing-type jarsigner
   ```

   The signed bundle is `android/app/build/outputs/bundle/release/app-release-signed.aab`. Android Studio can do the same: Build > Generate Signed App Bundle.
4. Upload it in the Play Console: Test and release > a testing track first (see the closed test below), then Production.

`.gitignore` keeps `*.jks`, `*.keystore`, `keystore.properties` and `local.properties` out of git. Never commit a key.

## iOS (on a Mac)

```sh
npm ci
npm run ios:open   # build:www, cap sync ios (with the native check), then opens Xcode
```

In Xcode, on the App target:

1. Signing & Capabilities: pick your team. Keep "Automatically manage signing" on.
2. General: set Version (`MARKETING_VERSION`, for example 1.0.0) and Build (`CURRENT_PROJECT_VERSION`, up by 1 for every upload).
3. Choose "Any iOS Device (arm64)", then Product > Archive.
4. In the Organizer, pick the archive, then Distribute App > App Store Connect > Upload. Before the first upload, use Generate Privacy Report on the archive and check that it lists only the UserDefaults reason (see `store/data-safety.md`).
5. In App Store Connect, add the build to TestFlight, test it on an iPhone, then submit it for review with the text in `store/`.

From the command line, the same archive is:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination "generic/platform=iOS" -archivePath build/ReelItIn.xcarchive archive
xcodebuild -exportArchive -archivePath build/ReelItIn.xcarchive -exportPath build/export -exportOptionsPlist ExportOptions.plist
```

(`ExportOptions.plist` with `method` = `app-store-connect` and your team ID. It is not in git.)

What the iOS project already sets: iPhone only (`TARGETED_DEVICE_FAMILY = 1`) from iOS 16.4 (the first version with import maps), in the project and in the Swift package; portrait only; the status bar hidden; `UIRequiresFullScreen`; `ITSAppUsesNonExemptEncryption = NO`; no `NSMotionUsageDescription`; `PrivacyInfo.xcprivacy` in the App target; no Mac or Vision Pro builds; and `MainViewController`, which hides the status bar and defers the system gesture at the bottom edge so a crank stroke does not leave the app. The home indicator stays on (dimmed by the deferral). It does not auto-hide, because developers report that iOS ignores the deferred edge when the home indicator auto-hides. For this reason SystemBars has `"hidden": false`.

## Icons and splash

```sh
NODE_PATH=../../qa/browser/node_modules npm run art   # paints resources/ and store/graphics/
npm run assets                                         # every size for iOS and Android
```

`npm run art` needs the game's title font at `public/fish/fonts/alfa-slab-one-latin.woff2`, or a path in `ART_FONT`. `npm run assets` runs `@capacitor/assets` for iOS and Android, then `scripts/adaptive-icons.mjs`. Commit the files it changes in `android/app/src/main/res` and `ios/App/App/Assets.xcassets`. To use commissioned art, replace the files in `resources/` (same names and sizes; `icon-only.png` with no alpha) and run `npm run assets`.

## Change the app ID

`com.cottagearcade.reelitin` is a placeholder. Neither store lets you change the ID after the first upload, so set the real one first, in all of these places:

- `capacitor.config.json`: `appId`
- `android/app/build.gradle`: `namespace` and `applicationId`
- `android/app/src/main/java/com/cottagearcade/reelitin/MainActivity.java`: the `package` line, and move the file to the folders of the new ID
- `android/app/src/main/res/values/strings.xml`: `package_name` and `custom_url_scheme`
- `ios/App/App.xcodeproj/project.pbxproj`: `PRODUCT_BUNDLE_IDENTIFIER` (or Xcode > App target > General > Bundle Identifier)

Then run `npx cap sync` and build both apps again.

## How the app is set up, and why

- **Splash.** The splash shows until the game calls `SplashScreen.hide()` when the title is ready. `launchAutoHide` is true with `launchShowDuration` 6000 ms, so the splash also goes away after 6 s if the game never calls it, and the player sees the loading screen or the error card. (With `launchAutoHide` false, Capacitor ignores `launchShowDuration` and would keep the splash up forever.)
- **System bars.** Capacitor 8's built-in SystemBars plugin puts `--safe-area-inset-*` CSS variables on the page for Android web views older than version 140. Its `"hidden"` setting is `false`: on iOS, `"hidden": true` would also auto-hide the home indicator and cancel the bottom-edge deferral (see the iOS section). The native code hides the bars instead. On Android, `MainActivity` hides the status bar and the navigation bar at launch, after SystemBars starts, and again whenever the app gets focus, so a swipe from an edge shows them only for a moment. On iOS, `MainViewController` hides the status bar and leaves the home indicator on. The game must not call `SystemBars.hide()` on iOS. `@capacitor/status-bar` is not installed: SystemBars does the same job, and the two would fight over the bars.
- **Back gesture.** `MainActivity` keeps the Android back gesture out of the bottom 200 dp of both side edges, where the crank sits. Android allows 200 dp of exclusion on each side edge. It cannot exclude the home gesture at the bottom edge.
- **Text zoom.** The Android web view follows the system font size, up to 130% (`MAX_TEXT_SCALE` in `MainActivity`). Above that, the text stops at 130%, so the fixed game layout does not break. Look at this limit again when the game's own Text size setting ships.
- **Old web views.** `minWebViewVersion` is 105 (the game uses import maps and container query units). On an older Android web view, the app shows `webview-update.html`, which tells the player to update Android System WebView.
- **No mixed content, no remote code.** The app loads only its own files from `https://localhost` (Android) and `capacitor://localhost` (iOS). These origins are secure contexts, which the motion sensors need.
- **Save.** `android:allowBackup` stays on, so the save copy in Preferences comes back on a new Android phone.

## Owner decisions still open

| Decision | Default in this folder | What to do |
| --- | --- | --- |
| Bundle ID and application ID | `com.cottagearcade.reelitin` (placeholder) | Pick a reverse domain you control, and change it before the first upload (see above). |
| Store name | "Reel It In: Lake Fishing"; "Reel It In" under the icon | Check that the name is free in App Store Connect and the Play Console, and search the USPTO for "Reel It In" in classes 9 and 41. |
| Support email | A marked placeholder in `public/fish/privacy.html` | Put a real address in the page (text and a `mailto:` link) and in both store forms. |
| Privacy policy URL | `https://<the site>/fish/privacy.html` | Choose the host (the arcade site or your own domain). Both stores need a public URL. |
| Google Play account type | Not known | A personal account made after 13 November 2023 must run a closed test with at least 12 testers for 14 days in a row before it can publish to production. Start the closed test as soon as there is a signed build. An organisation account does not need this. |
| Content rating and audience | 4+, Everyone, PEGI 3; audience 13 and over | Fill in the questionnaires with `store/age-rating.md`. Decide if the Play audience includes children under 13. |
| Accessibility labels | Only the labels that pass their checks | See `store/accessibility.md`. |
| Price | Free, no ads, no purchases | Keep, or update `store/data-safety.md` and the forms if this changes. |

## Device checklist

None of these can run on this Linux machine. Do them on a real iPhone (TestFlight) and a mid-range Android phone (debug APK or an internal test track) before the first release.

- [ ] **Offline first start.** Airplane mode on, install, open. The title shows with no network. The splash hides when the title is ready.
- [ ] **Motion timing.** 20 casts with the debug overlay on, on each phone (a debug build, then `location.replace("./?debug")` in the web inspector, see "Debug APK"). Read the cast numbers in the overlay. The release timing feels right, and the mean timing error is within about 15 ms of the web build on the same phone.
- [ ] **Haptics feel.** iPhone: taps for nibbles, a strong hit on the strike and the hook set, a buzz for the drag and a pattern for the catch. Android: the same patterns through vibration. Turn "Buzz and taps" off: nothing buzzes.
- [ ] **Back button on every screen (Android).** Help, Settings, the Journal and the Places close. In a cast, a reel or a fight the game pauses, and a second back resumes. On the catch card and the results the main button runs. On the title the app goes to the background. While a place loads nothing happens.
- [ ] **Edge gestures while cranking.** 50 fast crank turns near the bottom corners, in touch play and in motion play with each reel side. No Android back, no Android home, no iOS home (a first swipe up only lights the home indicator). If a single swipe leaves the app on iPhone, the bottom-edge deferral does not work: check that the home indicator does not auto-hide (`SystemBars` `"hidden"` is `false`, and the game calls no `SystemBars.hide()` on iOS).
- [ ] **Audio interruption by a call.** Take a call in a fight. The game pauses. After the call, the sound comes back after Resume.
- [ ] **Audio interruption by Control Center (iOS) and the notification shade (Android).** Pull it down in a fight. The game pauses, and nothing snaps the line while it is open.
- [ ] **Keep awake.** Wait 5 minutes for a bite with no touch. The screen stays on. On the title and the pause screen the screen can sleep again.
- [ ] **Safe areas on a notch or punch-hole phone.** The pause button, the clock and the HUD clear the camera cutout. The crank and the bottom buttons clear the home indicator and the gesture bar. Check an iPhone with a Dynamic Island and an Android phone with a punch-hole camera, and an older Android phone with a web view before version 140.
- [ ] **Portrait lock.** Turn the phone and a tablet or an unfolded foldable. The game stays in portrait.
- [ ] **iPad.** The app is for iPhone, but an iPad runs it in iPhone compatibility mode, and App Review can test it there. Install it from TestFlight on an iPad, play one cast and one fight, and open Settings.
- [ ] **Large system font (Android).** Set the largest font size in the phone's display settings. The menus, the HUD and the cards show all their text, and nothing covers a button. (The web view follows the font size up to 130%.)
- [ ] **Save.** Land a fish, close the app from the app switcher, open it again: the fish is in the journal. On Android, clear the app's web storage only (not the app data) if you can: the save comes back from Preferences.
- [ ] **Secure context.** In the debug overlay or the web inspector, `window.isSecureContext` is true and the motion sensors report data.
- [ ] **Performance.** 3 minutes at each place on a 2020-class Android phone and an iPhone 11. The frame rate holds, and the render scale stays at 0.85 or more.

## What this folder was checked with

On Linux (no Mac, no KVM): `npm run build:www`, `npm run check:www`, `npm run test:check`, `npm run check:native`, `npx cap sync`, `./gradlew assembleDebug`, `aapt2` on the APK, and `qa/fish/app-bundle.e2e.mjs`. The Android emulator could not run (no KVM). The iOS project was set up by hand and was not built: that needs a Mac with Xcode 26.

# Privacy answers: App Store and Google Play

Reel It In collects no data. The answers below are true for the app built from this folder, and they agree with `public/fish/privacy.html` and `ios/App/App/PrivacyInfo.xcprivacy`.

## Why the answer is "no data"

- The game keeps its save (fish, places, best scores, settings) on the phone: in the web view's storage and, through `@capacitor/preferences`, in the app's native storage (UserDefaults on iOS, SharedPreferences on Android).
- The bundle loads nothing from another host. `npm run check:www` fails the build if a file in `www/` loads a web address, and `qa/fish/app-bundle.e2e.mjs` fails if any request leaves the app's origin.
- The app has no analytics, no crash reporting, no ads, no accounts and no login.
- The motion sensors are read in the web view only to play the cast and the reel. The game keeps no record of the readings.
- The Capacitor plugins in `package.json` (App, Haptics, Preferences, Splash Screen, Keep Awake) run on the phone and send nothing.

Apple: "Data that is processed only on device is not 'collected'". Google: data that stays on the device and is not sent off it is not "collected".

## App Store Connect: App Privacy

| Question | Answer |
| --- | --- |
| Do you or your third-party partners collect data from this app? | No, we do not collect data from this app. |
| Result shown on the store | Data Not Collected |
| Tracking (App Tracking Transparency) | The app does not track. No ATT prompt. `NSPrivacyTracking` is false. |
| Privacy policy URL | `https://<the site>/fish/privacy.html` |

Privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`, in the App target):

| Key | Value |
| --- | --- |
| NSPrivacyTracking | false |
| NSPrivacyTrackingDomains | none |
| NSPrivacyCollectedDataTypes | none |
| NSPrivacyAccessedAPITypes | UserDefaults (`NSPrivacyAccessedAPICategoryUserDefaults`), reason `CA92.1`: the app reads and writes its own settings and save. `@capacitor/preferences` uses UserDefaults. |

Capacitor ships its own privacy manifest in the Capacitor framework. After the first archive, open Xcode's privacy report (Organizer > the archive > Generate Privacy Report) and check that it lists only the UserDefaults reason above.

Export compliance: `ITSAppUsesNonExemptEncryption` is `NO` in `Info.plist`. The app uses no encryption of its own and makes no network calls, so App Store Connect does not ask the encryption questions on upload.

## Google Play Console: Data safety

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | No |
| Result shown on the store | No data collected. No data shared with third parties. |
| Privacy policy | `https://<the site>/fish/privacy.html` (required even with no data) |

When the first answer is No, Play skips the questions about encryption in transit and data deletion.

## Google Play Console: App content (the other declarations)

| Declaration | Answer |
| --- | --- |
| Ads | No, the app does not contain ads. |
| App access | All functionality is available without special access. No login. |
| Advertising ID | No. The app does not use the advertising ID, and the manifest has no `AD_ID` permission. |
| Content rating | The IARC questionnaire. See `age-rating.md`. |
| Target audience and content | Owner decision. Default: 13 and over, which keeps the app out of the Families policy. The app has no ads and collects no data, so it can also include younger ages; then the Families policy applies and Play reviews it as a family app. |
| News app | No |
| Health apps | No (the app is a game, not a health or fitness app) |
| Financial features | None |
| Government app | No |
| Data safety | As above |

## Android permissions in the merged manifest

| Permission | Why |
| --- | --- |
| `INTERNET` | Kept from the Capacitor template. The game loads nothing from the network. |
| `VIBRATE` | `navigator.vibrate()` in the WebView needs it for the buzz on bites, strikes and line pull. `@capacitor/haptics` also adds it. |
| `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Added by AndroidX for its own broadcast receivers. Not a user data permission. |

Check them with: `$ANDROID_HOME/build-tools/36.0.0/aapt2 dump badging android/app/build/outputs/apk/debug/app-debug.apk | grep uses-permission`.

## If something changes

Any of these changes makes the answers above false. Update this file, the privacy page and the store forms first:

- an analytics, crash, ad or attribution SDK;
- a web font, script or image from another host (the bundle check catches this);
- an online feature, a leaderboard, an account or cloud saves;
- a new Capacitor plugin that sends data.

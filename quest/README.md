# quest/: ship In Full Swing to Meta Quest

This folder turns the web game at `/vr/` into an app for Meta Quest 3 and Quest 3S. The app is a Trusted Web Activity (TWA) that Meta's fork of Bubblewrap makes. It opens `https://arcade.uptick.systems/vr/?source=pwa` in the Quest Browser engine and goes straight into mixed reality. The game files are not inside the APK. The service worker (`public/vr/sw.js`) keeps a copy on the headset, so the game also starts without a network after the first start.

| File | What it does |
|---|---|
| `twa-manifest.json` | The app settings for `@meta-quest/bubblewrap-cli` 1.24.1: package `com.cottagearcade.fullswing`, launcher name "Full Swing", immersive mode, XR scene on, no microphone, no billing. |
| `build-apk.sh` | Installs the tools, makes or uses your signing key, generates the Android project, patches it, builds and signs the APK. |
| `patch-android.mjs` | Changes the generated project to meet the Horizon Store manifest rules. `build-apk.sh` runs it. |
| `make-icons.mjs` | Draws the app icons into `public/vr/icons/`. |
| `.gitignore` | Keeps tools, the generated project, keys and packages out of git. |

Files outside this folder that belong to the package:

- `public/vr/manifest.webmanifest`, `public/vr/sw.js`, `public/vr/privacy.html`, `public/vr/icons/`
- `public/.well-known/assetlinks.json` and its `Content-Type` header in `vercel.json`
- `qa/vr/pwa.mjs`, the test for all of the above

## Sideload the app

Do these steps to install the APK on your own headset.

1. **Turn on developer mode.** Create or join a developer organization at <https://developers.meta.com/horizon/manage/organizations/create/> and verify your account. Then open the Meta Horizon app on your phone. Select your headset, then **Headset settings → Developer mode → On**. Restart the headset.
2. **Install adb.** On macOS: `brew install --cask android-platform-tools`. On Linux: `sudo apt install adb`. On Windows: install the Android SDK Platform Tools. After a build, `quest/.tools/android-sdk/platform-tools/adb` also works.
3. **Connect and install.** Connect the headset with a USB-C cable. In the headset, allow USB debugging and select **Always allow from this computer**. Make sure that `adb devices` shows the headset. Then run `adb install -r fullswing.apk`. Use `-r` again for each update.
4. **Find the app.** In the headset, open your app library. Set the source filter to **Unknown Sources**. "Full Swing" is in that list.
5. **Start it for the first time.** Select the app. It opens in passthrough and starts the game. Allow the spatial data prompt, so that the game can find your walls. If you see a URL bar, or the app closes at once, the asset links check failed (see below).

To debug the page on the headset, open `chrome://inspect/#devices` in Chrome on your computer while the headset is connected.

## Build the APK

You need Node.js 18 or later, curl and unzip on Linux or macOS. The script downloads the rest into `quest/.tools` on the first run: the Bubblewrap CLI, Temurin JDK 17 and the Android SDK (about 1 GB). It uses a JDK 17 that you already have if `JAVA_HOME` or `JAVA17_HOME` points to one.

```sh
export BUBBLEWRAP_KEYSTORE_PASSWORD='your keystore password'
quest/build-apk.sh --out quest/dist/fullswing.apk
```

- **The key.** The script uses `~/.android/fullswing.keystore` (alias `fullswing`). If the file does not exist, the script makes a new key. Set `BUBBLEWRAP_KEYSTORE` to use another file. The script refuses a keystore inside the repository. `BUBBLEWRAP_KEY_PASSWORD` is the same as the keystore password unless you set it.
- **Keep the key safe.** Every update of the app must have the same key and the same package ID. Meta does not sign the app for you. If you lose the key, you cannot update the app. Make a backup of the keystore and its password in a safe place outside git.
- **The Android SDK licenses.** On the first run, sdkmanager shows the licenses of the SDK packages and asks you to accept them. For a run with no terminal, read them first and set `ACCEPT_ANDROID_SDK_LICENSES=yes`.
- **Before the first deploy.** Add `--local`. Bubblewrap then downloads the icons and the web manifest from this checkout, not from the live site. The APK still opens the live site.
- **Test the page before you build.** Run `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/pwa.mjs` from the repo root.

The script does these steps:

1. It regenerates `quest/android/` from `twa-manifest.json` with `bubblewrap update --skipVersionUpgrade`. There are no questions.
2. It runs `patch-android.mjs`: compileSdk and targetSdk 34, minSdk 32 or more, `installLocation="auto"`, `com.oculus.supportedDevices` = `quest3|quest3s`, head tracking `required="true"`, and `excludeFromRecents="true"` on the launcher activity. Bubblewrap 1.24.1 leaves these out, and the Store refuses an app without them.
3. It runs `bubblewrap build`, which builds the APK and signs it.
4. It checks the signature with `apksigner verify --verbose --min-sdk-version 24`. Meta asks for APK Signature Scheme v2. Without `--min-sdk-version 24`, apksigner shows only v3 for this app, because its minSdk is 32. The v2 signature is there all the same.
5. It prints the SHA-256 fingerprint of your key and the adb command.

The outputs are `quest/android/app-release-signed.apk` and `quest/android/app-release-bundle.aab`. The Quest uses the APK. The bundle is for Google Play only.

### Put your fingerprint in assetlinks.json

The app opens the site only if the site says that it trusts the app. This is Digital Asset Links.

1. Copy the SHA-256 fingerprint that `build-apk.sh` prints. You can also get it with `keytool -list -v -keystore ~/.android/fullswing.keystore -alias fullswing`.
2. In `public/.well-known/assetlinks.json`, replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with it. The format is 32 pairs of hex digits with colons, for example `F9:22:44:…:1B:99`. The file is a list, so other apps of the arcade can add their own entries later.
3. Deploy the site.
4. Check it: `curl -sI https://arcade.uptick.systems/.well-known/assetlinks.json` must show `content-type: application/json`, and `curl -s` of the same URL must show your fingerprint. `vercel.json` sets the header.
5. Install the app again and watch the log: `adb logcat | grep -i "TWA verification"`.

If the check fails, Meta says that an immersive PWA does not start. The log then shows `TWA verification was unsuccessful!`. The same happens when the fingerprint belongs to another key, when the file is not on the same host as `host` in `twa-manifest.json`, or when the host sends the file with the wrong type.

### Release a new version

1. Increase `VERSION` in `public/vr/js/config.js` and the same `VERSION` in `public/vr/sw.js`. A new version makes a new offline cache and deletes the old one.
2. In `twa-manifest.json`, set `appVersion` and `appVersionName` to the same version, and add 1 to `appVersionCode`. `qa/vr/pwa.mjs` checks that the versions agree.
3. Deploy the site, then run `build-apk.sh` with the same key.

The web game updates without a new APK. The service worker shows the cached copy first and gets the new files in the background, so a change shows on the next start. You need a new APK only when something in `twa-manifest.json` or the Android project changes.

### Icons

`node quest/make-icons.mjs` draws `icon-192.png`, `icon-512.png` and `maskable-512.png` into `public/vr/icons/` with the colours in `config.js`. Add `--preview sheet.png` to see them at launcher sizes and under a round mask. Run it with `NODE_PATH=/opt/node22/lib/node_modules` when Playwright is not in the project.

## Horizon Store checklist

Do these steps in the order shown. Meta's guide: <https://developers.meta.com/horizon/resources/publish-submit/>.

1. **Verify your organization.** Admin verification with a government ID, or business verification. You cannot publish or update before this. <https://developers.meta.com/horizon/resources/publish-organization-verification/>
2. **Create the app.** In the developer dashboard, select **Create a New App**, platform **Meta Horizon Store**. The dashboard URL shows the 16-digit App ID. Put it in `applicationId` in `twa-manifest.json` (it is `"0"` now), so the app sends the real ID to the platform SDK.
3. **Age group.** Self-certify as `TEENS_AND_ADULTS`. The privacy policy says that the game is not for children under 13. Add the IARC certificate on the Metadata → Content Rating tab.
4. **Data Use Checkup.** You need it only if the app uses platform data such as the user ID or in-app purchases. The game uses none of these now.
5. **Metadata.**
   - Name: `In Full Swing` (40 characters or fewer). Short description 500 characters or fewer, long description 1500 or fewer.
   - Comfort rating: **Intense** (Meta rates the default experience, and the game has rope swinging).
   - Play area: standing and sitting. Supported input: Touch controllers and hand tracking.
   - Internet connection: needed for the first start and for updates.
   - Privacy policy URL: `https://arcade.uptick.systems/vr/privacy.html`. Website URL: `https://arcade.uptick.systems/vr/`.
6. **Store assets.** Use these exact sizes. Covers show the exact title inside the safe area, with no taglines. Screenshots show no text, no HUD and no hardware other than Meta's.

   | Asset | Size (px) | Format |
   |---|---|---|
   | Hero cover | 3000 × 900 | 24-bit PNG |
   | Cover, landscape | 2560 × 1440 | 24-bit PNG |
   | Cover, square | 1440 × 1440 | 24-bit PNG |
   | Cover, portrait | 1008 × 1440 | 24-bit PNG |
   | Mini landscape | 1080 × 360 | 24-bit PNG |
   | Icon (square corners, no transparency) | 512 × 512 | 24-bit PNG |
   | Screenshots (5 required) | 2560 × 1440 | 24-bit PNG |
   | Logo (optional, transparent) | up to 9000 × 1440 | 32-bit PNG |
   | Trailer (optional, 30 s to 2 min) | 1080p to 2K | MP4, H.264, AAC |
   | Trailer cover | 2560 × 1440 | 24-bit PNG |
   | Arcade tile (`public/arcade/vr.webp`, not for Meta) | 640 × 528 | WebP |

   `quest/store-kit.mjs` is the planned tool that renders these from the game. Until it exists, make them at the sizes above.
7. **Build.** Use `build-apk.sh`. The build meets these rules: target and compile SDK 34 (apps created after 2026-03-01 must target 34), minSdk 32, `installLocation="auto"`, `supportedDevices`, head tracking required, launcher `excludeFromRecents`, APK Signature Scheme v2, 64-bit native code, a size of about 6 MB (the limit is 1 GB), and only two permissions (`USE_SCENE`, `HAND_TRACKING`).
8. **Check the VRCs on the device** (see the next list). The ones most likely to fail review: Performance.1 (72 Hz, never below 60 fps), Performance.3 (head-tracked graphics within 4 s), Functional.2 and Input.4 (pause and hide hands when the system menu opens), Functional.9 (recenter), Input.7 and Input.8 (switch between hands and controllers, no system gesture).
9. **Upload to a test channel.**

   ```sh
   ovr-platform-util upload-quest-build --app-id <APP_ID> --app-secret <APP_SECRET> \
     --apk quest/android/app-release-signed.apk --channel ALPHA \
     --age-group TEENS_AND_ADULTS --notes "In Full Swing 1.0.0"
   ```

   Without `--age-group`, the upload becomes a draft. Use `--channel store` for production. The Linux build of `ovr-platform-util` is experimental.
10. **Submit for review.** Do it at least two weeks before the launch date.

## Device-only checks

Headless tests cannot check these. Do them on a Quest 3 with the installed app.

- The app starts in passthrough with no URL bar, and the game shows head-tracked graphics within 4 s.
- Multiview is on (`G.test.state().xr.multiview`) and the wrist HUD updates. This proves the patch in `public/vr/lib/PATCHES.md`.
- The stencil portal in the wall works on the projection layer.
- Fixed foveation is on.
- OVR Metrics shows a steady 72 Hz, and 90 Hz when that setting is on.
- The boundary behaves as expected in the `immersive-ar` session.
- The spatial data permission prompt shows once, and the wall and crack appear after you allow it.
- The false-yank rate is low with controllers and with hands.
- The system menu pauses the game and hides the hands. The recenter gesture keeps you in place.
- Airplane mode: after one start online, the app starts again offline.
- Put the headset down and take it up again: the game pauses, and the pause menu is open when you come back.

## Limits

- **The site must be online for the first start.** The APK has no game files. After that, the service worker cache serves the game.
- **The domain is fixed.** The host `arcade.uptick.systems`, the package ID and the key are part of the app. An APK built from an older `twa-manifest.json` opens `warden-alpha-wheat.vercel.app`. That host serves the same site and the same `assetlinks.json`, so that APK keeps working. If the domain changes again, update `host`, the URLs in `twa-manifest.json` and `assetlinks.json` on the new host.
- **No achievements, leaderboards or entitlement check from JavaScript.** Only a server can call these Meta APIs, and the server must trust the user ID that the page sends. In-app purchases and the user ID work in JavaScript only when the app comes from the Store.
- **Bubblewrap regenerates the project.** `bubblewrap update` and a changed `twa-manifest.json` rebuild `quest/android/` and remove the patch. `build-apk.sh` always patches again. If you run Bubblewrap by hand, run `node quest/patch-android.mjs` after it.
- **Not yet proven on a device:** that a TWA with target SDK 34 still starts in immersive mode, that the Store upload accepts it, and whether bubblewrap issue #24 (a SurfaceSyncGroup timeout seen on Quest 2) also happens on Quest 3.

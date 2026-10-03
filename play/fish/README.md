# play/fish/: put Reel It In on Google Play

This folder turns the phone fishing game at `/fish/` into its own Android app. The app is a Trusted Web Activity (TWA). It opens `https://warden-alpha-wheat.vercel.app/fish/?source=play` in Chrome with no URL bar. The app has no link to the rest of the arcade, and it asks for no Android permission. The game files are not inside the app. The service worker (`public/fish/sw.js`, made by the web package) keeps a copy on the phone, so the game also starts with no network after the first start.

The folder holds the scripts for the Android side: the app settings, the build, the signing checks, and the Digital Asset Links tool. This guide lists every step from a new Play account to a live app, in order. Read it once before you start.

**What I could not check.** Nobody has run this app on a phone yet. The build ran in a sandbox, and the GitHub workflow has not run. Items that are not proven are marked **UNCONFIRMED** (a fact from the Google pages or from memory that nobody checked) or **DEVICE** (it needs a real Android phone). Do not treat them as facts. Nothing in this guide promises how Google Play review will go.

## Contents

1. [What you need](#what-you-need)
2. [Step 1: the Play account](#step-1-the-play-account)
3. [Step 2: make the upload key and back it up](#step-2-make-the-upload-key-and-back-it-up)
4. [Step 3: build the bundle](#step-3-build-the-bundle)
5. [Step 4: create the app in Play Console](#step-4-create-the-app-in-play-console)
6. [Step 5: the App content forms](#step-5-the-app-content-forms)
7. [Step 6: upload to internal testing](#step-6-upload-to-internal-testing)
8. [Step 7: add the Play signing key to assetlinks.json](#step-7-add-the-play-signing-key-to-assetlinksjson)
9. [Step 8: deploy and check](#step-8-deploy-and-check)
10. [Step 9: install from Play](#step-9-install-from-play)
11. [Step 10: closed test and production](#step-10-closed-test-and-production)
12. [Updates](#updates)
13. [Read the log with adb](#read-the-log-with-adb)
14. [DEVICE checklist](#device-checklist)
15. [Files in this folder](#files-in-this-folder)
16. [Owner decisions](#owner-decisions)
17. [Limits and risks](#limits-and-risks)

## What you need

- Linux or macOS (on Windows, use WSL), with Node.js 18 or later, `curl`, `unzip` and `bash`. The build script downloads the rest into `play/.tools` (about 1.8 GB): the Bubblewrap CLI 1.25.0, Temurin JDK 17.0.11+9, the Android command-line tools and SDK 36, and a Gradle cache. Delete `play/.tools` to remove all of it.
- An Android phone with Chrome, and a USB cable, for the **DEVICE** checks.
- A Google account for the Play Console, and US$25.
- Write access to the GitHub repository, if you build with the workflow.

## Step 1: the Play account

Do this first. It takes the longest.

1. **Pay and verify.** The Play Console fee is US$25, paid once. You must be 18 or older. Sign up at <https://play.google.com/console/signup>.
2. **Choose the account type.** This is an owner decision (see [Owner decisions](#owner-decisions)).

   | | Personal | Organization |
   |---|---|---|
   | You need | A government ID, a payments profile, a verified e-mail and phone (a 6-digit code by SMS or voice), and a check that you own an Android device (through the Play Console app on the phone) | The same, plus a D-U-N-S number (free, can take up to 30 days), an official organization document, an organization website, and an e-mail address on that domain |
   | Closed test before production | Yes (see below) | The Google page does not mention organization accounts. Blogs say they are exempt. **UNCONFIRMED** |

3. **Wait for verification.** You must pass it before you can submit any app. Google says it "may take a few days". That wording comes from a search summary of an official page, so treat the time as **UNCONFIRMED**. Failed verification can lead to removal.
4. **The closed-test rule.** A personal account that you created after 2023-11-13 must run a closed test with at least **12 testers** who stay opted in for at least **14 days** in a row. Then you apply for production access with a short questionnaire (three parts). Google says review "usually takes seven days or less". Google also checks whether the testers used the app, and whether the use looks real. The rule was still in force in October 2026 (<https://support.google.com/googleplay/android-developer/answer/14151465>). Blogs disagree on whether the 14 days start again when the count drops below 12. Plan for 15 to 20 testers and keep them all opted in. **UNCONFIRMED**
5. **Developer verification (2026).** Google started to enforce developer verification on 2026-09-30 in Brazil, Indonesia, Singapore and Thailand, and will enforce it everywhere in 2027. Apps from Play are registered automatically. Play registers the package name when you create the app, so you need no extra step.
6. **Plan the time.** A first review of a new or flagged account can take "up to seven days or longer in exceptional cases". Plan for one to two weeks after the 14-day test. Do not rely on the shorter times that blogs claim.
7. **EU trader status.** Google may ask whether you are a trader in the EU. I found no support page for it. Answer the prompts in the Console. **UNCONFIRMED**

## Step 2: make the upload key and back it up

You sign each bundle that you upload with the **upload key**. Google Play then signs the app that players install with a second key that Google keeps (Play App Signing). New apps join Play App Signing automatically (<https://support.google.com/googleplay/android-developer/answer/9842756>).

**Make the key.** The easy way: run `play/fish/build-aab.sh` in a terminal (Step 3). If there is no key, the script explains what it is, asks if you want one, asks twice for a password, and makes `~/.android/reelitin-upload.keystore` with the alias `reelitin`. It makes an RSA 2048 key that is valid for 20,000 days.

The same thing by hand:

```sh
mkdir -p ~/.android
keytool -genkeypair -keystore ~/.android/reelitin-upload.keystore -storetype PKCS12 -alias reelitin \
  -keyalg RSA -keysize 2048 -validity 20000 -dname "CN=Reel It In, O=Cottage Arcade, C=CA"
chmod 600 ~/.android/reelitin-upload.keystore
```

**Password rules.** Use 6 characters or more. Do not use `"`, `$`, a backtick, `\` or a line break. Bubblewrap passes the password through a shell, and these characters break it. The build script refuses such a password.

**Back it up now.** Do this before the first upload.

1. Copy `reelitin-upload.keystore` to a second place that is not your computer: a password manager that stores files, an encrypted USB stick, or an encrypted cloud folder.
2. Store the password next to it, but not in the same file.
3. Check the copy: `keytool -list -keystore COPY.keystore -alias reelitin`. It must show the same SHA-256 fingerprint as the original.
4. Never put the key in git, a chat or an e-mail. The build script refuses a keystore inside the repository. `.gitignore` also blocks `*.keystore`, `*.jks`, `*.p12`, `*.apk` and `*.aab`.

If you lose the upload key, you cannot sign new bundles. Google documents a way to register a new upload key. I did not check the current steps, so look them up in the Play Console help before you rely on this. **UNCONFIRMED**

## Step 3: build the bundle

### Option A: on your computer

```sh
export BUBBLEWRAP_KEYSTORE_PASSWORD='your keystore password'
play/fish/build-aab.sh --local
```

Use `--local` until the web files are deployed. Bubblewrap then takes the icons and the web manifest from this checkout, not from the live site. The app still opens the live site. Without `--local`, the script reads them from the live host and stops with a clear message when a file is missing.

On the first run the script downloads the tools. It stops at the Android SDK licenses. In a terminal, `sdkmanager` shows the license of each package it installs and asks you to accept. Without a terminal, read the license (<https://developer.android.com/studio/terms>) and set `ACCEPT_ANDROID_SDK_LICENSES=yes`. That accepts the license of the four packages the script installs, and no other license. By running the script with that setting, you accept the license.

The script does these steps:

1. It installs the pinned tools into `play/.tools`, or uses the JDK 17 that `JAVA17_HOME` or `JAVA_HOME` points to. Bubblewrap rejects JDK 21.
2. It copies `twa-manifest.json` into `play/fish/android/` with your key path, and (with `--local`) the download URLs of the local server.
3. It runs `bubblewrap update --skipVersionUpgrade`. There are no questions.
4. It runs `patch-android.mjs`. The patch stops the build if Bubblewrap does not generate SDK 36 (compile and target). It adds `android:appCategory="game"` (Android 16 then keeps the portrait lock on tablets) and `android:allowBackup="false"`. It adds no permission.
5. It runs `bubblewrap build` with your passwords from the environment. It tries up to four times, because Maven Central sometimes answers HTTP 429 (too many requests) to a shared address.
6. It copies the outputs to `play/fish/dist/` as `reelitin-<versionName>-<versionCode>.aab`, `.apk` and `.fingerprint.txt`.
7. It checks the result (see below) and prints the SHA-256 fingerprint of your upload key.

**What the script checks.** Each failed check stops the script.

| Check | How |
|---|---|
| Package id, version code and name, minSdk 24, target SDK 36, app name | `aapt2 dump badging` on the APK, and the manifest inside the bundle |
| No permission that asks the user for anything | The same two sources. One internal AndroidX permission named `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` is allowed. It asks the user for nothing |
| The app opens `https://<host>/fish/?source=play`, portrait, and only links inside `/fish/` | `aapt2 dump resources` and the bundle manifest |
| `appCategory` is `game`, backup is off | The bundle manifest |
| The APK is signed with the key in your keystore | `apksigner verify --min-sdk-version 24 --print-certs` |
| The bundle is signed with the same key | `jarsigner -verify` and `keytool -printcert -jarfile` |
| The key is not an Android debug key and has 2048 bits or more | `keytool -list -v` |

**Outputs.** The bundle (`.aab`) goes to Play Console. The APK goes to `adb install`. The fingerprint file holds the SHA-256 of your upload key.

**Development builds.** `play/fish/build-aab.sh --local --debug-key` signs with a throwaway key in `play/.tools/debug/`. Its password is public (`android`). The script prints a loud line, and the files carry `DEBUGKEY` in their names. **A debug-key bundle can never be uploaded to Google Play.** Do not put the debug key's fingerprint in `assetlinks.json`. To test a debug build on a phone before the site is ready, use the Chrome flag in [Read the log with adb](#read-the-log-with-adb).

**Other settings.** `--out DIR` changes the output folder. `PLAY_TOOLS`, `PLAY_PROJECT` and `PLAY_PUBLIC` change the tools folder, the project folder and the site files for `--local`. `BUBBLEWRAP_KEYSTORE` and `BUBBLEWRAP_KEY_ALIAS` change the key. Run `play/fish/build-aab.sh --help` for the list.

### Option B: the GitHub workflow

The workflow `.github/workflows/play-aab.yml` builds the bundle on GitHub from three secrets. It runs only when you start it. **It has not run yet**, because the sandbox where it was written has no GitHub runner. The script it calls ran in the sandbox (see the build record in the OpenSpec change).

1. **Make the base64 value of the keystore.**

   ```sh
   # Linux
   base64 -w0 ~/.android/reelitin-upload.keystore
   # macOS
   base64 -i ~/.android/reelitin-upload.keystore | tr -d '\n'
   ```

   Copy the whole output. To copy it straight to the clipboard, add `| xclip -selection clipboard` (Linux) or `| pbcopy` (macOS). The output is one long line. It is the key, so treat it like a password.
2. **Add the secrets.** In GitHub, open the repository, then **Settings, Secrets and variables, Actions, New repository secret**. Make these:

   | Secret name | Value |
   |---|---|
   | `PLAY_UPLOAD_KEYSTORE_BASE64` | The output of the command above |
   | `PLAY_UPLOAD_KEYSTORE_PASSWORD` | The keystore password |
   | `PLAY_UPLOAD_KEY_PASSWORD` | Optional. Only when the key password differs from the keystore password. A key that the script made has one password, so you can skip it |

   The alias is `reelitin`, as in the guide above.
3. **Run it.** Open the **Actions** tab, select **Reel It In bundle for Google Play**, select **Run workflow**, and type an optional note. GitHub lists a workflow in the Actions tab when its file is on the default branch. The workflow sets `ACCEPT_ANDROID_SDK_LICENSES=yes`, **so by running it you accept the Android SDK license** for the packages it installs (<https://developer.android.com/studio/terms>). Read the license first.
4. **Take the result.** When the run ends, download the artifact `reelitin-bundle` (it holds the `.aab` and the `.fingerprint.txt`). GitHub keeps it for 7 days. The run summary also shows the fingerprint.

How the workflow protects the key: it writes the keystore to a temporary file outside the workspace (`$RUNNER_TEMP`), with the permissions of the owner only. It passes the secrets to one step through `env`. It never prints them. It deletes the key file in a last step that always runs. It uses `--local`, so the icons and the web manifest come from the same commit as the build. `qa/fish/play.mjs` checks these rules in the workflow file.

## Step 4: create the app in Play Console

1. In Play Console, select **Create app**.
2. App name: `Reel It In` (30 characters at most). Whether the name is free on Play is **UNCONFIRMED**. The Console tells you.
3. Default language: English (United States). App or game: **Game**. Free or paid: **Free**.
4. Tick the declarations and create the app.
5. The package name `com.cottagearcade.reelitin` is fixed by your first upload. You cannot change it later.

## Step 5: the App content forms

Open **Policy and programs, App content** (the menu names change from time to time). Give these answers.

| Form | Answer |
|---|---|
| Privacy policy | `https://warden-alpha-wheat.vercel.app/fish/privacy.html` (the web package makes the page) |
| Ads | No, the app has no ads |
| App access | All functions are available without login or special access. Give no test credentials |
| Advertising ID | The app does not use it. The app has no `AD_ID` permission |
| Content rating (IARC) | Choose the category **Game**. Answer the questions truthfully. For this game the honest answers are no for violence beyond cartoon, sexual content, language, controlled substances, gambling, user interaction, location sharing and digital purchases. The likely result is ESRB Everyone, PEGI 3 and USK 0, **UNCONFIRMED** until you submit. Fishing and the toilet-plunger humour are the two things a rater might look at, so read each question |
| Target audience | Tick only **13-15, 16-17 and 18 and over**. If you tick any group under 13, the Families policy applies. The cartoon art can make Google treat the app as one for children. That is the owner's call (see [Owner decisions](#owner-decisions)) |
| Data safety | Does the app collect or share any of the required user data types? **No**. The app sends nothing off the phone. Motion data stays in the page, and the save stays in the browser. Give the privacy policy link. Whether the host's standard server logs (IP address) must be declared is **UNCONFIRMED**. `public/vr/privacy.html` already discloses such logs for the VR game, and the fish page should do the same |
| Government apps, financial features, health apps | No for all three |
| Permissions declarations | None. The app asks for no permission |
| Store category | Game, then one category. Casual, Simulation and Sports fit. The choice is the owner's |

**Store listing.** The Console checks the sizes.

| Item | Rule |
|---|---|
| App name | 30 characters |
| Short description | 80 characters. No claims of rank, price or award ("Best", "#1", "Top", "Free", "Sale") |
| Full description | 4,000 characters (**UNCONFIRMED**: check the counter in the Console) |
| Icon | 512 x 512 px, 32-bit PNG with alpha, at most 1024 KB. The build leaves `store_icon.png` in `play/fish/android/` |
| Feature graphic | 1024 x 500 px, JPEG or 24-bit PNG, no alpha |
| Phone screenshots | 2 to 8. JPEG or 24-bit PNG, no alpha. Each side 320 to 3840 px. The long side is at most 2 times the short side. For featuring, use at least 4 at 1080 px or more |
| Tablet screenshots | Optional |
| Release notes | 500 characters at most for each language |

Use screenshots from the real app. Do not show links to the arcade.

## Step 6: upload to internal testing

1. Open **Test and release, Testing, Internal testing** and select **Create new release**.
2. Upload `play/fish/dist/reelitin-1.0.0-1.aab`. A bundle signed with the debug key is a mistake: the file name has `DEBUGKEY` in it.
3. Accept Play App Signing if the Console asks.
4. Add a tester list (e-mail addresses of Google accounts, up to 100), and select **Save, Review release, Start rollout**.
5. Open the opt-in link on the phone of a tester. Internal testing is ready within minutes. It "might not be subject to standard Play policy or security reviews".

Each upload needs a version code that no earlier upload used. The largest value is 2,100,000,000. Raise `appVersionCode` in `twa-manifest.json` before each build.

## Step 7: add the Play signing key to assetlinks.json

The app opens the site with no URL bar only if the site says that it trusts the app's signing key. That is Digital Asset Links. A player's phone gets an app that **Google** signed, so you need Google's key, not only your upload key.

1. Add your upload key first (it is for builds that you install by hand). Use the fingerprint that `build-aab.sh` printed:

   ```sh
   node play/fish/assetlinks.mjs --upload "AA:BB:...:FF"
   ```
2. In Play Console, open **Test and release, App integrity, Play app signing** (other names for the same page: "Protected with Play, Play Store distribution, Play app signing", and "Release, Setup, App integrity"). Copy the **SHA-256 certificate fingerprint** of the app signing key.
3. Add it:

   ```sh
   node play/fish/assetlinks.mjs --play "AA:BB:...:FF"
   ```

The tool keeps both fingerprints in one entry of `public/.well-known/assetlinks.json`. It checks the format (32 pairs of hex digits, with colons, in capitals), refuses a placeholder, and refuses a fingerprint that the entry has already. It leaves every other entry as it is. `--print` shows the entry, and `--remove` takes a fingerprint out (for example an old upload key).

New apps use "quantum-ready, hybrid signing with Google-generated keys". Whether the fingerprint that the Console shows works as it is, is **UNCONFIRMED**. Test it on a build that you installed from Play (Step 9).

**Fix the Quest placeholder first.** The same file holds the entry of the Quest app (`com.cottagearcade.fullswing`) with the fingerprint `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`. That value is not a fingerprint. It makes the whole file malformed for Google. Google answers `ERROR_CODE_MALFORMED_CONTENT` for the host, and **no app of the host, this one included, passes verification** until the value is gone. The tool does not change that entry, because `qa/vr/pwa.mjs` checks it, but it warns you each time it runs. The Quest owner must put the real fingerprint of the Quest signing key in. The same tool can do it:

```sh
node play/fish/assetlinks.mjs --package com.cottagearcade.fullswing --upload "AA:BB:...:FF"
```

The tool drops the placeholder from the entry that you name, and writes the real fingerprint.

## Step 8: deploy and check

1. Commit `public/.well-known/assetlinks.json` and deploy the site. The repository deploys `public/` with no build step.
2. Check what Google reads:

   ```sh
   node play/fish/assetlinks.mjs --check
   ```

   The command reads `https://<host>/.well-known/assetlinks.json` (it must answer HTTP 200, with `Content-Type: application/json` and no redirect, which `vercel.json` sets), asks Google's API for the host, and prints the statements and any error code. It exits with 1 when something is wrong. Google keeps an answer for about 10 minutes (the API said `maxAge` of about 600 seconds), so wait and run it again after a deploy.
3. Pass another host as `--check HOST` if you move to a custom domain.

## Step 9: install from Play

1. On the phone, open the internal-test opt-in link, and install **Reel It In** from Google Play.
2. Open it. The game must start with **no URL bar** and no browser buttons. If you see a URL bar, the check failed. Look at [Read the log with adb](#read-the-log-with-adb). Common causes: the Play signing key is not in `assetlinks.json`, the file is not deployed, or the placeholder is still in the file.
3. Do the [DEVICE checklist](#device-checklist).

Test the version from Play, not only the APK that you installed by hand. The two have different signing keys.

## Step 10: closed test and production

1. **Closed test.** A personal account needs 12 testers for 14 days (Step 1). Open **Test and release, Testing, Closed testing**, make a release from the same bundle (or a newer one), and add the testers. Closed testing allows up to 200 lists of 2,000 users. Keep every tester opted in.
2. **Apply for production access** in the Console after 14 days. Answer the questionnaire.
3. **Production.** Make a production release and submit it. Changes are not sent for review by themselves: use the **Publishing overview** page. A first release has no staged rollout percentage. Updates have one.

I make no promise about Google's review. The reviewer should see the game start at once, full screen, in portrait, with no arcade links, a privacy policy link, accurate screenshots, a content rating, no broken pages and no crash.

## Updates

**You need a new bundle when** you change `twa-manifest.json` or the Android project. Examples: the app name, the icons (the build copies `icon-512.png` and `maskable-512.png` into the app), the colours, the start URL, the display mode, the orientation, the minimum SDK, the host, the package id, or the version. Also build again when Google raises the required target SDK: the next increase is **UNCONFIRMED** (the yearly pattern points at API 37 around 2027-08-31, but that is a guess from a blog, not a date from Google). To release:

1. Raise `appVersionCode` by 1 in `twa-manifest.json`. Change `appVersion` and `appVersionName` together for a visible version. `qa/fish/play.mjs` checks that they agree.
2. Build with the same upload key (Step 3).
3. Upload the bundle to a track in Play Console.

**You do not need a new bundle when** you change the website: anything under `public/fish/` (the code, the art, the privacy page, the manifest). The service worker fetches the new files, and the app shows them on the next launch after the worker updates. The web package keeps a version stamp for the worker (`stamp-sw.mjs`): run it after you change a precached file, as that script says, so that the worker sees a new version. The first start after an update can still show the old copy once.

## Read the log with adb

`adb` is in `play/.tools/android-sdk/platform-tools/` after a build. On the phone, turn on developer options and USB debugging.

```sh
adb devices                               # the phone must be listed
adb install -r play/fish/dist/reelitin-1.0.0-1.apk
adb logcat -c                             # clear the old log
adb shell monkey -p com.cottagearcade.reelitin -c android.intent.category.LAUNCHER 1
adb logcat | grep -i -e OriginVerifier -e digital_asset_links -e TWA
```

Look for lines that name `com.cottagearcade.reelitin` or the host. The exact words depend on the Chrome version (**UNCONFIRMED**). If you see no line at all, check that Chrome is the default browser and is up to date.

**Test before the site is ready.** In `chrome://flags` on the phone, turn on **Enable command line on non-rooted devices**, restart Chrome, and run:

```sh
adb shell "echo '_ --disable-digital-asset-link-verification-for-url=\"https://warden-alpha-wheat.vercel.app\"' > /data/local/tmp/chrome-command-line"
```

Chrome then skips the check for that host. Source: <https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide>. Remove the flag (`adb shell rm /data/local/tmp/chrome-command-line`) before you test the real check.

**Debug the page.** Open `chrome://inspect/#devices` in Chrome on your computer while the phone is connected.

## DEVICE checklist

Nobody has done these checks. Do them on a real phone with the app that you installed from Play, and tick each row. Do the first row on an app from Play and on an APK that you installed by hand.

| Done | Check | How | Expect |
|---|---|---|---|
| [ ] | TWA verified | Open the app. Read the log | No URL bar. The log names the package or the host |
| [ ] | Failed check | Once, with a wrong fingerprint in a test build | Note what happens: a URL bar, or a crash (the Google pages disagree, **UNCONFIRMED**) |
| [ ] | Start URL | Open the app | The game opens at `/fish/?source=play` and the title screen shows. The arcade links ("Switch game", "Back to the arcade") are hidden |
| [ ] | display-mode | Inspect the page, run `matchMedia("(display-mode: standalone)").matches` | `true`, or the app mode is on through `?source=play` all the same |
| [ ] | Motion rate | Inspect the page and count `devicemotion` events in 5 s | About 60 per second. The cast tuning assumes this |
| [ ] | Motion denied | Long-press the app icon, open the site settings, set **Motion sensors** to block | The game offers touch play and shows the right words for an Android app |
| [ ] | No gyro | An old phone, a tablet or a Chromebook | The game falls back to touch |
| [ ] | Wake lock | Fish for 5 minutes with no touch on other screens | The screen stays on |
| [ ] | Vibration | Fish with the volume on | The phone buzzes on the strike and the catch |
| [ ] | Back button | Press Back on the title, in play, in a menu and on a result card | As the web package designed: close menu, pause, or go to the title. One more Back leaves the app |
| [ ] | Insets and cutout | A phone with a punch-hole camera, Android 15 and 16 | Nothing hides under the camera or the gesture bar. The crank is not on the Home swipe |
| [ ] | Background | Leave the app for 10 minutes, then return | The lake still draws. The pause menu shows |
| [ ] | Offline start | Open the app once online. Turn on airplane mode. Close the app. Open it again | The game starts and the art loads |
| [ ] | Offline video | In airplane mode, open the guide | The clips play, or the guide falls back to its pictures |
| [ ] | Portrait lock | Turn the phone, on a phone and on a tablet or foldable | The game stays in portrait. On a screen of 600 dp or more this relies on `appCategory="game"` |
| [ ] | Site settings shortcut | Long-press the app icon | The shortcut opens the site settings. You find **Motion sensors** and the storage |
| [ ] | Navigation bar | Play with the 3-button bar and with gestures | The crank does not sit under a bar. Decide `standalone` or `fullscreen` (see [Owner decisions](#owner-decisions)) |
| [ ] | Uninstall | Catch a fish, uninstall the app, install it again | Note if the save (`fish.v1`) is still there. **UNCONFIRMED** |
| [ ] | Chrome save | Play in the Chrome browser, then in the app | The save is the same (the app shares storage with Chrome) |
| [ ] | Update | Deploy a small website change | The app shows it on the second launch |
| [ ] | Permissions | Open the app info, then **Permissions** | The list is empty |
| [ ] | Pre-launch report | After the first upload to a track | Read the report in Play Console. It needs a real Play listing |

## Files in this folder

| Path | What it does |
|---|---|
| `twa-manifest.json` | The app settings for `@bubblewrap/cli` 1.25.0: package `com.cottagearcade.reelitin`, host, start URL, scope `/fish/`, display, orientation, colours, minSdk 24, no notifications, no features, versions and the signing key name. One value for each decision |
| `build-aab.sh` | Installs the pinned tools, makes or uses your signing key, generates and patches the Android project, builds and signs the bundle and the APK, checks them, and prints the key fingerprint |
| `patch-android.mjs` | Stops the build unless Bubblewrap generates SDK 36. Adds `appCategory="game"` and `allowBackup="false"`. `build-aab.sh` runs it |
| `verify-output.mjs` | Checks the built APK and bundle against `twa-manifest.json`: ids, versions, SDK levels, permissions, launch URL, links. `build-aab.sh` runs it |
| `assetlinks.mjs` | Adds, removes, prints and checks the Digital Asset Links entry of the app in `public/.well-known/assetlinks.json` |
| `make-icons.mjs` | Draws the icons `public/fish/icons/icon-192.png`, `icon-512.png` and `maskable-512.png`. Made by the web package |
| `stamp-sw.mjs` | Stamps the service-worker version from the precache list. Made by the web package |
| `README.md` | This guide |
| `android/` | The generated Android project (git ignores it) |
| `dist/` | The outputs of a build: `.aab`, `.apk`, `.fingerprint.txt` (git ignores it) |

Files outside this folder:

| Path | What it does |
|---|---|
| `play/.gitignore` | Keeps the tools, the generated project, the outputs and every key file out of git |
| `play/.tools/` | The downloaded tools, the Gradle cache and the debug key (git ignores it) |
| `.github/workflows/play-aab.yml` | The manual workflow that builds a signed bundle from the three secrets |
| `public/.well-known/assetlinks.json` | The Digital Asset Links file, shared by every Android app of the host |
| `vercel.json` | Sends `assetlinks.json` with `Content-Type: application/json` |
| `qa/fish/play.mjs` | The test of everything above (node only, no network): `node qa/fish/play.mjs` |
| `openspec/changes/fish-play-store-android/` | The requirements, the design and the build record |
| `public/fish/manifest.webmanifest`, `sw.js`, `privacy.html`, `icons/` | The web side. The web package makes them |

## Owner decisions

The brief fixed these values. Each one lives in one place. Change it there.

| Decision | Default | Where to change it |
|---|---|---|
| Package id (permanent after the first upload) | `com.cottagearcade.reelitin` | `packageId` in `twa-manifest.json` |
| Host (part of the app and of `assetlinks.json`) | `warden-alpha-wheat.vercel.app` | `host` in `twa-manifest.json`, and the same host in `fullScopeUrl`, `webManifestUrl`, `iconUrl` and `maskableIconUrl`. `qa/fish/play.mjs` fails if they differ. Also change the privacy policy URL in Step 5 |
| Start URL of the app | `/fish/?source=play` | `startUrl` in `twa-manifest.json`. Keep `source=play`: the game uses it to switch to app mode |
| Start URL of the web manifest | `/fish/?source=pwa` | The web manifest |
| Display | `standalone` | `display` in `twa-manifest.json` (`fullscreen-sticky` hides the system bars: **DEVICE**) |
| Orientation | `portrait` | `orientation` in `twa-manifest.json` |
| Minimum Android | 24 | `minSdkVersion` in `twa-manifest.json` |
| Target and compile SDK | 36 (Play needs it since 2026-08-31) | `RULES.sdk` in `patch-android.mjs` |
| App name, launcher name | `Reel It In` | `name`, `launcherName` in `twa-manifest.json` |
| Colours | `#0d2f38` | `themeColor`, `backgroundColor` and the other colours in `twa-manifest.json`, and the web manifest |
| Permissions, notifications | None | Do not change. Notifications, billing, location and the web view fallback each add a permission or a service |
| Category | Games | Store listing |
| Upload key file and alias | `~/.android/reelitin-upload.keystore`, `reelitin` | `BUBBLEWRAP_KEYSTORE`, `BUBBLEWRAP_KEY_ALIAS` |
| Version | 1.0.0, code 1 | `appVersion`, `appVersionName`, `appVersionCode` in `twa-manifest.json` |
| Account type | Not decided | You |
| Target audience | 13 and over | Play Console |
| Store texts and graphics, support e-mail, privacy contact | Not decided | You |
| Closed-test testers | Not decided | You, if the account is personal |
| Data safety answer for host logs | Not decided | You |
| Quest placeholder in `assetlinks.json` | Still there | The Quest owner |

## Limits and risks

- **The domain is fixed.** The host, the package id and the upload key are part of the app. Choose the final domain before the first upload. If it changes, change the host in `twa-manifest.json`, serve `assetlinks.json` on the new host, build and upload a new bundle.
- **The first start needs the network.** The app has no game files. After one online start, the service worker serves the game.
- **No link to the arcade.** The app handles links to `https://<host>/fish/` only (`verify-output.mjs` checks the filter). The web package hides the arcade links inside the app.
- **A failed asset-links check** shows a URL bar or crashes the app. Which of the two happens on a current Chrome is **UNCONFIRMED**.
- **The practical floor for Chrome** is about version 89 (import maps, WebGL, wake lock). **UNCONFIRMED**
- **Downloads are not checksummed.** The script downloads the JDK, the command-line tools and the npm package from their official hosts over HTTPS, and it pins versions, not hashes.
- **The password goes through a shell.** Bubblewrap puts the password on the command line of `jarsigner` and `apksigner` for a moment. On your own computer that is fine. On a shared computer, another user could see it with `ps`.
- **Bubblewrap regenerates the project.** `bubblewrap update` removes the patch. `build-aab.sh` always patches again. If you run Bubblewrap by hand, run `node play/fish/patch-android.mjs` after it.
- **Nothing here is proven on a device.** See the [DEVICE checklist](#device-checklist).

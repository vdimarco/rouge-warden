# Design

## The app

The app is a Trusted Web Activity (TWA). Chrome shows the page at `https://<host>/fish/?source=play` with no URL bar, if the site lists the app's signing key in `/.well-known/assetlinks.json` (Digital Asset Links). The app holds no game files. A service worker on the site (the web package) keeps the game on the phone. The app has no permission: Chrome owns the motion sensors, the buzz and the screen wake lock. The fallback when Chrome is old is a Custom Tab (`fallbackType: customtabs`). The web view fallback would add the INTERNET permission and a second code path, so it is off.

Upstream `@bubblewrap/cli` 1.25.0 is the generator. Meta's fork (`@meta-quest/bubblewrap-cli` 1.24.1, used by `quest/`) and `quest/patch-android.mjs` force SDK 34 and add Meta-only fields. Google Play needs API 36 since 2026-08-31, and 1.25.0 generates 36 by itself. The fork is not reused.

## One config value per decision

| Decision | Value | The one place |
|---|---|---|
| Package id | `com.cottagearcade.reelitin` | `packageId` in `twa-manifest.json` |
| Host | `warden-alpha-wheat.vercel.app` | `host` in `twa-manifest.json`. Bubblewrap needs full URLs in four more fields (`fullScopeUrl`, `webManifestUrl`, `iconUrl`, `maskableIconUrl`), so the test fails if one differs from `host`. `assetlinks.json` holds no host (the file is served by the host). The guide names the host in the privacy URL only |
| App start URL | `/fish/?source=play` | `startUrl` |
| Display, orientation | `standalone`, `portrait` | `display`, `orientation` |
| minSdk | 24 | `minSdkVersion` |
| Target and compile SDK | 36 | `RULES.sdk` in `patch-android.mjs` (Bubblewrap hard-codes it in its template, so the patch asserts it) |
| Name, colours | "Reel It In", `#0d2f38` | `name`, `launcherName`, the colour fields |
| Version | 1.0.0, code 1 | `appVersion`, `appVersionName`, `appVersionCode` |
| Upload key | `~/.android/reelitin-upload.keystore`, `reelitin` | `BUBBLEWRAP_KEYSTORE`, `BUBBLEWRAP_KEY_ALIAS` (the file path in `twa-manifest.json` is a note: the script writes the real path into the project's copy) |
| Tool pins | Bubblewrap 1.25.0, JDK 17.0.11+9, command-line tools 11076708, build-tools 36.1.0 and 35.0.0, `android-36`, `platform-tools` | The top of `build-aab.sh`. `qa/fish/play.mjs` pins the same values, so a change needs a change in both |

## The build

1. Check the arguments and the key location, before anything is downloaded.
2. Find or download Temurin JDK 17 (Bubblewrap rejects JDK 21), install the Bubblewrap CLI, the command-line tools and the four SDK packages into `play/.tools`. Gradle uses a private home, `play/.tools/gradle-home`, so deleting `play/.tools` removes everything the script downloaded.
3. Make or open the signing key (see below).
4. Copy `twa-manifest.json` into the project folder with the key path, and with `--local` the download URLs of a local server over `PLAY_PUBLIC` (default `public/`). Ask for each URL before Bubblewrap runs, because Bubblewrap fails late with a poor message.
5. `bubblewrap update --skipVersionUpgrade`, then (with `--local`) write the live host back into the web manifest URL resource, then `patch-android.mjs`.
6. Delete old outputs, then `bubblewrap build` (up to four tries, 10 s apart). Bubblewrap builds the APK (`assembleRelease`, zipalign, apksigner) and the bundle (`bundleRelease`, jarsigner). The key path comes from the project's manifest, which Bubblewrap quotes. The script does not pass `--signingKeyPath`, because Bubblewrap does not quote that value.
7. Copy the outputs, verify them, write the fingerprint file, print the next steps.
8. On exit, stop the Gradle daemon of the private Gradle home and delete the temporary files.

`bubblewrap init` has no flag for its questions, so the manifest is written by hand and `update` generates the project. `bubblewrap build` asks a question when `manifest-checksum.txt` is missing or stale, so the script always runs `update` first.

## What the script checks

`verify-output.mjs` reads three things and compares them with `twa-manifest.json`:

- `aapt2 dump badging` of the APK: package, version code and name, minSdk, targetSdk, `uses-permission`, label.
- `aapt2 dump resources` of the APK: the launch URL, the scope URL, the host, the web manifest URL, the orientation, the fallback type and `enableNotification`. The web manifest URL proves that `--local` did not leave a local address in the app.
- The manifest of the bundle (`base/manifest/AndroidManifest.xml`), which is protobuf. A first version looked for strings and found `android.permission.DUMP`. That is the `android:permission` guard on AndroidX's `ProfileInstallReceiver`, not a request. So the script reads the protobuf with a small reader (`XmlNode`, `XmlElement`, `XmlAttribute` of aapt2's `Resources.proto`) and looks at `uses-permission` elements only. It also reads `uses-sdk`, `appCategory`, `allowBackup`, and the `data` of the `autoVerify` intent filter. Bubblewrap 1.25.0 writes `pathPrefix=/fish/` there from `fullScopeUrl`, so the app opens links to the scope only and not to the rest of the arcade.

The script also runs `apksigner verify --min-sdk-version <minSdk> --print-certs`, `jarsigner -verify` and `keytool -printcert -jarfile`, and compares both certificates with the one in the keystore. With minSdk 24, `apksigner` checks as a device with that level would, and shows a v2 and v3 signature.

## The upload key

The key is an RSA 2048 PKCS12 keystore. The rules:

- Refuse a keystore inside the repository (also by a relative path or a symlink), before any download. `.gitignore` also blocks the usual key and package files.
- Never print a password. The tools read passwords from environment variables (`-storepass:env`). The test scans the script for any output command that expands a password.
- Bubblewrap puts the passwords in double quotes in a shell command. So the script refuses `"`, `$`, a backtick, a backslash and a line break in a password and in the key path. It also refuses a short password.
- Make a missing key only in a terminal, after an explanation and a confirmation, with the password typed twice. In CI a missing keystore must stop the build, because a silent new key would give a fingerprint that Play does not know.
- Refuse a key with CN `Android Debug`, a copy of the script's own debug key (its name says `NEVER UPLOAD`), and a key under 2048 bits.
- `--debug-key` uses a throwaway key in `play/.tools/debug` with the public password `android`. It keeps a stable fingerprint, so `adb install -r` works from one development build to the next. The names of its files hold `DEBUGKEY`, and the script prints a loud line at the start and at the end.

## SDK licenses

The first version of the script, like `quest/build-apk.sh`, ran `sdkmanager --licenses`. That accepts seven licenses, among them the Google TV, Android XR, Glass and MIPS image licenses, which the build does not need. The script now runs `sdkmanager` with the four packages. `sdkmanager` asks about the licenses of those packages only (in practice the Android SDK License Agreement). In a terminal the person answers. With `ACCEPT_ANDROID_SDK_LICENSES=yes` the script answers yes and writes the text to `play/.tools/sdkmanager.log`. The workflow sets the flag, so running the workflow is the owner's acceptance. A person must read the license (<https://developer.android.com/studio/terms>) before that.

## The Digital Asset Links tool

`assetlinks.json` is one list for the whole host. Each Android app has its own entry. Google reads the whole file, and **a malformed fingerprint anywhere makes the whole file invalid**. The live file has such a value today: the Quest entry holds `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`. Google answers `ERROR_CODE_MALFORMED_CONTENT` for the host (checked on 2026-10-03). Until the Quest owner replaces it, the fish app fails verification as well.

The brief forbids a change to that entry, because `qa/vr/pwa.mjs` checks it. So:

- The tool never adds a placeholder for the fish app, and refuses one.
- The tool warns about any malformed value in the file in every run, and the test prints the same warning. The warning says that the owner of that app must replace the value.
- `--package <id>` lets the Quest owner do it with the same tool. The tool drops a malformed value from the entry that it edits, and writes the real one.

The tool treats the entry as a list of trusted keys. `--upload` puts a key first, `--play` puts it last, `--remove` takes one out. It accepts a fingerprint in lower case or without colons and writes it in the strict form. It refuses a value with fewer than 8 different bytes, because a real SHA-256 never looks like that. It refuses a duplicate with exit code 1 and writes nothing. It writes the file in the style of the existing file (2 spaces, short string lists on one line), so an untouched file gives the same bytes and other entries do not change in `git diff`.

`--check` asks `https://digitalassetlinks.googleapis.com/v1/statements:list` for the host. The live answers of 2026-10-03 had these shapes: `errorCode` and `debugString` for a bad file, `statements[].target.androidApp.{packageName, certificate.sha256Fingerprint}` for a good one (seen for other hosts), and an `error` object for a bad query. The answer carries `maxAge` of about 600 seconds. It also reads the file from the host and checks the status, the content type and the redirect, because Google needs HTTP 200, `application/json` and no redirect.

## The workflow

It runs only on `workflow_dispatch`, with the permission `contents: read`. The first step checks that the secrets are not empty, before any download. The keystore goes to `$RUNNER_TEMP` with `umask 077`, and its path goes to later steps through `$GITHUB_ENV`. Secrets reach steps through `env` only, so a secret is never inside a script text. The workflow uses `printf`, not `echo`, and never `set -x`. A last step that always runs deletes the key file. It builds with `--local`, so the icons and the web manifest in the bundle come from the commit that the run built. It uploads the bundle and the fingerprint file for 7 days. Actions are pinned to major tags (`@v4`). It runs `node qa/fish/play.mjs` first.

## The test

`qa/fish/play.mjs` has no dependency and needs no network. Each check is a function that returns a list of problems. The test runs it on the real file, and then on broken copies from a table. A check that does not report its broken copy fails the test. The workflow file is read with a small YAML reader written for the subset it uses (checked against PyYAML once, by hand). The bundle manifest fixture is built with a small protobuf encoder, so no binary file is in git. The test also runs the command lines (`assetlinks.mjs`, `patch-android.mjs`, `verify-output.mjs`, and `build-aab.sh --help` and its refusals) on a scratch folder.

## What this change needs from the web package

- `public/fish/manifest.webmanifest` with scope `/fish/`, the same theme and background colour, orientation `portrait`, and icons `icons/icon-512.png` and `icons/maskable-512.png` (512 px or more, PNG). The test compares them with `twa-manifest.json` as soon as the file exists.
- `public/fish/privacy.html` for the Play forms, and the service worker, the self-hosted three.js and fonts, so that the game starts offline.
- App mode for `?source=play`: no "Switch game", no "Back to the arcade", no fullscreen buttons.
- A `webManifestUrl` that answers HTTP 200 on the live host before the first build without `--local`.

## Open items

UNCONFIRMED (no source checked, or not proven here):

- Whether Chrome rejects the whole `assetlinks.json` for a malformed value, as Google's API does.
- Whether a failed check shows a URL bar or crashes the app.
- Whether the Play app signing fingerprint works as the Console shows it.
- The practical Chrome floor (about version 89).
- Whether organization accounts skip the closed test.
- The review times, and the EU trader status.
- Whether the host's server logs go into the Data safety form, and the IARC result.
- The date of the next target SDK increase, and the steps to reset an upload key.
- What happens to `fish.v1` when the app is uninstalled.

DEVICE (needs a phone; none was available):

- The TWA starts with no URL bar, and `display-mode` inside the TWA.
- The motion event rate, and a blocked sensor setting.
- Wake lock, vibration and the Back button.
- Insets and cutouts, and the lake after 10 minutes in the background.
- Offline start and offline video.
- The portrait lock on a tablet, and the site settings shortcut.
- Fullscreen against standalone, and the update flow.

The full table is in `play/fish/README.md`.

Risks: Maven Central may answer HTTP 429 (seen in the sandbox; the script retries). Downloads are pinned by version, not by checksum. Bubblewrap puts the passwords on a command line for a moment. The host is part of the app.

## Deviations from the brief

- `--debug-key` output names carry `-DEBUGKEY` (for example `reelitin-1.0.0-1-DEBUGKEY.aab`), so nobody uploads one by mistake.
- The script accepts the licenses of the four packages only, not all seven (see above).
- `PLAY_PUBLIC` (default `public`) tells `--local` which site files to serve. It lets a test use stand-in files.
- `verify-output.mjs` is a file that the brief did not list. It holds the output checks so that the test can run them on fixtures.
- The workflow always builds with `--local` and has one input, `note`.
- `vercel.json` is unchanged. The `Content-Type` rule for `assetlinks.json` is already there.
- `android.suppressUnsupportedCompileSdk` is not set. The build needs no such flag: Android Gradle Plugin 8.9.1 built with compileSdk 36 and printed no warning about it.

## Validation

The OpenSpec CLI is not installed in this sandbox, so `openspec validate` did not run. `qa/fish/play.mjs` checks the structure of `specs/fish-play-app/spec.md` (the `## ADDED Requirements` heading, a SHALL in each requirement, and a WHEN and THEN in each scenario). That is not the CLI's validation.

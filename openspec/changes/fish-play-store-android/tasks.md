# Tasks

## Android build

- [x] Write `play/fish/twa-manifest.json` for `@bubblewrap/cli` 1.25.0: package, one host, scope `/fish/`, start URL `/fish/?source=play`, standalone, portrait, colours, minSdk 24, no notification, no feature, versions, signing key name, and no Meta-only field.
- [x] Write `play/fish/patch-android.mjs`: stop unless compileSdk and targetSdk are 36, add `appCategory="game"` and `allowBackup="false"`, add no permission.
- [x] Write `play/fish/build-aab.sh` with the pins, `--local`, `--debug-key`, `--out`, `PLAY_TOOLS`, `JAVA17_HOME`, the key rules, the licence rule, the retry, and the checks.
- [x] Write `play/fish/verify-output.mjs`: badging, resources and the protobuf manifest of the bundle.
- [x] Write `play/.gitignore` for the tools, the project, the outputs and every key file.
- [x] Run the build for real in the sandbox with `--local --debug-key` (see the record below). Fix what it shows: the permission check misread `android.permission.DUMP`, the minSdk key of aapt2, the licenses (now narrow), the Maven 429 (retry).
- [x] Run the build with a real (not debug) key made by the script in a terminal, and check the refusals: key in the repo (relative, absolute, symlink), no key and no terminal, wrong password, a password with `$`, an Android debug key, a copy of the script's debug key, a 1024-bit key.
- [x] Find out whether `android.suppressUnsupportedCompileSdk` is needed. It is not.

## Digital Asset Links

- [x] Write `play/fish/assetlinks.mjs`: `--upload`, `--play`, `--remove`, `--print`, `--check`, `--file`, `--package`.
- [x] Keep the Full Swing placeholder as it is, and warn about it in the tool, in the test and in the guide.
- [x] Do not add a fingerprint for the fish app to `public/.well-known/assetlinks.json`. There is no real fingerprint yet.
- [ ] Owner: build with the upload key, run `--upload`, deploy.
- [ ] Owner: after the first upload, copy the Play app signing SHA-256 and run `--play`, deploy.
- [ ] Quest owner: replace the placeholder in the Full Swing entry.
- [ ] Owner: run `node play/fish/assetlinks.mjs --check` after the deploy and read the answer.

## Workflow

- [x] Write `.github/workflows/play-aab.yml`: manual, secrets only through `env`, key outside the workspace, deleted at the end, short retention, pinned actions.
- [x] Run the script path that the workflow uses (`build-aab.sh --local --out DIR` with a keystore and passwords from the environment, no terminal) in the sandbox.
- [ ] Run the workflow on GitHub. It has not run: the sandbox has no runner and no secrets.

## Test and documents

- [x] Write `qa/fish/play.mjs` and prove that each check fails on a broken input.
- [x] Write the guide `play/fish/README.md`.
- [x] Add the README section "Reel It In on Google Play" and the test row.
- [x] Write this change.
- [ ] Validate the spec with the OpenSpec CLI when it is available. It is not installed in the sandbox, so `openspec validate` did not run. `qa/fish/play.mjs` checks the structure only.
- [ ] Archive this change after the owner has published the app, and review `openspec/specs/`.

## DEVICE and owner steps (nothing here is done)

- [ ] Play account, verification, and the 12-tester, 14-day closed test (personal account).
- [ ] Make the upload key and back it up in two places.
- [ ] Create the app, fill in the App content forms, add the listing, upload to internal testing.
- [ ] Install from Play and check that the game starts with no URL bar.
- [ ] Do each row of the DEVICE checklist in `play/fish/README.md`.
- [ ] Decide the open points in the guide: account type, target audience, display mode, domain, store texts, support e-mail, Data safety answer for server logs.

## Build record (sandbox, 2026-10-03)

Everything below was run in a disposable Linux sandbox. Nothing ran on a phone, and the GitHub workflow did not run.

### Setup

- Linux 6.18 x86_64, Node 22.22.2. The system JDK is 21.0.10, which the script rejects, so it downloads Temurin 17.0.11+9.
- Stand-in site files for `--local` (made with a few lines of node in a scratch folder, not in git): a web manifest and three solid-colour PNG icons (192 px, 512 px, 512 px maskable). The app icons of these builds are solid squares for that reason. A later build used the real manifest and icons of the web side (see run 6).
- I accepted the Android SDK license in this disposable sandbox only to build, with `ACCEPT_ANDROID_SDK_LICENSES=yes`. The owner accepts it on their own computer, or by running the workflow. `sdkmanager` accepted one license, `android-sdk-license`, for the four packages.

### Versions that were used

| Part | Version |
|---|---|
| `@bubblewrap/cli`, `@bubblewrap/core` | 1.25.0 |
| JDK | Temurin 17.0.11+9 |
| Android command-line tools | 11076708 |
| SDK packages | `build-tools;36.1.0`, `build-tools;35.0.0`, `platforms;android-36` (revision 2), `platform-tools` 37.0.1 |
| Gradle (wrapper) | 8.11.1 |
| Android Gradle Plugin | 8.9.1 |
| `androidbrowserhelper` | 2.6.2 |

### What the first builds showed (all fixed)

- Maven Central answers HTTP 429 to the shared address of the sandbox, most often on a cold Gradle cache. The script now tries the build up to four times, 10 s apart.
- The permission check read `android.permission.DUMP` as a request. It is the `android:permission` guard on AndroidX's `ProfileInstallReceiver`. The check now reads the protobuf manifest of the bundle and looks at `uses-permission` elements only.
- `aapt2 dump badging` prints `minSdkVersion`, not `sdkVersion`, for this app. The check reads both.
- `sdkmanager --licenses` (as in `quest/build-apk.sh`) accepts seven licenses, among them licenses for products the build does not use. The script now installs the four packages and accepts the license of those only.

### Runs of the final script

| Run | Result |
|---|---|
| 1. Cold: empty tools folder, `--local --debug-key`, stand-in site files | Passed. 201 s in all, including the downloads. The first Gradle try failed with HTTP 429, and the second passed. The tools folder was 1.8 GB |
| 2. `gradlew assembleRelease --rerun-tasks` by hand, to see the Gradle warnings that Bubblewrap hides | BUILD SUCCESSFUL in 33 s. No warning about compileSdk 36, so `android.suppressUnsupportedCompileSdk` is not needed |
| 3. A real (not debug) key, made by the script in a pseudo-terminal (`script`), then the build | Passed. The key file got mode 600. The prompts did not echo, and the password is not in the log |
| 4. The `run:` blocks of `.github/workflows/play-aab.yml`, read with PyYAML and run in order with the shell flags of GitHub (key from a base64 value into a temporary folder, no terminal, passwords from the environment, an empty `BUBBLEWRAP_KEY_PASSWORD`, `build-aab.sh --local --out DIR`, the summary lines, the cleanup) | Passed. The build step took 68 s. No secret value appears in any output. The key file is gone at the end. The actions (`uses:`) did not run |
| 5. Refusals, each with a message and no build: no key and no terminal, no password and no terminal, a wrong password, a short password, a password with `$`, an alias with a space, an Android debug key, a copy of the script's own debug key, a 1024-bit key | All refused. The three cases of a key inside the repo (relative path, absolute path, symlink) are in `qa/fish/play.mjs` |
| 6. Dry-run merge of this branch with the `play-web` branch (`git merge-tree`, no worktree touched), then `node qa/fish/play.mjs` and a warm `--local --debug-key` build on that tree | No merge conflict. The test passed with the real `public/fish/manifest.webmanifest`, and the build passed in 47 s. The AAB was 2,017,468 bytes and the APK 1,916,381 bytes with the real icons |
| 7. `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/pwa.mjs` (the Quest checks of `assetlinks.json` and `vercel.json`) | Passed |
| 8. `node play/fish/assetlinks.mjs --check` against the live host | Exit 1, as expected: `ERROR_CODE_MALFORMED_CONTENT` for `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`, 0 statements |

### Outputs (run 1, stand-in icons)

| File | Size |
|---|---|
| `reelitin-1.0.0-1-DEBUGKEY.aab` | 934,453 bytes (it varies by a few bytes from run to run, because of the signature time) |
| `reelitin-1.0.0-1-DEBUGKEY.apk` | 835,037 bytes, 454 files |

`aapt2 dump badging` of the APK (the label lines for 60 locales and the density list are left out):

```
package: name='com.cottagearcade.reelitin' versionCode='1' versionName='1.0.0' platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36' compileSdkVersionCodename='16'
minSdkVersion:'24'
targetSdkVersion:'36'
uses-permission: name='com.cottagearcade.reelitin.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
application-label:'Reel It In'
application: label='Reel It In' icon='res/BW.xml'
launchable-activity: name='com.cottagearcade.reelitin.LauncherActivity'  label='Reel It In' icon=''
feature-group: label=''
  uses-feature: name='android.hardware.faketouch'
  uses-implied-feature: name='android.hardware.faketouch' reason='default feature for all apps'
supports-screens: 'small' 'normal' 'large' 'xlarge'
supports-any-density: 'true'
```

The one permission is AndroidX's internal `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` of the app's own package, a signature-level permission that asks the user for nothing. The bundle manifest (protobuf) has the same single `uses-permission`, `uses-sdk` 24 and 36, `appCategory=game`, `allowBackup=false`, and an `autoVerify` link filter with `pathPrefix=/fish/`. `aapt2 dump resources` shows `launchUrl` `https://warden-alpha-wheat.vercel.app/fish/?source=play`, `orientation` `portrait`, `fallbackType` `customtabs`, `enableNotification` `false`, and `webManifestUrl` on the live host although the build used `--local`.

`apksigner verify --verbose --print-certs --min-sdk-version 24` of the debug-key APK: `Verifies`, v1 false, v2 true, v3 true, one signer, RSA 2048, certificate SHA-256 digest `976d57086c78daedc2da3767ff4be6aa088c232e30ba0ccbc69380f9a5466dd1`. `zipalign -c -P 16 -v 4`: `Verification successful`. `jarsigner -verify` of the bundle: `jar verified` (with the usual note that the signature has no timestamp). The SHA-256 of the throwaway debug key, in the format `assetlinks.json` uses, was `97:6D:57:08:6C:78:DA:ED:C2:DA:37:67:FF:4B:E6:AA:08:8C:23:2E:30:BA:0C:CB:C6:93:80:F9:A5:46:6D:D1`. The sandbox keys are test keys. Nobody must put them in `assetlinks.json`.

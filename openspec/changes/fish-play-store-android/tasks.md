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

The record is below, in the order of the runs. See also `design.md`.

### Setup

- Linux 6.18 x86_64 sandbox, Node 22.22.2. The system JDK is 21.0.10, which the script rejected, so it downloaded Temurin 17.0.11+9.
- Stand-in site files for `--local` (made with a few lines of node, in a scratch folder, not in git): a web manifest and three solid-colour PNG icons (192 px, 512 px, 512 px maskable). The app icons in these builds are solid squares for that reason. The real manifest and icons belong to the web package and were not in this tree.
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

### Runs

| Run | Result |
|---|---|
| 1. Tools downloads only (JDK, CLI, command-line tools), no license flag | Stopped at the license step, as designed. 21 s |
| 2. First build, `--local --debug-key` | Gradle failed: Maven Central answered HTTP 429 for many POMs. The run showed the need for a retry |
| 3. Same command again | The build worked. The check then failed twice: it read `android.permission.DUMP` (a guard on AndroidX's `ProfileInstallReceiver`) as a permission, and it looked for `sdkVersion` where aapt2 prints `minSdkVersion`. Both fixed (protobuf reader, both keys) |
| 4. Same command, with the fixes | Passed. 41 s with the tools and the Gradle cache warm |
| 5. Cold run in an empty tools folder, `--local --debug-key` | Passed on the third of three tries (429 on the first two). 3 min 24 s in all, including the downloads. `play/.tools` is 1.8 GB: `cli` 169 MB, `jdk17` 317 MB, `android-sdk` 611 MB, `gradle-home` 672 MB |
| 6. A real key, made by the script through a pseudo-terminal (`script`), then the build | Passed. The key file got mode 600. The password prompts did not echo |
| 7. The workflow's steps in a shell: key from a base64 value into a temporary folder, no terminal, passwords from the environment, an empty `BUBBLEWRAP_KEY_PASSWORD`, `build-aab.sh --local --out DIR`, the summary lines | Passed. 58 s. The password text appears nowhere in the log |
| 8. Refusals | Passed: a key inside the repo (relative, absolute, symlink), no key and no terminal, a wrong password, a password with `$`, an Android debug key, a copy of the script's debug key, a 1024-bit key |
| 9. `gradlew assembleRelease --rerun-tasks` by hand | BUILD SUCCESSFUL in 31 s, and no warning about compileSdk 36, so `android.suppressUnsupportedCompileSdk` is not needed |

### Outputs

| File | Size |
|---|---|
| `reelitin-1.0.0-1.aab` | 934,428 bytes (it varies by a few bytes from run to run, because of the signature time) |
| `reelitin-1.0.0-1.apk` | 835,037 bytes, 454 files |

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

`apksigner verify --verbose --print-certs --min-sdk-version 24` of the debug-key APK: `Verifies`, v1 false, v2 true, v3 true, one signer, RSA 2048, SHA-256 digest `76647cb467a09211605c0e6f67cf949772c37f14f99ffa8012b8124603cb641c`. `zipalign -c -P 16 -v 4`: `Verification successful`. `jarsigner -verify` of the bundle: `jar verified`. The SHA-256 of the throwaway debug key, in the format `assetlinks.json` uses, was `76:64:7C:B4:67:A0:92:11:60:5C:0E:6F:67:CF:94:97:72:C3:7F:14:F9:9F:FA:80:12:B8:12:46:03:CB:64:1C`. The sandbox keys are test keys. Nobody must put them in `assetlinks.json`.

## ADDED Requirements

### Requirement: One place for each app setting
The Android settings of Reel It In SHALL live in `play/fish/twa-manifest.json`. The file SHALL name one host, and every absolute URL in it SHALL use that host. The file SHALL hold no Meta-only field. The scope SHALL be `/fish/`, and the start URL SHALL be inside the scope with `source=play`.

#### Scenario: Move to a custom domain
- **WHEN** the owner changes `host` and the four absolute URLs in `twa-manifest.json` to a new domain
- **THEN** `node qa/fish/play.mjs` passes, and it fails if one URL still has the old host

#### Scenario: Meta-only field
- **WHEN** `twa-manifest.json` gains `isMetaQuest`, `horizonOSAppMode`, `enableXRScene` or a `horizon` feature
- **THEN** the test fails and names the field

#### Scenario: Start URL outside the app
- **WHEN** the start URL points outside `/fish/` or has no `source=play`
- **THEN** the test fails

#### Scenario: Web manifest and app settings agree
- **WHEN** `public/fish/manifest.webmanifest` exists and its scope, theme colour, background colour, orientation or icons differ from `twa-manifest.json`
- **THEN** the test fails and names the difference

#### Scenario: Versions
- **WHEN** `appVersionCode` is not a whole number from 1 to 2100000000, or `appVersion` and `appVersionName` differ
- **THEN** the test fails

### Requirement: A signed bundle for Google Play
`play/fish/build-aab.sh` SHALL build a signed Android App Bundle and a signed APK from `twa-manifest.json`. It SHALL use `@bubblewrap/cli` 1.25.0, Temurin JDK 17.0.11+9, Android command-line tools 11076708, build-tools 36.1.0 and 35.0.0, `platforms;android-36` and `platform-tools`. The tools SHALL go into `play/.tools`. The app SHALL target and compile for API 36, and SHALL have minSdk 24. The app SHALL ask the user for no permission. The app SHALL open `https://<host>/fish/?source=play`.

#### Scenario: Build
- **WHEN** the build runs with an upload key
- **THEN** `play/fish/dist/` holds `reelitin-<versionName>-<versionCode>.aab`, the matching `.apk` and a `.fingerprint.txt`, and the script prints the SHA-256 of the upload key in the format `assetlinks.json` uses

#### Scenario: Target SDK
- **WHEN** Bubblewrap generates a compile or target SDK other than 36
- **THEN** the patch step stops the build before it builds, and the manifest is not changed

#### Scenario: The app has no permission
- **WHEN** the build ends
- **THEN** the APK badging and the bundle manifest list at most the one AndroidX internal permission `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, and the build fails on any other `uses-permission`

#### Scenario: A game on a large screen
- **WHEN** the bundle is built
- **THEN** its `<application>` has `android:appCategory="game"` and `android:allowBackup="false"`. Android 16 keeps the portrait lock of a game on screens of 600 dp or more. UNCONFIRMED (DEVICE): in a Trusted Web Activity, Chrome's activity draws the game, so nobody has shown that the attribute keeps the lock. No tablet test has run

#### Scenario: JDK 21 on the machine
- **WHEN** the machine has only JDK 21
- **THEN** the script downloads Temurin 17.0.11+9 into `play/.tools/jdk17`
- **AND** it uses that JDK for the build only, and leaves the system JDK alone

#### Scenario: Web files not deployed
- **WHEN** the script runs without `--local` and the live web manifest or an icon does not answer HTTP 200
- **THEN** the script stops before it generates the project and names the missing URL

#### Scenario: Before the web files are deployed
- **WHEN** the script runs with `--local`
- **THEN** it serves the site files of this checkout on a local port for the icons and the web manifest, and the built app still points at the live host

#### Scenario: Network trouble
- **WHEN** Gradle fails because Maven Central answers HTTP 429
- **THEN** the script tries the build again, up to four times in all

### Requirement: The build checks what it built
After the build, the script SHALL check the APK and the bundle against `twa-manifest.json` and SHALL stop on any difference.

#### Scenario: Checks
- **WHEN** the build ends
- **THEN** the script compares package id, version code and name, minSdk, targetSdk and app label with `twa-manifest.json`
- **AND** it compares the launch URL, orientation, scope and web manifest URL
- **AND** it checks the permissions, `appCategory` and `allowBackup`, and that the app links open only the scope
- **AND** it reads `aapt2 dump badging`, `aapt2 dump resources` and the protobuf manifest of the bundle

#### Scenario: Signatures
- **WHEN** the build ends
- **THEN** `apksigner verify --min-sdk-version <minSdk>` and `jarsigner -verify` succeed, and the certificate of the APK and of the bundle both equal the certificate in the keystore

#### Scenario: Broken output
- **WHEN** a fixture has target SDK 35, an extra permission, a missing `appCategory`, a link filter for the whole host, a local web manifest URL or another launch URL
- **THEN** the check reports that exact problem

### Requirement: The upload key stays safe
The script SHALL never print a password, SHALL never write a secret into the repository, and SHALL refuse a keystore inside the repository. This includes what Bubblewrap prints: a failed signing step prints the whole command, and the script SHALL hide both passwords in that output and keep the exit status of Bubblewrap.

#### Scenario: Keystore in the repository
- **WHEN** `BUBBLEWRAP_KEYSTORE` points inside the repository, by a relative path, an absolute path or a symlink
- **THEN** the script stops with "inside the repository" before it downloads anything

#### Scenario: No password in any output
- **WHEN** the script runs
- **THEN** no line of its output holds a password, passwords reach the tools through the environment (`-storepass:env`), and the test finds no command in the script that prints a password

#### Scenario: A failed signing step
- **WHEN** `bubblewrap build` fails and prints a command that holds both passwords
- **THEN** the output shows `********` in place of each password, and the text around it is as Bubblewrap printed it
- **AND** the build function returns the exit status of Bubblewrap, so the retry loop still retries
- **AND** a password with regular-expression characters, or cut in two by the output chunks, is hidden as well

#### Scenario: Passwords that Bubblewrap cannot pass
- **WHEN** a password or the key path holds `"`, `$`, a backtick, a backslash or a line break
- **THEN** the script refuses it and says why

#### Scenario: A space in a path
- **WHEN** the tools folder (`PLAY_TOOLS`, or `play/.tools` in a checkout whose path has a space) or the key path holds a space or a tab
- **THEN** the script stops at the start, before any download, and names the setting to change: Bubblewrap runs `apksigner` and `jarsigner` through a shell and does not put these paths in quotes

#### Scenario: No key yet
- **WHEN** the keystore does not exist and a terminal is open
- **THEN** the script explains what the upload key is and how to keep it, and asks for confirmation
- **AND** it asks for a new password twice, and makes an RSA 2048 key with `chmod 600`
- **AND** it tells the owner to back the key up

#### Scenario: No key and no terminal
- **WHEN** the keystore does not exist and no terminal is open
- **THEN** the script stops and makes no key

#### Scenario: A key that Google Play rejects
- **WHEN** the keystore holds an Android debug key, a copy of this script's own debug key, or an RSA key under 2048 bits
- **THEN** the script stops with the reason

#### Scenario: Debug key
- **WHEN** the script runs with `--debug-key`
- **THEN** it signs with a throwaway key in `play/.tools/debug`, prints a loud line that the bundle can never be uploaded to Google Play, and puts `DEBUGKEY` in the file names

### Requirement: SDK licenses are accepted on purpose
The script SHALL accept an Android SDK license only in a terminal, where `sdkmanager` asks, or when `ACCEPT_ANDROID_SDK_LICENSES=yes` is set. It SHALL accept the licenses of the packages it installs, and no other license.

#### Scenario: No terminal, no flag
- **WHEN** the SDK packages are missing, no terminal is open and the flag is not `yes`
- **THEN** the script stops before it installs a package and says where the license text is

#### Scenario: The flag
- **WHEN** `ACCEPT_ANDROID_SDK_LICENSES=yes` is set
- **THEN** `sdkmanager` installs the four packages, accepts their license only, and writes its text to `play/.tools/sdkmanager.log`

### Requirement: The Digital Asset Links entry
`play/fish/assetlinks.mjs` SHALL add, remove and print the entry for `com.cottagearcade.reelitin` in `public/.well-known/assetlinks.json`, with the upload key and the Play app signing key in one entry. It SHALL leave every other entry as it is, and SHALL keep the file a valid JSON list.

#### Scenario: Add the upload key
- **WHEN** the owner runs `--upload <SHA-256>` and the file has no entry for the app
- **THEN** the file gains one entry with `delegate_permission/common.handle_all_urls`, namespace `android_app` and that fingerprint, and the text of the other entries does not change

#### Scenario: Add the Play key
- **WHEN** the owner then runs `--play <SHA-256>`
- **THEN** the same entry holds both fingerprints, the upload key first

#### Scenario: Not a fingerprint
- **WHEN** the value is a placeholder such as `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`, is not 32 pairs of hex digits, or has fewer than 8 different bytes
- **THEN** the tool refuses it, exits with 1, and does not write the file

#### Scenario: Duplicate
- **WHEN** the entry already holds the fingerprint, or the file has two entries for the app
- **THEN** the tool refuses and does not write the file

#### Scenario: Style of the file
- **WHEN** the tool writes the file
- **THEN** the fingerprints are in capitals with colons, the file keeps two-space indentation, and writing an untouched file gives the same bytes

#### Scenario: The Quest placeholder
- **WHEN** another entry holds a malformed fingerprint, such as the Full Swing placeholder
- **THEN** the tool leaves that entry as it is
- **AND** it prints a warning in every run: Google rejects the whole file because of this value, so the fish app fails verification too
- **AND** the warning says that the owner of that app must replace the value

#### Scenario: Replace the Quest placeholder
- **WHEN** the Quest owner runs `--package com.cottagearcade.fullswing --upload <SHA-256>`
- **THEN** the placeholder is replaced by the real fingerprint and the warning goes away

#### Scenario: Check what Google reads
- **WHEN** the owner runs `--check`
- **THEN** the tool reads the file from the host and checks for HTTP 200, `application/json` and no redirect
- **AND** it asks `digitalassetlinks.googleapis.com` for the host, and prints the statements and any error code
- **AND** it exits with 1 when Google reports an error, lists no fingerprint for the app, or does not yet list a fingerprint of the local file

### Requirement: A manual workflow that builds from secrets
`.github/workflows/play-aab.yml` SHALL run only when started by hand. It SHALL build a signed bundle with the secrets `PLAY_UPLOAD_KEYSTORE_BASE64`, `PLAY_UPLOAD_KEYSTORE_PASSWORD` and the optional `PLAY_UPLOAD_KEY_PASSWORD`.

#### Scenario: Run
- **WHEN** the owner starts the workflow
- **THEN** it checks out, sets up Node 22 and Temurin 17, and runs `node qa/fish/play.mjs`
- **AND** it writes the keystore to a temporary file outside the workspace, and runs `play/fish/build-aab.sh --local` with `ACCEPT_ANDROID_SDK_LICENSES=yes`
- **AND** it uploads the `.aab` and the fingerprint file as an artifact for 7 days

#### Scenario: Secrets
- **WHEN** the workflow runs
- **THEN** every secret reaches a step through `env`, no step prints one, nothing runs with `set -x`, and a last step that always runs deletes the keystore

#### Scenario: Missing secret
- **WHEN** a required secret is empty
- **THEN** the workflow stops in its first step, before it checks out or downloads anything, and names the secrets to add

#### Scenario: Other triggers
- **WHEN** someone pushes a commit or opens a pull request
- **THEN** the workflow does not run

#### Scenario: Pinned actions
- **WHEN** the workflow file uses an action
- **THEN** the action is pinned to a major version tag, and the test fails for a branch name or a full version

### Requirement: The owner can do every step
`play/fish/README.md` SHALL give the steps from the Play account to the closed test, in order. It SHALL give the answers for the Play forms and the rule for which changes need a new bundle. It SHALL give the `adb logcat` commands. It SHALL hold the DEVICE checklist as a table, a table of every file in `play/fish`, and a table of the owner decisions with their defaults.

#### Scenario: Unproven items
- **WHEN** a fact comes from a source that nobody checked, or needs a phone
- **THEN** the guide marks it UNCONFIRMED or DEVICE, and states no promise about Google's review

#### Scenario: Which changes need a new bundle
- **WHEN** the owner changes `twa-manifest.json` or the Android project
- **THEN** the guide says to raise `appVersionCode`, build again with the same key and upload a bundle

#### Scenario: Website change
- **WHEN** the owner changes a file under `public/fish/`
- **THEN** the guide says that no new bundle is needed, and that the service worker brings the change on the next launch

### Requirement: Every check can fail
`qa/fish/play.mjs` SHALL run with node only (no network, no browser, no Android tools). For each check it SHALL also run the check on a broken input and require a failure.

#### Scenario: Run
- **WHEN** `node qa/fish/play.mjs` runs from the repo root
- **THEN** it prints PASS for each group, prints a WARNING for the Full Swing placeholder, and exits with 0

#### Scenario: A broken input passes
- **WHEN** a check accepts its broken input
- **THEN** the test fails and names the input that it missed

#### Scenario: Secrets in git
- **WHEN** `git check-ignore` is run for a keystore, an APK, a bundle, the tools folder, the generated project and the output folder under `play/`
- **THEN** git ignores each one, and no such file is tracked
